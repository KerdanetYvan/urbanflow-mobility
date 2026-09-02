import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GtfsRealtimeCacheService } from '../gtfs-realtime/gtfs-realtime-cache.service';
import type { RealtimeDisruption } from '../gtfs-realtime/interfaces/realtime-disruption.interface';
import { PushNotificationService } from '../push/push-notification.service';
import type { FollowedTrip } from '../trips/following/followed-trip.entity';
import { FollowedTripService } from '../trips/following/followed-trip.service';
import { TripsService } from '../trips/trips.service';

/** Texte affiche a l'usager quand une alerte operateur n'a pas de headerText exploitable (rare, voir GtfsRealtimeClientService#fetchAlertDisruptions). */
const GENERIC_ALERT_BODY = 'Une perturbation affecte votre trajet.';

/**
 * Declenche le recalcul et la notification push quand une perturbation
 * touche le trajet actuellement suivi par un utilisateur (issue #18,
 * docs/specs/f3-scoring-perturbations.md section 3 +
 * docs/specs/f3-scoring-perturbations-suivi.md).
 *
 * Cycle propre (pas d'evenement emis par GtfsRealtimeCacheService, voir sa
 * docstring) : ce service tourne sur son propre `@Cron(EVERY_MINUTE)`,
 * independant de celui qui rafraichit le cache GTFS-Realtime - au pire un
 * decalage d'une minute entre une perturbation publiee par l'operateur et
 * sa detection ici, largement suffisant pour cette fonctionnalite (aucune
 * exigence de reactivite sub-minute dans la spec).
 */
@Injectable()
export class TripDisruptionMonitorService {
  private readonly logger = new Logger(TripDisruptionMonitorService.name);

  constructor(
    private readonly followedTripService: FollowedTripService,
    private readonly gtfsRealtimeCache: GtfsRealtimeCacheService,
    private readonly tripsService: TripsService,
    private readonly pushNotificationService: PushNotificationService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async checkFollowedTrips(): Promise<void> {
    const followedTrips = await this.followedTripService.findAllActive();
    if (followedTrips.length === 0) return;

    // Chaque suivi est independant (utilisateur different, perturbation
    // potentiellement differente) - Promise.all plutot qu'une boucle
    // sequentielle, un suivi lent (recalcul OTP) ne doit pas retarder les
    // autres.
    await Promise.all(
      followedTrips.map((followedTrip) => this.checkOne(followedTrip)),
    );
  }

  private async checkOne(followedTrip: FollowedTrip): Promise<void> {
    const disruption = this.findFirstDisruption(followedTrip);
    if (!disruption) return;

    const signature = this.signature(disruption);
    // Anti-spam (docs/specs/f3-scoring-perturbations-suivi.md section 4) :
    // meme perturbation deja notifiee pour ce suivi -> rien a refaire, tant
    // que la situation n'a pas change.
    if (signature === followedTrip.lastNotifiedDisruptionSignature) return;

    this.logger.log(
      `Perturbation detectee sur le suivi ${followedTrip.id} (${disruption.kind}) - recalcul + notification`,
    );

    // Critere d'acceptation #1 (#14 -> #18) : declenche le recalcul. Le
    // nouveau classement integre deja la penalite de perturbation
    // (ScoringService#hasActiveDisruption, cablee au meme cache GTFS-Realtime)
    // - critere d'acceptation #3 satisfait par construction, pas de logique
    // dupliquee ici. Le resultat lui-meme n'est pas retransmis dans la
    // notification (section 3.2 du spec : jamais de detail du score) - le
    // frontend le recuperera via son propre GET /trips a l'ouverture de
    // l'app suite au tap (section 3.3).
    await this.tripsService.search(
      {
        originLat: followedTrip.originLat,
        originLon: followedTrip.originLon,
        destinationLat: followedTrip.destinationLat,
        destinationLon: followedTrip.destinationLon,
        transportModes: followedTrip.transportModes ?? undefined,
      },
      followedTrip.userId,
    );

    // Critere d'acceptation #2 : notification push.
    await this.pushNotificationService.notifyUser(followedTrip.userId, {
      title: 'Perturbation sur votre trajet',
      body: this.buildNotificationBody(disruption),
    });

    await this.followedTripService.recordNotifiedDisruption(
      followedTrip.id,
      signature,
    );
  }

  /**
   * Premiere perturbation trouvee en parcourant les segments du suivi, dans
   * leur ordre d'origine (le premier segment perturbe rencontre sur le
   * trajet, pas necessairement "la pire") - suffisant pour declencher
   * recalcul + notification, la spec ne demande pas de hierarchiser
   * plusieurs perturbations simultanees sur un meme trajet (cas marginal).
   */
  private findFirstDisruption(
    followedTrip: FollowedTrip,
  ): RealtimeDisruption | undefined {
    for (const segment of followedTrip.segments) {
      const [match] = this.gtfsRealtimeCache.findDisruptions({
        routeId: segment.routeId,
        tripId: segment.tripId,
      });
      if (match) return match;
    }
    return undefined;
  }

  /** Signature anti-spam (section 4 de la spec de cadrage) - deux perturbations avec la meme signature sont considerees comme "la meme situation persistante". */
  private signature(disruption: RealtimeDisruption): string {
    return [
      disruption.kind,
      disruption.routeId ?? '',
      disruption.tripId ?? '',
      disruption.stopId ?? '',
      disruption.headerText ?? '',
    ].join('|');
  }

  /**
   * Corps de la notification (section 3.2 du spec principal) - jamais de
   * jargon technique ni de code GTFS-RT brut. Pour une alerte operateur,
   * son `headerText` (deja redige pour un usager, ex. "Rénovation ascenseur
   * - Triangle") est le texte le plus concret disponible. Pour une
   * annulation/un arret saute, pas de nom de ligne exploitable ici
   * (RealtimeDisruption ne porte que des identifiants GTFS bruts, jamais un
   * libelle - voir GtfsRealtimeClientService) : phrase generique plutot que
   * d'exposer un identifiant technique.
   */
  private buildNotificationBody(disruption: RealtimeDisruption): string {
    switch (disruption.kind) {
      case 'alert':
        return disruption.headerText ?? GENERIC_ALERT_BODY;
      case 'cancellation':
        return 'Une course de votre trajet est annulée - un nouvel itinéraire est disponible.';
      case 'skipped_stop':
        return 'Un arrêt de votre trajet est supprimé - un nouvel itinéraire est disponible.';
    }
  }
}

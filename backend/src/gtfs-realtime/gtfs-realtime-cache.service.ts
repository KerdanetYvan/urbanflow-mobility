import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GtfsRealtimeClientService } from './gtfs-realtime-client.service';
import type { RealtimeDisruption } from './interfaces/realtime-disruption.interface';

/**
 * Flux GTFS-Realtime reels de la metropole (STAR Rennes, verifies en
 * session via transport.data.gouv.fr - dataset "Reseau urbain STAR").
 * Memes raisonnement de valeurs par defaut codees en dur que
 * DEFAULT_GTFS_SOURCE_URL/DEFAULT_GBFS_DISCOVERY_URL : des flux reels
 * plutot que des exemples, surchargeables via .env.
 */
const DEFAULT_TRIP_UPDATES_URL =
  'https://proxy.transport.data.gouv.fr/resource/star-rennes-integration-gtfs-rt-trip-update';
const DEFAULT_ALERTS_URL =
  'https://proxy.transport.data.gouv.fr/resource/star-rennes-integration-gtfs-rt-alerts';

/**
 * Cache memoire des perturbations GTFS-Realtime (issue #14) - abonnement
 * technique + detection. Rafraichi periodiquement (comme GbfsCacheService,
 * issue #13) plutot qu'interroge a chaque appel : la "detection" (critere
 * d'acceptation de #14) s'appuie sur ce cache, jamais sur un appel reseau a
 * la demande.
 *
 * TripUpdate et Alerts sont rafraichis et degrades INDEPENDAMMENT (une
 * source en panne ne prive pas l'autre) - meme esprit que PlacesService
 * (arrets/adresses). Difference volontaire avec GbfsCacheService (issue
 * #13) sur la regle de degradation : GbfsClientService/GtfsRealtimeClient
 * distinguent explicitement "echec de recuperation" (`null`, cache
 * precedent conserve) de "recupere avec succes, 0 resultat" (`[]`, cache
 * remplace) - contrairement aux stations GBFS, une metropole SANS aucune
 * perturbation en cours est l'etat normal et frequent, pas un signe de
 * panne : un simple "tableau vide => panne supposee" serait faux ici et
 * ferait perdurer une perturbation resolue indefiniment.
 *
 * Pas de controller HTTP : contrairement a GbfsModule (consomme
 * directement par le frontend), ce cache est une brique interne destinee a
 * etre interrogee par un futur consommateur backend (issue #18 - recalcul
 * + notification push sur perturbation du trajet suivi), pas encore
 * exposee au frontend a ce stade.
 */
@Injectable()
export class GtfsRealtimeCacheService implements OnModuleInit {
  private readonly logger = new Logger(GtfsRealtimeCacheService.name);
  private tripUpdateDisruptions: RealtimeDisruption[] = [];
  private alertDisruptions: RealtimeDisruption[] = [];

  constructor(
    private readonly gtfsRealtimeClient: GtfsRealtimeClientService,
    private readonly configService: ConfigService,
  ) {}

  /** Premier chargement au demarrage - une detection doit etre possible des la premiere requete, sans attendre jusqu'a une minute le premier @Cron. */
  async onModuleInit(): Promise<void> {
    await this.refresh();
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async refresh(): Promise<void> {
    const tripUpdatesUrl = this.configService.get<string>(
      'GTFS_RT_TRIP_UPDATES_URL',
      DEFAULT_TRIP_UPDATES_URL,
    );
    const alertsUrl = this.configService.get<string>(
      'GTFS_RT_ALERTS_URL',
      DEFAULT_ALERTS_URL,
    );

    const [tripUpdates, alerts] = await Promise.all([
      this.gtfsRealtimeClient.fetchTripUpdateDisruptions(tripUpdatesUrl),
      this.gtfsRealtimeClient.fetchAlertDisruptions(alertsUrl),
    ]);

    if (tripUpdates === null) {
      this.logger.warn(
        'Echec de rafraichissement du flux TripUpdate - conservation des dernieres perturbations connues',
      );
    } else {
      this.tripUpdateDisruptions = tripUpdates;
    }

    if (alerts === null) {
      this.logger.warn(
        'Echec de rafraichissement du flux Alerts - conservation des dernieres alertes connues',
      );
    } else {
      this.alertDisruptions = alerts;
    }

    this.logger.log(
      `Cache GTFS-Realtime rafraichi : ${this.tripUpdateDisruptions.length} perturbation(s) TripUpdate, ${this.alertDisruptions.length} alerte(s) active(s)`,
    );
  }

  /**
   * Detection (critere d'acceptation de #14) : perturbations actuellement
   * connues pour une ligne (`routeId`) et/ou une course (`tripId`) donnee -
   * conçue pour etre interrogee segment par segment par un futur
   * consommateur (#18) une fois qu'un TripSegment portera les identifiants
   * GTFS bruts renvoyes par OpenTripPlanner (`route.id`/`trip.gtfsId`, pas
   * encore mappes sur TripSegment a ce jour - voir OtpLeg,
   * trips.service.ts).
   */
  findDisruptions({
    routeId,
    tripId,
  }: {
    routeId?: string;
    tripId?: string;
  }): RealtimeDisruption[] {
    if (!routeId && !tripId) return [];
    return this.getAllDisruptions().filter(
      (disruption) =>
        (routeId !== undefined && disruption.routeId === routeId) ||
        (tripId !== undefined && disruption.tripId === tripId),
    );
  }

  /** Etat brut complet du cache (TripUpdate + Alerts confondus). */
  getAllDisruptions(): RealtimeDisruption[] {
    return [...this.tripUpdateDisruptions, ...this.alertDisruptions];
  }
}

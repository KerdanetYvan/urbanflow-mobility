import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { MobilityOperatorConfig } from '../operators/interfaces/mobility-operator-config.interface';
import { OperatorsService } from '../operators/operators.service';
import { GtfsRealtimeClientService } from './gtfs-realtime-client.service';
import type { RealtimeDisruption } from './interfaces/realtime-disruption.interface';

/** Perturbations connues d'UN operateur, TripUpdate et Alerts distincts (voir refresh - degradation independante par flux). */
interface OperatorDisruptionCache {
  tripUpdates: RealtimeDisruption[];
  alerts: RealtimeDisruption[];
}

/**
 * Cache memoire des perturbations GTFS-Realtime de TOUS les operateurs
 * configures (issue #14, generalise multi-operateur par issue #15) -
 * abonnement technique + detection. Rafraichi periodiquement (comme
 * GbfsCacheService, issue #13) plutot qu'interroge a chaque appel : la
 * "detection" (critere d'acceptation de #14) s'appuie sur ce cache, jamais
 * sur un appel reseau a la demande.
 *
 * Cache tenu **par operateur** (Map, pas un simple tableau plat) : un echec
 * transitoire d'UN operateur ne doit affecter que ses propres perturbations
 * en cache, jamais celles des autres operateurs deja a jour - un simple
 * tableau global naif perdrait les donnees d'un operateur B toujours en
 * ligne des qu'un operateur A tombe en panne, si on remplacait tout le
 * tableau par le seul resultat de A.
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
 * directement par le frontend), ce cache est une brique interne consommee
 * par TripDisruptionMonitorService/ScoringService (issue #18).
 */
@Injectable()
export class GtfsRealtimeCacheService implements OnModuleInit {
  private readonly logger = new Logger(GtfsRealtimeCacheService.name);
  private readonly perOperator = new Map<string, OperatorDisruptionCache>();

  constructor(
    private readonly gtfsRealtimeClient: GtfsRealtimeClientService,
    private readonly operatorsService: OperatorsService,
  ) {}

  /** Premier chargement au demarrage - une detection doit etre possible des la premiere requete, sans attendre jusqu'a une minute le premier @Cron. */
  async onModuleInit(): Promise<void> {
    await this.refresh();
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async refresh(): Promise<void> {
    const operators = this.operatorsService.getOperators();
    await Promise.all(
      operators.map((operator) => this.refreshOperator(operator)),
    );

    this.logger.log(
      `Cache GTFS-Realtime rafraichi : ${this.getAllDisruptions().length} perturbation(s)/alerte(s) sur ${operators.length} operateur(s)`,
    );
  }

  /**
   * Rafraichit le cache d'UN operateur - absence d'URL pour un flux donne
   * (l'operateur ne le publie pas, voir MobilityOperatorConfig) traitee
   * comme un resultat vide normal, PAS comme un echec (aucun warning, le
   * cache de ce flux pour cet operateur est simplement vide).
   */
  private async refreshOperator(
    operator: MobilityOperatorConfig,
  ): Promise<void> {
    const existing = this.perOperator.get(operator.id) ?? {
      tripUpdates: [],
      alerts: [],
    };

    const [tripUpdates, alerts] = await Promise.all([
      operator.gtfsRealtimeTripUpdatesUrl
        ? this.gtfsRealtimeClient.fetchTripUpdateDisruptions(
            operator.gtfsRealtimeTripUpdatesUrl,
          )
        : Promise.resolve<RealtimeDisruption[]>([]),
      operator.gtfsRealtimeAlertsUrl
        ? this.gtfsRealtimeClient.fetchAlertDisruptions(
            operator.gtfsRealtimeAlertsUrl,
          )
        : Promise.resolve<RealtimeDisruption[]>([]),
    ]);

    if (tripUpdates === null) {
      this.logger.warn(
        `Echec de rafraichissement du flux TripUpdate de ${operator.id} - conservation des dernieres perturbations connues`,
      );
    }
    if (alerts === null) {
      this.logger.warn(
        `Echec de rafraichissement du flux Alerts de ${operator.id} - conservation des dernieres alertes connues`,
      );
    }

    this.perOperator.set(operator.id, {
      tripUpdates: tripUpdates ?? existing.tripUpdates,
      alerts: alerts ?? existing.alerts,
    });
  }

  /**
   * Detection (critere d'acceptation de #14) : perturbations actuellement
   * connues pour une ligne (`routeId`) et/ou une course (`tripId`) donnee,
   * tous operateurs confondus - conçue pour etre interrogee segment par
   * segment par TripDisruptionMonitorService/ScoringService (#18).
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

  /** Etat brut complet du cache (TripUpdate + Alerts, tous operateurs confondus). */
  getAllDisruptions(): RealtimeDisruption[] {
    return [...this.perOperator.values()].flatMap((cache) => [
      ...cache.tripUpdates,
      ...cache.alerts,
    ]);
  }
}

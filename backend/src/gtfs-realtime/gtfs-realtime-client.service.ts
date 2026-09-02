import { Injectable, Logger } from '@nestjs/common';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import type { transit_realtime } from 'gtfs-realtime-bindings';
import type { RealtimeDisruption } from './interfaces/realtime-disruption.interface';

const { FeedMessage } = GtfsRealtimeBindings.transit_realtime;
const { ScheduleRelationship: TripScheduleRelationship } =
  GtfsRealtimeBindings.transit_realtime.TripDescriptor;
const { ScheduleRelationship: StopTimeScheduleRelationship } =
  GtfsRealtimeBindings.transit_realtime.TripUpdate.StopTimeUpdate;

/**
 * Connecteur GTFS-Realtime (issue #14, F3) : telecharge et decode les flux
 * protobuf standard (TripUpdate, Alerts - specification
 * https://gtfs.org/realtime, bindings officiels `gtfs-realtime-bindings`
 * maintenus par MobilityData/Google) d'un operateur, et en extrait les
 * perturbations en cours sous forme unifiee (RealtimeDisruption).
 *
 * Meme contrat de degradation que GbfsClientService/NominatimClientService
 * pour les erreurs reseau/HTTP : jamais d'exception. Difference volontaire
 * en cas de succes reseau avec un flux illisible (protobuf mal forme) :
 * renvoie `null` plutot que `[]`, pour que GtfsRealtimeCacheService puisse
 * distinguer "aucune perturbation en ce moment" (frequent et attendu pour ce
 * domaine - contrairement aux stations GBFS, "0 perturbation" est l'etat
 * normal) d'un vrai echec a ne pas prendre pour argent comptant.
 */
@Injectable()
export class GtfsRealtimeClientService {
  private readonly logger = new Logger(GtfsRealtimeClientService.name);

  /**
   * Perturbations issues du flux TripUpdate : courses annulees en bloc
   * (trip.scheduleRelationship = CANCELED) et arrets sautes sur une course
   * par ailleurs programmee (stopTimeUpdate.scheduleRelationship = SKIPPED).
   * Une course annulee n'est pas en plus inspectee arret par arret (deja
   * couverte dans son ensemble, une seule entree suffit).
   */
  async fetchTripUpdateDisruptions(
    url: string,
  ): Promise<RealtimeDisruption[] | null> {
    const buffer = await this.fetchBuffer(url);
    if (!buffer) return null;

    const feed = this.decode(url, buffer);
    if (!feed) return null;

    const disruptions: RealtimeDisruption[] = [];
    for (const entity of feed.entity) {
      const tripUpdate = entity.tripUpdate;
      if (!tripUpdate) continue;

      const tripId = tripUpdate.trip?.tripId || undefined;
      const routeId = tripUpdate.trip?.routeId || undefined;

      if (
        tripUpdate.trip?.scheduleRelationship ===
        TripScheduleRelationship.CANCELED
      ) {
        disruptions.push({ kind: 'cancellation', tripId, routeId });
        continue;
      }

      for (const stopTimeUpdate of tripUpdate.stopTimeUpdate ?? []) {
        if (
          stopTimeUpdate.scheduleRelationship ===
          StopTimeScheduleRelationship.SKIPPED
        ) {
          disruptions.push({
            kind: 'skipped_stop',
            tripId,
            routeId,
            stopId: stopTimeUpdate.stopId || undefined,
          });
        }
      }
    }
    return disruptions;
  }

  /**
   * Perturbations issues du flux Alerts : une entree par (alerte x entite
   * informee) actuellement active - une alerte sans `activePeriod` du tout
   * est active en permanence (regle GTFS-RT), une alerte avec des periodes
   * n'est retenue que si l'instant present tombe dans au moins l'une
   * d'elles.
   */
  async fetchAlertDisruptions(
    url: string,
  ): Promise<RealtimeDisruption[] | null> {
    const buffer = await this.fetchBuffer(url);
    if (!buffer) return null;

    const feed = this.decode(url, buffer);
    if (!feed) return null;

    const nowSeconds = Date.now() / 1000;
    const disruptions: RealtimeDisruption[] = [];
    for (const entity of feed.entity) {
      const alert = entity.alert;
      if (!alert || !this.isAlertActive(alert.activePeriod, nowSeconds)) {
        continue;
      }

      const headerText = this.pickTranslation(alert.headerText);
      const informedEntities = alert.informedEntity ?? [];

      if (informedEntities.length === 0) {
        // Alerte sans entite informee (rare, mais possible cote standard) :
        // une seule entree generique plutot que de la perdre silencieusement.
        disruptions.push({ kind: 'alert', headerText });
        continue;
      }

      for (const informed of informedEntities) {
        disruptions.push({
          kind: 'alert',
          routeId: informed.routeId || undefined,
          tripId: informed.trip?.tripId || undefined,
          stopId: informed.stopId || undefined,
          headerText,
        });
      }
    }
    return disruptions;
  }

  /** `true` si `activePeriod` est absent/vide (toujours actif) ou si `now` tombe dans au moins une periode. */
  private isAlertActive(
    activePeriod: transit_realtime.ITimeRange[] | null | undefined,
    nowSeconds: number,
  ): boolean {
    if (!activePeriod || activePeriod.length === 0) return true;
    return activePeriod.some((period) => {
      const start =
        period.start !== undefined && period.start !== null
          ? Number(period.start)
          : undefined;
      const end =
        period.end !== undefined && period.end !== null
          ? Number(period.end)
          : undefined;
      if (start !== undefined && nowSeconds < start) return false;
      if (end !== undefined && nowSeconds > end) return false;
      return true;
    });
  }

  /** Prend la traduction francaise si publiee, sinon la premiere disponible - `undefined` si le champ lui-meme est absent. */
  private pickTranslation(
    translatedString: transit_realtime.ITranslatedString | null | undefined,
  ): string | undefined {
    const translations = translatedString?.translation ?? [];
    if (translations.length === 0) return undefined;
    const french = translations.find((t) => t.language === 'fr');
    return (french ?? translations[0]).text ?? undefined;
  }

  private decode(
    url: string,
    buffer: Buffer,
  ): ReturnType<typeof FeedMessage.decode> | null {
    try {
      return FeedMessage.decode(buffer);
    } catch (error) {
      this.logger.warn(
        `Flux GTFS-Realtime illisible (${url}) : ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  /** GET binaire generique, jamais d'exception - `null` (logge) sur toute erreur reseau/HTTP. */
  private async fetchBuffer(url: string): Promise<Buffer | null> {
    let response: Response;
    try {
      response = await fetch(url);
    } catch (error) {
      this.logger.warn(
        `Flux GTFS-Realtime injoignable (${url}) : ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }

    if (!response.ok) {
      this.logger.warn(
        `Flux GTFS-Realtime a repondu ${response.status} (${url})`,
      );
      return null;
    }

    return Buffer.from(await response.arrayBuffer());
  }
}

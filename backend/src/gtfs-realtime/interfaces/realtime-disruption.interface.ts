/**
 * Nature d'une perturbation detectee dans les flux GTFS-Realtime (issue #14) :
 * - 'cancellation' : une course entiere annulee (TripUpdate, trip.scheduleRelationship = CANCELED).
 * - 'skipped_stop' : un arret precis saute sur une course par ailleurs programmee
 *   (TripUpdate, stopTimeUpdate.scheduleRelationship = SKIPPED).
 * - 'alert' : une alerte operateur en cours de validite (flux Alerts - travaux,
 *   incident, information trafic...).
 *
 * Volontairement PAS de retard chiffre en minutes/secondes ici (voir
 * GtfsRealtimeClientService, section "Limite assumee") : le flux TripUpdate
 * reel de l'operateur retenu (STAR Rennes, verifie en session) n'expose que
 * des horaires absolus (`arrival.time`/`departure.time`), jamais de champ
 * `delay` peuple - calculer un delta fiable exigerait de le comparer a
 * l'horaire theorique du GTFS statique (`stop_times.txt`), non ingere a ce
 * jour (voir backend/README.md, "Ingestion GTFS statique (F3)" - portee
 * volontairement limitee a stops.txt). Un retard fictif serait pire qu'une
 * absence de chiffre.
 */
export type RealtimeDisruptionKind = 'cancellation' | 'skipped_stop' | 'alert';

/**
 * Une perturbation unifiee, quelle que soit sa source (TripUpdate ou Alert) -
 * voir GtfsRealtimeClientService pour la traduction depuis le protobuf brut.
 */
export interface RealtimeDisruption {
  kind: RealtimeDisruptionKind;
  /** Identifiant GTFS brut de la ligne concernee (route_id), tel qu'expose par le flux - absent si la perturbation ne cible pas une ligne precise. */
  routeId?: string;
  /** Identifiant GTFS brut de la course concernee (trip_id) - absent pour 'alert' quand elle cible route/arret plutot qu'une course precise. */
  tripId?: string;
  /** Identifiant GTFS brut de l'arret concerne (stop_id) - present pour 'skipped_stop', optionnel pour 'alert'. */
  stopId?: string;
  /** Uniquement pour kind === 'alert' : texte court destine a l'usager (traduction francaise si l'operateur la publie, repli sur la premiere disponible sinon). */
  headerText?: string;
}

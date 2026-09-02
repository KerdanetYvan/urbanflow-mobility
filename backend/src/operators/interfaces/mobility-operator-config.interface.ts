/**
 * Contrat commun d'un operateur de mobilite pluggable (issue #15,
 * "Interface commune de connecteur GTFS/GBFS documentee") : ce qu'un
 * operateur PEUT publier, jamais ce qu'il DOIT publier - un operateur
 * n'exposant que du GBFS (velos) sans GTFS-Realtime (perturbations) reste
 * un operateur valide, tous les champs de flux sont donc optionnels. Seuls
 * `id`/`name` sont obligatoires (identite de l'operateur, meme sans aucun
 * flux configure).
 *
 * "Interface commune" au sens ou GbfsCacheService et GtfsRealtimeCacheService
 * (issues #13/#14) consomment TOUS deux cette meme forme pour decouvrir
 * quels flux interroger, sans jamais coder en dur un operateur particulier -
 * ajouter un operateur revient a ajouter une entree conforme a cette
 * interface (voir OperatorsService), jamais a modifier ces deux services.
 *
 * Volontairement PAS d'URL pour le GTFS statique (import unique dans le
 * graphe d'OpenTripPlanner, `GtfsImportService`/`npm run import:gtfs`,
 * issue #12) : contrairement a GBFS/GTFS-Realtime (caches memoire
 * independants, simplement concatenables entre operateurs), faire cohabiter
 * plusieurs flux GTFS statiques dans UN MEME graphe OTP exige qu'OTP les
 * charge tous les deux au build (`routing-engine/data/*.zip`, mode
 * multi-feed) ET que les identifiants GTFS bruts (route_id/trip_id)
 * retrouvent leur prefixe de feed a travers tout le pipeline de
 * perturbations (TripsService#stripOtpFeedPrefix, issue #18, aujourd'hui
 * retire volontairement puisqu'un seul feed est charge) - portee
 * explicitement laissee de cote par cette issue, voir backend/README.md
 * section "Architecture pluggable" pour le detail de cette limite.
 */
export interface MobilityOperatorConfig {
  /** Identifiant stable de l'operateur (slug, ex. "star-rennes") - sert a tagger les donnees fusionnees de plusieurs operateurs (SharedMobilityStation#operatorId), pas expose tel quel a l'usager. */
  id: string;
  /** Nom lisible (ex. "STAR (Rennes Métropole)") - a des fins de journalisation/documentation, pas encore affiche cote frontend. */
  name: string;
  /** URL du fichier d'auto-decouverte GBFS (gbfs.json) - absent si l'operateur ne publie pas de velos/trottinettes en libre-service (issue #13). */
  gbfsDiscoveryUrl?: string;
  /** URL du flux GTFS-Realtime TripUpdate (protobuf) - absent si l'operateur ne publie pas de mises a jour temps reel (issue #14). */
  gtfsRealtimeTripUpdatesUrl?: string;
  /** URL du flux GTFS-Realtime Alerts (protobuf) - absent si l'operateur ne publie pas d'alertes (issue #14). */
  gtfsRealtimeAlertsUrl?: string;
}

/**
 * Modes de transport proposables dans les preferences d'un profil de
 * mobilite. Reprend les modes evoques dans le sujet et le dossier de
 * certification (marche, velo/trottinette en libre-service, transports en
 * commun, covoiturage).
 *
 * Transports en commun eclates en 4 modes (issue #66, remplace l'ancien
 * PUBLIC_TRANSPORT generique) car geres par des operateurs differents.
 * Chaque valeur correspond a un route_type GTFS standard, pour rester
 * exploitable par le routage OpenTripPlanner (F2) le jour ou le mapping
 * TransportMode -> parametre OTP sera cable (pas encore fait, voir
 * OtpClientService.buildPlanUrl) :
 *   - BUS       -> route_type 3
 *   - TRAM      -> route_type 0
 *   - METRO     -> route_type 1 (subway)
 *   - TRAIN_TER -> route_type 2 (rail)
 */
export enum TransportMode {
  WALKING = 'walking',
  CYCLING = 'cycling',
  SCOOTER = 'scooter',
  BUS = 'bus',
  TRAM = 'tram',
  METRO = 'metro',
  TRAIN_TER = 'train_ter',
  CARPOOLING = 'carpooling',
}

/**
 * Sous-ensemble de TransportMode reellement proposable dans les preferences
 * d'un profil de mobilite (issue #278).
 *
 * SCOOTER (trottinette) et CARPOOLING (covoiturage) sont volontairement
 * exclus : aucune source de donnees ne permet aujourd'hui de produire un
 * trajet de ce type (constat de la revue testeur du Sprint 4, confirme par
 * le commentaire de otp-modes.ts - acceptes par OTP mais silencieusement
 * ignores au routage) et aucune integration n'est prevue a court terme.
 * Les laisser dans le selecteur revenait a cocher une preference qui ne
 * serait jamais honoree. CYCLING reste : la source GBFS existe deja
 * (issue #13), seul son cablage au routage est encore un backlog.
 *
 * TransportMode ci-dessus garde en revanche les deux valeurs : elles
 * restent des chaines connues du catalogue pour la recherche d'itineraire
 * (SearchTripsDto) et le suivi de trajet (FollowedTrip), et on veut
 * tolerer en lecture un profil existant qui les aurait deja en base
 * (colonne Postgres text[], aucune contrainte d'enum au niveau SQL) plutot
 * que de planter l'affichage de ces comptes.
 */
export const PROFILE_TRANSPORT_MODES: readonly TransportMode[] = [
  TransportMode.WALKING,
  TransportMode.CYCLING,
  TransportMode.BUS,
  TransportMode.TRAM,
  TransportMode.METRO,
  TransportMode.TRAIN_TER,
];

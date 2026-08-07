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

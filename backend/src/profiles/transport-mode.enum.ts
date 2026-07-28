/**
 * Modes de transport proposables dans les preferences d'un profil de
 * mobilite. Reprend les modes evoques dans le sujet et le dossier de
 * certification (marche, velo/trottinette en libre-service, transports en
 * commun, covoiturage).
 */
export enum TransportMode {
  WALKING = 'walking',
  CYCLING = 'cycling',
  SCOOTER = 'scooter',
  PUBLIC_TRANSPORT = 'public_transport',
  CARPOOLING = 'carpooling',
}

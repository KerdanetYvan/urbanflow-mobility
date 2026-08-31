import { TransportMode } from '../profiles/transport-mode.enum';

/**
 * Correspondance TransportMode (préférences du profil de mobilité, alignées
 * sur les route_type GTFS) -> mode OpenTripPlanner attendu par le query
 * param `mode` de `GET /plan` (issue #87).
 *
 * Seuls les transports en commun et la marche sont routables aujourd'hui :
 * le jeu de données chargé dans OTP n'intègre pas encore de source
 * vélo/trottinette en libre-service (GBFS, F3, issue #13) ni de covoiturage.
 * `walking` / `cycling` / `scooter` / `carpooling` sont donc volontairement
 * absents de cette table côté "modes filtrables" - `WALKING` est géré à part
 * (toujours ajouté, voir toOtpModeParam), les trois autres sont acceptés par
 * le DTO mais silencieusement ignorés au routage tant que leur intégration
 * OTP n'est pas faite.
 */
const OTP_TRANSIT_MODE_BY_TRANSPORT_MODE: Partial<
  Record<TransportMode, string>
> = {
  [TransportMode.BUS]: 'BUS',
  [TransportMode.TRAM]: 'TRAM',
  [TransportMode.METRO]: 'SUBWAY',
  [TransportMode.TRAIN_TER]: 'RAIL',
};

/**
 * Valeur par défaut du paramètre `mode` d'OTP : la méta-catégorie `TRANSIT`
 * (tous les transports en commun) + `WALK`. Utilisée quand aucun filtre de
 * mode n'est demandé, ou quand le filtre demandé ne laisse aucun mode
 * routable (voir toOtpModeParam).
 */
export const DEFAULT_OTP_MODE_PARAM = 'TRANSIT,WALK';

/**
 * Construit la valeur du query param `mode` de la requête OTP `/plan` à
 * partir des modes de transport préférés transmis à `GET /trips` (issue
 * #87, SearchTripsDto.transportModes).
 *
 * Règles :
 * - `modes` absent ou vide -> DEFAULT_OTP_MODE_PARAM : aucun filtre, tous
 *   les transports en commun sont considérés (comportement historique, voir
 *   docs/specs/filtre-modes-transport.md section 6).
 * - sinon -> `WALK` (toujours nécessaire à OTP pour les tronçons d'accès et
 *   de sortie autour du transport en commun) + les modes de transport en
 *   commun correspondants. Les modes pas encore intégrés à OTP
 *   (vélo/trottinette/covoiturage) sont ignorés.
 * - si, après filtrage, aucun mode de transport en commun ne subsiste
 *   (l'utilisateur n'a coché que des modes non routables) -> on retombe sur
 *   DEFAULT_OTP_MODE_PARAM plutôt que de lancer une recherche "à pied
 *   seule", qui n'a aucun intérêt sur cet écran.
 *
 * @param modes préférences de l'utilisateur, alignées sur TransportMode
 * @returns la valeur du query param `mode` (ex. `"WALK,BUS,SUBWAY"`)
 */
export function toOtpModeParam(modes?: TransportMode[]): string {
  if (!modes || modes.length === 0) {
    return DEFAULT_OTP_MODE_PARAM;
  }

  // Set : dédoublonne quand deux TransportMode pointent vers le même mode
  // OTP (cas absent aujourd'hui mais sans coût, et robuste à une évolution
  // de l'enum).
  const transitModes = new Set<string>();
  for (const mode of modes) {
    const otpMode = OTP_TRANSIT_MODE_BY_TRANSPORT_MODE[mode];
    if (otpMode) {
      transitModes.add(otpMode);
    }
  }

  if (transitModes.size === 0) {
    return DEFAULT_OTP_MODE_PARAM;
  }

  return ['WALK', ...transitModes].join(',');
}

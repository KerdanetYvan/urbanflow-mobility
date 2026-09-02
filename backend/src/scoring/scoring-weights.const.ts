import { TransportMode } from '../profiles/transport-mode.enum';

/**
 * Poids du systeme de scoring (issue #16, partie 7.3 du dossier) : un score
 * "cout" par itineraire (plus bas = meilleur), combinaison lineaire de
 * criteres ponderes - jamais un modele de ML opaque. Point d'entree unique
 * pour ajuster le comportement du classement : tout changement de
 * ponderation se fait ici, sans toucher a ScoringService.
 */
export const SCORING_WEIGHTS = {
  /**
   * Cout par seconde de duree totale du trajet. 1/60 = 1 point par minute -
   * unite de reference a laquelle les autres couts sont compares.
   */
  DURATION_PER_SECOND: 1 / 60,

  /**
   * Cout de base par correspondance, applique meme sans profil (coherent
   * avec le tri natif d'OpenTripPlanner, qui penalise deja legerement les
   * correspondances). Volontairement faible : la duree domine par defaut.
   */
  TRANSFER: 2,

  /**
   * Multiplicateur applique au cout par correspondance quand le profil de
   * l'utilisateur a coche AccessibilityPreference.LIMIT_TRANSFERS - une
   * correspondance devient alors nettement plus penalisante que la duree.
   */
  TRANSFER_MULTIPLIER_WHEN_LIMITED: 6,

  /**
   * Cout par metre marche (somme des segments WALK), applique uniquement si
   * AccessibilityPreference.LIMIT_WALKING_DISTANCE est cochee - sans cette
   * preference, la marche n'est pas penalisee au-dela de son propre impact
   * sur la duree totale.
   */
  WALKING_METER_WHEN_LIMITED: 0.05,

  /**
   * Bonus (cout negatif) par segment dont le mode figure dans
   * preferredTransportModes du profil.
   */
  PREFERRED_MODE_BONUS_PER_SEGMENT: -3,

  /**
   * Seuil de precipitations (mm, WeatherService#CurrentWeather) a partir
   * duquel la pluie est jugee "forte" (issue #17, partie 7.3 du dossier) -
   * 2.5mm correspond au seuil standard pluie moderee/forte. En dessous, pas
   * de malus meteo.
   */
  RAIN_THRESHOLD_MM: 2.5,

  /**
   * Cout par metre marche quand RAIN_THRESHOLD_MM est depasse - applique
   * TOUJOURS (contrairement a WALKING_METER_WHEN_LIMITED, conditionne au
   * profil) : la meteo en cours est un critere de base du dossier (partie
   * 7.2), pas une preference enregistree.
   */
  WALKING_METER_WHEN_RAINING: 0.08,

  /**
   * Penalite fixe (pas par metre/segment) appliquee des qu'au moins un
   * segment de l'itineraire est actuellement touche par une perturbation
   * GTFS-Realtime (issue #18, docs/specs/f3-scoring-perturbations.md
   * section 4.2 - "Perturbations GTFS-Realtime en cours", 20% du poids
   * decrit par le PO, second critere le plus lourd apres la duree).
   * Calibree a l'echelle de DURATION_PER_SECOND (1 pt/min) : 15 points
   * equivaut a un allongement de 15 min du trajet, suffisant pour reléguer
   * un itineraire perturbe derriere une alternative propre de duree
   * comparable, sans l'exclure completement (jamais un filtre dur - meme
   * principe que PREFERRED_MODE_BONUS_PER_SEGMENT : un ecran vide reste
   * pire qu'un resultat imparfait). Flat plutot que multiplie par le nombre
   * de segments perturbes : le signal "ce trajet est perturbe" compte, pas
   * son intensite (que #14 ne sait de toute facon pas chiffrer, voir
   * GtfsRealtimeClientService).
   */
  PERTURBATION_PENALTY: 15,
} as const;

// AccessibilityPreference.WHEELCHAIR_ACCESSIBLE n'a volontairement aucun
// poids ici : TripSegment ne porte aucune information d'accessibilite par
// segment (OTP n'est pas encore interroge avec le parametre wheelchair, voir
// le commentaire sur MobilityProfile.accessibilityPreferences - "cablage
// reel... reste a trancher lors de l'integration OTP correspondante"). A
// cabler dans ce fichier une fois cette donnee disponible.

/**
 * Correspondance mode OpenTripPlanner -> TransportMode (profil de mobilite).
 * OtpClientService.buildPlanUrl restreint la requete a "TRANSIT,WALK" (voir
 * ce fichier) : seuls les modes ci-dessous peuvent donc apparaitre dans une
 * reponse OTP aujourd'hui. CYCLING/SCOOTER/CARPOOLING ne matcheront jamais
 * tant que velo/trottinette en libre-service (GBFS) et covoiturage ne sont
 * pas integres a OTP - limitation connue, pas un bug de cette table.
 */
export const OTP_MODE_TO_TRANSPORT_MODE: Record<string, TransportMode> = {
  WALK: TransportMode.WALKING,
  BUS: TransportMode.BUS,
  TRAM: TransportMode.TRAM,
  SUBWAY: TransportMode.METRO,
  RAIL: TransportMode.TRAIN_TER,
};

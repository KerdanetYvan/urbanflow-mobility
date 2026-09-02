/**
 * Formes minimales de la reponse REST `GET {OTP_URL}/plan` (OpenTripPlanner
 * 2.5) utilisees par OtpClientService - uniquement les champs consommes,
 * pas un typage exhaustif de toute l'API OTP.
 */

export interface OtpPlace {
  name: string;
  lat: number;
  lon: number;
}

export interface OtpLeg {
  mode: string;
  /**
   * `route` est le nom LONG de la ligne (ex. "Ligne Test - Boucle Centre"),
   * pas ce qu'un usager reconnait - `routeShortName` (ex. "T1") est le bon
   * champ a afficher (verifie en testant contre un vrai OTP, voir
   * TripsService#mapLeg). Les deux sont absents/vides pour un segment a pied.
   */
  route?: string;
  routeShortName?: string;
  /**
   * Couleur de la ligne definie par l'operateur GTFS (route_color), en
   * hexadecimal SANS '#' (ex. "EE1D23") - format brut renvoye par OTP,
   * verifie contre un vrai OTP (issue #129, section 8). Absente pour un
   * segment a pied ou si l'operateur ne definit pas de couleur.
   */
  routeColor?: string;
  /**
   * Couleur de texte associee a routeColor (GTFS route_text_color), meme
   * format brut sans '#' - pensee par l'operateur pour rester lisible sur
   * routeColor (voir docs/specs/badges-lignes-transport.md section 8.6).
   */
  routeTextColor?: string;
  /**
   * Identifiant GTFS brut de la ligne (route_id), prefixe par l'id du feed
   * OTP ("{feedId}:{route_id}", ex. "1:7-0001") - format confirme contre le
   * mapper REST reel d'OTP 2.5 (FeedScopedIdMapper#mapToApi,
   * ext/restapi/mapping/, `feedId + ":" + id`), pas encore verifie contre
   * une instance OTP reelle de ce projet (aucun conteneur OTP disponible
   * dans cette session, voir routing-engine/README.md pour le lancer). Le
   * prefixe de feed est retire par TripsService#mapLeg avant d'exposer
   * TripSegment#routeId, pour matcher directement le route_id brut (sans
   * prefixe) expose par le flux GTFS-Realtime de l'operateur (issue #14).
   * Absent pour un segment a pied.
   */
  routeId?: string;
  /** Identifiant GTFS brut de la course (trip_id), meme prefixe/usage que routeId - voir TripSegment#tripId. Absent pour un segment a pied. */
  tripId?: string;
  startTime: number;
  endTime: number;
  distance: number;
  from: OtpPlace;
  to: OtpPlace;
  /**
   * Trace detaille du segment (suit les rues/voies), encode au format
   * "Encoded Polyline Algorithm" de Google (precision 5) - present par
   * defaut sur chaque leg de la reponse REST `/plan` d'OTP, verifie contre
   * un vrai OTP (issue #8). Optionnel dans ce typage par prudence (un champ
   * absent/vide ne doit jamais faire planter TripsService#mapLeg, voir son
   * repli sur [from, to]), mais toujours present en pratique.
   */
  legGeometry?: { points: string };
}

export interface OtpItinerary {
  startTime: number;
  endTime: number;
  duration: number;
  transfers: number;
  legs: OtpLeg[];
}

export interface OtpPlanError {
  /**
   * Code d'erreur OTP. 400 = origine/destination hors de la zone couverte
   * par le graphe (coordonnees non exploitables) ; les autres valeurs
   * (404 "aucun trajet", 500/503 cote OTP) sont traitees comme "aucun
   * itineraire trouve" plutot que comme une erreur API (voir OtpClientService).
   */
  id: number;
  message?: string;
}

export interface OtpPlanResponse {
  plan?: {
    itineraries: OtpItinerary[];
  };
  error?: OtpPlanError;
}

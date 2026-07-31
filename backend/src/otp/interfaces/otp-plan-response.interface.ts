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
  startTime: number;
  endTime: number;
  distance: number;
  from: OtpPlace;
  to: OtpPlace;
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

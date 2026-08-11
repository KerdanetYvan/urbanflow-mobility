/**
 * Forme minimale de la reponse REST `GET /v1/forecast` d'Open-Meteo
 * (https://api.open-meteo.com) utilisee par WeatherService - uniquement les
 * champs consommes (precipitations), pas un typage exhaustif de toute
 * l'API. Meme motif que otp-plan-response.interface.ts.
 */
export interface OpenMeteoCurrentConditions {
  /** Precipitations totales (pluie + averses + neige) sur l'intervalle courant, en mm. */
  precipitation: number;
  /** Pluie liquide uniquement, en mm - sous-ensemble de precipitation. */
  rain: number;
}

export interface OpenMeteoResponse {
  current?: OpenMeteoCurrentConditions;
}

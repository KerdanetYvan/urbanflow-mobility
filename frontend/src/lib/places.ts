import { apiGet } from './api';

/**
 * Forme renvoyee par GET /places (voir backend/src/places/dto/place-suggestion.dto.ts,
 * issue #81, enrichi #168) - une suggestion pour l'autocompletion origine/destination.
 *
 * `kind` distingue un arret de transport (geocodeur OTP) d'une adresse
 * postale (Nominatim) - sert a afficher une icone differente. Optionnel dans
 * le type pour tolerer un backend anterieur a #168, mais toujours present en
 * pratique.
 */
export interface PlaceSuggestion {
  label: string;
  lat: number;
  lon: number;
  kind?: 'stop' | 'address';
}

/**
 * Autocompletion origine/destination par texte (GET /places, issue #81,
 * #167/#168). Le backend fusionne les arrets (geocodeur OTP) et les adresses
 * postales (Nominatim auto-heberge). Non authentifie : utilisable sans
 * compte (voir issue #64).
 */
export function searchPlaces(query: string): Promise<PlaceSuggestion[]> {
  return apiGet<PlaceSuggestion[]>(`/places?query=${encodeURIComponent(query)}`);
}

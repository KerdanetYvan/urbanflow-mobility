import { apiGet } from './api';

/**
 * Forme renvoyee par GET /places (voir backend/src/places/dto/place-suggestion.dto.ts,
 * issue #81) - une suggestion d'adresse pour l'autocompletion origine/destination.
 */
export interface PlaceSuggestion {
  label: string;
  lat: number;
  lon: number;
}

/**
 * Autocompletion d'adresse par texte (GET /places, issue #81). Delegue au
 * geocodeur integre a OpenTripPlanner. Non authentifie : utilisable sans
 * compte (voir issue #64).
 */
export function searchPlaces(query: string): Promise<PlaceSuggestion[]> {
  return apiGet<PlaceSuggestion[]>(`/places?query=${encodeURIComponent(query)}`);
}

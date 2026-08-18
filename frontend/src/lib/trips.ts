import { apiGet } from './api';

/** Voir backend/src/trips/dto/trip-itinerary.dto.ts (issue #7) - un point (origine/destination/correspondance) d'un segment d'itineraire. */
export interface TripPlace {
  name: string;
  lat: number;
  lon: number;
}

/** Un point du trace detaille d'un segment (issue #8) - pas de nom, contrairement a TripPlace. */
export interface TripGeoPoint {
  lat: number;
  lon: number;
}

/** Un segment d'itineraire (un mode de transport, ex. marche puis bus). */
export interface TripSegment {
  mode: string;
  routeName?: string;
  /** Couleur de la ligne (GTFS route_color, hex SANS '#') - voir backend/src/trips/dto/trip-itinerary.dto.ts et docs/specs/badges-lignes-transport.md section 8. */
  routeColor?: string;
  /** Couleur de texte associee a routeColor (GTFS route_text_color, hex SANS '#'). */
  routeTextColor?: string;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  distanceMeters: number;
  from: TripPlace;
  to: TripPlace;
  /** Trace detaille du segment (suit les rues/voies parcourues), voir MapView. Au moins 2 points. */
  geometry: TripGeoPoint[];
}

/** Un itineraire multimodal complet, decoupe en segments. */
export interface TripItinerary {
  startTime: string;
  endTime: string;
  durationSeconds: number;
  transfers: number;
  segments: TripSegment[];
}

/**
 * Parametres de recherche transmis a GET /trips (issue #7).
 *
 * Pas de champ pour les modes de transport preferes : SearchTripsDto
 * (backend) ne les accepte pas encore, et le pipeline de validation global
 * rejette toute requete avec un champ non declare (whitelist +
 * forbidNonWhitelisted, voir backend/src/main.ts) - les envoyer ferait
 * echouer l'appel avec un 400. Le formulaire de recherche (#35) les affiche
 * neanmoins (voir docs/specs/f2-ecrans-planification.md section 2.1) pour
 * suivre la spec ecran, mais ne les transmet pas encore a l'API : filtrer
 * /trips par mode est un chantier backend a part, non couvert par ce ticket
 * (voir issue #87, Stretch).
 */
export interface SearchTripsParams {
  originLat: number;
  originLon: number;
  destinationLat: number;
  destinationLon: number;
  /** ISO 8601. Absent = maintenant (comportement par defaut du backend). */
  departureTime?: string;
}

/**
 * Recherche d'itineraires multimodaux (GET /trips, issue #7). Non
 * authentifie : utilisable sans compte (voir issue #64). Renvoie les
 * itineraires deja tries par le backend (ordre natif OTP en Sprint 2, voir
 * docs/specs/f2-ecrans-planification.md section 3.4) - l'appelant ne doit
 * pas re-trier.
 */
export function searchTrips(params: SearchTripsParams): Promise<TripItinerary[]> {
  const query = new URLSearchParams({
    originLat: String(params.originLat),
    originLon: String(params.originLon),
    destinationLat: String(params.destinationLat),
    destinationLon: String(params.destinationLon),
    ...(params.departureTime ? { departureTime: params.departureTime } : {}),
  });
  return apiGet<TripItinerary[]>(`/trips?${query.toString()}`);
}

import { apiGetWithOptionalAuth, authGet } from './api';
import { formatCoordinates } from './format';
import type { PlaceSuggestion } from './places';

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
  /** Identifiant GTFS brut de la ligne (route_id), issue #18 - jamais affiche a l'usager (routeName est le libelle), sert uniquement a demarrer un suivi de trajet (POST /trips/current, voir lib/followedTrip.ts). Absent pour un segment a pied. */
  routeId?: string;
  /** Identifiant GTFS brut de la course (trip_id), meme usage que routeId. Absent pour un segment a pied. */
  tripId?: string;
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
  /** Horaires de depart (ISO 8601, tries) des itineraires strictement identiques regroupes sous ce resultat (issue #127) - voir backend/src/trips/trips.service.ts#groupByRoute. Absent si aucun regroupement n'a eu lieu pour cet itineraire (deja distinct). startTime correspond au premier element. */
  nextDepartures?: string[];
  /** true si un segment est actuellement touche par une perturbation GTFS-Realtime (issue #18, ScoringService) - absent (pas juste false) sinon. Affiche le marqueur "Perturbation en cours", distinct des badges qualitatifs. */
  disrupted?: boolean;
}

/**
 * Nature du repli quand la recherche normale ne renvoie aucun itineraire a
 * l'heure demandee. Dans les deux cas, `TripSearchResult.itineraries`
 * contient les trajets du repli (non vide).
 *
 * - `later-departure` (issue #91) : aucun trajet a l'heure demandee, mais un
 *   trajet existe plus tard - `requestedDepartureTime` / `actualDepartureTime`
 *   disent de combien le creneau a glisse.
 * - `walk-only` (issue #190) : aucun trajet en transport en commun (meme plus
 *   tard), un trajet a pied est propose a la place.
 */
export type TripFallback =
  | { kind: 'walk-only' }
  | {
      kind: 'later-departure';
      /** ISO 8601 - heure demandee (ou "maintenant" resolu au moment de la recherche). */
      requestedDepartureTime: string;
      /** ISO 8601 - heure de depart du premier itineraire propose, posterieure a l'heure demandee. */
      actualDepartureTime: string;
    };

/**
 * Reponse de GET /trips (issue #7). Enveloppe plutot qu'un tableau nu depuis
 * l'issue #190 : `fallback` est une metadonnee sur la recherche (repli a
 * pied), qu'un tableau ne peut pas porter proprement.
 */
export interface TripSearchResult {
  /** Itineraires trouves, deja tries par le backend. Vide = aucun (voir `fallback`). */
  itineraries: TripItinerary[];
  /** Present uniquement quand la recherche normale n'a rien donne ET qu'un repli a ete tente. */
  fallback?: TripFallback;
}

/**
 * Parametres de recherche transmis a GET /trips (issue #7).
 */
export interface SearchTripsParams {
  originLat: number;
  originLon: number;
  destinationLat: number;
  destinationLon: number;
  /** ISO 8601. Absent = maintenant (comportement par defaut du backend). */
  departureTime?: string;
  /**
   * Libelles d'adresse lisibles (issue #11), envoyes uniquement quand
   * l'utilisateur est connecte (voir RecherchePage.tsx) - servent
   * uniquement a l'historique des trajets cote backend
   * (TripHistoryService#record), jamais transmis a OpenTripPlanner.
   */
  originLabel?: string;
  destinationLabel?: string;
  /**
   * Modes de transport preferes a privilegier (issue #87), valeurs alignees
   * sur TRANSPORT_MODES (lib/profile.ts) / l'enum TransportMode backend.
   * Envoyes uniquement quand au moins un mode est coche : une liste vide est
   * omise, le backend considere alors tous les modes (docs/specs/
   * filtre-modes-transport.md section 6). Transmis en parametres repetes
   * (`transportModes=bus&transportModes=tram`).
   */
  transportModes?: string[];
}

/**
 * Recherche d'itineraires multimodaux (GET /trips, issue #7). Utilisable
 * sans compte (issue #64) : apiGetWithOptionalAuth n'attache un jeton que
 * s'il existe, ne bloque jamais sinon (voir lib/api.ts,
 * OptionalJwtAuthGuard cote backend). Renvoie les itineraires deja tries
 * par le backend (ordre natif OTP en Sprint 2, voir
 * docs/specs/f2-ecrans-planification.md section 3.4) - l'appelant ne doit
 * pas re-trier.
 *
 * Si un utilisateur authentifie est reconnu cote backend (jeton attache par
 * apiGetWithOptionalAuth), le scoring tient compte du profil de mobilite
 * (issue #16) et la recherche est enregistree automatiquement dans
 * l'historique (issue #11, TripsService#search) - aucun appel reseau
 * supplementaire necessaire ici dans les deux cas.
 */
export function searchTrips(
  params: SearchTripsParams,
): Promise<TripSearchResult> {
  const query = new URLSearchParams({
    originLat: String(params.originLat),
    originLon: String(params.originLon),
    destinationLat: String(params.destinationLat),
    destinationLon: String(params.destinationLon),
    ...(params.departureTime ? { departureTime: params.departureTime } : {}),
    ...(params.originLabel ? { originLabel: params.originLabel } : {}),
    ...(params.destinationLabel
      ? { destinationLabel: params.destinationLabel }
      : {}),
  });
  // Modes preferes (issue #87) : un parametre repete par mode
  // (`transportModes=bus&transportModes=tram`), forme geree par le
  // @Transform de SearchTripsDto. Rien ajoute si la liste est vide/absente.
  for (const mode of params.transportModes ?? []) {
    query.append('transportModes', mode);
  }
  return apiGetWithOptionalAuth<TripSearchResult>(`/trips?${query.toString()}`);
}

/** Une entree dedupliquee de l'historique de recherche (voir backend/src/trips/dto/trip-history-entry.dto.ts, issue #11). */
export interface TripHistoryEntry {
  id: string;
  originLat: number;
  originLon: number;
  originLabel?: string;
  destinationLat: number;
  destinationLon: number;
  destinationLabel?: string;
  /** ISO 8601 - date/heure de la recherche la plus recente pour ce couple origine/destination. */
  lastSearchedAt: string;
}

/**
 * Historique des trajets recemment recherches (GET /trips/history, issue
 * #11). Necessite un compte (contrairement a searchTrips) - authGet attache
 * le jeton et gere le rafraichissement/401 (voir lib/api.ts).
 */
export function getTripHistory(): Promise<TripHistoryEntry[]> {
  return authGet<TripHistoryEntry[]>('/trips/history');
}

/**
 * Convertit une entree d'historique en couple origine/destination directement
 * exploitable par performSearch/handleQuickSearch (RecherchePage.tsx, issue
 * #112) - repli sur formatCoordinates si l'entree n'a pas de libelle
 * enregistre, meme convention que RechercheQuickShortcuts. Factorise ici
 * (issue #174) pour que HistoriquePage (bouton "Relancer cette recherche")
 * et RechercheQuickShortcuts partagent la meme conversion plutot que de la
 * dupliquer.
 */
export function entryToPlaces(entry: TripHistoryEntry): {
  origin: PlaceSuggestion;
  destination: PlaceSuggestion;
} {
  return {
    origin: {
      label:
        entry.originLabel ?? formatCoordinates(entry.originLat, entry.originLon),
      lat: entry.originLat,
      lon: entry.originLon,
    },
    destination: {
      label:
        entry.destinationLabel ??
        formatCoordinates(entry.destinationLat, entry.destinationLon),
      lat: entry.destinationLat,
      lon: entry.destinationLon,
    },
  };
}

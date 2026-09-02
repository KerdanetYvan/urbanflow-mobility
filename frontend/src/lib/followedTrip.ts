import { ApiError, authDelete, authGet, authPost } from './api';
import type { TripItinerary } from './trips';

/** Voir backend/src/trips/following/dto/start-following-trip.dto.ts (issue #18). */
export interface FollowedTripSegmentInput {
  mode: string;
  routeId?: string;
  tripId?: string;
}

/** Corps de POST /trips/current (issue #18). */
export interface StartFollowingTripInput {
  originLat: number;
  originLon: number;
  originLabel?: string;
  destinationLat: number;
  destinationLon: number;
  destinationLabel?: string;
  /** TripItinerary#endTime (ISO 8601) - le suivi expire automatiquement a cette heure. */
  endTime: string;
  segments: FollowedTripSegmentInput[];
  transportModes?: string[];
}

/** Voir backend/src/trips/following/followed-trip.entity.ts (issue #18) - le trajet actuellement suivi. */
export interface FollowedTrip {
  id: string;
  userId: string;
  originLat: number;
  originLon: number;
  originLabel: string | null;
  destinationLat: number;
  destinationLon: number;
  destinationLabel: string | null;
  segments: FollowedTripSegmentInput[];
  transportModes: string[] | null;
  endTime: string;
  lastNotifiedDisruptionSignature: string | null;
  createdAt: string;
}

/**
 * Construit le corps de POST /trips/current a partir d'un itineraire deja
 * recu de GET /trips (issue #18) - origine/destination = premier/dernier
 * segment, segments reduits a {mode, routeId, tripId} (voir
 * FollowedTripSegmentInput, le trace/les couleurs ne servent a rien cote
 * backend pour cette fonctionnalite).
 */
export function toStartFollowingTripInput(
  itinerary: TripItinerary,
  transportModes?: string[],
): StartFollowingTripInput {
  const firstSegment = itinerary.segments[0];
  const lastSegment = itinerary.segments[itinerary.segments.length - 1];
  return {
    originLat: firstSegment.from.lat,
    originLon: firstSegment.from.lon,
    originLabel: firstSegment.from.name,
    destinationLat: lastSegment.to.lat,
    destinationLon: lastSegment.to.lon,
    destinationLabel: lastSegment.to.name,
    endTime: itinerary.endTime,
    segments: itinerary.segments.map((segment) => ({
      mode: segment.mode,
      routeId: segment.routeId,
      tripId: segment.tripId,
    })),
    transportModes,
  };
}

/** Demarre le suivi d'un itineraire (remplace un suivi existant, voir docs/specs/f3-scoring-perturbations-suivi.md section 2). Necessite un compte. */
export function startFollowingTrip(
  input: StartFollowingTripInput,
): Promise<FollowedTrip> {
  return authPost<FollowedTrip>('/trips/current', input);
}

/**
 * Le trajet actuellement suivi, `null` si aucun (backend : 404). Jamais
 * d'exception propagee - une erreur inattendue est traitee comme "pas de
 * suivi" plutot que de casser l'ecran qui l'appelle au montage.
 */
export async function getCurrentFollowedTrip(): Promise<FollowedTrip | null> {
  try {
    return await authGet<FollowedTrip>('/trips/current');
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 404) return null;
    return null;
  }
}

/** Arrete le suivi de trajet en cours (idempotent cote backend). */
export function stopFollowingTrip(): Promise<void> {
  return authDelete<void>('/trips/current');
}

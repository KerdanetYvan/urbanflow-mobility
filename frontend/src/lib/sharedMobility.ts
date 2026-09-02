import { apiGet } from './api';

/** Nature d'une entree GBFS (issue #13) - voir backend/src/gbfs/dto/shared-mobility-station.dto.ts. */
export type SharedMobilityKind = 'station' | 'vehicle';

/**
 * Forme renvoyee par GET /shared-mobility-stations (backend/src/gbfs/,
 * issue #13) - une station a quai fixe ou un vehicule en free-floating
 * (velos/trottinettes en libre-service), quelle que soit l'operateur GBFS
 * d'origine.
 */
export interface SharedMobilityStation {
  id: string;
  /** Absent pour un vehicule en free-floating (pas de nom individuel dans le standard GBFS). */
  name?: string;
  lat: number;
  lon: number;
  kind: SharedMobilityKind;
  bikesAvailable: number;
  /** Uniquement pour une station a quai fixe. */
  docksAvailable?: number;
  isRenting: boolean;
}

/**
 * Stations/vehicules en libre-service disponibles (issue #13). Non
 * authentifie, comme searchPlaces (lib/places.ts) : la carte est
 * consultable sans compte. Backend deja rafraichi en tache de fond
 * (GbfsCacheService) - cet appel ne fait jamais patienter derriere un
 * appel au flux GBFS de l'operateur.
 */
export function fetchSharedMobilityStations(): Promise<SharedMobilityStation[]> {
  return apiGet<SharedMobilityStation[]>('/shared-mobility-stations');
}

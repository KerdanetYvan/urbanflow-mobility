import { authDelete, authGet, authPatch, authPost } from './api';

/**
 * Memes valeurs que l'enum TransportMode cote backend (voir
 * backend/src/profiles/transport-mode.enum.ts) - pas de code partage entre
 * les deux projets, donc dupliquees ici volontairement, avec un libelle
 * lisible pour l'affichage du formulaire.
 */
export const TRANSPORT_MODES = [
  { value: 'walking', label: 'Marche' },
  { value: 'cycling', label: 'Vélo' },
  { value: 'scooter', label: 'Trottinette' },
  { value: 'public_transport', label: 'Transports en commun' },
  { value: 'carpooling', label: 'Covoiturage' },
] as const;

export interface MobilityProfile {
  id: string;
  userId: string;
  preferredTransportModes: string[];
  reducedMobility: boolean;
  maxWalkingDistanceMeters: number | null;
  maxTransfers: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileInput {
  preferredTransportModes: string[];
  reducedMobility: boolean;
  maxWalkingDistanceMeters?: number;
  maxTransfers?: number;
}

/** GET /profiles/me - leve une ApiError (404) si l'utilisateur n'a pas encore de profil. */
export function getMyProfile(): Promise<MobilityProfile> {
  return authGet<MobilityProfile>('/profiles/me');
}

export function createProfile(data: ProfileInput): Promise<MobilityProfile> {
  return authPost<MobilityProfile>('/profiles', data);
}

export function updateProfile(
  data: Partial<ProfileInput>,
): Promise<MobilityProfile> {
  return authPatch<MobilityProfile>('/profiles/me', data);
}

export function deleteProfile(): Promise<void> {
  return authDelete<void>('/profiles/me');
}

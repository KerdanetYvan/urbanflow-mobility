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
  { value: 'bus', label: 'Bus' },
  { value: 'tram', label: 'Tram' },
  { value: 'metro', label: 'Métro' },
  { value: 'train_ter', label: 'Train / TER' },
  { value: 'carpooling', label: 'Covoiturage' },
] as const;

/**
 * Memes valeurs que l'enum AccessibilityPreference cote backend (voir
 * backend/src/profiles/accessibility-preference.enum.ts), meme raison de
 * duplication que TRANSPORT_MODES ci-dessus. Chaque valeur cochee/decochee
 * est pensee comme une entree de ponderation pour le futur service de
 * scoring (issue #68) - pas de seuil numerique ni de champ libre.
 */
export const ACCESSIBILITY_PREFERENCES = [
  { value: 'wheelchair_accessible', label: 'Accessible en fauteuil roulant' },
  { value: 'limit_walking_distance', label: 'Limiter la distance de marche' },
  { value: 'limit_transfers', label: 'Limiter le nombre de correspondances' },
] as const;

export interface MobilityProfile {
  id: string;
  userId: string;
  preferredTransportModes: string[];
  accessibilityPreferences: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProfileInput {
  preferredTransportModes: string[];
  accessibilityPreferences: string[];
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

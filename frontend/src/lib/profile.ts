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
  /**
   * Adresses domicile/travail (issue #113/#114), utilisees comme raccourcis
   * d'origine sur l'ecran de recherche (issue #93). `null` quand l'adresse
   * n'a jamais ete renseignee - jamais une moitie seule (voir
   * backend/src/profiles/profiles.service.ts#assertCompleteAddressPairs).
   * Optionnelles ici (et non `| null` strictement requis) uniquement pour
   * ne pas casser les mocks de profil deja ecrits par d'autres suites de
   * tests (App.spec.tsx, ConnexionPage.spec.tsx...) qui predatent cette
   * issue - l'API reelle les renvoie toujours (voir GET /profiles/me).
   */
  homeLabel?: string | null;
  homeLat?: number | null;
  homeLon?: number | null;
  workLabel?: string | null;
  workLat?: number | null;
  workLon?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileInput {
  preferredTransportModes: string[];
  accessibilityPreferences: string[];
  /**
   * Champs optionnels (issue #113/#114) : absents du payload envoye au
   * backend quand une adresse n'est pas renseignee/modifiee - pas de
   * semantique "effacer via null" a ce jour (voir docs/sprints/
   * sprint-3-plan.md, PR #140), donc jamais `null` explicite ici.
   */
  homeLabel?: string;
  homeLat?: number;
  homeLon?: number;
  workLabel?: string;
  workLat?: number;
  workLon?: number;
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

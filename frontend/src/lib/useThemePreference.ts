import { useState } from 'react';
import {
  getStoredThemePreference,
  setStoredThemePreference,
  type ThemePreference,
} from './theme';

/**
 * État React de la préférence de thème (issue #245) - le DOM (`data-theme`)
 * est déjà à jour dès le premier rendu (script inline anti-FOUC de
 * `index.html`, voir `theme.ts`), ce hook sert uniquement à exposer la
 * valeur courante à l'UI de réglage (`ProfilPage`) et à la faire changer.
 * Pas de `useEffect` de synchronisation au montage : `getStoredThemePreference`
 * en lazy initializer suffit, la source de vérité (`localStorage`) ne change
 * jamais hors de `setPreference` ci-dessous (un seul onglet à la fois pour
 * ce réglage, pas de synchronisation multi-onglets requise par #245).
 */
export function useThemePreference(): [
  ThemePreference,
  (preference: ThemePreference) => void,
] {
  const [preference, setPreferenceState] = useState<ThemePreference>(
    getStoredThemePreference,
  );

  function setPreference(next: ThemePreference) {
    setStoredThemePreference(next);
    setPreferenceState(next);
  }

  return [preference, setPreference];
}

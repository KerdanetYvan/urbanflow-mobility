import { useState } from 'react';
import {
  getStoredGlyphSizePreference,
  setStoredGlyphSizePreference,
  type GlyphSizePreference,
} from './glyphSize';

/**
 * État React de la préférence de taille des glyphes (issue #246) - même
 * forme que `useThemePreference` (#245) : lazy initializer sur la valeur
 * stockée, pas de synchronisation multi-onglets (un seul onglet a la main
 * sur ce réglage à la fois, suffisant pour ce cas d'usage).
 */
export function useGlyphSizePreference(): [
  GlyphSizePreference,
  (preference: GlyphSizePreference) => void,
] {
  const [preference, setPreferenceState] = useState<GlyphSizePreference>(
    getStoredGlyphSizePreference,
  );

  function setPreference(next: GlyphSizePreference) {
    setStoredGlyphSizePreference(next);
    setPreferenceState(next);
  }

  return [preference, setPreference];
}

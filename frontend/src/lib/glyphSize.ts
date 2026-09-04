/**
 * Réglage manuel de la taille des repères de la carte (issue #246) - même
 * famille que `theme.ts` (#245) : préférence d'affichage propre à cet
 * appareil/navigateur (`localStorage`), pas une donnée de compte. Distincte
 * à dessein d'`accessibilityPreferences` du profil de mobilité
 * (`profiles/accessibility-preference.enum.ts`) : ce champ-là pondère le
 * SCORING des itinéraires côté backend, celui-ci ne touche qu'à l'affichage
 * côté client - décision PO explicite documentée dans l'issue.
 *
 * Deux valeurs seulement (pas de gradation fine) : la carte a déjà un
 * agrandissement de base selon la largeur d'écran (voir `useGlyphScale.ts`),
 * ce réglage n'a qu'à dire "plus grand encore" ou non, cohérent avec
 * l'acceptance de l'issue ("qui agrandit ENCORE les glyphes").
 */
export type GlyphSizePreference = 'normal' | 'large';

const STORAGE_KEY = 'urbanflow.glyphSize.v1';

/**
 * Lit la préférence enregistrée. `'normal'` par défaut, y compris si la
 * valeur stockée est absente ou corrompue - même garde-fou que
 * `getStoredThemePreference` (theme.ts).
 */
export function getStoredGlyphSizePreference(): GlyphSizePreference {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'large' ? 'large' : 'normal';
}

/** Enregistre la préférence. Contrairement à `setStoredThemePreference`, rien à appliquer immédiatement au DOM ici : la taille des glyphes est recalculée au rendu par `useGlyphScale`/`MapView`, pas posée en attribut global. */
export function setStoredGlyphSizePreference(
  preference: GlyphSizePreference,
): void {
  localStorage.setItem(STORAGE_KEY, preference);
}

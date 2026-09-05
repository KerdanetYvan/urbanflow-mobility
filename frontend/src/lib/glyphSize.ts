/**
 * Réglage manuel de la taille des repères de la carte (issue #246, étendu à
 * 4 paliers par #272) - même famille que `theme.ts` (#245) : préférence
 * d'affichage propre à cet appareil/navigateur (`localStorage`), pas une
 * donnée de compte. Distincte à dessein d'`accessibilityPreferences` du
 * profil de mobilité (`profiles/accessibility-preference.enum.ts`) : ce
 * champ-là pondère le SCORING des itinéraires côté backend, celui-ci ne
 * touche qu'à l'affichage côté client - décision PO explicite documentée
 * dans l'issue.
 *
 * 4 paliers (issue #272, retour testeur : "toujours trop petit même en
 * grande") - `'medium'` est désormais le PALIER PAR DÉFAUT plutôt que le
 * plus petit : l'ancien maximum (`'large'`, #246) restait perçu comme
 * minuscule, il n'était donc pas question de le garder comme référence
 * neutre. `'small'` permet de revenir en dessous pour qui trouve `'medium'`
 * déjà trop grand ; `'large'`/`'xlarge'` montent au-delà pour les usagers
 * qui ont besoin de repères bien plus visibles (accessibilité visuelle).
 */
export type GlyphSizePreference = 'small' | 'medium' | 'large' | 'xlarge';

const VALID_PREFERENCES: ReadonlySet<string> = new Set<GlyphSizePreference>([
  'small',
  'medium',
  'large',
  'xlarge',
]);

const STORAGE_KEY = 'urbanflow.glyphSize.v1';

/**
 * Lit la préférence enregistrée, avec migration de l'ancien système binaire
 * (#246 → #272) : un `'normal'` déjà enregistré (l'ancien défaut) devient
 * `'medium'` (le nouveau défaut) - personne ne redescend en dessous de ce
 * qu'il avait. Un `'large'` déjà enregistré reste `'large'` tel quel : cet
 * utilisateur avait explicitement demandé "plus grand que le défaut", il
 * reste sur le palier qui porte encore ce sens un cran au-dessus de
 * `'medium'`, même si sa valeur absolue a changé (voir `useGlyphScale.ts`).
 * `'medium'` par défaut si la valeur stockée est absente, corrompue, ou
 * inconnue - même garde-fou que `getStoredThemePreference` (theme.ts).
 */
export function getStoredGlyphSizePreference(): GlyphSizePreference {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'normal') return 'medium';
  if (stored !== null && VALID_PREFERENCES.has(stored)) {
    return stored as GlyphSizePreference;
  }
  return 'medium';
}

/** Enregistre la préférence. Contrairement à `setStoredThemePreference`, rien à appliquer immédiatement au DOM ici : la taille des glyphes est recalculée au rendu par `useGlyphScale`/`MapView`, pas posée en attribut global. */
export function setStoredGlyphSizePreference(
  preference: GlyphSizePreference,
): void {
  localStorage.setItem(STORAGE_KEY, preference);
}

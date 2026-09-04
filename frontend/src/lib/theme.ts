/**
 * Réglage manuel du thème clair/sombre (issue #245) - jusqu'ici l'app
 * suivait uniquement `prefers-color-scheme` (voir `styles/tokens.css`),
 * sans possibilité de le changer indépendamment du système d'exploitation.
 *
 * `localStorage` (pas le profil de mobilité backend) : préférence
 * d'affichage propre à cet appareil/navigateur, même famille que le cache
 * hors-ligne (`tripCache.ts`) plutôt que les données de compte (profil de
 * mobilité, historique) - pas de notion de compte nécessaire, cohérent avec
 * une app utilisable sans connexion (issue #64).
 *
 * `'system'` (valeur par défaut) : aucun attribut `data-theme` posé sur
 * `<html>`, `prefers-color-scheme` reprend la main normalement (voir
 * `tokens.css`, bloc `@media` non court-circuité). `'light'`/`'dark'` :
 * `data-theme` force le thème correspondant quel que soit le système.
 */
export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'urbanflow.theme.v1';

/**
 * Lit la préférence enregistrée (`localStorage`). `'system'` par défaut, y
 * compris si la valeur stockée est absente ou corrompue (jamais une valeur
 * invalide qui casserait `applyTheme` en aval) - pas de `try/catch` autour
 * de `localStorage` lui-même : même convention que `authStorage.ts`, aucun
 * appel `localStorage` de ce projet ne s'en protège (navigation privée
 * *tres* ancienne uniquement, negligeable ici).
 */
export function getStoredThemePreference(): ThemePreference {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : 'system';
}

/** Enregistre la préférence et l'applique immédiatement (voir `applyTheme`). */
export function setStoredThemePreference(preference: ThemePreference): void {
  localStorage.setItem(STORAGE_KEY, preference);
  applyTheme(preference);
}

/**
 * Pose ou retire `data-theme` sur `<html>` selon la préférence - seule
 * fonction qui touche au DOM ici (le reste de ce fichier est pur), pour
 * rester appelable aussi bien depuis React (`useThemePreference`) que
 * depuis le script inline anti-FOUC de `index.html` (dupliqué là-bas en JS
 * brut, ce module ES n'y est pas chargeable avant le premier paint - garder
 * les deux en synchronisation si cette logique change).
 */
export function applyTheme(preference: ThemePreference): void {
  if (preference === 'system') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', preference);
  }
}

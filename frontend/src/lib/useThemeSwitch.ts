import { useEffect, useState } from 'react';
import { useThemePreference } from './useThemePreference';

const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

/**
 * Vue "switch a 2 positions" de la preference de theme (issue #245,
 * decision UX en session) - a la difference de `useThemePreference`
 * (3 valeurs : 'light'/'dark'/'system'), l'interrupteur physique n'a que
 * 2 positions. Tant qu'aucun choix explicite n'a ete fait ('system'), le
 * switch se place sur le theme que le SYSTEME resout actuellement (et le
 * suit en direct si l'OS change de theme en cours de session, ex.
 * bascule automatique jour/nuit) - au premier clic, un choix explicite
 * clair/sombre est enregistre et le switch cesse de suivre le systeme
 * (pas de 3e position ni de retour a 'system' depuis le switch : decision
 * UX assumee, cf. discussion en session - la simplicite d'un vrai
 * interrupteur binaire l'emporte sur la possibilite de revenir en
 * arriere, rare en pratique une fois un choix fait).
 */
export function useThemeSwitch(): [isDark: boolean, toggle: () => void] {
  const [preference, setPreference] = useThemePreference();
  const [systemPrefersDark, setSystemPrefersDark] = useState(
    () => window.matchMedia(DARK_MEDIA_QUERY).matches,
  );

  useEffect(() => {
    // Ecoute seulement utile tant que preference === 'system' (sinon la
    // valeur systeme n'influence plus rien) mais reste branchee dans tous
    // les cas : plus simple qu'un abonnement conditionnel, et sans cout
    // reel (l'evenement 'change' de matchMedia est rare).
    const mediaQuery = window.matchMedia(DARK_MEDIA_QUERY);
    function handleChange(event: MediaQueryListEvent) {
      setSystemPrefersDark(event.matches);
    }
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const isDark = preference === 'system' ? systemPrefersDark : preference === 'dark';

  function toggle() {
    setPreference(isDark ? 'light' : 'dark');
  }

  return [isDark, toggle];
}

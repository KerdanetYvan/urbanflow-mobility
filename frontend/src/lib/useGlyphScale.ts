import { useEffect, useState } from 'react';
import type { GlyphSizePreference } from './glyphSize';
import { useGlyphSizePreference } from './useGlyphSizePreference';

/**
 * 768px : meme seuil desktop/tablette que le reste du projet (voir le
 * commentaire en tete de styles/tokens.css - repris litteralement partout,
 * pas de variable CSS possible pour une media query). Ici en JS (pas CSS)
 * car Leaflet construit ses icones (`L.divIcon`) en JS, pas via des regles
 * CSS classiques - voir MapView.tsx.
 */
const DESKTOP_MEDIA_QUERY = '(min-width: 768px)';

/**
 * Agrandissement de base selon la largeur d'ecran (issue #246, revu a la
 * hausse par #272 - retour testeur : "toujours trop petit meme en grande",
 * sur mobile ET desktop, mobile percu comme encore plus petit) : plus grand
 * sur petit ecran (mobile, lu "de pres" en mobilite, voir CLAUDE.md -
 * mobile-first) que sur desktop. Desktop ne garde plus les tailles
 * d'origine telles quelles (contrairement a #246) : meme le desktop devait
 * grossir, l'ecart entre les deux se creuse simplement un peu plus qu'avant
 * (x1.33 aujourd'hui contre x1.25 a l'origine).
 */
const MOBILE_SCALE = 2;
const DESKTOP_SCALE = 1.5;

/**
 * Multiplicateur du reglage manuel de taille (issue #246, etendu a 4
 * paliers par #272) - s'applique PAR-DESSUS l'agrandissement de base
 * ci-dessus, jamais a sa place. `'medium'` (nouveau defaut, voir
 * glyphSize.ts) depasse deja `'large'` d'avant #272 une fois combine a
 * MOBILE_SCALE/DESKTOP_SCALE ci-dessus : le testeur trouvait l'ancien
 * maximum trop petit, ce nouveau defaut ne pouvait donc pas repartir du
 * meme point. Valeurs de depart, a affiner apres verification visuelle
 * reelle dans le navigateur (voir issue #272) - aucun plafond volontaire
 * sur `'xlarge'` combine a MOBILE_SCALE : c'est precisement le cas d'usage
 * accessibilite vise, un usager qui le choisit veut le repere le plus gros
 * possible.
 */
const PREFERENCE_MULTIPLIERS: Record<GlyphSizePreference, number> = {
  small: 0.8,
  medium: 1.1,
  large: 1.4,
  xlarge: 1.7,
};

/**
 * Facteur d'echelle combine (ecran x reglage manuel) a appliquer aux tailles
 * de glyphes de la carte (issue #246) - voir MapView.tsx, ou chaque icone
 * devient une fonction de ce facteur plutot qu'une constante figee. Ecoute
 * les changements de largeur d'ecran EN DIRECT (pas seulement au montage) :
 * meme raison que useThemeSwitch (#245), une rotation d'ecran ou un
 * redimensionnement de fenetre doit rafraichir l'echelle sans recharger la
 * page.
 */
export function useGlyphScale(): number {
  const [preference] = useGlyphSizePreference();
  const [isDesktop, setIsDesktop] = useState(
    () => window.matchMedia(DESKTOP_MEDIA_QUERY).matches,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);
    function handleChange(event: MediaQueryListEvent) {
      setIsDesktop(event.matches);
    }
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const breakpointScale = isDesktop ? DESKTOP_SCALE : MOBILE_SCALE;
  const preferenceScale = PREFERENCE_MULTIPLIERS[preference];

  return breakpointScale * preferenceScale;
}

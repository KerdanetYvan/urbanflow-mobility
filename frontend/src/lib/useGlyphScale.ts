import { useEffect, useState } from 'react';
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
 * Agrandissement de base selon la largeur d'ecran (issue #246, acceptance
 * 1) : plus grand sur petit ecran (mobile, lu "de pres" en mobilite, voir
 * CLAUDE.md - mobile-first) que sur desktop, qui garde les tailles
 * d'origine (verifiees visuellement lors de #244) comme reference. Pas
 * l'inverse (desktop plus grand) : un petit ecran n'implique pas un besoin
 * de precision plus fine, au contraire.
 */
const MOBILE_SCALE = 1.25;
const DESKTOP_SCALE = 1;

/**
 * Multiplicateur du reglage manuel "agrandir les reperes" (issue #246,
 * acceptance 2) - s'applique PAR-DESSUS l'agrandissement de base ci-dessus,
 * jamais a sa place : un usager sur mobile qui active le reglage cumule les
 * deux (1.25 x 1.4 = 1.75), coherent avec "qui agrandit ENCORE les
 * glyphes" (formulation de l'issue).
 */
const LARGE_PREFERENCE_MULTIPLIER = 1.4;

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
  const preferenceScale =
    preference === 'large' ? LARGE_PREFERENCE_MULTIPLIER : 1;

  return breakpointScale * preferenceScale;
}

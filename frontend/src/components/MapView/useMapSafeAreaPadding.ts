import { useEffect, useState, type RefObject } from 'react';

/**
 * Marge de respiration ajoutee par-dessus l'espace reellement occupe par les
 * panneaux (issue #273) - meme valeur que l'ancien padding uniforme
 * `[24, 24]` d'avant ce correctif, pour ne pas coller le trajet directement
 * contre le bord du panneau une fois l'occultation retiree.
 */
const BASE_MARGIN = 24;

/** Meme seuil que useGlyphScale.ts - reutilise ici car la disposition des
 * panneaux (bandeau bas pleine largeur vs panneau flottant bas-gauche)
 * change au meme point de rupture. */
const DESKTOP_MEDIA_QUERY = '(min-width: 768px)';

/**
 * Marges asymetriques a appliquer au cadrage Leaflet (`fitBounds`/
 * equivalent, voir MapView.tsx) pour que le trajet/point affiche reste
 * entierement dans la portion de carte REELLEMENT visible, c'est-a-dire non
 * recouverte par les panneaux flottants (issue #273). Meme forme que les
 * options `paddingTopLeft`/`paddingBottomRight` de `L.Map#fitBounds`.
 */
export interface MapSafeAreaPadding {
  paddingTopLeft: [number, number];
  paddingBottomRight: [number, number];
}

const DEFAULT_PADDING: MapSafeAreaPadding = {
  paddingTopLeft: [BASE_MARGIN, BASE_MARGIN],
  paddingBottomRight: [BASE_MARGIN, BASE_MARGIN],
};

/**
 * Mesure l'espace REELLEMENT occupe par les panneaux flottants qui
 * chevauchent la carte (issue #273, retour testeur : le cadrage actuel
 * ignore ces panneaux et peut cacher une partie du trajet) et en deduit un
 * padding asymetrique a donner a Leaflet, plutot qu'une constante figee par
 * breakpoint (une constante ignorerait la hauteur reelle du panneau, qui
 * depend de son contenu - nombre de resultats, detail ouvert ou non...).
 *
 * Disposition connue des deux panneaux (voir RecherchePageResults.css) :
 * - `formPanelRef` (`.recherche-panel-form`) : bandeau plein largeur ancre en
 *   bas sur mobile (n'occulte que depuis le BAS) ; panneau flottant ancre en
 *   bas-gauche sur desktop (n'occulte que depuis la GAUCHE - traite comme
 *   s'etendant sur toute la hauteur plutot que de calculer aussi sa position
 *   verticale : approximation deliberement prudente, jamais insuffisante,
 *   voir le commentaire de MapView.tsx).
 * - `detailPanelRef` (`.resultats-detail-panel`, optionnel - absent sur
 *   l'ecran "formulaire" de RecherchePage.tsx) : panneau desktop uniquement,
 *   plus a droite du precedent - etend simplement l'occultation "gauche"
 *   jusqu'a son propre bord droit quand il est present.
 *
 * Recalcule sur : changement de taille des panneaux observes (contenu qui
 * grandit/retrecit, `ResizeObserver`), fin de transition CSS du bandeau
 * mobile (`transitionend` sur `transform` - repli/deploiement du sheet,
 * voir RecherchePageResults.css), et redimensionnement de fenetre (bascule
 * de breakpoint). Le changement d'attribut `data-sheet-state` lui-meme
 * (`MutationObserver`) est ecoute en plus de `transitionend` : sous
 * `prefers-reduced-motion: reduce`, la transition est desactivee
 * (`transition: none`) et `transitionend` ne se declenche jamais - la
 * mutation d'attribut reste le seul signal disponible dans ce cas.
 *
 * `detailPanelPresent` (au lieu de deduire sa presence de `detailPanelRef.
 * current`) : un ref React reste la MEME reference tout au long de la vie du
 * composant, seule sa propriete `.current` change quand l'element
 * apparait/disparait du DOM (ex. panneau de detail monte seulement une fois
 * un itineraire selectionne) - cette mutation seule ne redeclenche PAS cet
 * effet. `detailPanelPresent` est un booleen ordinaire, issu du meme rendu
 * que la condition qui monte ou non l'element : il change de valeur au bon
 * moment et force donc l'effet a se re-executer (a desabonner les anciens
 * observateurs, en reabonner sur la ref desormais a jour) exactement quand
 * le panneau apparait ou disparait.
 */
export function useMapSafeAreaPadding(
  formPanelRef: RefObject<HTMLElement | null>,
  detailPanelRef: RefObject<HTMLElement | null> | null = null,
  detailPanelPresent = false,
): MapSafeAreaPadding {
  const [padding, setPadding] = useState<MapSafeAreaPadding>(DEFAULT_PADDING);

  useEffect(() => {
    function recompute() {
      const isDesktop = window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
      const formRect = formPanelRef.current?.getBoundingClientRect();
      const detailRect = detailPanelPresent
        ? detailPanelRef?.current?.getBoundingClientRect()
        : undefined;

      if (isDesktop) {
        const rightMostEdge = Math.max(
          formRect?.right ?? 0,
          detailRect?.right ?? 0,
        );
        setPadding({
          paddingTopLeft: [rightMostEdge + BASE_MARGIN, BASE_MARGIN],
          paddingBottomRight: [BASE_MARGIN, BASE_MARGIN],
        });
      } else {
        const panelTop = formRect?.top ?? window.innerHeight;
        const bottomInset = Math.max(window.innerHeight - panelTop, 0);
        setPadding({
          paddingTopLeft: [BASE_MARGIN, BASE_MARGIN],
          paddingBottomRight: [BASE_MARGIN, bottomInset + BASE_MARGIN],
        });
      }
    }

    recompute();

    const resizeObserver = new ResizeObserver(recompute);
    if (formPanelRef.current) resizeObserver.observe(formPanelRef.current);
    if (detailPanelPresent && detailPanelRef?.current) {
      resizeObserver.observe(detailPanelRef.current);
    }

    const formEl = formPanelRef.current;
    // `transitionend` : mesure precise une fois le glissement du bandeau
    // mobile termine (voir la docstring ci-dessus).
    formEl?.addEventListener('transitionend', recompute);

    // `MutationObserver` sur `data-sheet-state` : filet de securite quand
    // aucune transition ne joue (repli/deploiement instantane sous
    // `prefers-reduced-motion: reduce`), seul cas ou `transitionend` ne
    // suffit pas.
    const mutationObserver = new MutationObserver(recompute);
    if (formEl) {
      mutationObserver.observe(formEl, {
        attributes: true,
        attributeFilter: ['data-sheet-state'],
      });
    }

    window.addEventListener('resize', recompute);

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      formEl?.removeEventListener('transitionend', recompute);
      window.removeEventListener('resize', recompute);
    };
  }, [formPanelRef, detailPanelRef, detailPanelPresent]);

  return padding;
}

import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AddressField from './AddressField';
import type { PlaceSuggestion } from '../../lib/places';

/**
 * Test de non-régression du positionnement flottant du dropdown
 * (issue #233, bug constaté en session : le dropdown du champ Destination
 * restait coincé sous le champ, écrasé avec un scroll interne, au lieu de
 * basculer au-dessus quand la place manquait en dessous).
 *
 * Cause : `size()` (dans la chaîne de middleware d'`AddressField`) rétrécit
 * le dropdown ; au calcul suivant, `flip()` — qui s'exécute avant `size()` —
 * mesurait ce dropdown déjà rétréci, le voyait « rentrer » sous le champ, et
 * ne basculait donc jamais. Le correctif réinitialise les contraintes de
 * taille (`minWidth`/`maxWidth`/`maxHeight` inline) au début de chaque
 * `updatePosition`, avant de rappeler `computePosition`.
 *
 * jsdom n'a pas de moteur de rendu : on ne peut pas vérifier la bascule
 * elle-même. On vérifie le mécanisme qui la rend possible — les styles de
 * taille sont bien remis à zéro avant chaque `computePosition`.
 */

// Contraintes de taille (`floatingEl.style.maxHeight`) observées à l'instant
// précis où `computePosition` est appelé, un enregistrement par appel.
const maxHeightAtEachComputeCall: string[] = [];
// Callback de repositionnement qu'`AddressField` confie à `autoUpdate` :
// capturé pour pouvoir simuler un 2e calcul (scroll/resize) à la main.
let triggerReposition: (() => void) | undefined;

vi.mock('@floating-ui/dom', () => ({
  // Les middlewares ne servent à rien ici (aucun calcul de layout possible
  // sous jsdom) : on les réduit à des objets inertes.
  offset: () => ({ name: 'offset', fn: () => ({}) }),
  flip: () => ({ name: 'flip', fn: () => ({}) }),
  shift: () => ({ name: 'shift', fn: () => ({}) }),
  size: () => ({ name: 'size', fn: () => ({}) }),
  // Enregistre l'état de `maxHeight` au moment de l'appel, puis renvoie une
  // position neutre.
  computePosition: vi.fn((_reference: HTMLElement, floating: HTMLElement) => {
    maxHeightAtEachComputeCall.push(floating.style.maxHeight);
    return Promise.resolve({
      x: 0,
      y: 0,
      placement: 'bottom-start',
      strategy: 'fixed',
      middlewareData: {},
    });
  }),
  // Appelle une fois le callback (comme le vrai `autoUpdate` au montage) et
  // le garde sous la main pour les rejeux manuels.
  autoUpdate: (
    _reference: HTMLElement,
    _floating: HTMLElement,
    update: () => void,
  ) => {
    triggerReposition = update;
    update();
    return () => {
      triggerReposition = undefined;
    };
  },
}));

const SUGGESTION: PlaceSuggestion = {
  label: 'Rue Jean Jaurès, Montgermont',
  lat: 48.15,
  lon: -1.7,
  kind: 'address',
};

beforeEach(() => {
  maxHeightAtEachComputeCall.length = 0;
  triggerReposition = undefined;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('AddressField - positionnement flottant (non-régression #233)', () => {
  it('réinitialise maxHeight avant chaque computePosition, même après un rétrécissement par size()', async () => {
    render(
      <AddressField
        id="destination-address"
        label="Destination"
        value="jean jaures"
        suggestions={[SUGGESTION]}
        onChange={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    // Le dropdown est monté (portal) et le 1er calcul a eu lieu au montage.
    expect(
      screen.getByRole('button', { name: 'Rue Jean Jaurès, Montgermont' }),
    ).toBeInTheDocument();
    expect(maxHeightAtEachComputeCall).toEqual(['']);

    // Simule l'effet de `size()` au 1er tour : il a plafonné le dropdown à
    // une hauteur ridicule (peu de place sous le champ Destination).
    const dropdown = screen.getByRole('listbox');
    dropdown.style.maxHeight = '92px';
    dropdown.style.maxWidth = '260px';
    dropdown.style.minWidth = '260px';

    // 2e calcul (comme un scroll / resize déclencherait via autoUpdate).
    triggerReposition?.();

    // Sans le correctif, flip() mesurerait ici un dropdown encore bridé à
    // 92px ; avec, la contrainte est repartie de zéro.
    expect(maxHeightAtEachComputeCall).toEqual(['', '']);
    expect(dropdown.style.maxHeight).toBe('');
    expect(dropdown.style.maxWidth).toBe('');
    expect(dropdown.style.minWidth).toBe('');
  });
});

import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { TripItinerary } from '../../lib/trips';
import ResultatsPage from './ResultatsPage';

const ORIGIN = { label: 'Gare Part-Dieu', lat: 45.76, lon: 4.86 };
const DESTINATION = { label: 'Hôtel de Ville', lat: 45.77, lon: 4.83 };

const FAST_ITINERARY: TripItinerary = {
  startTime: '2026-08-02T08:00:00.000Z',
  endTime: '2026-08-02T08:25:00.000Z',
  durationSeconds: 1500,
  transfers: 1,
  segments: [
    {
      mode: 'WALK',
      startTime: '2026-08-02T08:00:00.000Z',
      endTime: '2026-08-02T08:05:00.000Z',
      durationSeconds: 300,
      distanceMeters: 400,
      from: { name: 'Domicile', lat: 45.75, lon: 4.85 },
      to: { name: 'Arrêt Bellecour', lat: 45.751, lon: 4.851 },
      geometry: [
        { lat: 45.75, lon: 4.85 },
        { lat: 45.751, lon: 4.851 },
      ],
    },
    {
      mode: 'BUS',
      routeName: 'C1',
      startTime: '2026-08-02T08:05:00.000Z',
      endTime: '2026-08-02T08:25:00.000Z',
      durationSeconds: 1200,
      distanceMeters: 3000,
      from: { name: 'Arrêt Bellecour', lat: 45.751, lon: 4.851 },
      to: { name: 'Gare Part-Dieu', lat: 45.76, lon: 4.86 },
      geometry: [
        { lat: 45.751, lon: 4.851 },
        { lat: 45.76, lon: 4.86 },
      ],
    },
  ],
};

const SLOW_ITINERARY: TripItinerary = {
  startTime: '2026-08-02T08:00:00.000Z',
  endTime: '2026-08-02T08:45:00.000Z',
  durationSeconds: 2700,
  transfers: 0,
  segments: [
    {
      mode: 'WALK',
      startTime: '2026-08-02T08:00:00.000Z',
      endTime: '2026-08-02T08:45:00.000Z',
      durationSeconds: 2700,
      distanceMeters: 3200,
      from: { name: 'Domicile', lat: 45.75, lon: 4.85 },
      to: { name: 'Gare Part-Dieu', lat: 45.76, lon: 4.86 },
      geometry: [
        { lat: 45.75, lon: 4.85 },
        { lat: 45.76, lon: 4.86 },
      ],
    },
  ],
};

function renderPage(state?: {
  itineraries: TripItinerary[];
  origin: typeof ORIGIN;
  destination: typeof DESTINATION;
}) {
  return render(
    <MemoryRouter
      initialEntries={[{ pathname: '/resultats', state: state ?? null }]}
    >
      <Routes>
        <Route path="/resultats" element={<ResultatsPage />} />
        <Route path="/recherche" element={<p>Page de recherche</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

/**
 * Les deux dispositions (panneaux flottants desktop, bandeau mobile)
 * rendent chacune leur propre copie de la liste/du detail - seule une
 * media query CSS decide laquelle est visible, jsdom ne l'applique pas en
 * test. On se limite donc volontairement au panneau desktop
 * (`.resultats-panel-list`) pour les assertions generiques sur le contenu,
 * et on teste le bandeau mobile separement, explicitement, plus bas.
 */
function desktopCards(container: HTMLElement) {
  const panel = container.querySelector('.resultats-panel-list');
  if (!panel) throw new Error('.resultats-panel-list introuvable');
  return within(panel as HTMLElement).getAllByRole('button', { name: /min/ });
}

describe('ResultatsPage', () => {
  it("renvoie vers /recherche en l'absence de criteres de recherche (navigation directe, pas de resultat a afficher)", () => {
    renderPage();
    expect(screen.getByText('Page de recherche')).toBeInTheDocument();
  });

  it("affiche le contexte de la recherche et la liste dans l'ordre recu, sans re-trier", () => {
    const { container } = renderPage({
      itineraries: [FAST_ITINERARY, SLOW_ITINERARY],
      origin: ORIGIN,
      destination: DESTINATION,
    });

    expect(
      screen.getAllByRole('link', { name: 'Modifier la recherche' })[0].closest('p'),
    ).toHaveTextContent('De Gare Part-Dieu à Hôtel de Ville');

    const cards = desktopCards(container);
    expect(cards).toHaveLength(2);
    // Le premier itineraire recu (le plus rapide) reste premier affiche.
    expect(cards[0]).toHaveTextContent('25 min');
    expect(cards[1]).toHaveTextContent('45 min');
  });

  it("ne montre jamais de valeur de score (uniquement l'ordre recu du backend)", () => {
    renderPage({
      itineraries: [FAST_ITINERARY],
      origin: ORIGIN,
      destination: DESTINATION,
    });

    expect(screen.queryByText(/score/i)).not.toBeInTheDocument();
  });

  it('presente le premier itineraire selectionne par defaut, avec son detail par segment', () => {
    const { container } = renderPage({
      itineraries: [FAST_ITINERARY, SLOW_ITINERARY],
      origin: ORIGIN,
      destination: DESTINATION,
    });

    const cards = desktopCards(container);
    expect(cards[0]).toHaveAttribute('aria-current', 'true');
    expect(cards[1]).not.toHaveAttribute('aria-current');

    // Panneau detail desktop, toujours visible des qu'un itineraire est
    // selectionne (contrairement au bandeau mobile, replie par defaut sur
    // le detail - voir les tests dedies au bandeau plus bas).
    const detailPanel = container.querySelector('.resultats-panel-detail');
    expect(within(detailPanel as HTMLElement).getByText('Bus C1')).toBeInTheDocument();
    expect(
      within(detailPanel as HTMLElement).getByText('Arrêt Bellecour → Gare Part-Dieu'),
    ).toBeInTheDocument();
  });

  it('change le detail affiche quand un autre itineraire de la liste est selectionne', async () => {
    const user = userEvent.setup();
    const { container } = renderPage({
      itineraries: [FAST_ITINERARY, SLOW_ITINERARY],
      origin: ORIGIN,
      destination: DESTINATION,
    });

    const cards = desktopCards(container);
    await user.click(cards[1]);

    expect(cards[1]).toHaveAttribute('aria-current', 'true');
    expect(cards[0]).not.toHaveAttribute('aria-current');
    // Le detail par segment du deuxieme itineraire (trajet 100% marche) ne
    // contient plus de segment bus, ni dans le panneau desktop ni dans le
    // bandeau mobile (bascule sur "detail" au clic, voir ResultatsPage.tsx).
    expect(screen.queryByText('Bus C1')).not.toBeInTheDocument();
  });

  it("affiche un etat vide dedie (pas une erreur) quand aucun itineraire n'est trouve", () => {
    renderPage({ itineraries: [], origin: ORIGIN, destination: DESTINATION });

    expect(
      screen.getByText('Aucun itinéraire trouvé pour ce trajet.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Nouvelle recherche' }),
    ).toHaveAttribute('href', '/recherche');
  });

  describe('bandeau mobile (bottom sheet)', () => {
    function sheet(container: HTMLElement) {
      const el = container.querySelector('.resultats-sheet');
      if (!el) throw new Error('.resultats-sheet introuvable');
      return el as HTMLElement;
    }

    it('demarre replie sur la liste des trajets ("list")', () => {
      const { container } = renderPage({
        itineraries: [FAST_ITINERARY],
        origin: ORIGIN,
        destination: DESTINATION,
      });

      expect(sheet(container)).toHaveAttribute('data-sheet-state', 'list');
    });

    it('la poignee replie puis redeploie le bandeau au tap ("list" -> "collapsed" -> "list")', async () => {
      const user = userEvent.setup();
      const { container } = renderPage({
        itineraries: [FAST_ITINERARY],
        origin: ORIGIN,
        destination: DESTINATION,
      });
      const handleButton = container.querySelector(
        '.resultats-sheet-handle',
      ) as HTMLElement;

      await user.click(handleButton);
      expect(sheet(container)).toHaveAttribute('data-sheet-state', 'collapsed');

      await user.click(handleButton);
      expect(sheet(container)).toHaveAttribute('data-sheet-state', 'list');
    });

    it('affiche un apercu du trajet selectionne dans la poignee une fois replie', async () => {
      const user = userEvent.setup();
      const { container } = renderPage({
        itineraries: [FAST_ITINERARY],
        origin: ORIGIN,
        destination: DESTINATION,
      });
      const handleButton = container.querySelector(
        '.resultats-sheet-handle',
      ) as HTMLElement;

      await user.click(handleButton);

      expect(within(handleButton).getByText(/25 min/)).toBeInTheDocument();
    });

    it('selectionner un trajet dans le bandeau ouvre directement son detail, avec un retour vers la liste', async () => {
      const user = userEvent.setup();
      const { container } = renderPage({
        itineraries: [FAST_ITINERARY, SLOW_ITINERARY],
        origin: ORIGIN,
        destination: DESTINATION,
      });

      const sheetBody = container.querySelector(
        '.resultats-sheet-body',
      ) as HTMLElement;
      const secondCard = within(sheetBody).getAllByRole('button', {
        name: /min/,
      })[1];
      await user.click(secondCard);

      expect(sheet(container)).toHaveAttribute('data-sheet-state', 'detail');
      expect(
        within(sheetBody).getByRole('button', { name: /Tous les trajets/ }),
      ).toBeInTheDocument();

      await user.click(
        within(sheetBody).getByRole('button', { name: /Tous les trajets/ }),
      );
      expect(sheet(container)).toHaveAttribute('data-sheet-state', 'list');
    });

    it('un glissement vers le bas sur la poignee replie le bandeau', () => {
      const { container } = renderPage({
        itineraries: [FAST_ITINERARY],
        origin: ORIGIN,
        destination: DESTINATION,
      });
      const handleButton = container.querySelector(
        '.resultats-sheet-handle',
      ) as HTMLElement;

      fireEvent.touchStart(handleButton, { touches: [{ clientY: 100 }] });
      fireEvent.touchEnd(handleButton, {
        changedTouches: [{ clientY: 220 }],
      });

      expect(sheet(container)).toHaveAttribute('data-sheet-state', 'collapsed');
    });
  });
});

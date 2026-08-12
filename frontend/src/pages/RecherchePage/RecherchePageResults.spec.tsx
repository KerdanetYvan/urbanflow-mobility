import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TripItinerary, TripSegment } from '../../lib/trips';
import RecherchePageResults from './RecherchePageResults';

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

/** Deux lignes de bus distinctes sur le meme trajet (issue #129) - verifie que tripModeChips ne les fusionne pas en un seul badge. */
const TWO_BUS_LINES_ITINERARY: TripItinerary = {
  startTime: '2026-08-02T08:00:00.000Z',
  endTime: '2026-08-02T08:40:00.000Z',
  durationSeconds: 2400,
  transfers: 1,
  segments: [
    {
      mode: 'BUS',
      routeName: '24',
      startTime: '2026-08-02T08:00:00.000Z',
      endTime: '2026-08-02T08:15:00.000Z',
      durationSeconds: 900,
      distanceMeters: 2500,
      from: { name: 'Domicile', lat: 45.75, lon: 4.85 },
      to: { name: 'Republique', lat: 45.758, lon: 4.858 },
      geometry: [
        { lat: 45.75, lon: 4.85 },
        { lat: 45.758, lon: 4.858 },
      ],
    },
    {
      mode: 'BUS',
      routeName: 'C6',
      startTime: '2026-08-02T08:15:00.000Z',
      endTime: '2026-08-02T08:40:00.000Z',
      durationSeconds: 1500,
      distanceMeters: 3800,
      from: { name: 'Republique', lat: 45.758, lon: 4.858 },
      to: { name: 'Gare Part-Dieu', lat: 45.76, lon: 4.86 },
      geometry: [
        { lat: 45.758, lon: 4.858 },
        { lat: 45.76, lon: 4.86 },
      ],
    },
  ] satisfies TripSegment[],
};

function renderResults(
  itineraries: TripItinerary[] | null,
  onEditSearch = vi.fn(),
) {
  return {
    onEditSearch,
    ...render(
      <RecherchePageResults
        origin={ORIGIN}
        destination={DESTINATION}
        itineraries={itineraries}
        onEditSearch={onEditSearch}
      />,
    ),
  };
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

describe('RecherchePageResults', () => {
  it("affiche une disposition en chargement (carte origine/destination + squelette) quand itineraries est null (issue #73)", () => {
    const { container } = renderResults(null);

    // Le texte "De X à Y" est reparti sur plusieurs noeuds texte (JSX) :
    // on verifie le contenu textuel complet du <p>, pas un noeud isole.
    expect(
      screen
        .getAllByRole('button', { name: 'Modifier la recherche' })[0]
        .closest('p'),
    ).toHaveTextContent('De Gare Part-Dieu à Hôtel de Ville');
    expect(container.querySelector('.resultats-skeleton')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /min/ })).not.toBeInTheDocument();
  });

  it("appelle onEditSearch au clic sur 'Modifier la recherche' pendant le chargement", async () => {
    const user = userEvent.setup();
    const { onEditSearch } = renderResults(null);

    await user.click(
      screen.getAllByRole('button', { name: 'Modifier la recherche' })[0],
    );

    expect(onEditSearch).toHaveBeenCalledTimes(1);
  });

  it("affiche le contexte de la recherche et la liste dans l'ordre recu, sans re-trier", () => {
    const { container } = renderResults([FAST_ITINERARY, SLOW_ITINERARY]);

    expect(
      screen
        .getAllByRole('button', { name: 'Modifier la recherche' })[0]
        .closest('p'),
    ).toHaveTextContent('De Gare Part-Dieu à Hôtel de Ville');

    const cards = desktopCards(container);
    expect(cards).toHaveLength(2);
    // Le premier itineraire recu (le plus rapide) reste premier affiche.
    expect(cards[0]).toHaveTextContent('25 min');
    expect(cards[1]).toHaveTextContent('45 min');
  });

  it("ne montre jamais de valeur de score (uniquement l'ordre recu du backend)", () => {
    renderResults([FAST_ITINERARY]);
    expect(screen.queryByText(/score/i)).not.toBeInTheDocument();
  });

  it('presente le premier itineraire selectionne par defaut, avec son detail par segment', () => {
    const { container } = renderResults([FAST_ITINERARY, SLOW_ITINERARY]);

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
    const { container } = renderResults([FAST_ITINERARY, SLOW_ITINERARY]);

    const cards = desktopCards(container);
    await user.click(cards[1]);

    expect(cards[1]).toHaveAttribute('aria-current', 'true');
    expect(cards[0]).not.toHaveAttribute('aria-current');
    // Le detail par segment du deuxieme itineraire (trajet 100% marche) ne
    // contient plus de segment bus, ni dans le panneau desktop ni dans le
    // bandeau mobile (bascule sur "detail" au clic, voir RecherchePageResults.tsx).
    expect(screen.queryByText('Bus C1')).not.toBeInTheDocument();
  });

  it("affiche un etat vide dedie (pas une erreur) quand aucun itineraire n'est trouve", async () => {
    const user = userEvent.setup();
    const { onEditSearch } = renderResults([]);

    expect(
      screen.getByText('Aucun itinéraire trouvé pour ce trajet.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Nouvelle recherche' }));
    expect(onEditSearch).toHaveBeenCalledTimes(1);
  });

  describe('badges de ligne par mode de transport (issue #129)', () => {
    it('affiche un badge de ligne avec le numero de ligne pour un segment BUS, a la place de l icone', () => {
      const { container } = renderResults([FAST_ITINERARY]);

      const card = desktopCards(container)[0];
      expect(within(card).getByText('C1')).toHaveClass('line-badge--bus');
    });

    it('affiche deux badges distincts pour deux lignes de bus differentes sur le meme itineraire', () => {
      const { container } = renderResults([TWO_BUS_LINES_ITINERARY]);

      const card = desktopCards(container)[0];
      expect(within(card).getByText('24')).toBeInTheDocument();
      expect(within(card).getByText('C6')).toBeInTheDocument();
    });

    it('garde l icone existante pour un mode sans ligne (marche)', () => {
      const { container } = renderResults([SLOW_ITINERARY]);

      const card = desktopCards(container)[0];
      // SLOW_ITINERARY n'a qu'un segment WALK : aucun badge de ligne ne doit apparaitre.
      expect(card.querySelector('.line-badge')).not.toBeInTheDocument();
    });

    it('inclut le numero de ligne dans le texte cache pour lecteurs d ecran', () => {
      renderResults([FAST_ITINERARY]);

      expect(screen.getAllByText('Modes : Marche, Bus C1.')[0]).toBeInTheDocument();
    });

    it('affiche aussi les badges de ligne dans l apercu compact du bandeau mobile replie', async () => {
      const user = userEvent.setup();
      const { container } = renderResults([FAST_ITINERARY]);

      const handleButton = container.querySelector('.resultats-sheet-handle') as HTMLElement;
      await user.click(handleButton);

      expect(within(handleButton).getByText('C1')).toBeInTheDocument();
    });
  });

  describe('bandeau mobile (bottom sheet)', () => {
    function sheet(container: HTMLElement) {
      const el = container.querySelector('.resultats-sheet');
      if (!el) throw new Error('.resultats-sheet introuvable');
      return el as HTMLElement;
    }

    it('demarre replie sur la liste des trajets ("list")', () => {
      const { container } = renderResults([FAST_ITINERARY]);
      expect(sheet(container)).toHaveAttribute('data-sheet-state', 'list');
    });

    it('la poignee replie puis redeploie le bandeau au tap ("list" -> "collapsed" -> "list")', async () => {
      const user = userEvent.setup();
      const { container } = renderResults([FAST_ITINERARY]);
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
      const { container } = renderResults([FAST_ITINERARY]);
      const handleButton = container.querySelector(
        '.resultats-sheet-handle',
      ) as HTMLElement;

      await user.click(handleButton);

      expect(within(handleButton).getByText(/25 min/)).toBeInTheDocument();
    });

    it('selectionner un trajet dans le bandeau ouvre directement son detail, avec un retour vers la liste', async () => {
      const user = userEvent.setup();
      const { container } = renderResults([FAST_ITINERARY, SLOW_ITINERARY]);

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
      const { container } = renderResults([FAST_ITINERARY]);
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

import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { formatTime } from '../../lib/format';
import * as sharedMobilityLib from '../../lib/sharedMobility';
import type {
  TripFallback,
  TripItinerary,
  TripSegment,
} from '../../lib/trips';
import RecherchePageResults from './RecherchePageResults';

// MapView (rendue par cet ecran) charge les stations en libre-service au
// montage (issue #13) - mocke pour ne jamais dependre d'un vrai appel
// reseau dans ce fichier de test, qui ne s'interesse pas a cette
// fonctionnalite (meme raisonnement que RecherchePage.spec.tsx).
vi.mock('../../lib/sharedMobility');

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
      routeColor: '95C11E',
      routeTextColor: '1A171B',
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
  accessibilityPreferences?: string[],
  fallback?: TripFallback,
) {
  return {
    onEditSearch,
    ...render(
      <RecherchePageResults
        origin={ORIGIN}
        destination={DESTINATION}
        itineraries={itineraries}
        fallback={fallback}
        onEditSearch={onEditSearch}
        accessibilityPreferences={accessibilityPreferences}
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
  beforeEach(() => {
    vi.mocked(sharedMobilityLib.fetchSharedMobilityStations).mockResolvedValue(
      [],
    );
  });

  it("affiche une disposition en chargement (carte origine/destination + squelette) quand itineraries est null (issue #73)", () => {
    const { container } = renderResults(null);

    // Le texte "De X à Y" est reparti sur plusieurs noeuds texte (JSX) :
    // on verifie le contenu textuel complet du <p>, pas un noeud isole.
    expect(
      screen
        .getAllByRole('button', { name: 'Modifier la recherche' })[0]
        .closest('p'),
    ).toHaveTextContent('De Gare Part-Dieu à Hôtel de Ville');
    expect(container.querySelector('.skeleton')).toBeInTheDocument();
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

  describe('itineraires regroupes par prochain passage (issue #127/#173)', () => {
    it('affiche les prochains passages dans le detail de l\'itineraire selectionne, pas sur la carte compacte (issue #173)', () => {
      const grouped: TripItinerary = {
        ...FAST_ITINERARY,
        nextDepartures: [
          '2026-08-02T08:00:00.000Z',
          '2026-08-02T08:10:00.000Z',
          '2026-08-02T08:20:00.000Z',
        ],
      };
      const { container } = renderResults([grouped]);

      // Heures formatees dynamiquement (formatTime, fuseau local) plutot que
      // codees en dur : le fuseau du runner CI n'est pas Europe/Paris comme
      // en local, un texte fige aurait echoue en CI sans etre faux ici.
      const expected =
        `Prochain passage à ${formatTime(grouped.nextDepartures![0])}, puis ` +
        `${formatTime(grouped.nextDepartures![1])}, ${formatTime(grouped.nextDepartures![2])}`;

      const detailPanel = container.querySelector(
        '.resultats-panel-detail',
      ) as HTMLElement;
      expect(detailPanel).toHaveTextContent(expected);

      // Plus sur la carte compacte de la liste (le but de #173 : l'alleger).
      const cards = desktopCards(container);
      expect(cards[0]).not.toHaveTextContent('Prochain passage');
    });

    it("n'affiche aucun texte de prochain passage quand l'itineraire n'a pas ete regroupe (nextDepartures absent)", () => {
      const { container } = renderResults([FAST_ITINERARY]);

      const detailPanel = container.querySelector(
        '.resultats-panel-detail',
      ) as HTMLElement;
      expect(detailPanel).not.toHaveTextContent('Prochain passage');
      expect(desktopCards(container)[0]).not.toHaveTextContent('Prochain passage');
    });
  });

  describe('badges qualitatifs de scoring (issue #126)', () => {
    it("affiche le badge 'meilleur choix global' sur le premier itineraire, absent des autres, sans preference prioritaire", () => {
      const { container } = renderResults([FAST_ITINERARY, SLOW_ITINERARY]);

      const cards = desktopCards(container);
      expect(
        within(cards[0]).getByText('Le plus adapté à vos critères'),
      ).toBeInTheDocument();
      expect(
        within(cards[1]).queryByText('Le plus adapté à vos critères'),
      ).not.toBeInTheDocument();
    });

    it("affiche le badge cible sur l'itineraire pertinent (pas forcement le premier) quand limit_transfers est prioritaire", () => {
      // FAST_ITINERARY (index 0, 1 correspondance) reste le meilleur choix
      // global ; SLOW_ITINERARY (index 1, 0 correspondance) est celui qui
      // satisfait le mieux le critere "limit_transfers".
      const { container } = renderResults(
        [FAST_ITINERARY, SLOW_ITINERARY],
        undefined,
        ['limit_transfers'],
      );

      const cards = desktopCards(container);
      expect(
        within(cards[0]).getByText('Le plus adapté à vos critères'),
      ).toBeInTheDocument();
      expect(
        within(cards[1]).getByText('Le moins de correspondances'),
      ).toBeInTheDocument();
    });

    it('n’affiche jamais plus de 2 badges au total sur la liste', () => {
      const { container } = renderResults(
        [FAST_ITINERARY, SLOW_ITINERARY],
        undefined,
        ['limit_transfers'],
      );

      const panel = container.querySelector('.resultats-panel-list') as HTMLElement;
      expect(within(panel).getAllByText(/./, { selector: '.badge' })).toHaveLength(2);
    });

    it("n'affiche aucune valeur chiffree dans le texte des badges", () => {
      const { container } = renderResults(
        [FAST_ITINERARY, SLOW_ITINERARY],
        undefined,
        ['limit_transfers'],
      );

      const panel = container.querySelector('.resultats-panel-list') as HTMLElement;
      for (const badge of within(panel).getAllByText(/./, { selector: '.badge' })) {
        expect(badge.textContent).not.toMatch(/\d/);
      }
    });

    it('affiche aussi les badges dans le bandeau mobile', () => {
      const { container } = renderResults(
        [FAST_ITINERARY, SLOW_ITINERARY],
        undefined,
        ['limit_transfers'],
      );

      const sheetBody = container.querySelector('.resultats-sheet-body') as HTMLElement;
      expect(
        within(sheetBody).getByText('Le moins de correspondances'),
      ).toBeInTheDocument();
    });
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

  it("rend l'etat vide DANS le panneau fusionne, plus de page separee (issue #190)", async () => {
    const user = userEvent.setup();
    const { container, onEditSearch } = renderResults([]);

    // Plus de `.resultats-page` : meme coquille carte + panneau que
    // "recherche en cours".
    expect(container.querySelector('.resultats-page')).not.toBeInTheDocument();
    expect(container.querySelector('.resultats-shell')).toBeInTheDocument();
    expect(container.querySelector('.resultats-map-bg')).toBeInTheDocument();

    const listPanel = container.querySelector(
      '.resultats-panel-list',
    ) as HTMLElement;
    expect(
      within(listPanel).getByText(
        'Aucun itinéraire trouvé pour ce trajet, même à pied.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // Action de recours = "Modifier la recherche" de SearchContext (edition
    // en place, decision #190).
    await user.click(
      within(listPanel).getByRole('button', { name: 'Modifier la recherche' }),
    );
    expect(onEditSearch).toHaveBeenCalledTimes(1);
  });

  it('affiche le trajet a pied de repli comme un resultat normal, avec un bandeau explicatif (issue #190)', () => {
    const walkItinerary: TripItinerary = {
      startTime: '2026-08-02T08:00:00.000Z',
      endTime: '2026-08-02T08:18:00.000Z',
      durationSeconds: 1080,
      transfers: 0,
      segments: [
        {
          mode: 'WALK',
          startTime: '2026-08-02T08:00:00.000Z',
          endTime: '2026-08-02T08:18:00.000Z',
          durationSeconds: 1080,
          distanceMeters: 1400,
          from: { name: 'Gare Part-Dieu', lat: 45.76, lon: 4.86 },
          to: { name: 'Hôtel de Ville', lat: 45.77, lon: 4.83 },
          geometry: [
            { lat: 45.76, lon: 4.86 },
            { lat: 45.77, lon: 4.83 },
          ],
        },
      ],
    };

    const { container } = renderResults([walkItinerary], undefined, undefined, {
      kind: 'walk-only',
    });

    const listPanel = container.querySelector(
      '.resultats-panel-list',
    ) as HTMLElement;
    // Bandeau explicatif ...
    expect(
      within(listPanel).getByText(/Aucun trajet en transport en commun/),
    ).toBeInTheDocument();
    // ... au-dessus d'un vrai resultat (carte-itineraire cliquable + detail).
    expect(
      within(listPanel).getByRole('button', { name: /min/ }),
    ).toBeInTheDocument();
    expect(
      container.querySelector('.resultats-panel-detail'),
    ).toBeInTheDocument();
  });

  it('affiche le repli "prochain creneau" comme un resultat normal, avec un bandeau heure demandee -> heure reelle (issue #91)', () => {
    // Demandé à 22:00, prochain trajet le lendemain à 08:00.
    const laterItinerary: TripItinerary = {
      ...FAST_ITINERARY,
      startTime: '2026-08-03T06:00:00.000Z',
      endTime: '2026-08-03T06:25:00.000Z',
    };

    const { container } = renderResults(
      [laterItinerary],
      undefined,
      undefined,
      {
        kind: 'later-departure',
        requestedDepartureTime: '2026-08-02T20:00:00.000Z',
        actualDepartureTime: '2026-08-03T06:00:00.000Z',
      },
    );

    const listPanel = container.querySelector(
      '.resultats-panel-list',
    ) as HTMLElement;
    const note = within(listPanel).getByText(/Aucun trajet à \d{2}:\d{2}/);
    // "Aucun trajet à HH:mm. Prochain trajet <jour> à HH:mm."
    expect(note).toHaveTextContent(/Prochain trajet .*\d{2}:\d{2}\.?$/);
    // Un vrai resultat est affiche en dessous (pas l'etat vide).
    expect(container.querySelector('.resultats-empty')).not.toBeInTheDocument();
    expect(
      within(listPanel).getByRole('button', { name: /min/ }),
    ).toBeInTheDocument();
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

    it('affiche aussi le badge de ligne dans le detail deplie du trajet selectionne', () => {
      const { container } = renderResults([FAST_ITINERARY]);

      const detailPanel = container.querySelector('.resultats-panel-detail') as HTMLElement;
      expect(within(detailPanel).getByText('C1')).toHaveClass('line-badge--bus');
    });

    it('garde l icone existante dans le detail deplie pour un segment marche', () => {
      const { container } = renderResults([FAST_ITINERARY]);

      const detailPanel = container.querySelector('.resultats-panel-detail') as HTMLElement;
      const walkSegment = within(detailPanel)
        .getByText('Marche')
        .closest('.resultats-segment') as HTMLElement;
      expect(walkSegment.querySelector('.line-badge')).not.toBeInTheDocument();
    });

    it('applique la couleur de ligne GTFS en fond plein sur le badge (issue #129, section 8)', () => {
      const { container } = renderResults([FAST_ITINERARY]);

      const card = desktopCards(container)[0];
      expect(within(card).getByText('C1')).toHaveStyle({
        background: '#95C11E',
        color: '#1A171B',
      });
    });

    it('applique aussi la couleur de ligne dans le detail deplie du trajet selectionne', () => {
      const { container } = renderResults([FAST_ITINERARY]);

      const detailPanel = container.querySelector('.resultats-panel-detail') as HTMLElement;
      expect(within(detailPanel).getByText('C1')).toHaveStyle({ background: '#95C11E' });
    });

    it('retombe sur le badge neutre quand le segment n a pas de couleur GTFS', () => {
      const { container } = renderResults([TWO_BUS_LINES_ITINERARY]);

      const card = desktopCards(container)[0];
      // TWO_BUS_LINES_ITINERARY n'a pas routeColor/routeTextColor sur ses segments.
      expect(within(card).getByText('24')).not.toHaveAttribute('style');
    });
  });

  describe('vue Edition (issue #171/#172)', () => {
    it("affiche le contenu de renderEditForm et masque la liste/le detail quand isEditingSearch est vrai", () => {
      const { container } = render(
        <RecherchePageResults
          origin={ORIGIN}
          destination={DESTINATION}
          itineraries={[FAST_ITINERARY]}
          onEditSearch={vi.fn()}
          isEditingSearch
          renderEditForm={() => <input aria-label="Origine (test)" />}
        />,
      );

      expect(screen.getByLabelText('Origine (test)')).toBeInTheDocument();
      expect(container.querySelector('.resultats-panels')).not.toBeInTheDocument();
      expect(container.querySelector('.resultats-sheet')).not.toBeInTheDocument();
      expect(container.querySelector('.recherche-panel-form')).toBeInTheDocument();
    });

    it('la touche Echap appelle onCancelEdit pendant l\'edition', async () => {
      const user = userEvent.setup();
      const onCancelEdit = vi.fn();
      render(
        <RecherchePageResults
          origin={ORIGIN}
          destination={DESTINATION}
          itineraries={[FAST_ITINERARY]}
          onEditSearch={vi.fn()}
          isEditingSearch
          onCancelEdit={onCancelEdit}
          renderEditForm={() => <input aria-label="Origine (test)" />}
        />,
      );

      await user.keyboard('{Escape}');

      expect(onCancelEdit).toHaveBeenCalledTimes(1);
    });

    it("sans isEditingSearch, la liste reste affichee meme si renderEditForm est fourni", () => {
      const { container } = renderResults([FAST_ITINERARY]);
      expect(container.querySelector('.recherche-panel-form')).not.toBeInTheDocument();
      expect(desktopCards(container)).toHaveLength(1);
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

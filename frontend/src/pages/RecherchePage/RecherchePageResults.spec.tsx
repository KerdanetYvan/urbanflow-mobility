import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import * as followedTripLib from '../../lib/followedTrip';
import { formatTime } from '../../lib/format';
import * as sharedMobilityLib from '../../lib/sharedMobility';
import type {
  TripFallback,
  TripItinerary,
  TripSegment,
} from '../../lib/trips';
import * as useAuthLib from '../../lib/useAuth';
import RecherchePageResults from './RecherchePageResults';

// MapView (rendue par cet ecran) charge les stations en libre-service au
// montage (issue #13) - mocke pour ne jamais dependre d'un vrai appel
// reseau dans ce fichier de test, qui ne s'interesse pas a cette
// fonctionnalite (meme raisonnement que RecherchePage.spec.tsx).
vi.mock('../../lib/sharedMobility');
// TripFollowButton (rendu par ItinerarySegments, issue #18) verifie le
// suivi actif au montage - mocke pour la meme raison que sharedMobility
// ci-dessus.
vi.mock('../../lib/followedTrip');
// useAuth mocke directement plutot qu'un vrai <AuthProvider> (qui lit
// localStorage a son montage, hors-sujet pour ce fichier qui ne teste
// aucun comportement lie a l'authentification elle-meme - voir
// RecherchePage.spec.tsx pour les tests qui en ont reellement besoin).
vi.mock('../../lib/useAuth');

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

/**
 * Formulaire de test par defaut (issue #234) : un simple champ repere,
 * suffisant pour verifier que RecherchePageResults l'affiche bien (une
 * seule fois, en tete de la carte persistante) - le contenu reel du
 * formulaire est teste par RecherchePage.spec.tsx, pas ici
 * (RecherchePageResults ne connait le formulaire qu'a travers cette
 * fonction, fournie par son parent).
 */
const DEFAULT_SEARCH_FORM = () => <input aria-label="Origine (test)" />;

function renderResults(
  itineraries: TripItinerary[] | null,
  renderSearchForm = DEFAULT_SEARCH_FORM,
  accessibilityPreferences?: string[],
  fallback?: TripFallback,
  fromCache?: boolean,
) {
  return render(
    // MemoryRouter (issue #18) : ItinerarySegments rend desormais
    // TripFollowButton (useNavigate) - useAuth est mocke directement
    // (voir vi.mock ci-dessus), pas besoin d'un vrai <AuthProvider>.
    <MemoryRouter>
      <RecherchePageResults
        origin={ORIGIN}
        destination={DESTINATION}
        itineraries={itineraries}
        fallback={fallback}
        fromCache={fromCache}
        accessibilityPreferences={accessibilityPreferences}
        renderSearchForm={renderSearchForm}
      />
    </MemoryRouter>,
  );
}

describe('RecherchePageResults', () => {
  beforeEach(() => {
    vi.mocked(sharedMobilityLib.fetchSharedMobilityStations).mockResolvedValue(
      [],
    );
    // Visiteur non connecte par defaut dans ces tests : getCurrentFollowedTrip
    // n'est meme pas appele par TripFollowButton dans ce cas (voir son
    // effet), mais un mock explicite evite toute ambiguite si un test
    // authentifie l'utilisateur.
    vi.mocked(useAuthLib.useAuth).mockReturnValue({
      isAuthenticated: false,
      setAuthenticated: vi.fn(),
    });
    vi.mocked(followedTripLib.getCurrentFollowedTrip).mockResolvedValue(null);
  });

  it("affiche une disposition en chargement (carte origine/destination + squelette) quand itineraries est null (issue #73)", () => {
    const { container } = renderResults(null);

    // Carte de recherche persistante (issue #234), affichee des l'etat de
    // chargement.
    expect(screen.getByLabelText('Origine (test)')).toBeInTheDocument();
    expect(container.querySelector('.skeleton')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /min/ })).not.toBeInTheDocument();
  });

  it("affiche la liste dans l'ordre recu, sans re-trier", () => {
    renderResults([FAST_ITINERARY, SLOW_ITINERARY]);

    const cards = screen.getAllByRole('button', { name: /min/ });
    expect(cards).toHaveLength(2);
    // Le premier itineraire recu (le plus rapide) reste premier affiche.
    expect(cards[0]).toHaveTextContent('25 min');
    expect(cards[1]).toHaveTextContent('45 min');
  });

  it("ne montre jamais de valeur de score (uniquement l'ordre recu du backend)", () => {
    renderResults([FAST_ITINERARY]);
    expect(screen.queryByText(/score/i)).not.toBeInTheDocument();
  });

  describe('perturbation en cours (issue #18)', () => {
    it("affiche le bouton \"Suivre ce trajet\" dans le detail de l'itineraire selectionne", () => {
      renderResults([FAST_ITINERARY]);

      expect(
        screen.getByRole('button', { name: 'Suivre ce trajet' }),
      ).toBeInTheDocument();
    });

    it(
      "affiche un marqueur \"Perturbation en cours\" (distinct des badges " +
        'qualitatifs) quand disrupted est vrai',
      () => {
        renderResults([{ ...FAST_ITINERARY, disrupted: true }]);

        expect(screen.getByText('Perturbation en cours')).toBeInTheDocument();
      },
    );

    it("n'affiche aucun marqueur de perturbation quand disrupted est absent", () => {
      renderResults([FAST_ITINERARY]);

      expect(
        screen.queryByText('Perturbation en cours'),
      ).not.toBeInTheDocument();
    });
  });

  describe('mode degrade - resultats servis depuis le cache local (issue #10)', () => {
    it('affiche un bandeau explicite quand fromCache est vrai', () => {
      renderResults([FAST_ITINERARY], undefined, undefined, undefined, true);

      expect(screen.getByText('Résultats hors ligne')).toBeInTheDocument();
    });

    it("n'affiche aucun bandeau de mode degrade pour un resultat frais (fromCache absent)", () => {
      renderResults([FAST_ITINERARY]);

      expect(
        screen.queryByText('Résultats hors ligne'),
      ).not.toBeInTheDocument();
    });

    it('affiche le bandeau de mode degrade ET le bandeau de repli simultanement si les deux sont presents', () => {
      renderResults(
        [FAST_ITINERARY],
        undefined,
        undefined,
        { kind: 'walk-only' },
        true,
      );

      expect(screen.getByText('Résultats hors ligne')).toBeInTheDocument();
      expect(
        screen.getByText(/Aucun trajet en transport en commun/),
      ).toBeInTheDocument();
    });
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

      const detail = container.querySelector('.resultats-detail') as HTMLElement;
      expect(detail).toHaveTextContent(expected);

      // Plus sur la carte compacte de la liste (le but de #173 : l'alleger).
      const card = screen.getAllByRole('button', { name: /min/ })[0];
      expect(card).not.toHaveTextContent('Prochain passage');
    });

    it("n'affiche aucun texte de prochain passage quand l'itineraire n'a pas ete regroupe (nextDepartures absent)", () => {
      const { container } = renderResults([FAST_ITINERARY]);

      const detail = container.querySelector('.resultats-detail') as HTMLElement;
      expect(detail).not.toHaveTextContent('Prochain passage');
      expect(
        screen.getAllByRole('button', { name: /min/ })[0],
      ).not.toHaveTextContent('Prochain passage');
    });
  });

  describe('badges qualitatifs de scoring (issue #126)', () => {
    it("affiche le badge 'meilleur choix global' sur le premier itineraire, absent des autres, sans preference prioritaire", () => {
      renderResults([FAST_ITINERARY, SLOW_ITINERARY]);

      const cards = screen.getAllByRole('button', { name: /min/ });
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
      renderResults(
        [FAST_ITINERARY, SLOW_ITINERARY],
        undefined,
        ['limit_transfers'],
      );

      const cards = screen.getAllByRole('button', { name: /min/ });
      expect(
        within(cards[0]).getByText('Le plus adapté à vos critères'),
      ).toBeInTheDocument();
      expect(
        within(cards[1]).getByText('Le moins de correspondances'),
      ).toBeInTheDocument();
    });

    it('n’affiche jamais plus de 2 badges au total sur la liste', () => {
      renderResults(
        [FAST_ITINERARY, SLOW_ITINERARY],
        undefined,
        ['limit_transfers'],
      );

      expect(screen.getAllByText(/./, { selector: '.badge' })).toHaveLength(2);
    });

    it("n'affiche aucune valeur chiffree dans le texte des badges", () => {
      renderResults(
        [FAST_ITINERARY, SLOW_ITINERARY],
        undefined,
        ['limit_transfers'],
      );

      for (const badge of screen.getAllByText(/./, { selector: '.badge' })) {
        expect(badge.textContent).not.toMatch(/\d/);
      }
    });
  });

  it('presente le premier itineraire selectionne par defaut, avec son detail par segment', () => {
    const { container } = renderResults([FAST_ITINERARY, SLOW_ITINERARY]);

    const cards = screen.getAllByRole('button', { name: /min/ });
    expect(cards[0]).toHaveAttribute('aria-current', 'true');
    expect(cards[1]).not.toHaveAttribute('aria-current');

    // Detail affiche a la suite de la liste, des qu'un itineraire est
    // selectionne (issue #234 : plus de panneau/etat dedie, un seul et
    // meme corps defilant).
    const detail = container.querySelector('.resultats-detail') as HTMLElement;
    expect(within(detail).getByText('Bus C1')).toBeInTheDocument();
    expect(
      within(detail).getByText('Arrêt Bellecour → Gare Part-Dieu'),
    ).toBeInTheDocument();
  });

  it('change le detail affiche quand un autre itineraire de la liste est selectionne', async () => {
    const user = userEvent.setup();
    renderResults([FAST_ITINERARY, SLOW_ITINERARY]);

    const cards = screen.getAllByRole('button', { name: /min/ });
    await user.click(cards[1]);

    expect(cards[1]).toHaveAttribute('aria-current', 'true');
    expect(cards[0]).not.toHaveAttribute('aria-current');
    // Le detail par segment du deuxieme itineraire (trajet 100% marche) ne
    // contient plus de segment bus - la liste reste affichee telle quelle
    // au-dessus (issue #234 : pas de bascule, seul le detail en dessous
    // change).
    expect(screen.queryByText('Bus C1')).not.toBeInTheDocument();
  });

  it("rend l'etat vide a la suite du formulaire de recherche, plus de page separee (issue #190)", () => {
    const { container } = renderResults([]);

    // Plus de `.resultats-page` : meme coquille carte + carte de recherche
    // que "recherche en cours".
    expect(container.querySelector('.resultats-page')).not.toBeInTheDocument();
    expect(container.querySelector('.resultats-shell')).toBeInTheDocument();
    expect(container.querySelector('.resultats-map-bg')).toBeInTheDocument();

    expect(
      screen.getByText('Aucun itinéraire trouvé pour ce trajet, même à pied.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // Action de recours = les champs de recherche, juste au-dessus (issue
    // #234) - plus de bouton "Modifier la recherche" dedie.
    expect(screen.getByLabelText('Origine (test)')).toBeInTheDocument();
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

    // Bandeau explicatif ...
    expect(
      screen.getByText(/Aucun trajet en transport en commun/),
    ).toBeInTheDocument();
    // ... au-dessus d'un vrai resultat (carte-itineraire cliquable + detail).
    expect(screen.getByRole('button', { name: /min/ })).toBeInTheDocument();
    expect(container.querySelector('.resultats-detail')).toBeInTheDocument();
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

    const note = screen.getByText(/Aucun trajet à \d{2}:\d{2}/);
    // "Aucun trajet à HH:mm. Prochain trajet <jour> à HH:mm."
    expect(note).toHaveTextContent(/Prochain trajet .*\d{2}:\d{2}\.?$/);
    // Un vrai resultat est affiche en dessous (pas l'etat vide).
    expect(container.querySelector('.resultats-empty')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /min/ })).toBeInTheDocument();
  });

  describe('badges de ligne par mode de transport (issue #129)', () => {
    it('affiche un badge de ligne avec le numero de ligne pour un segment BUS, a la place de l icone', () => {
      renderResults([FAST_ITINERARY]);

      const card = screen.getAllByRole('button', { name: /min/ })[0];
      expect(within(card).getByText('C1')).toHaveClass('line-badge--bus');
    });

    it('affiche deux badges distincts pour deux lignes de bus differentes sur le meme itineraire', () => {
      renderResults([TWO_BUS_LINES_ITINERARY]);

      const card = screen.getAllByRole('button', { name: /min/ })[0];
      expect(within(card).getByText('24')).toBeInTheDocument();
      expect(within(card).getByText('C6')).toBeInTheDocument();
    });

    it('garde l icone existante pour un mode sans ligne (marche)', () => {
      renderResults([SLOW_ITINERARY]);

      const card = screen.getAllByRole('button', { name: /min/ })[0];
      // SLOW_ITINERARY n'a qu'un segment WALK : aucun badge de ligne ne doit apparaitre.
      expect(card.querySelector('.line-badge')).not.toBeInTheDocument();
    });

    it('inclut le numero de ligne dans le texte cache pour lecteurs d ecran', () => {
      renderResults([FAST_ITINERARY]);

      expect(screen.getByText('Modes : Marche, Bus C1.')).toBeInTheDocument();
    });

    it('affiche aussi le badge de ligne dans le detail deplie du trajet selectionne', () => {
      const { container } = renderResults([FAST_ITINERARY]);

      const detail = container.querySelector('.resultats-detail') as HTMLElement;
      expect(within(detail).getByText('C1')).toHaveClass('line-badge--bus');
    });

    it('garde l icone existante dans le detail deplie pour un segment marche', () => {
      const { container } = renderResults([FAST_ITINERARY]);

      const detail = container.querySelector('.resultats-detail') as HTMLElement;
      const walkSegment = within(detail)
        .getByText('Marche')
        .closest('.resultats-segment') as HTMLElement;
      expect(walkSegment.querySelector('.line-badge')).not.toBeInTheDocument();
    });

    it('applique la couleur de ligne GTFS en fond plein sur le badge (issue #129, section 8)', () => {
      renderResults([FAST_ITINERARY]);

      const card = screen.getAllByRole('button', { name: /min/ })[0];
      expect(within(card).getByText('C1')).toHaveStyle({
        background: '#95C11E',
        color: '#1A171B',
      });
    });

    it('applique aussi la couleur de ligne dans le detail deplie du trajet selectionne', () => {
      const { container } = renderResults([FAST_ITINERARY]);

      const detail = container.querySelector('.resultats-detail') as HTMLElement;
      expect(within(detail).getByText('C1')).toHaveStyle({ background: '#95C11E' });
    });

    it('retombe sur le badge neutre quand le segment n a pas de couleur GTFS', () => {
      renderResults([TWO_BUS_LINES_ITINERARY]);

      const card = screen.getAllByRole('button', { name: /min/ })[0];
      // TWO_BUS_LINES_ITINERARY n'a pas routeColor/routeTextColor sur ses segments.
      expect(within(card).getByText('24')).not.toHaveAttribute('style');
    });
  });

  describe('carte de recherche persistante (issue #234)', () => {
    it('affiche le formulaire ET les resultats simultanement, a la suite l\'un de l\'autre dans la meme carte', () => {
      const { container } = renderResults([FAST_ITINERARY]);

      // Contrairement a l'ancienne "vue Edition" (#171/#172) puis a l'ancien
      // duo panneaux/bandeau resultats separes (premiere version de #234,
      // retiree apres retour utilisateur en session) : une seule carte,
      // .recherche-panel-form, contient le formulaire puis les resultats.
      const form = container.querySelector('.recherche-panel-form') as HTMLElement;
      expect(form).toBeInTheDocument();
      expect(within(form).getByLabelText('Origine (test)')).toBeInTheDocument();
      expect(
        within(form).getAllByRole('button', { name: /min/ }),
      ).toHaveLength(1);
    });

    it('une seule instance de la carte est montee, pas une copie desktop + une copie mobile', () => {
      renderResults([FAST_ITINERARY]);
      // getByLabelText (pas getAllBy) leve deja une erreur si le champ
      // existe en double - assertion explicite en plus pour la clarte de
      // l'intention (RecherchePageResults.tsx : id de champ potentiellement
      // dupliques sinon, voir le commentaire de RecherchePageResults).
      expect(screen.getAllByLabelText('Origine (test)')).toHaveLength(1);
      // Meme raisonnement pour les resultats : plus de panneau desktop +
      // bandeau mobile dupliques (ancienne disposition), une seule liste.
      expect(screen.getAllByRole('button', { name: /min/ })).toHaveLength(1);
    });

    it('reste affichee dans les 3 etats (chargement, vide, resultats)', () => {
      const { unmount: unmount1 } = renderResults(null);
      expect(screen.getByLabelText('Origine (test)')).toBeInTheDocument();
      unmount1();

      const { unmount: unmount2 } = renderResults([]);
      expect(screen.getByLabelText('Origine (test)')).toBeInTheDocument();
      unmount2();

      renderResults([FAST_ITINERARY]);
      expect(screen.getByLabelText('Origine (test)')).toBeInTheDocument();
    });
  });

  describe('repli/deploiement de la carte en mobile (data-sheet-state)', () => {
    function panelForm(container: HTMLElement) {
      const el = container.querySelector('.recherche-panel-form');
      if (!el) throw new Error('.recherche-panel-form introuvable');
      return el as HTMLElement;
    }

    it('demarre depliee ("expanded")', () => {
      const { container } = renderResults([FAST_ITINERARY]);
      expect(panelForm(container)).toHaveAttribute('data-sheet-state', 'expanded');
    });

    it('la poignee replie puis redeploie la carte au tap', async () => {
      const user = userEvent.setup();
      const { container } = renderResults([FAST_ITINERARY]);
      const handleButton = container.querySelector(
        '.recherche-panel-form-handle',
      ) as HTMLElement;

      await user.click(handleButton);
      expect(panelForm(container)).toHaveAttribute('data-sheet-state', 'collapsed');

      await user.click(handleButton);
      expect(panelForm(container)).toHaveAttribute('data-sheet-state', 'expanded');
    });

    it('un glissement vers le bas sur la poignee replie la carte', () => {
      const { container } = renderResults([FAST_ITINERARY]);
      const handleButton = container.querySelector(
        '.recherche-panel-form-handle',
      ) as HTMLElement;

      fireEvent.touchStart(handleButton, { touches: [{ clientY: 100 }] });
      fireEvent.touchEnd(handleButton, {
        changedTouches: [{ clientY: 220 }],
      });

      expect(panelForm(container)).toHaveAttribute('data-sheet-state', 'collapsed');
    });
  });
});

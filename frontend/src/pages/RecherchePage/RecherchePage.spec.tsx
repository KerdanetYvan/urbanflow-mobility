import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ApiError } from '../../lib/api';
import { AuthProvider } from '../../lib/AuthProvider';
import { clearTokens, saveTokens } from '../../lib/authStorage';
import * as placesLib from '../../lib/places';
import * as profileLib from '../../lib/profile';
import * as tripsLib from '../../lib/trips';
import RecherchePage from './RecherchePage';

vi.mock('../../lib/places');
// Mock partiel (meme motif que lib/profile ci-dessous et HistoriquePage.spec.tsx) :
// entryToPlaces est une fonction pure reutilisee par RechercheQuickShortcuts,
// un automock complet la remplacerait par un vi.fn() sans valeur de retour et
// ferait echouer le rendu des raccourcis (destructuring d'un retour undefined).
vi.mock('../../lib/trips', async () => {
  const actual =
    await vi.importActual<typeof import('../../lib/trips')>('../../lib/trips');
  return { ...actual, getTripHistory: vi.fn(), searchTrips: vi.fn() };
});

// Auto-mock complet remplacerait aussi TRANSPORT_MODES (un tableau, pas une
// fonction) par une valeur vide : on garde l'export reel de tout sauf
// getMyProfile, seule fonction d'appel API utilisee par cet ecran (voir
// ProfilPage.spec.tsx, meme raisonnement).
vi.mock('../../lib/profile', async () => {
  const actual =
    await vi.importActual<typeof import('../../lib/profile')>('../../lib/profile');
  return { ...actual, getMyProfile: vi.fn() };
});

const GARE = { label: 'Gare Part-Dieu', lat: 45.76, lon: 4.86 };
const HOTEL_DE_VILLE = { label: 'Hôtel de Ville', lat: 45.77, lon: 4.83 };

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <RecherchePage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

/** Meme rendu que renderPage, avec un etat de navigation entrant (issue #174, relance depuis /historique). */
function renderPageWithLocationState(state: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/recherche', state }]}>
      <AuthProvider>
        <RecherchePage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

async function selectAddress(
  user: ReturnType<typeof userEvent.setup>,
  fieldLabel: string,
  typed: string,
  suggestionLabel: string,
) {
  await user.type(screen.getByLabelText(fieldLabel), typed);
  const suggestion = await screen.findByRole('button', {
    name: suggestionLabel,
  });
  await user.click(suggestion);
}

describe('RecherchePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(placesLib.searchPlaces).mockResolvedValue([]);
    // Valeur par defaut sans raccourci (issue #112) - les tests qui verifient
    // les raccourcis eux-memes ecrasent ce mock avec des entrees explicites.
    vi.mocked(tripsLib.getTripHistory).mockResolvedValue([]);
  });

  afterEach(() => {
    clearTokens();
  });

  it('affiche une invitation discrete a se connecter pour un utilisateur non authentifie', () => {
    renderPage();
    expect(
      screen.getByRole('link', { name: 'Connectez-vous' }),
    ).toBeInTheDocument();
  });

  it('affiche les suggestions renvoyees par /places et permet de choisir une adresse', async () => {
    vi.mocked(placesLib.searchPlaces).mockResolvedValue([GARE]);
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Origine'), 'Gare');

    await waitFor(() => {
      expect(placesLib.searchPlaces).toHaveBeenCalledWith('Gare');
    });
    const suggestion = await screen.findByRole('button', {
      name: 'Gare Part-Dieu',
    });
    await user.click(suggestion);

    expect(screen.getByLabelText('Origine')).toHaveValue('Gare Part-Dieu');
    // La suggestion cliquee disparait de la liste une fois selectionnee.
    expect(
      screen.queryByRole('button', { name: 'Gare Part-Dieu' }),
    ).not.toBeInTheDocument();
  });

  it('bloque la soumission et signale les champs vides sans appeler /trips', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Rechercher' }));

    expect(screen.getAllByText('Ce champ est requis.')).toHaveLength(2);
    expect(tripsLib.searchTrips).not.toHaveBeenCalled();
  });

  it("signale une adresse non selectionnee dans la liste comme non resolue", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Origine'), 'Gare');
    await user.type(screen.getByLabelText('Destination'), 'Mairie');
    await user.click(screen.getByRole('button', { name: 'Rechercher' }));

    expect(
      await screen.findByText(
        'Adresse non résolue. Sélectionnez une adresse dans la liste de suggestions.',
      ),
    ).toBeInTheDocument();
    expect(tripsLib.searchTrips).not.toHaveBeenCalled();
  });

  it('bloque la recherche si origine et destination sont la meme adresse', async () => {
    vi.mocked(placesLib.searchPlaces).mockResolvedValue([GARE]);
    const user = userEvent.setup();
    renderPage();

    await selectAddress(user, 'Origine', 'Gare', 'Gare Part-Dieu');
    await selectAddress(user, 'Destination', 'Gare', 'Gare Part-Dieu');
    await user.click(screen.getByRole('button', { name: 'Rechercher' }));

    expect(
      await screen.findByText(
        "L'origine et la destination doivent être différentes.",
      ),
    ).toBeInTheDocument();
    expect(tripsLib.searchTrips).not.toHaveBeenCalled();
  });

  it('inverse origine et destination au clic sur le bouton dedie', async () => {
    vi.mocked(placesLib.searchPlaces).mockResolvedValue([GARE]);
    const user = userEvent.setup();
    renderPage();

    await selectAddress(user, 'Origine', 'Gare', 'Gare Part-Dieu');
    await user.click(
      screen.getByRole('button', { name: "Inverser l'origine et la destination" }),
    );

    expect(screen.getByLabelText('Origine')).toHaveValue('');
    expect(screen.getByLabelText('Destination')).toHaveValue('Gare Part-Dieu');
  });

  it("recherche et affiche la disposition resultats fusionnee, sans navigation vers une autre route (issue #73)", async () => {
    vi.mocked(placesLib.searchPlaces).mockImplementation((query) =>
      Promise.resolve(query === 'Gare' ? [GARE] : [HOTEL_DE_VILLE]),
    );
    const itineraries = [
      { startTime: 't0', endTime: 't1', durationSeconds: 600, transfers: 0, segments: [] },
    ];
    vi.mocked(tripsLib.searchTrips).mockResolvedValue(itineraries);
    const user = userEvent.setup();
    renderPage();

    await selectAddress(user, 'Origine', 'Gare', 'Gare Part-Dieu');
    await selectAddress(user, 'Destination', 'Mairie', 'Hôtel de Ville');
    await user.click(screen.getByRole('button', { name: 'Rechercher' }));

    await waitFor(() => {
      expect(tripsLib.searchTrips).toHaveBeenCalledWith({
        originLat: GARE.lat,
        originLon: GARE.lon,
        destinationLat: HOTEL_DE_VILLE.lat,
        destinationLon: HOTEL_DE_VILLE.lon,
      });
    });
    // Le formulaire disparait au profit de la disposition resultats (meme
    // ecran, pas de navigation - voir RecherchePageResults).
    expect(screen.queryByLabelText('Origine')).not.toBeInTheDocument();
    // Le texte "De X à Y" est reparti sur plusieurs noeuds texte (JSX) :
    // on verifie le contenu textuel complet du <p>, pas un noeud isole.
    expect(
      (
        await screen.findAllByRole('button', { name: 'Modifier la recherche' })
      )[0].closest('p'),
    ).toHaveTextContent('De Gare Part-Dieu à Hôtel de Ville');
  });

  it("revient au formulaire, criteres preremplis, quand l'appel a /trips echoue (issue #73)", async () => {
    vi.mocked(placesLib.searchPlaces).mockImplementation((query) =>
      Promise.resolve(query === 'Gare' ? [GARE] : [HOTEL_DE_VILLE]),
    );
    vi.mocked(tripsLib.searchTrips).mockRejectedValue(
      new ApiError('Moteur de calcul indisponible', 503),
    );
    const user = userEvent.setup();
    renderPage();

    await selectAddress(user, 'Origine', 'Gare', 'Gare Part-Dieu');
    await selectAddress(user, 'Destination', 'Mairie', 'Hôtel de Ville');
    await user.click(screen.getByRole('button', { name: 'Rechercher' }));

    expect(
      await screen.findByText('Moteur de calcul indisponible'),
    ).toBeInTheDocument();
    // Retour au formulaire (pas de route a quitter) : les valeurs saisies
    // avant l'echec restent intactes, rien n'est perdu.
    expect(screen.getByLabelText('Origine')).toHaveValue('Gare Part-Dieu');
    expect(screen.getByLabelText('Destination')).toHaveValue('Hôtel de Ville');
  });

  it("'Modifier la recherche' revient au formulaire avec les criteres preremplis (issue #73)", async () => {
    vi.mocked(placesLib.searchPlaces).mockImplementation((query) =>
      Promise.resolve(query === 'Gare' ? [GARE] : [HOTEL_DE_VILLE]),
    );
    const itineraries = [
      { startTime: 't0', endTime: 't1', durationSeconds: 600, transfers: 0, segments: [] },
    ];
    vi.mocked(tripsLib.searchTrips).mockResolvedValue(itineraries);
    const user = userEvent.setup();
    renderPage();

    await selectAddress(user, 'Origine', 'Gare', 'Gare Part-Dieu');
    await selectAddress(user, 'Destination', 'Mairie', 'Hôtel de Ville');
    await user.click(screen.getByRole('button', { name: 'Rechercher' }));
    await screen.findAllByRole('button', { name: 'Modifier la recherche' });

    await user.click(
      screen.getAllByRole('button', { name: 'Modifier la recherche' })[0],
    );

    expect(screen.getByLabelText('Origine')).toHaveValue('Gare Part-Dieu');
    expect(screen.getByLabelText('Destination')).toHaveValue('Hôtel de Ville');
  });

  describe('vue Edition en place depuis les resultats (issue #171/#172)', () => {
    async function searchAndReachResults(user: ReturnType<typeof userEvent.setup>) {
      vi.mocked(placesLib.searchPlaces).mockImplementation((query) =>
        Promise.resolve(query === 'Gare' ? [GARE] : [HOTEL_DE_VILLE]),
      );
      const itineraries = [
        { startTime: 't0', endTime: 't1', durationSeconds: 600, transfers: 0, segments: [] },
      ];
      vi.mocked(tripsLib.searchTrips).mockResolvedValue(itineraries);
      renderPage();

      await selectAddress(user, 'Origine', 'Gare', 'Gare Part-Dieu');
      await selectAddress(user, 'Destination', 'Mairie', 'Hôtel de Ville');
      await user.click(screen.getByRole('button', { name: 'Rechercher' }));
      await screen.findAllByRole('button', { name: 'Modifier la recherche' });
    }

    it("'Annuler' referme la vue Edition sans relancer /trips, la liste des resultats est retrouvee telle quelle", async () => {
      const user = userEvent.setup();
      await searchAndReachResults(user);
      expect(tripsLib.searchTrips).toHaveBeenCalledTimes(1);

      await user.click(
        screen.getAllByRole('button', { name: 'Modifier la recherche' })[0],
      );
      // La vue Edition affiche bien les champs, mais la liste de resultats
      // n'est plus dans le document tant qu'on est en edition (voir
      // RecherchePageResults.tsx) - pas de disparition silencieuse d'un
      // resultat existant, juste un panneau qui remplace l'autre.
      expect(screen.getByLabelText('Origine')).toBeInTheDocument();
      expect(
        screen.queryAllByRole('button', { name: /min/ }),
      ).toHaveLength(0);

      await user.click(screen.getByRole('button', { name: 'Annuler' }));

      // Retour a la liste sans nouvel appel reseau : "Annuler" ne
      // resoumet jamais la recherche.
      expect(tripsLib.searchTrips).toHaveBeenCalledTimes(1);
      expect(screen.queryByLabelText('Origine')).not.toBeInTheDocument();
      expect(
        (await screen.findAllByRole('button', { name: /min/ })).length,
      ).toBeGreaterThan(0);
    });

    it("le bouton 'Annuler' n'apparait pas au tout premier chargement (rien a annuler)", () => {
      renderPage();
      expect(
        screen.queryByRole('button', { name: 'Annuler' }),
      ).not.toBeInTheDocument();
    });

    it('soumettre le formulaire depuis la vue Edition relance la recherche et revient a la vue Resume', async () => {
      const user = userEvent.setup();
      await searchAndReachResults(user);

      await user.click(
        screen.getAllByRole('button', { name: 'Modifier la recherche' })[0],
      );
      await selectAddress(user, 'Origine', 'Gare', 'Gare Part-Dieu');
      await user.click(screen.getByRole('button', { name: 'Rechercher' }));

      await waitFor(() => {
        expect(tripsLib.searchTrips).toHaveBeenCalledTimes(2);
      });
      // Retour automatique a la vue Resume + liste, sans clic supplementaire.
      expect(screen.queryByLabelText('Origine')).not.toBeInTheDocument();
      expect(
        (await screen.findAllByRole('button', { name: 'Modifier la recherche' }))
          .length,
      ).toBeGreaterThan(0);
    });
  });

  it('ne pre-remplit pas les modes de transport pour un utilisateur non connecte', async () => {
    const user = userEvent.setup();
    renderPage();
    expect(profileLib.getMyProfile).not.toHaveBeenCalled();

    // Case derriere le filtre "Modes de transport" (issue #108/#109,
    // ferme par defaut) : l'ouvrir avant de verifier son etat, comme le
    // ferait un vrai utilisateur.
    await user.click(screen.getByRole('button', { name: 'Modes de transport' }));

    expect(screen.getByRole('checkbox', { name: 'Vélo' })).not.toBeChecked();
  });

  describe('filtre des modes de transport (issue #108/#109)', () => {
    it("n'affiche aucun compteur tant qu'aucun mode n'est coche", () => {
      renderPage();

      const trigger = screen.getByRole('button', { name: 'Modes de transport' });
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(
        screen.queryByRole('checkbox', { name: 'Vélo' }),
      ).not.toBeInTheDocument();
    });

    it('affiche le nombre de modes coches sur le bouton declencheur, mis a jour en direct', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByRole('button', { name: 'Modes de transport' }));
      await user.click(screen.getByRole('checkbox', { name: 'Vélo' }));
      await user.click(screen.getByRole('checkbox', { name: 'Bus' }));

      expect(
        screen.getByRole('button', { name: 'Modes de transport · 2' }),
      ).toBeInTheDocument();

      await user.click(screen.getByRole('checkbox', { name: 'Vélo' }));

      expect(
        screen.getByRole('button', { name: 'Modes de transport · 1' }),
      ).toBeInTheDocument();
    });

    it('ferme le panneau et rend le focus au declencheur au clic sur "Fermer"', async () => {
      const user = userEvent.setup();
      renderPage();

      const trigger = screen.getByRole('button', { name: 'Modes de transport' });
      await user.click(trigger);
      await user.click(screen.getByRole('button', { name: 'Fermer' }));

      expect(
        screen.queryByRole('checkbox', { name: 'Vélo' }),
      ).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });

    it('ferme le panneau et rend le focus au declencheur a la touche Echap', async () => {
      const user = userEvent.setup();
      renderPage();

      const trigger = screen.getByRole('button', { name: 'Modes de transport' });
      await user.click(trigger);
      await user.keyboard('{Escape}');

      expect(
        screen.queryByRole('checkbox', { name: 'Vélo' }),
      ).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });

    it(
      "ferme le panneau au clic exterieur, SANS reprendre le focus au " +
        'declencheur (le clic a deja porte le focus sur sa propre cible)',
      async () => {
        const user = userEvent.setup();
        renderPage();

        await user.click(screen.getByRole('button', { name: 'Modes de transport' }));
        await user.click(screen.getByLabelText('Destination'));

        expect(
          screen.queryByRole('checkbox', { name: 'Vélo' }),
        ).not.toBeInTheDocument();
        expect(screen.getByLabelText('Destination')).toHaveFocus();
      },
    );

    it('conserve la selection quand le panneau est referme puis rouvert', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByRole('button', { name: 'Modes de transport' }));
      await user.click(screen.getByRole('checkbox', { name: 'Tram' }));
      await user.keyboard('{Escape}');

      await user.click(
        screen.getByRole('button', { name: 'Modes de transport · 1' }),
      );

      expect(screen.getByRole('checkbox', { name: 'Tram' })).toBeChecked();
    });
  });

  it("transmet accessibilityPreferences du profil connecte a l'ecran de resultats, pour le badge cible de scoring (issue #126)", async () => {
    saveTokens({ accessToken: 'fake-token', refreshToken: 'fake-refresh' });
    vi.mocked(profileLib.getMyProfile).mockResolvedValue({
      id: 'profile-1',
      userId: 'user-1',
      preferredTransportModes: [],
      accessibilityPreferences: ['limit_transfers'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    vi.mocked(placesLib.searchPlaces).mockImplementation((query) =>
      Promise.resolve(query === 'Gare' ? [GARE] : [HOTEL_DE_VILLE]),
    );
    const itineraries = [
      { startTime: 't0', endTime: 't1', durationSeconds: 600, transfers: 2, segments: [] },
      { startTime: 't2', endTime: 't3', durationSeconds: 900, transfers: 0, segments: [] },
    ];
    vi.mocked(tripsLib.searchTrips).mockResolvedValue(itineraries);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(profileLib.getMyProfile).toHaveBeenCalled());

    await selectAddress(user, 'Origine', 'Gare', 'Gare Part-Dieu');
    await selectAddress(user, 'Destination', 'Mairie', 'Hôtel de Ville');
    await user.click(screen.getByRole('button', { name: 'Rechercher' }));

    // Le premier itineraire (2 correspondances) garde le badge global ; le
    // second (0 correspondance) recoit le badge cible sur limit_transfers -
    // seul un profil connecte avec cette preference peut le declencher.
    // Panneau desktop + bandeau mobile rendent chacun leur propre copie de
    // la liste (media queries non appliquees en jsdom) : au moins une copie
    // doit porter le badge.
    expect(
      (await screen.findAllByText('Le moins de correspondances')).length,
    ).toBeGreaterThan(0);
  });

  describe('adresses recentes dans le dropdown (issue #166)', () => {
    const HISTORY_ENTRY = {
      id: 'history-1',
      originLat: GARE.lat,
      originLon: GARE.lon,
      originLabel: GARE.label,
      destinationLat: HOTEL_DE_VILLE.lat,
      destinationLon: HOTEL_DE_VILLE.lon,
      destinationLabel: HOTEL_DE_VILLE.label,
      lastSearchedAt: '2026-08-20T18:00:00.000Z',
    };

    function mockAuthenticatedProfile() {
      saveTokens({ accessToken: 'fake-token', refreshToken: 'fake-refresh' });
      vi.mocked(profileLib.getMyProfile).mockResolvedValue({
        id: 'profile-1',
        userId: 'user-1',
        preferredTransportModes: [],
        accessibilityPreferences: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    it("ne charge pas l'historique pour un utilisateur non authentifie", async () => {
      const user = userEvent.setup();
      renderPage();
      await user.click(screen.getByLabelText('Origine'));

      expect(tripsLib.getTripHistory).not.toHaveBeenCalled();
      expect(screen.queryByText('Recherché récemment')).not.toBeInTheDocument();
    });

    it("ne propose aucune adresse recente quand l'historique est vide", async () => {
      mockAuthenticatedProfile();
      vi.mocked(tripsLib.getTripHistory).mockResolvedValue([]);
      const user = userEvent.setup();
      renderPage();

      await waitFor(() => expect(tripsLib.getTripHistory).toHaveBeenCalled());
      await user.click(screen.getByLabelText('Origine'));
      expect(screen.queryByText('Recherché récemment')).not.toBeInTheDocument();
    });

    it("propose chaque extremite de l'historique comme entree d'adresse au focus du champ", async () => {
      mockAuthenticatedProfile();
      vi.mocked(tripsLib.getTripHistory).mockResolvedValue([HISTORY_ENTRY]);
      const user = userEvent.setup();
      renderPage();

      await waitFor(() => expect(tripsLib.getTripHistory).toHaveBeenCalled());
      await user.click(screen.getByLabelText('Origine'));

      // Une entree par adresse (origine ET destination du trajet passe), avec
      // le sous-titre "Recherché récemment" - plus de bouton "trajet complet".
      expect(
        screen.getByRole('button', { name: /Gare Part-Dieu/ }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Hôtel de Ville/ }),
      ).toBeInTheDocument();
      expect(screen.getAllByText('Recherché récemment')).toHaveLength(2);
      expect(
        screen.queryByRole('button', {
          name: 'Gare Part-Dieu → Hôtel de Ville',
        }),
      ).not.toBeInTheDocument();
    });

    it('remplit le champ sans relancer la recherche au clic sur une adresse recente', async () => {
      mockAuthenticatedProfile();
      vi.mocked(tripsLib.getTripHistory).mockResolvedValue([HISTORY_ENTRY]);
      const user = userEvent.setup();
      renderPage();

      await waitFor(() => expect(tripsLib.getTripHistory).toHaveBeenCalled());
      await user.click(screen.getByLabelText('Destination'));
      await user.click(
        await screen.findByRole('button', { name: /Hôtel de Ville/ }),
      );

      expect(screen.getByLabelText('Destination')).toHaveValue('Hôtel de Ville');
      // Le dropdown ne fait que pre-remplir : aucune recherche declenchee
      // (contrairement a l'ancien raccourci "relancer le trajet", #112).
      expect(tripsLib.searchTrips).not.toHaveBeenCalled();
    });

    it("ne propose pas dans un champ l'adresse deja choisie dans l'autre", async () => {
      mockAuthenticatedProfile();
      vi.mocked(tripsLib.getTripHistory).mockResolvedValue([HISTORY_ENTRY]);
      const user = userEvent.setup();
      renderPage();

      await waitFor(() => expect(tripsLib.getTripHistory).toHaveBeenCalled());
      await user.click(screen.getByLabelText('Origine'));
      await user.click(
        await screen.findByRole('button', { name: /Gare Part-Dieu/ }),
      );

      await user.click(screen.getByLabelText('Destination'));
      expect(
        screen.queryByRole('button', { name: /Gare Part-Dieu/ }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Hôtel de Ville/ }),
      ).toBeInTheDocument();
    });
  });

  describe('relance depuis /historique (issue #174)', () => {
    it('relance automatiquement la recherche quand origine/destination arrivent via l\'etat de navigation', async () => {
      const itineraries = [
        {
          startTime: 't0',
          endTime: 't1',
          durationSeconds: 600,
          transfers: 0,
          segments: [],
        },
      ];
      vi.mocked(tripsLib.searchTrips).mockResolvedValue(itineraries);

      renderPageWithLocationState({ origin: GARE, destination: HOTEL_DE_VILLE });

      await waitFor(() => {
        expect(tripsLib.searchTrips).toHaveBeenCalledWith({
          originLat: GARE.lat,
          originLon: GARE.lon,
          destinationLat: HOTEL_DE_VILLE.lat,
          destinationLon: HOTEL_DE_VILLE.lon,
        });
      });
      expect(
        (
          await screen.findAllByRole('button', { name: 'Modifier la recherche' })
        )[0].closest('p'),
      ).toHaveTextContent('De Gare Part-Dieu à Hôtel de Ville');
    });

    it("ne relance rien quand la page est ouverte sans etat de navigation", () => {
      renderPage();
      expect(tripsLib.searchTrips).not.toHaveBeenCalled();
    });
  });

  describe("raccourcis d'origine (issue #93)", () => {
    // Meme motif de stub que useGeolocation.spec.ts (lib/useGeolocation.ts) -
    // pas de mock du module useGeolocation lui-meme, on simule directement
    // l'API navigateur qu'il enveloppe.
    function mockGeolocation(overrides: Partial<Geolocation> = {}) {
      const geolocation = {
        watchPosition: vi.fn(),
        clearWatch: vi.fn(),
        getCurrentPosition: vi.fn(),
        ...overrides,
      };
      vi.stubGlobal('navigator', { ...navigator, geolocation });
      return geolocation;
    }

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    // Depuis #166, ces entrees vivent dans le dropdown du champ Origine : il
    // faut d'abord donner le focus au champ (champ vide) pour les afficher.
    // Leur nom accessible inclut le sous-titre ("Ma position actuelle Votre
    // position GPS", "Domicile 8 place du Marché"...) - d'ou les matchers
    // par expression reguliere.
    it("remplit l'origine avec la position GPS actuelle au clic sur l'entree dediee", async () => {
      mockGeolocation({
        watchPosition: vi.fn((success: PositionCallback) => {
          success({
            coords: { latitude: 45.76, longitude: 4.86 },
          } as GeolocationPosition);
          return 1;
        }),
      });
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByLabelText('Origine'));
      await user.click(
        screen.getByRole('button', { name: /Ma position actuelle/ }),
      );

      await waitFor(() => {
        expect(screen.getByLabelText('Origine')).toHaveValue(
          'Ma position actuelle',
        );
      });
    });

    it('affiche un message si la geolocalisation est refusee, sans planter', async () => {
      mockGeolocation({
        watchPosition: vi.fn(
          (_success: PositionCallback, error: PositionErrorCallback) => {
            error({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError);
            return 1;
          },
        ),
      });
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByLabelText('Origine'));
      await user.click(
        screen.getByRole('button', { name: /Ma position actuelle/ }),
      );

      expect(
        await screen.findByText(
          "Géolocalisation refusée. Impossible d'utiliser votre position comme origine.",
        ),
      ).toBeInTheDocument();
      expect(screen.getByLabelText('Origine')).toHaveValue('');
    });

    it("ne propose ni domicile ni travail au focus pour un utilisateur non authentifie", async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByLabelText('Origine'));
      expect(
        screen.queryByRole('button', { name: /Domicile/ }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /Travail/ }),
      ).not.toBeInTheDocument();
    });

    it(
      "ne propose pas l'entree domicile si le profil connecte n'en a pas " +
        'enregistre',
      async () => {
        saveTokens({ accessToken: 'fake-token', refreshToken: 'fake-refresh' });
        vi.mocked(profileLib.getMyProfile).mockResolvedValue({
          id: 'profile-1',
          userId: 'user-1',
          preferredTransportModes: [],
          accessibilityPreferences: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        const user = userEvent.setup();
        renderPage();

        await waitFor(() => expect(profileLib.getMyProfile).toHaveBeenCalled());
        await user.click(screen.getByLabelText('Origine'));
        expect(
          screen.queryByRole('button', { name: /Domicile/ }),
        ).not.toBeInTheDocument();
      },
    );

    it(
      "remplit l'origine avec le domicile enregistre au clic sur son " +
        'entree (issue #113/#114)',
      async () => {
        saveTokens({ accessToken: 'fake-token', refreshToken: 'fake-refresh' });
        vi.mocked(profileLib.getMyProfile).mockResolvedValue({
          id: 'profile-1',
          userId: 'user-1',
          preferredTransportModes: [],
          accessibilityPreferences: [],
          homeLabel: 'Domicile test',
          homeLat: 48.1,
          homeLon: -1.2,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        const user = userEvent.setup();
        renderPage();

        await user.click(screen.getByLabelText('Origine'));
        const homeButton = await screen.findByRole('button', {
          name: /Domicile/,
        });
        await user.click(homeButton);

        expect(screen.getByLabelText('Origine')).toHaveValue('Domicile test');
      },
    );
  });

  describe('panneau formulaire (bandeau mobile, issue #110/#111)', () => {
    function panel(container: HTMLElement) {
      const el = container.querySelector('.recherche-panel-form');
      if (!el) throw new Error('.recherche-panel-form introuvable');
      return el as HTMLElement;
    }

    it('demarre deplie ("expanded") - le formulaire est ce qu\'il faut remplir en premier', () => {
      const { container } = renderPage();
      expect(panel(container)).toHaveAttribute('data-sheet-state', 'expanded');
    });

    it('la poignee replie puis redeploie le bandeau au tap', async () => {
      const user = userEvent.setup();
      const { container } = renderPage();
      const handleButton = container.querySelector(
        '.recherche-panel-form-handle',
      ) as HTMLElement;

      await user.click(handleButton);
      expect(panel(container)).toHaveAttribute('data-sheet-state', 'collapsed');

      await user.click(handleButton);
      expect(panel(container)).toHaveAttribute('data-sheet-state', 'expanded');
    });

    it('un glissement vers le bas sur la poignee replie le bandeau', () => {
      const { container } = renderPage();
      const handleButton = container.querySelector(
        '.recherche-panel-form-handle',
      ) as HTMLElement;

      fireEvent.touchStart(handleButton, { touches: [{ clientY: 100 }] });
      fireEvent.touchEnd(handleButton, {
        changedTouches: [{ clientY: 220 }],
      });

      expect(panel(container)).toHaveAttribute('data-sheet-state', 'collapsed');
    });

    it(
      'une erreur de recherche redeploie le bandeau si replie (l\'utilisateur ' +
        'ne doit jamais rater un message d\'erreur)',
      async () => {
        vi.mocked(placesLib.searchPlaces).mockResolvedValue([GARE]);
        const user = userEvent.setup();
        const { container } = renderPage();

        const handleButton = container.querySelector(
          '.recherche-panel-form-handle',
        ) as HTMLElement;
        await user.click(handleButton);
        expect(panel(container)).toHaveAttribute(
          'data-sheet-state',
          'collapsed',
        );

        // Une seule adresse selectionnee (Origine), Destination juste tapee
        // sans etre choisie dans la liste -> "adresse non resolue".
        await user.type(screen.getByLabelText('Origine'), 'Gare');
        const suggestion = await screen.findByRole('button', {
          name: 'Gare Part-Dieu',
        });
        await user.click(suggestion);
        await user.type(screen.getByLabelText('Destination'), 'Mairie');
        await user.click(screen.getByRole('button', { name: 'Rechercher' }));

        expect(
          await screen.findByText(
            'Adresse non résolue. Sélectionnez une adresse dans la liste de suggestions.',
          ),
        ).toBeInTheDocument();
        expect(panel(container)).toHaveAttribute(
          'data-sheet-state',
          'expanded',
        );
      },
    );
  });
});

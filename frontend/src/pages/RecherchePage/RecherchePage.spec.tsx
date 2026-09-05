import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ApiError } from '../../lib/api';
import { AuthProvider } from '../../lib/AuthProvider';
import { clearTokens, saveTokens } from '../../lib/authStorage';
import * as followedTripLib from '../../lib/followedTrip';
import * as placesLib from '../../lib/places';
import * as profileLib from '../../lib/profile';
import * as sharedMobilityLib from '../../lib/sharedMobility';
import * as tripsLib from '../../lib/trips';
import RecherchePage from './RecherchePage';

vi.mock('../../lib/places');
// MapView (rendue en permanence sur cet ecran, issue #110) charge les
// stations en libre-service au montage (issue #13) - mocke pour ne jamais
// dependre d'un vrai appel reseau dans ce fichier de test, qui ne
// s'interesse pas a cette fonctionnalite.
vi.mock('../../lib/sharedMobility');
// Effet de reprise d'un trajet suivi au montage (issue #18) + TripFollowButton
// (rendu par RecherchePageResults une fois des itineraires trouves) -
// mocke pour la meme raison que sharedMobility ci-dessus.
vi.mock('../../lib/followedTrip');
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
    // Persistance de la recherche entre navigations (issue #266) - sans ce
    // nettoyage, un test qui saisit une recherche laisse un residu dans
    // sessionStorage que le montage du test SUIVANT restaurerait a tort
    // (jsdom ne vide jamais sessionStorage tout seul entre deux tests).
    sessionStorage.clear();
    vi.mocked(placesLib.searchPlaces).mockResolvedValue([]);
    // Valeur par defaut sans raccourci (issue #112) - les tests qui verifient
    // les raccourcis eux-memes ecrasent ce mock avec des entrees explicites.
    vi.mocked(tripsLib.getTripHistory).mockResolvedValue([]);
    vi.mocked(sharedMobilityLib.fetchSharedMobilityStations).mockResolvedValue(
      [],
    );
    // Aucun trajet suivi par defaut (issue #18) - les tests qui verifient
    // la reprise automatique ecrasent ce mock avec un suivi explicite.
    vi.mocked(followedTripLib.getCurrentFollowedTrip).mockResolvedValue(null);
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

  it(
    "Entrée sur une adresse tapée-mais-pas-sélectionnée ne soumet plus le " +
      'formulaire (issue #253 - anciennement une soumission native avec une ' +
      'adresse non resolue)',
    async () => {
      vi.mocked(placesLib.searchPlaces).mockResolvedValue([GARE]);
      const user = userEvent.setup();
      renderPage();

      await user.type(screen.getByLabelText('Origine'), 'Gare');
      await screen.findByRole('option', { name: 'Gare Part-Dieu' });
      await user.keyboard('{Enter}');

      // Contrairement au clic sur "Rechercher" (test ci-dessus), la touche
      // Entrée est neutralisee AVANT d'atteindre le gestionnaire de
      // soumission du formulaire : ni appel reseau, ni message de
      // validation "Adresse non résolue" (celui-ci suppose une vraie
      // tentative de soumission).
      expect(tripsLib.searchTrips).not.toHaveBeenCalled();
      expect(
        screen.queryByText(
          'Adresse non résolue. Sélectionnez une adresse dans la liste de suggestions.',
        ),
      ).not.toBeInTheDocument();
    },
  );

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
    vi.mocked(tripsLib.searchTrips).mockResolvedValue({ itineraries });
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
    // Le formulaire de recherche reste affiche EN PLUS de la disposition
    // resultats (issue #234) - meme ecran, pas de navigation, plus jamais
    // remplace par un resume (voir RecherchePageResults).
    expect(await screen.findByLabelText('Origine')).toBeInTheDocument();
    expect(screen.getByLabelText('Destination')).toBeInTheDocument();
  });

  it("propage le fallback 'prochain creneau' de /trips jusqu'a la disposition resultats (issue #91)", async () => {
    vi.mocked(placesLib.searchPlaces).mockImplementation((query) =>
      Promise.resolve(query === 'Gare' ? [GARE] : [HOTEL_DE_VILLE]),
    );
    vi.mocked(tripsLib.searchTrips).mockResolvedValue({
      itineraries: [
        {
          startTime: '2026-08-03T06:00:00.000Z',
          endTime: '2026-08-03T06:25:00.000Z',
          durationSeconds: 1500,
          transfers: 0,
          segments: [],
        },
      ],
      fallback: {
        kind: 'later-departure',
        requestedDepartureTime: '2026-08-02T20:00:00.000Z',
        actualDepartureTime: '2026-08-03T06:00:00.000Z',
      },
    });
    const user = userEvent.setup();
    renderPage();

    await selectAddress(user, 'Origine', 'Gare', 'Gare Part-Dieu');
    await selectAddress(user, 'Destination', 'Mairie', 'Hôtel de Ville');
    await user.click(screen.getByRole('button', { name: 'Rechercher' }));

    expect(
      await screen.findAllByText(/Aucun trajet à \d{2}:\d{2}\. Prochain trajet/),
    ).not.toHaveLength(0);
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

  describe('mode dégradé - cache local des derniers trajets utiles (issue #10)', () => {
    afterEach(() => {
      localStorage.removeItem('urbanflow.tripCache.v1');
    });

    it(
      'affiche les resultats en cache (bandeau "hors ligne" explicite) quand ' +
        "une recherche identique echoue faute de connexion (pas d'ApiError - " +
        'le backend n\'a jamais ete joint)',
      async () => {
        vi.mocked(placesLib.searchPlaces).mockImplementation((query) =>
          Promise.resolve(query === 'Gare' ? [GARE] : [HOTEL_DE_VILLE]),
        );
        const itineraries = [
          {
            startTime: 't0',
            endTime: 't1',
            durationSeconds: 600,
            transfers: 0,
            segments: [],
          },
        ];
        vi.mocked(tripsLib.searchTrips).mockResolvedValueOnce({ itineraries });
        const user = userEvent.setup();
        renderPage();

        // Premiere recherche reussie : alimente le cache local.
        await selectAddress(user, 'Origine', 'Gare', 'Gare Part-Dieu');
        await selectAddress(user, 'Destination', 'Mairie', 'Hôtel de Ville');
        await user.click(screen.getByRole('button', { name: 'Rechercher' }));
        await screen.findAllByRole('button', { name: /min/ });

        // Deuxieme recherche, meme trajet, echoue faute de connexion (fetch
        // rejette sans jamais joindre le backend - pas une ApiError). Le
        // formulaire etant deja affiche en permanence au-dessus des
        // resultats (issue #234), relancer la recherche ne demande plus de
        // clic intermediaire "Modifier la recherche".
        vi.mocked(tripsLib.searchTrips).mockRejectedValueOnce(
          new TypeError('Failed to fetch'),
        );
        await user.click(screen.getByRole('button', { name: 'Rechercher' }));

        expect(
          await screen.findAllByText('Résultats hors ligne'),
        ).not.toHaveLength(0);
        // Toujours sur l'ecran resultats (pas de retour au formulaire "seul")
        // - le cache a pris le relais, les champs restent affiches comme
        // toujours.
        expect(screen.getByLabelText('Origine')).toBeInTheDocument();
      },
    );

    it(
      "revient au formulaire avec le message d'erreur habituel quand la " +
        'recherche echoue et qu\'aucun trajet en cache ne correspond',
      async () => {
        vi.mocked(placesLib.searchPlaces).mockImplementation((query) =>
          Promise.resolve(query === 'Gare' ? [GARE] : [HOTEL_DE_VILLE]),
        );
        vi.mocked(tripsLib.searchTrips).mockRejectedValue(
          new TypeError('Failed to fetch'),
        );
        const user = userEvent.setup();
        renderPage();

        await selectAddress(user, 'Origine', 'Gare', 'Gare Part-Dieu');
        await selectAddress(user, 'Destination', 'Mairie', 'Hôtel de Ville');
        await user.click(screen.getByRole('button', { name: 'Rechercher' }));

        expect(
          await screen.findByText('Connexion indisponible, réessayez.'),
        ).toBeInTheDocument();
        // Retour au formulaire (pas de trajet en cache pour ce couple) -
        // meme comportement qu'avant #10.
        expect(screen.getByLabelText('Origine')).toHaveValue('Gare Part-Dieu');
      },
    );

    it(
      "ignore le cache et affiche l'erreur habituelle quand le backend a " +
        'bien ete joint (ApiError) - la connexion n\'est pas en cause',
      async () => {
        vi.mocked(placesLib.searchPlaces).mockImplementation((query) =>
          Promise.resolve(query === 'Gare' ? [GARE] : [HOTEL_DE_VILLE]),
        );
        const itineraries = [
          {
            startTime: 't0',
            endTime: 't1',
            durationSeconds: 600,
            transfers: 0,
            segments: [],
          },
        ];
        vi.mocked(tripsLib.searchTrips).mockResolvedValueOnce({ itineraries });
        const user = userEvent.setup();
        renderPage();

        await selectAddress(user, 'Origine', 'Gare', 'Gare Part-Dieu');
        await selectAddress(user, 'Destination', 'Mairie', 'Hôtel de Ville');
        await user.click(screen.getByRole('button', { name: 'Rechercher' }));
        await screen.findAllByRole('button', { name: /min/ });

        vi.mocked(tripsLib.searchTrips).mockRejectedValueOnce(
          new ApiError('Moteur de calcul indisponible', 503),
        );
        await user.click(screen.getByRole('button', { name: 'Rechercher' }));

        expect(
          await screen.findByText('Moteur de calcul indisponible'),
        ).toBeInTheDocument();
        expect(
          screen.queryByText('Résultats hors ligne'),
        ).not.toBeInTheDocument();
      },
    );
  });

  it("les criteres de recherche restent affiches et pre-remplis une fois les resultats obtenus (issue #234)", async () => {
    vi.mocked(placesLib.searchPlaces).mockImplementation((query) =>
      Promise.resolve(query === 'Gare' ? [GARE] : [HOTEL_DE_VILLE]),
    );
    const itineraries = [
      { startTime: 't0', endTime: 't1', durationSeconds: 600, transfers: 0, segments: [] },
    ];
    vi.mocked(tripsLib.searchTrips).mockResolvedValue({ itineraries });
    const user = userEvent.setup();
    renderPage();

    await selectAddress(user, 'Origine', 'Gare', 'Gare Part-Dieu');
    await selectAddress(user, 'Destination', 'Mairie', 'Hôtel de Ville');
    await user.click(screen.getByRole('button', { name: 'Rechercher' }));
    await screen.findAllByRole('button', { name: /min/ });

    // Plus besoin de cliquer "Modifier la recherche" (retire, issue #234) :
    // les champs sont deja la, deja pre-remplis, directement modifiables.
    expect(screen.getByLabelText('Origine')).toHaveValue('Gare Part-Dieu');
    expect(screen.getByLabelText('Destination')).toHaveValue('Hôtel de Ville');
  });

  describe('modifier une recherche depuis les resultats (issue #234)', () => {
    async function searchAndReachResults(user: ReturnType<typeof userEvent.setup>) {
      vi.mocked(placesLib.searchPlaces).mockImplementation((query) =>
        Promise.resolve(query === 'Gare' ? [GARE] : [HOTEL_DE_VILLE]),
      );
      const itineraries = [
        { startTime: 't0', endTime: 't1', durationSeconds: 600, transfers: 0, segments: [] },
      ];
      vi.mocked(tripsLib.searchTrips).mockResolvedValue({ itineraries });
      renderPage();

      await selectAddress(user, 'Origine', 'Gare', 'Gare Part-Dieu');
      await selectAddress(user, 'Destination', 'Mairie', 'Hôtel de Ville');
      await user.click(screen.getByRole('button', { name: 'Rechercher' }));
      await screen.findAllByRole('button', { name: /min/ });
    }

    it(
      'modifier un champ puis re-soumettre relance directement la ' +
        'recherche, sans aucune etape intermediaire (retour testeur : ' +
        "l'ancien detour Resume -> Modifier -> Edition -> Rechercher -> " +
        'Resume genait l\'iteration rapide)',
      async () => {
        const user = userEvent.setup();
        await searchAndReachResults(user);
        expect(tripsLib.searchTrips).toHaveBeenCalledTimes(1);

        // Champs ET liste de resultats visibles SIMULTANEMENT - plus de
        // bouton "Modifier la recherche" a chercher/cliquer avant de
        // pouvoir toucher aux champs (voir RecherchePageResults.tsx).
        // getAllByRole (pas getByRole) : la liste est dupliquee entre le
        // panneau desktop et le bandeau mobile (seule une media query CSS
        // decide laquelle est visible, non appliquee sous jsdom) -
        // contrairement au formulaire, qui lui reste une instance unique.
        expect(screen.getByLabelText('Origine')).toBeInTheDocument();
        expect(
          screen.getAllByRole('button', { name: /min/ }).length,
        ).toBeGreaterThan(0);

        await selectAddress(user, 'Origine', 'Gare', 'Gare Part-Dieu');
        await user.click(screen.getByRole('button', { name: 'Rechercher' }));

        await waitFor(() => {
          expect(tripsLib.searchTrips).toHaveBeenCalledTimes(2);
        });
        // Toujours affiches apres la nouvelle recherche - jamais retires du
        // rendu (contrairement a l'ancienne vue Edition, #171/#172, qui
        // demontait la liste le temps de l'edition).
        expect(screen.getByLabelText('Origine')).toBeInTheDocument();
        expect(
          (await screen.findAllByRole('button', { name: /min/ })).length,
        ).toBeGreaterThan(0);
      },
    );

    it(
      "ne propose plus de bouton 'Annuler' (issue #234, retire avec la " +
        "vue Edition qu'il servait a fermer)",
      async () => {
        const user = userEvent.setup();
        await searchAndReachResults(user);
        expect(
          screen.queryByRole('button', { name: 'Annuler' }),
        ).not.toBeInTheDocument();
      },
    );
  });

  it('ne pre-remplit pas les modes de transport pour un utilisateur non connecte', async () => {
    const user = userEvent.setup();
    renderPage();
    expect(profileLib.getMyProfile).not.toHaveBeenCalled();

    // Case derriere le bouton "Filtres" (issue #233, ferme par defaut) :
    // l'ouvrir avant de verifier son etat, comme le ferait un vrai
    // utilisateur.
    await user.click(screen.getByRole('button', { name: 'Filtres' }));

    expect(screen.getByRole('checkbox', { name: 'Vélo' })).not.toBeChecked();
  });

  describe('modale de filtres - modes de transport + heure de depart (issue #108/#109, #233 lot 2)', () => {
    it("n'affiche aucun badge tant qu'aucun filtre n'est actif", () => {
      renderPage();

      // Le badge (pastille avec le compte) est absent : le nom accessible
      // du bouton reste "Filtres" seul, sans le suffixe "(N)".
      expect(
        screen.getByRole('button', { name: 'Filtres' }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('checkbox', { name: 'Vélo' }),
      ).not.toBeInTheDocument();
    });

    it('affiche le nombre de filtres actifs sur le bouton declencheur, mis a jour en direct', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByRole('button', { name: 'Filtres' }));
      await user.click(screen.getByRole('checkbox', { name: 'Vélo' }));
      await user.click(screen.getByRole('checkbox', { name: 'Bus' }));

      expect(
        screen.getByRole('button', { name: 'Filtres (2)' }),
      ).toBeInTheDocument();

      await user.click(screen.getByRole('checkbox', { name: 'Vélo' }));

      expect(
        screen.getByRole('button', { name: 'Filtres (1)' }),
      ).toBeInTheDocument();
    });

    it('ferme la modale et rend le focus au declencheur au clic sur "Fermer"', async () => {
      const user = userEvent.setup();
      renderPage();

      const trigger = screen.getByRole('button', { name: 'Filtres' });
      await user.click(trigger);
      await user.click(screen.getByRole('button', { name: 'Fermer' }));

      expect(
        screen.queryByRole('checkbox', { name: 'Vélo' }),
      ).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });

    it('ferme la modale et rend le focus au declencheur a la touche Echap', async () => {
      const user = userEvent.setup();
      renderPage();

      const trigger = screen.getByRole('button', { name: 'Filtres' });
      await user.click(trigger);
      await user.keyboard('{Escape}');

      expect(
        screen.queryByRole('checkbox', { name: 'Vélo' }),
      ).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });

    it(
      'ferme la modale et rend le focus au declencheur au clic sur le fond ' +
        '(contrairement a l\'ancien popover : une VRAIE modale avec un fond ' +
        "opaque n'a pas d'autre cible de focus a respecter derriere elle)",
      async () => {
        const user = userEvent.setup();
        renderPage();

        const trigger = screen.getByRole('button', { name: 'Filtres' });
        await user.click(trigger);
        const dialog = screen.getByRole('dialog', {
          name: 'Filtres de recherche',
        });
        // Clique le fond lui-meme (le parent de la boite de dialogue),
        // jamais un descendant - voir handleBackdropClick dans
        // RecherchePage.tsx, qui ne ferme que si event.target ===
        // event.currentTarget. Aucun role/texte propre a interroger pour
        // ce fond purement visuel : acces direct via .parentElement.
        await user.click(dialog.parentElement as HTMLElement);

        expect(
          screen.queryByRole('checkbox', { name: 'Vélo' }),
        ).not.toBeInTheDocument();
        expect(trigger).toHaveFocus();
      },
    );

    it('conserve la selection quand la modale est refermee puis rouverte', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByRole('button', { name: 'Filtres' }));
      await user.click(screen.getByRole('checkbox', { name: 'Tram' }));
      await user.keyboard('{Escape}');

      await user.click(screen.getByRole('button', { name: 'Filtres (1)' }));

      expect(screen.getByRole('checkbox', { name: 'Tram' })).toBeChecked();
    });

    it('compte aussi une heure de depart renseignee dans le badge de filtres actifs', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByRole('button', { name: 'Filtres' }));
      await user.type(
        screen.getByLabelText('Partir à'),
        '2026-09-10T08:00',
      );
      await user.keyboard('{Escape}');

      expect(
        screen.getByRole('button', { name: 'Filtres (1)' }),
      ).toBeInTheDocument();
    });

    it('transmet les modes coches a GET /trips au lancement de la recherche (issue #87)', async () => {
      vi.mocked(placesLib.searchPlaces).mockImplementation((query) =>
        Promise.resolve(query === 'Gare' ? [GARE] : [HOTEL_DE_VILLE]),
      );
      vi.mocked(tripsLib.searchTrips).mockResolvedValue({ itineraries: [] });
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByRole('button', { name: 'Filtres' }));
      await user.click(screen.getByRole('checkbox', { name: 'Bus' }));
      await user.click(screen.getByRole('checkbox', { name: 'Métro' }));
      await user.keyboard('{Escape}');

      await selectAddress(user, 'Origine', 'Gare', 'Gare Part-Dieu');
      await selectAddress(user, 'Destination', 'Mairie', 'Hôtel de Ville');
      await user.click(screen.getByRole('button', { name: 'Rechercher' }));

      await waitFor(() => {
        expect(tripsLib.searchTrips).toHaveBeenCalledWith(
          expect.objectContaining({ transportModes: ['bus', 'metro'] }),
        );
      });
    });

    it('omet transportModes quand aucun mode n\'est coche (issue #87, filtre absent = tous les modes)', async () => {
      vi.mocked(placesLib.searchPlaces).mockImplementation((query) =>
        Promise.resolve(query === 'Gare' ? [GARE] : [HOTEL_DE_VILLE]),
      );
      vi.mocked(tripsLib.searchTrips).mockResolvedValue({ itineraries: [] });
      const user = userEvent.setup();
      renderPage();

      await selectAddress(user, 'Origine', 'Gare', 'Gare Part-Dieu');
      await selectAddress(user, 'Destination', 'Mairie', 'Hôtel de Ville');
      await user.click(screen.getByRole('button', { name: 'Rechercher' }));

      await waitFor(() => {
        expect(tripsLib.searchTrips).toHaveBeenCalled();
      });
      const [params] = vi.mocked(tripsLib.searchTrips).mock.calls[0];
      expect(params).not.toHaveProperty('transportModes');
    });

    it(
      "ferme le dropdown de suggestions d'adresse quand la modale de " +
        'filtres s\'ouvre (issue #252, les deux overlays se chevauchaient)',
      async () => {
        vi.mocked(placesLib.searchPlaces).mockResolvedValue([GARE]);
        const user = userEvent.setup();
        renderPage();

        await user.type(screen.getByLabelText('Origine'), 'Gare');
        expect(
          await screen.findByRole('button', { name: 'Gare Part-Dieu' }),
        ).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Filtres' }));

        expect(
          screen.queryByRole('button', { name: 'Gare Part-Dieu' }),
        ).not.toBeInTheDocument();
      },
    );
    // Pas de test symetrique "ouvrir un dropdown referme la modale" : verifie
    // manuellement en session (Playwright, vrai navigateur) que ce sens est
    // deja impossible via une interaction reelle - le fond opaque de la
    // modale intercepte tout clic vers les champs situes derriere elle, et
    // son piege de focus empeche deja Tab d'en sortir (voir le commentaire
    // de forceClosed dans AddressField.tsx). Un test jsdom sur ce sens
    // passerait a tort : jsdom n'applique ni l'occlusion par le fond ni un
    // vrai piege de focus, contrairement a un navigateur reel.
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
    vi.mocked(tripsLib.searchTrips).mockResolvedValue({ itineraries });
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
      vi.mocked(tripsLib.searchTrips).mockResolvedValue({ itineraries });

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
        (await screen.findAllByRole('button', { name: /min/ })).length,
      ).toBeGreaterThan(0);
      expect(screen.getByLabelText('Origine')).toHaveValue('Gare Part-Dieu');
      expect(screen.getByLabelText('Destination')).toHaveValue(
        'Hôtel de Ville',
      );
    });

    it("ne relance rien quand la page est ouverte sans etat de navigation", () => {
      renderPage();
      expect(tripsLib.searchTrips).not.toHaveBeenCalled();
    });
  });

  describe('reprise automatique d\'un trajet suivi (issue #18)', () => {
    it(
      "relance la recherche origine/destination du suivi actif au tap sur " +
        'la notification (ouverture sur "/recherche" sans etat de navigation)',
      async () => {
        saveTokens({ accessToken: 'fake-token', refreshToken: 'fake-refresh' });
        vi.mocked(followedTripLib.getCurrentFollowedTrip).mockResolvedValue({
          id: 'followed-1',
          userId: 'user-1',
          originLat: GARE.lat,
          originLon: GARE.lon,
          originLabel: GARE.label,
          destinationLat: HOTEL_DE_VILLE.lat,
          destinationLon: HOTEL_DE_VILLE.lon,
          destinationLabel: HOTEL_DE_VILLE.label,
          segments: [],
          transportModes: null,
          endTime: '2026-08-20T19:00:00.000Z',
          lastNotifiedDisruptionSignature: null,
          createdAt: '2026-08-20T18:00:00.000Z',
        });
        vi.mocked(tripsLib.searchTrips).mockResolvedValue({
          itineraries: [
            {
              startTime: 't0',
              endTime: 't1',
              durationSeconds: 600,
              transfers: 0,
              segments: [],
            },
          ],
        });

        renderPage();

        await waitFor(() => {
          // originLabel/destinationLabel inclus : contrairement au test
          // #174 ci-dessus (visiteur non authentifie), ce test authentifie
          // l'utilisateur (le suivi necessite un compte, voir
          // performSearch - libelles transmis uniquement si isAuthenticated).
          expect(tripsLib.searchTrips).toHaveBeenCalledWith({
            originLat: GARE.lat,
            originLon: GARE.lon,
            originLabel: GARE.label,
            destinationLat: HOTEL_DE_VILLE.lat,
            destinationLon: HOTEL_DE_VILLE.lon,
            destinationLabel: HOTEL_DE_VILLE.label,
          });
        });
      },
    );

    it("ne relance rien pour un visiteur non authentifie (le suivi necessite un compte, issue #18)", () => {
      renderPage();
      expect(followedTripLib.getCurrentFollowedTrip).not.toHaveBeenCalled();
      expect(tripsLib.searchTrips).not.toHaveBeenCalled();
    });

    it("ne relance rien quand l'utilisateur authentifie ne suit aucun trajet", async () => {
      saveTokens({ accessToken: 'fake-token', refreshToken: 'fake-refresh' });
      vi.mocked(followedTripLib.getCurrentFollowedTrip).mockResolvedValue(null);

      renderPage();

      await waitFor(() =>
        expect(followedTripLib.getCurrentFollowedTrip).toHaveBeenCalled(),
      );
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

  describe('persistance de la recherche entre navigations (issue #266)', () => {
    it(
      'restaure origine et destination apres un remontage (changement de ' +
        'page), sans recherche lancee',
      async () => {
        vi.mocked(placesLib.searchPlaces).mockResolvedValue([GARE]);
        const user = userEvent.setup();
        const { unmount } = renderPage();

        await selectAddress(user, 'Origine', 'Gare', 'Gare Part-Dieu');
        await user.type(screen.getByLabelText('Destination'), 'Mairie');

        // Simule un changement de route (React demonte RecherchePage) puis
        // un retour dessus (nouveau montage) - meme mecanique que la
        // navigation reelle via react-router.
        unmount();
        renderPage();

        expect(
          await screen.findByDisplayValue('Gare Part-Dieu'),
        ).toBeInTheDocument();
        expect(screen.getByDisplayValue('Mairie')).toBeInTheDocument();
      },
    );

    it(
      "restaure l'ecran resultats apres un remontage, sans refaire l'appel " +
        'reseau (resultats deja connus, persistes avec la recherche)',
      async () => {
        vi.mocked(placesLib.searchPlaces).mockImplementation((query) =>
          Promise.resolve(query === 'Gare' ? [GARE] : [HOTEL_DE_VILLE]),
        );
        const itineraries = [
          { startTime: 't0', endTime: 't1', durationSeconds: 600, transfers: 0, segments: [] },
        ];
        vi.mocked(tripsLib.searchTrips).mockResolvedValue({ itineraries });
        const user = userEvent.setup();
        const { unmount } = renderPage();

        await selectAddress(user, 'Origine', 'Gare', 'Gare Part-Dieu');
        await selectAddress(user, 'Destination', 'Mairie', 'Hôtel de Ville');
        await user.click(screen.getByRole('button', { name: 'Rechercher' }));
        await waitFor(() =>
          expect(tripsLib.searchTrips).toHaveBeenCalledTimes(1),
        );

        unmount();
        renderPage();

        expect(await screen.findByLabelText('Origine')).toHaveValue(
          'Gare Part-Dieu',
        );
        expect(screen.getByLabelText('Destination')).toHaveValue(
          'Hôtel de Ville',
        );
        // Toujours un seul appel : le remontage restaure l'ecran resultats
        // depuis sessionStorage plutot que de relancer GET /trips.
        expect(tripsLib.searchTrips).toHaveBeenCalledTimes(1);
      },
    );
  });
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ApiError } from '../../lib/api';
import { AuthProvider } from '../../lib/AuthProvider';
import * as placesLib from '../../lib/places';
import * as profileLib from '../../lib/profile';
import * as tripsLib from '../../lib/trips';
import RecherchePage from './RecherchePage';

vi.mock('../../lib/places');
vi.mock('../../lib/trips');

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

  it('ne pre-remplit pas les modes de transport pour un utilisateur non connecte', async () => {
    const user = userEvent.setup();
    renderPage();
    expect(profileLib.getMyProfile).not.toHaveBeenCalled();

    // Case derriere la divulgation "Plus d'options" (issue #110/#111,
    // repliee par defaut) : l'ouvrir avant de verifier son etat, comme le
    // ferait un vrai utilisateur.
    await user.click(screen.getByText("Plus d'options"));

    expect(screen.getByRole('checkbox', { name: 'Vélo' })).not.toBeChecked();
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

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ApiError } from '../../lib/api';
import { AuthProvider } from '../../lib/AuthProvider';
import * as placesLib from '../../lib/places';
import * as profileLib from '../../lib/profile';
import * as tripsLib from '../../lib/trips';
import RecherchePage from './RecherchePage';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

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

  it('recherche puis navigue vers /resultats avec les criteres en etat de navigation', async () => {
    vi.mocked(placesLib.searchPlaces).mockImplementation((query) =>
      Promise.resolve(query === 'Gare' ? [GARE] : [HOTEL_DE_VILLE]),
    );
    const itineraries = [{ startTime: 't0', endTime: 't1', durationSeconds: 600, transfers: 0, segments: [] }];
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
      expect(navigateMock).toHaveBeenCalledWith('/resultats', {
        state: { itineraries, origin: GARE, destination: HOTEL_DE_VILLE },
      });
    });
  });

  it("affiche une erreur reseau generique quand l'appel a /trips echoue", async () => {
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
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('ne pre-remplit pas les modes de transport pour un utilisateur non connecte', () => {
    renderPage();
    expect(profileLib.getMyProfile).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox', { name: 'Vélo' })).not.toBeChecked();
  });
});

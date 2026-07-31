import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ApiError } from '../../lib/api';
import { AuthProvider } from '../../lib/AuthProvider';
import * as profileLib from '../../lib/profile';
import ProfilPage from './ProfilPage';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

// Auto-mock complet remplacerait aussi TRANSPORT_MODES (un tableau, pas une
// fonction) par une valeur vide : on garde l'export reel de tout sauf les
// fonctions d'appel API, qu'on mocke explicitement.
vi.mock('../../lib/profile', async () => {
  const actual =
    await vi.importActual<typeof import('../../lib/profile')>('../../lib/profile');
  return {
    ...actual,
    getMyProfile: vi.fn(),
    createProfile: vi.fn(),
    updateProfile: vi.fn(),
    deleteProfile: vi.fn(),
  };
});

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ProfilPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('ProfilPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("propose un formulaire vide et cree le profil quand l'utilisateur n'en a pas encore", async () => {
    vi.mocked(profileLib.getMyProfile).mockRejectedValue(
      new ApiError('Profil introuvable', 404),
    );
    vi.mocked(profileLib.createProfile).mockResolvedValue({
      id: 'profile-1',
      userId: 'user-1',
      preferredTransportModes: ['cycling'],
      reducedMobility: true,
      maxWalkingDistanceMeters: null,
      maxTransfers: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const user = userEvent.setup();
    renderPage();

    await screen.findByRole('button', { name: 'Enregistrer' });
    await user.click(screen.getByRole('checkbox', { name: 'Vélo' }));
    await user.click(screen.getByRole('checkbox', { name: 'Mobilité réduite' }));
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => {
      expect(profileLib.createProfile).toHaveBeenCalledWith({
        preferredTransportModes: ['cycling'],
        reducedMobility: true,
      });
      expect(profileLib.updateProfile).not.toHaveBeenCalled();
    });
    expect(await screen.findByText('Profil enregistré.')).toBeInTheDocument();
  });

  it('pre-remplit le formulaire avec le profil existant et le met a jour', async () => {
    vi.mocked(profileLib.getMyProfile).mockResolvedValue({
      id: 'profile-1',
      userId: 'user-1',
      preferredTransportModes: ['walking'],
      reducedMobility: false,
      maxWalkingDistanceMeters: 500,
      maxTransfers: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    vi.mocked(profileLib.updateProfile).mockResolvedValue({
      id: 'profile-1',
      userId: 'user-1',
      preferredTransportModes: ['walking'],
      reducedMobility: true,
      maxWalkingDistanceMeters: 500,
      maxTransfers: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const user = userEvent.setup();
    renderPage();

    // Pre-remplissage : le mode "Marche" doit deja etre coche.
    const walkingCheckbox = await screen.findByRole('checkbox', {
      name: 'Marche',
    });
    expect(walkingCheckbox).toBeChecked();
    expect(screen.getByLabelText('Distance de marche maximale (mètres)')).toHaveValue(500);
    expect(screen.getByLabelText('Nombre de correspondances maximum')).toHaveValue(2);

    await user.click(screen.getByRole('checkbox', { name: 'Mobilité réduite' }));
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => {
      expect(profileLib.updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({ reducedMobility: true }),
      );
      expect(profileLib.createProfile).not.toHaveBeenCalled();
    });
  });

  it("redirige vers la connexion si le chargement du profil renvoie 401 (session expiree)", async () => {
    vi.mocked(profileLib.getMyProfile).mockRejectedValue(
      new ApiError('Session expirée, veuillez vous reconnecter', 401),
    );

    renderPage();

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/connexion');
    });
  });

  it('affiche une erreur si la sauvegarde echoue', async () => {
    vi.mocked(profileLib.getMyProfile).mockRejectedValue(
      new ApiError('Profil introuvable', 404),
    );
    vi.mocked(profileLib.createProfile).mockRejectedValue(
      new ApiError('Erreur interne du serveur', 500),
    );

    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Enregistrer' }));

    expect(
      await screen.findByText('Erreur interne du serveur'),
    ).toBeInTheDocument();
  });
});

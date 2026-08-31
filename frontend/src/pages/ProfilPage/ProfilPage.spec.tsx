import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ApiError } from '../../lib/api';
import { AuthProvider } from '../../lib/AuthProvider';
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from '../../lib/authStorage';
import * as placesLib from '../../lib/places';
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

// AddressField (domicile/travail, issue #113/#114) appelle GET /places.
vi.mock('../../lib/places');

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
    vi.mocked(placesLib.searchPlaces).mockResolvedValue([]);
  });

  afterEach(() => {
    clearTokens();
  });

  describe("onboarding quand l'utilisateur n'a pas encore de profil (issue #106/#107)", () => {
    beforeEach(() => {
      vi.mocked(profileLib.getMyProfile).mockRejectedValue(
        new ApiError('Profil introuvable', 404),
      );
    });

    it('affiche l\'etape 1 (modes de transport) en premier, avec un indicateur de progression', async () => {
      renderPage();

      expect(await screen.findByText('Étape 1 sur 2')).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: 'Modes de transport préférés' }),
      ).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'Vélo' })).not.toBeChecked();
      expect(
        screen.queryByRole('checkbox', { name: 'Accessible en fauteuil roulant' }),
      ).not.toBeInTheDocument();
    });

    it('passe a l\'etape 2 en conservant la selection au clic sur "Continuer"', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole('checkbox', { name: 'Vélo' }));
      await user.click(screen.getByRole('button', { name: 'Continuer' }));

      expect(await screen.findByText('Étape 2 sur 2')).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: "Préférences d'accessibilité" }),
      ).toBeInTheDocument();

      // Revenir a l'etape 1 (bouton "Precedent") : la selection est conservee.
      await user.click(screen.getByRole('button', { name: '← Précédent' }));
      expect(screen.getByRole('checkbox', { name: 'Vélo' })).toBeChecked();
    });

    it(
      'cree le profil et termine la sequence au clic sur "Terminer" (issue ' +
        '#106/#107)',
      async () => {
        vi.mocked(profileLib.createProfile).mockResolvedValue({
          id: 'profile-1',
          userId: 'user-1',
          preferredTransportModes: ['cycling'],
          accessibilityPreferences: ['wheelchair_accessible'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        const user = userEvent.setup();
        renderPage();

        await user.click(await screen.findByRole('checkbox', { name: 'Vélo' }));
        await user.click(screen.getByRole('button', { name: 'Continuer' }));
        await user.click(
          await screen.findByRole('checkbox', { name: 'Accessible en fauteuil roulant' }),
        );
        await user.click(screen.getByRole('button', { name: 'Terminer' }));

        await waitFor(() => {
          expect(profileLib.createProfile).toHaveBeenCalledWith({
            preferredTransportModes: ['cycling'],
            accessibilityPreferences: ['wheelchair_accessible'],
          });
        });
        // Fin de l'onboarding : redirige vers /recherche, pas de maintien
        // sur /profil (spec section 3.4).
        expect(navigateMock).toHaveBeenCalledWith('/recherche');
      },
    );

    it('"Passer" a l\'etape 1 vide la selection de modes avant de passer a l\'etape 2', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole('checkbox', { name: 'Vélo' }));
      await user.click(screen.getByRole('button', { name: 'Passer' }));

      await screen.findByText('Étape 2 sur 2');
      await user.click(screen.getByRole('button', { name: '← Précédent' }));
      expect(screen.getByRole('checkbox', { name: 'Vélo' })).not.toBeChecked();
    });

    it(
      '"Passer" a l\'etape 2 cree le profil sans les preferences ' +
        "d'accessibilite, meme si une case avait ete cochee",
      async () => {
        vi.mocked(profileLib.createProfile).mockResolvedValue({
          id: 'profile-1',
          userId: 'user-1',
          preferredTransportModes: [],
          accessibilityPreferences: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        const user = userEvent.setup();
        renderPage();

        await user.click(await screen.findByRole('button', { name: 'Passer' }));
        await user.click(
          await screen.findByRole('checkbox', { name: 'Accessible en fauteuil roulant' }),
        );
        await user.click(screen.getByRole('button', { name: 'Passer' }));

        await waitFor(() => {
          expect(profileLib.createProfile).toHaveBeenCalledWith({
            preferredTransportModes: [],
            accessibilityPreferences: [],
          });
        });
        expect(navigateMock).toHaveBeenCalledWith('/recherche');
      },
    );

    it("affiche une erreur et reste sur l'etape 2 si la creation du profil echoue", async () => {
      vi.mocked(profileLib.createProfile).mockRejectedValue(
        new ApiError('Erreur interne du serveur', 500),
      );
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole('button', { name: 'Passer' }));
      await user.click(await screen.findByRole('button', { name: 'Terminer' }));

      expect(
        await screen.findByText('Erreur interne du serveur'),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: "Préférences d'accessibilité" }),
      ).toBeInTheDocument();
      expect(navigateMock).not.toHaveBeenCalledWith('/recherche');
    });
  });

  it('pre-remplit le formulaire avec le profil existant et le met a jour', async () => {
    vi.mocked(profileLib.getMyProfile).mockResolvedValue({
      id: 'profile-1',
      userId: 'user-1',
      preferredTransportModes: ['walking'],
      accessibilityPreferences: ['limit_transfers'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    vi.mocked(profileLib.updateProfile).mockResolvedValue({
      id: 'profile-1',
      userId: 'user-1',
      preferredTransportModes: ['walking'],
      accessibilityPreferences: ['limit_transfers', 'wheelchair_accessible'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const user = userEvent.setup();
    renderPage();

    // Pre-remplissage : le mode "Marche" et "Limiter le nombre de
    // correspondances" doivent deja etre coches.
    const walkingCheckbox = await screen.findByRole('checkbox', {
      name: 'Marche',
    });
    expect(walkingCheckbox).toBeChecked();
    expect(
      screen.getByRole('checkbox', {
        name: 'Limiter le nombre de correspondances',
      }),
    ).toBeChecked();

    await user.click(
      screen.getByRole('checkbox', { name: 'Accessible en fauteuil roulant' }),
    );
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => {
      expect(profileLib.updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          accessibilityPreferences: ['limit_transfers', 'wheelchair_accessible'],
        }),
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

  it("nettoie les jetons et redirige vers la recherche au clic sur 'Se deconnecter' (issue #65)", async () => {
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

    await user.click(await screen.findByRole('button', { name: 'Se déconnecter' }));

    // Pas vers /connexion : se deconnecter peut juste vouloir dire "faire
    // une recherche sans que le compte connecte l'influence", pas
    // forcement se reconnecter dans la foulee (retour utilisateur, voir
    // le commentaire de handleLogout dans ProfilPage.tsx).
    expect(navigateMock).toHaveBeenCalledWith('/recherche');
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it('affiche une erreur si la sauvegarde du formulaire d\'edition echoue (profil existant)', async () => {
    vi.mocked(profileLib.getMyProfile).mockResolvedValue({
      id: 'profile-1',
      userId: 'user-1',
      preferredTransportModes: [],
      accessibilityPreferences: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    vi.mocked(profileLib.updateProfile).mockRejectedValue(
      new ApiError('Erreur interne du serveur', 500),
    );

    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Enregistrer' }));

    expect(
      await screen.findByText('Erreur interne du serveur'),
    ).toBeInTheDocument();
  });

  describe('domicile et travail (issue #113/#114)', () => {
    const RUE_DE_LA_PAIX = { label: 'Rue de la Paix', lat: 48.1, lon: -1.2 };

    function mockExistingProfile(
      overrides: Partial<profileLib.MobilityProfile> = {},
    ) {
      vi.mocked(profileLib.getMyProfile).mockResolvedValue({
        id: 'profile-1',
        userId: 'user-1',
        preferredTransportModes: [],
        accessibilityPreferences: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...overrides,
      });
    }

    it('pre-remplit le champ domicile avec une adresse deja enregistree', async () => {
      mockExistingProfile({
        homeLabel: 'Domicile test',
        homeLat: 48.1,
        homeLon: -1.2,
      });

      renderPage();

      expect(await screen.findByLabelText('Domicile')).toHaveValue(
        'Domicile test',
      );
    });

    it(
      'ne montre aucun dropdown au focus des champs domicile/travail vides ' +
        '(issue #166, spec section 6)',
      async () => {
        mockExistingProfile();
        const user = userEvent.setup();
        renderPage();

        await user.click(await screen.findByLabelText('Domicile'));

        // Les entrées rapides de /recherche ("Ma position actuelle",
        // "Recherché récemment"...) sont un comportement opt-in : ProfilPage
        // ne l'active pas, le champ reste au géocodeur seul dès 2 caractères.
        expect(
          screen.queryByRole('button', { name: /Ma position actuelle/ }),
        ).not.toBeInTheDocument();
        expect(
          screen.queryByText('Recherché récemment'),
        ).not.toBeInTheDocument();
      },
    );

    it('envoie la nouvelle adresse travail selectionnee, sans toucher au domicile (laisse vide)', async () => {
      mockExistingProfile();
      vi.mocked(placesLib.searchPlaces).mockResolvedValue([RUE_DE_LA_PAIX]);
      vi.mocked(profileLib.updateProfile).mockResolvedValue({
        id: 'profile-1',
        userId: 'user-1',
        preferredTransportModes: [],
        accessibilityPreferences: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      const user = userEvent.setup();
      renderPage();

      await user.type(await screen.findByLabelText('Travail'), 'Rue');
      const suggestion = await screen.findByRole('button', {
        name: 'Rue de la Paix',
      });
      await user.click(suggestion);
      await user.click(
        await screen.findByRole('button', { name: 'Enregistrer' }),
      );

      await waitFor(() => {
        expect(profileLib.updateProfile).toHaveBeenCalledWith(
          expect.objectContaining({
            workLabel: 'Rue de la Paix',
            workLat: 48.1,
            workLon: -1.2,
          }),
        );
      });
      // Domicile jamais renseigne ni touche : aucune cle correspondante
      // dans le payload (voir handleSubmit - un champ vide n'envoie rien,
      // pas de semantique "effacer").
      const [payload] = vi.mocked(profileLib.updateProfile).mock.calls[0];
      expect(payload).not.toHaveProperty('homeLabel');
      expect(payload).not.toHaveProperty('homeLat');
      expect(payload).not.toHaveProperty('homeLon');
    });

    it(
      "signale une adresse tapee mais non selectionnee comme non resolue, " +
        'sans appeler updateProfile',
      async () => {
        mockExistingProfile();
        const user = userEvent.setup();
        renderPage();

        await user.type(await screen.findByLabelText('Domicile'), 'Rue');
        await user.click(
          await screen.findByRole('button', { name: 'Enregistrer' }),
        );

        expect(
          await screen.findByText(
            'Adresse non résolue. Sélectionnez une adresse dans la liste de suggestions.',
          ),
        ).toBeInTheDocument();
        expect(profileLib.updateProfile).not.toHaveBeenCalled();
      },
    );
  });
});

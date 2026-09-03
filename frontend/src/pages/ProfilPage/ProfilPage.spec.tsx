import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ApiError } from '../../lib/api';
import * as authLib from '../../lib/auth';
import { AuthProvider } from '../../lib/AuthProvider';
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from '../../lib/authStorage';
import * as placesLib from '../../lib/places';
import * as profileLib from '../../lib/profile';
import ProfilPage from './ProfilPage';

// Seul deleteAccount() est mocke (issue #164) - logout() reste la vraie
// implementation : le test de deconnexion existant (issue #65) verifie un
// effet reel sur authStorage (getAccessToken/getRefreshToken), pas un appel
// mocke.
vi.mock('../../lib/auth', async () => {
  const actual =
    await vi.importActual<typeof import('../../lib/auth')>('../../lib/auth');
  return { ...actual, deleteAccount: vi.fn() };
});

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

  describe("onboarding quand l'utilisateur n'a pas encore de profil (issue #106/#107, adresses #236)", () => {
    /** Profil renvoye par un createProfile() reussi - forme complete attendue par MobilityProfile. */
    function mockCreatedProfile(
      overrides: Partial<profileLib.MobilityProfile> = {},
    ) {
      vi.mocked(profileLib.createProfile).mockResolvedValue({
        id: 'profile-1',
        userId: 'user-1',
        preferredTransportModes: [],
        accessibilityPreferences: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...overrides,
      });
    }

    /** Avance jusqu'a l'etape 3 (domicile/travail) en passant les 2 premieres. */
    async function goToAddressStep(user: ReturnType<typeof userEvent.setup>) {
      await user.click(await screen.findByRole('button', { name: 'Passer' })); // etape 1
      await user.click(await screen.findByRole('button', { name: 'Passer' })); // etape 2
      await screen.findByText('Étape 3 sur 3');
    }

    beforeEach(() => {
      vi.mocked(profileLib.getMyProfile).mockRejectedValue(
        new ApiError('Profil introuvable', 404),
      );
    });

    it('affiche l\'etape 1 (modes de transport) en premier, avec un indicateur de progression', async () => {
      renderPage();

      expect(await screen.findByText('Étape 1 sur 3')).toBeInTheDocument();
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

      expect(await screen.findByText('Étape 2 sur 3')).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: "Préférences d'accessibilité" }),
      ).toBeInTheDocument();

      // Revenir a l'etape 1 (bouton "Precedent") : la selection est conservee.
      await user.click(screen.getByRole('button', { name: '← Précédent' }));
      expect(screen.getByRole('checkbox', { name: 'Vélo' })).toBeChecked();
    });

    it('passe de l\'etape 2 a l\'etape 3 (domicile/travail) au clic sur "Continuer"', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole('button', { name: 'Continuer' })); // etape 1 -> 2
      await user.click(
        await screen.findByRole('button', { name: 'Continuer' }),
      ); // etape 2 -> 3

      expect(await screen.findByText('Étape 3 sur 3')).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: 'Domicile et travail' }),
      ).toBeInTheDocument();
      expect(screen.getByLabelText('Domicile')).toBeInTheDocument();
      expect(screen.getByLabelText('Travail')).toBeInTheDocument();

      // "Precedent" revient a l'etape 2.
      await user.click(screen.getByRole('button', { name: '← Précédent' }));
      expect(await screen.findByText('Étape 2 sur 3')).toBeInTheDocument();
    });

    it(
      'cree le profil avec les preferences des 3 etapes et termine la ' +
        'sequence (issue #106/#107, #236)',
      async () => {
        mockCreatedProfile({
          preferredTransportModes: ['cycling'],
          accessibilityPreferences: ['wheelchair_accessible'],
        });
        const user = userEvent.setup();
        renderPage();

        await user.click(await screen.findByRole('checkbox', { name: 'Vélo' }));
        await user.click(screen.getByRole('button', { name: 'Continuer' }));
        await user.click(
          await screen.findByRole('checkbox', { name: 'Accessible en fauteuil roulant' }),
        );
        await user.click(screen.getByRole('button', { name: 'Continuer' }));
        // Etape 3 laissee vide : "Terminer" cree le profil sans cle d'adresse.
        await user.click(await screen.findByRole('button', { name: 'Terminer' }));

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

    it('envoie les adresses domicile/travail selectionnees a l\'etape 3', async () => {
      mockCreatedProfile();
      vi.mocked(placesLib.searchPlaces).mockResolvedValue([
        { label: 'Rue de la Paix', lat: 48.1, lon: -1.2 },
      ]);
      const user = userEvent.setup();
      renderPage();

      await goToAddressStep(user);
      await user.type(screen.getByLabelText('Domicile'), 'Rue');
      await user.click(
        await screen.findByRole('button', { name: 'Rue de la Paix' }),
      );
      await user.click(screen.getByRole('button', { name: 'Terminer' }));

      await waitFor(() => {
        expect(profileLib.createProfile).toHaveBeenCalledWith(
          expect.objectContaining({
            preferredTransportModes: [],
            accessibilityPreferences: [],
            homeLabel: 'Rue de la Paix',
            homeLat: 48.1,
            homeLon: -1.2,
          }),
        );
      });
      // Travail jamais renseigne : aucune cle correspondante (meme regle
      // que le formulaire d'edition, pas de semantique "effacer").
      const [payload] = vi.mocked(profileLib.createProfile).mock.calls[0];
      expect(payload).not.toHaveProperty('workLabel');
      expect(navigateMock).toHaveBeenCalledWith('/recherche');
    });

    it(
      'signale une adresse tapee mais non selectionnee a l\'etape 3, sans ' +
        'appeler createProfile',
      async () => {
        const user = userEvent.setup();
        renderPage();

        await goToAddressStep(user);
        await user.type(screen.getByLabelText('Domicile'), 'Rue');
        await user.click(screen.getByRole('button', { name: 'Terminer' }));

        expect(
          await screen.findByText(
            'Adresse non résolue. Sélectionnez une adresse dans la liste de suggestions.',
          ),
        ).toBeInTheDocument();
        expect(profileLib.createProfile).not.toHaveBeenCalled();
      },
    );

    it('"Passer" a l\'etape 1 vide la selection de modes avant de passer a l\'etape 2', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole('checkbox', { name: 'Vélo' }));
      await user.click(screen.getByRole('button', { name: 'Passer' }));

      await screen.findByText('Étape 2 sur 3');
      await user.click(screen.getByRole('button', { name: '← Précédent' }));
      expect(screen.getByRole('checkbox', { name: 'Vélo' })).not.toBeChecked();
    });

    it(
      '"Passer" a l\'etape 2 vide la selection d\'accessibilite avant de ' +
        "passer a l'etape 3, meme si une case avait ete cochee",
      async () => {
        mockCreatedProfile();
        const user = userEvent.setup();
        renderPage();

        await user.click(await screen.findByRole('button', { name: 'Passer' })); // etape 1
        await user.click(
          await screen.findByRole('checkbox', { name: 'Accessible en fauteuil roulant' }),
        );
        await user.click(screen.getByRole('button', { name: 'Passer' })); // etape 2 -> 3
        await user.click(await screen.findByRole('button', { name: 'Terminer' }));

        await waitFor(() => {
          expect(profileLib.createProfile).toHaveBeenCalledWith({
            preferredTransportModes: [],
            accessibilityPreferences: [],
          });
        });
        expect(navigateMock).toHaveBeenCalledWith('/recherche');
      },
    );

    it("affiche une erreur et reste sur l'etape 3 si la creation du profil echoue", async () => {
      vi.mocked(profileLib.createProfile).mockRejectedValue(
        new ApiError('Erreur interne du serveur', 500),
      );
      const user = userEvent.setup();
      renderPage();

      await goToAddressStep(user);
      await user.click(screen.getByRole('button', { name: 'Terminer' }));

      expect(
        await screen.findByText('Erreur interne du serveur'),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: 'Domicile et travail' }),
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

  describe('suppression de compte (issue #164, droit a l\'effacement RGPD)', () => {
    function mockExistingProfileForDeletion() {
      vi.mocked(profileLib.getMyProfile).mockResolvedValue({
        id: 'profile-1',
        userId: 'user-1',
        preferredTransportModes: [],
        accessibilityPreferences: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    it(
      "affiche un panneau de confirmation (mot de passe) au clic sur " +
        "'Supprimer mon compte', sans rien supprimer avant validation " +
        '(jamais juste un confirm() navigateur)',
      async () => {
        mockExistingProfileForDeletion();
        const user = userEvent.setup();
        renderPage();

        await user.click(
          await screen.findByRole('button', { name: 'Supprimer mon compte' }),
        );

        expect(screen.getByLabelText('Mot de passe (confirmation)')).toBeInTheDocument();
        expect(authLib.deleteAccount).not.toHaveBeenCalled();
      },
    );

    it(
      "supprime le compte, redirige vers /recherche et invalide la session " +
        'apres confirmation avec le mot de passe',
      async () => {
        saveTokens({ accessToken: 'fake-token', refreshToken: 'fake-refresh' });
        mockExistingProfileForDeletion();
        vi.mocked(authLib.deleteAccount).mockImplementation(async () => {
          clearTokens();
        });
        const user = userEvent.setup();
        renderPage();

        await user.click(
          await screen.findByRole('button', { name: 'Supprimer mon compte' }),
        );
        await user.type(
          screen.getByLabelText('Mot de passe (confirmation)'),
          'MotDePasse123!',
        );
        await user.click(
          screen.getByRole('button', { name: 'Supprimer définitivement' }),
        );

        await waitFor(() => {
          expect(authLib.deleteAccount).toHaveBeenCalledWith('MotDePasse123!');
        });
        // Meme destination que la deconnexion (issue #65) : /recherche
        // reste utilisable sans compte, voir handleAccountDeleted.
        expect(navigateMock).toHaveBeenCalledWith('/recherche');
        expect(getAccessToken()).toBeNull();
        expect(getRefreshToken()).toBeNull();
      },
    );

    it(
      "affiche l'erreur renvoyee par l'API (mot de passe incorrect) et " +
        'reste sur le panneau de confirmation, sans naviguer',
      async () => {
        mockExistingProfileForDeletion();
        // 403, pas 401 (voir backend/src/users/users.service.ts#remove) :
        // deleteAccount() (mocke ici) est cense propager le message tel
        // quel, sans passer par le mecanisme de rafraichissement
        // automatique de authRequest reserve au 401 (lib/api.ts).
        vi.mocked(authLib.deleteAccount).mockRejectedValue(
          new ApiError('Mot de passe incorrect', 403),
        );
        const user = userEvent.setup();
        renderPage();

        await user.click(
          await screen.findByRole('button', { name: 'Supprimer mon compte' }),
        );
        await user.type(
          screen.getByLabelText('Mot de passe (confirmation)'),
          'MauvaisMotDePasse',
        );
        await user.click(
          screen.getByRole('button', { name: 'Supprimer définitivement' }),
        );

        expect(await screen.findByText('Mot de passe incorrect')).toBeInTheDocument();
        expect(
          screen.getByLabelText('Mot de passe (confirmation)'),
        ).toBeInTheDocument();
        expect(navigateMock).not.toHaveBeenCalledWith('/recherche');
      },
    );

    it("'Annuler' referme le panneau de confirmation sans appeler deleteAccount", async () => {
      mockExistingProfileForDeletion();
      const user = userEvent.setup();
      renderPage();

      await user.click(
        await screen.findByRole('button', { name: 'Supprimer mon compte' }),
      );
      await user.click(screen.getByRole('button', { name: 'Annuler' }));

      expect(
        screen.queryByLabelText('Mot de passe (confirmation)'),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Supprimer mon compte' }),
      ).toBeInTheDocument();
      expect(authLib.deleteAccount).not.toHaveBeenCalled();
    });
  });
});

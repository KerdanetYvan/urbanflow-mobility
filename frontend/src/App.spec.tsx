import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import * as profileLib from './lib/profile';
import * as authLib from './lib/auth';
import { saveTokens, clearTokens } from './lib/authStorage';
import App from './App';

// ProfilPage (derriere RequireAuth) appelle getMyProfile() au montage : on
// mocke le module pour ce fichier de test de NAVIGATION, qui ne s'interesse
// qu'au routing, pas au contenu de la page (voir ProfilPage.spec.tsx pour
// ca). Evite un vrai appel reseau dans l'environnement de test. Garde les
// exports reels non-fonction (TRANSPORT_MODES) : l'auto-mock les viderait.
vi.mock('./lib/profile', async () => {
  const actual =
    await vi.importActual<typeof import('./lib/profile')>('./lib/profile');
  return { ...actual, getMyProfile: vi.fn() };
});

// MemoryRouter simule un historique de navigation en memoire (pas besoin
// d'un vrai navigateur ni de jsdom.location) : utile pour tester le routing
// de facon isolee, avec un point de depart choisi (initialEntries).
function renderApp(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <App />
    </MemoryRouter>,
  );
}

describe('App (navigation)', () => {
  afterEach(() => {
    clearTokens();
  });

  it("affiche l'ecran de recherche sur la route racine, sans compte requis", () => {
    renderApp('/');

    expect(
      screen.getByRole('heading', { name: "Recherche d'itinéraire" }),
    ).toBeInTheDocument();
  });

  it('n\'affiche que les liens de navigation pertinents pour un visiteur non connecte', () => {
    renderApp();

    const nav = screen.getByRole('navigation', {
      name: 'Navigation principale',
    });
    const navScope = within(nav);
    for (const label of ['Recherche', 'Connexion']) {
      expect(navScope.getByRole('link', { name: label })).toBeInTheDocument();
    }
    // Profil et Historique ne concernent qu'un utilisateur connecte ;
    // Resultats n'est jamais un onglet de nav permanent (voir issue #64).
    for (const label of ['Profil', 'Résultats', 'Historique']) {
      expect(navScope.queryByRole('link', { name: label })).not.toBeInTheDocument();
    }
  });

  it("n'affiche que les liens de navigation pertinents pour un utilisateur connecte", () => {
    saveTokens({ accessToken: 'fake-token', refreshToken: 'fake-refresh' });
    vi.mocked(profileLib.getMyProfile).mockResolvedValue({
      id: 'profile-1',
      userId: 'user-1',
      preferredTransportModes: [],
      reducedMobility: false,
      maxWalkingDistanceMeters: null,
      maxTransfers: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    renderApp();

    const nav = screen.getByRole('navigation', {
      name: 'Navigation principale',
    });
    const navScope = within(nav);
    for (const label of ['Recherche', 'Profil', 'Historique']) {
      expect(navScope.getByRole('link', { name: label })).toBeInTheDocument();
    }
    // Connexion n'a plus rien a proposer a quelqu'un deja identifie.
    expect(navScope.queryByRole('link', { name: 'Connexion' })).not.toBeInTheDocument();
  });

  it('redirige /connexion vers /profil si on est deja connecte', () => {
    saveTokens({ accessToken: 'fake-token', refreshToken: 'fake-refresh' });
    vi.mocked(profileLib.getMyProfile).mockResolvedValue({
      id: 'profile-1',
      userId: 'user-1',
      preferredTransportModes: [],
      reducedMobility: false,
      maxWalkingDistanceMeters: null,
      maxTransfers: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    renderApp('/connexion');

    expect(
      screen.getByRole('heading', { name: 'Profil de mobilité' }),
    ).toBeInTheDocument();
  });

  it("affiche une invitation discrete a se connecter sur l'ecran de recherche pour un visiteur non connecte", () => {
    renderApp('/recherche');

    expect(
      screen.getByRole('link', { name: 'Connectez-vous' }),
    ).toBeInTheDocument();
  });

  it("n'affiche pas d'invitation a se connecter sur l'ecran de recherche pour un utilisateur connecte", () => {
    saveTokens({ accessToken: 'fake-token', refreshToken: 'fake-refresh' });

    renderApp('/recherche');

    expect(
      screen.queryByRole('link', { name: 'Connectez-vous' }),
    ).not.toBeInTheDocument();
  });

  it('redirige vers la connexion si on visite /profil sans etre connecte', async () => {
    renderApp('/profil');

    expect(
      screen.getByRole('heading', { name: 'Connexion' }),
    ).toBeInTheDocument();
  });

  it('met a jour la nav juste apres une connexion reussie, sans reload (regression AppLayout reste monte)', async () => {
    vi.mocked(profileLib.getMyProfile).mockResolvedValue({
      id: 'profile-1',
      userId: 'user-1',
      preferredTransportModes: [],
      reducedMobility: false,
      maxWalkingDistanceMeters: null,
      maxTransfers: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    vi.spyOn(authLib, 'login').mockImplementation(async () => {
      saveTokens({ accessToken: 'fake-token', refreshToken: 'fake-refresh' });
    });

    const user = userEvent.setup();
    renderApp('/connexion');

    await user.type(screen.getByLabelText('Adresse email'), 'alice@example.com');
    await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse123');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Profil de mobilité' }),
      ).toBeInTheDocument();
    });

    const nav = screen.getByRole('navigation', {
      name: 'Navigation principale',
    });
    expect(
      within(nav).queryByRole('link', { name: 'Connexion' }),
    ).not.toBeInTheDocument();
  });

  it('navigue vers la page Profil au clic sur le lien correspondant, une fois connecte', async () => {
    // Simule un utilisateur deja connecte : un access token present suffit
    // pour que RequireAuth laisse passer (voir components/RequireAuth.tsx).
    saveTokens({ accessToken: 'fake-token', refreshToken: 'fake-refresh' });
    vi.mocked(profileLib.getMyProfile).mockResolvedValue({
      id: 'profile-1',
      userId: 'user-1',
      preferredTransportModes: [],
      reducedMobility: false,
      maxWalkingDistanceMeters: null,
      maxTransfers: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('link', { name: 'Profil' }));

    expect(
      screen.getByRole('heading', { name: 'Profil de mobilité' }),
    ).toBeInTheDocument();
    // Le lien actif doit porter aria-current="page" (ajoute automatiquement
    // par NavLink), utile aux lecteurs d'ecran et utilise comme crochet CSS.
    expect(screen.getByRole('link', { name: 'Profil' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});

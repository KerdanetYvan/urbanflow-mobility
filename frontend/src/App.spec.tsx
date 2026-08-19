import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import * as profileLib from './lib/profile';
import * as authLib from './lib/auth';
import { saveTokens, clearTokens } from './lib/authStorage';
import { fakeJwt } from './test/fakeJwt';
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
      accessibilityPreferences: [],
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
      accessibilityPreferences: [],
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

  it('redirige vers la connexion si on visite /profil avec des jetons JWT prouves expires (issue #65, durcissement RequireAuth)', () => {
    saveTokens({ accessToken: fakeJwt(-60), refreshToken: fakeJwt(-1) });

    renderApp('/profil');

    expect(
      screen.getByRole('heading', { name: 'Connexion' }),
    ).toBeInTheDocument();
    // getMyProfile n'a meme pas besoin d'etre appele : le rejet est purement
    // local, avant tout aller-retour reseau.
    expect(profileLib.getMyProfile).not.toHaveBeenCalled();
  });

  it("ne redirige pas /connexion vers /profil si les jetons JWT sont prouves expires, meme si un jeton existe (issue #65)", () => {
    saveTokens({ accessToken: fakeJwt(-60), refreshToken: fakeJwt(-1) });

    renderApp('/connexion');

    expect(
      screen.getByRole('heading', { name: 'Connexion' }),
    ).toBeInTheDocument();
  });

  it('met a jour la nav juste apres une connexion reussie, sans reload (regression AppLayout reste monte)', async () => {
    vi.mocked(profileLib.getMyProfile).mockResolvedValue({
      id: 'profile-1',
      userId: 'user-1',
      preferredTransportModes: [],
      accessibilityPreferences: [],
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

    // Profil deja existant (getMyProfile mocke ci-dessus) : atterrit sur
    // /recherche, pas /profil (issue #106/#107, voir ConnexionPage.tsx).
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: "Recherche d'itinéraire" }),
      ).toBeInTheDocument();
    });

    const nav = screen.getByRole('navigation', {
      name: 'Navigation principale',
    });
    expect(
      within(nav).queryByRole('link', { name: 'Connexion' }),
    ).not.toBeInTheDocument();
  });

  it("deconnecte vers /recherche au clic sur 'Se deconnecter', sans etre reprisi par le garde RequireAuth (issue #65)", async () => {
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
    renderApp('/profil');

    await user.click(await screen.findByRole('button', { name: 'Se déconnecter' }));

    expect(
      await screen.findByRole('heading', { name: "Recherche d'itinéraire" }),
    ).toBeInTheDocument();
  });

  it('navigue vers la page Profil au clic sur le lien correspondant, une fois connecte', async () => {
    // Simule un utilisateur deja connecte : un access token present suffit
    // pour que RequireAuth laisse passer (voir components/RequireAuth.tsx).
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

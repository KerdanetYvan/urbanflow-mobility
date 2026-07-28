import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import * as profileLib from './lib/profile';
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

  it("redirige la route racine vers l'ecran de connexion", () => {
    renderApp('/');

    expect(
      screen.getByRole('heading', { name: 'Connexion' }),
    ).toBeInTheDocument();
  });

  it('affiche un lien de navigation vers chaque ecran principal', () => {
    renderApp();

    const nav = screen.getByRole('navigation', {
      name: 'Navigation principale',
    });
    const navScope = within(nav);
    for (const label of [
      'Connexion',
      'Profil',
      'Recherche',
      'Résultats',
      'Historique',
    ]) {
      expect(navScope.getByRole('link', { name: label })).toBeInTheDocument();
    }
  });

  it('redirige vers la connexion si on visite /profil sans etre connecte', async () => {
    renderApp('/profil');

    expect(
      screen.getByRole('heading', { name: 'Connexion' }),
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

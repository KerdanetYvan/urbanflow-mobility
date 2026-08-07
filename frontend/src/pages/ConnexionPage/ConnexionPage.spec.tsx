import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ApiError } from '../../lib/api';
import * as authLib from '../../lib/auth';
import { AuthProvider } from '../../lib/AuthProvider';
import ConnexionPage from './ConnexionPage';

// react-router-dom reel (MemoryRouter fonctionne normalement), seul
// useNavigate est remplace par un espion pour verifier vers ou l'ecran
// redirige apres une connexion reussie.
const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

// login()/register() sont mockes : ce test verifie le COMPORTEMENT de
// l'ecran (validation, appels, affichage d'erreur, navigation), pas le
// reseau reel (deja verifie manuellement contre le backend, voir la PR).
vi.mock('../../lib/auth');

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ConnexionPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('ConnexionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche le lien 'Mot de passe oublié ?' seulement en mode connexion (issue #71)", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(
      screen.getByRole('link', { name: 'Mot de passe oublié ?' }),
    ).toHaveAttribute('href', '/mot-de-passe-oublie');

    await user.click(screen.getByRole('tab', { name: 'Créer un compte' }));

    expect(
      screen.queryByRole('link', { name: 'Mot de passe oublié ?' }),
    ).not.toBeInTheDocument();
  });

  it('affiche les erreurs de validation sans appeler login si le formulaire est vide', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(screen.getByText('Adresse email invalide')).toBeInTheDocument();
    expect(screen.getByText('Le mot de passe est requis')).toBeInTheDocument();
    expect(authLib.login).not.toHaveBeenCalled();
  });

  it("bascule vers le formulaire d'inscription et applique la regle de complexite du mot de passe", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('tab', { name: 'Créer un compte' }));
    await user.type(screen.getByLabelText('Adresse email'), 'alice@example.com');
    // Minuscule uniquement : ni majuscule, ni chiffre, ni caractere special.
    await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse');
    await user.type(
      screen.getByLabelText('Confirmer le mot de passe'),
      'motdepasse',
    );
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }));

    expect(
      screen.getByText(
        'Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial',
      ),
    ).toBeInTheDocument();
    expect(authLib.register).not.toHaveBeenCalled();
  });

  it('refuse une inscription si la confirmation ne correspond pas au mot de passe', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('tab', { name: 'Créer un compte' }));
    await user.type(screen.getByLabelText('Adresse email'), 'alice@example.com');
    await user.type(screen.getByLabelText('Mot de passe'), 'MotDePasse123!');
    await user.type(
      screen.getByLabelText('Confirmer le mot de passe'),
      'AutreChose123!',
    );
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }));

    expect(
      screen.getByText('Les mots de passe ne correspondent pas'),
    ).toBeInTheDocument();
    expect(authLib.register).not.toHaveBeenCalled();
  });

  it('connecte puis redirige vers /profil quand les identifiants sont corrects', async () => {
    vi.mocked(authLib.login).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Adresse email'), 'alice@example.com');
    await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse123');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    await waitFor(() => {
      expect(authLib.login).toHaveBeenCalledWith(
        'alice@example.com',
        'motdepasse123',
      );
      expect(navigateMock).toHaveBeenCalledWith('/profil');
    });
  });

  it("affiche le message d'erreur de l'API en cas d'identifiants invalides, sans naviguer", async () => {
    vi.mocked(authLib.login).mockRejectedValue(
      new ApiError('Email ou mot de passe incorrect', 401),
    );
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Adresse email'), 'alice@example.com');
    await user.type(screen.getByLabelText('Mot de passe'), 'mauvais123');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(
      await screen.findByText('Email ou mot de passe incorrect'),
    ).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("inscrit puis connecte automatiquement l'utilisateur en mode inscription", async () => {
    vi.mocked(authLib.register).mockResolvedValue({
      id: 'user-1',
      email: 'bob@example.com',
      createdAt: new Date().toISOString(),
    });
    vi.mocked(authLib.login).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('tab', { name: 'Créer un compte' }));
    await user.type(screen.getByLabelText('Adresse email'), 'bob@example.com');
    await user.type(screen.getByLabelText('Mot de passe'), 'MotDePasse123!');
    await user.type(
      screen.getByLabelText('Confirmer le mot de passe'),
      'MotDePasse123!',
    );
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }));

    await waitFor(() => {
      expect(authLib.register).toHaveBeenCalledWith(
        'bob@example.com',
        'MotDePasse123!',
      );
      expect(authLib.login).toHaveBeenCalledWith(
        'bob@example.com',
        'MotDePasse123!',
      );
      expect(navigateMock).toHaveBeenCalledWith('/profil');
    });
  });
});

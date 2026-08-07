import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ApiError } from '../../lib/api';
import * as authLib from '../../lib/auth';
import ReinitialiserMotDePassePage from './ReinitialiserMotDePassePage';

// resetPassword() est mockee : ce test verifie le COMPORTEMENT de l'ecran
// (lecture du token, validation, appel, affichage), pas le reseau reel.
vi.mock('../../lib/auth');

function renderPage(path = '/reset-password?token=un-token-valide') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ReinitialiserMotDePassePage />
    </MemoryRouter>,
  );
}

describe('ReinitialiserMotDePassePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche une erreur immediate et aucun formulaire si le token est absent de l'URL", () => {
    renderPage('/reset-password');

    expect(screen.getByText('Lien invalide')).toBeInTheDocument();
    expect(
      screen.queryByLabelText('Nouveau mot de passe'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Redemander un lien' }),
    ).toHaveAttribute('href', '/mot-de-passe-oublie');
  });

  it("applique la regle de complexite du mot de passe sans appeler l'API", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(
      screen.getByLabelText('Nouveau mot de passe'),
      'motdepasse',
    );
    await user.type(
      screen.getByLabelText('Confirmer le mot de passe'),
      'motdepasse',
    );
    await user.click(screen.getByRole('button', { name: 'Réinitialiser' }));

    expect(
      screen.getByText(
        'Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial',
      ),
    ).toBeInTheDocument();
    expect(authLib.resetPassword).not.toHaveBeenCalled();
  });

  it('refuse si la confirmation ne correspond pas au nouveau mot de passe', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(
      screen.getByLabelText('Nouveau mot de passe'),
      'NouveauMotDePasse123!',
    );
    await user.type(
      screen.getByLabelText('Confirmer le mot de passe'),
      'AutreChose123!',
    );
    await user.click(screen.getByRole('button', { name: 'Réinitialiser' }));

    expect(
      screen.getByText('Les mots de passe ne correspondent pas'),
    ).toBeInTheDocument();
    expect(authLib.resetPassword).not.toHaveBeenCalled();
  });

  it("appelle resetPassword avec le token de l'URL et affiche le message de succes", async () => {
    vi.mocked(authLib.resetPassword).mockResolvedValue({
      message: 'Mot de passe reinitialise.',
    });
    const user = userEvent.setup();
    renderPage('/reset-password?token=abc123');

    await user.type(
      screen.getByLabelText('Nouveau mot de passe'),
      'NouveauMotDePasse123!',
    );
    await user.type(
      screen.getByLabelText('Confirmer le mot de passe'),
      'NouveauMotDePasse123!',
    );
    await user.click(screen.getByRole('button', { name: 'Réinitialiser' }));

    expect(
      await screen.findByText('Mot de passe reinitialise.'),
    ).toBeInTheDocument();
    expect(authLib.resetPassword).toHaveBeenCalledWith(
      'abc123',
      'NouveauMotDePasse123!',
    );
    expect(
      screen.queryByLabelText('Nouveau mot de passe'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Se connecter' }),
    ).toHaveAttribute('href', '/connexion');
  });

  it("affiche le message d'erreur de l'API si le token est invalide ou expire", async () => {
    vi.mocked(authLib.resetPassword).mockRejectedValue(
      new ApiError('Lien de reinitialisation invalide ou expire', 400),
    );
    const user = userEvent.setup();
    renderPage();

    await user.type(
      screen.getByLabelText('Nouveau mot de passe'),
      'NouveauMotDePasse123!',
    );
    await user.type(
      screen.getByLabelText('Confirmer le mot de passe'),
      'NouveauMotDePasse123!',
    );
    await user.click(screen.getByRole('button', { name: 'Réinitialiser' }));

    expect(
      await screen.findByText('Lien de reinitialisation invalide ou expire'),
    ).toBeInTheDocument();
  });
});

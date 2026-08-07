import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ApiError } from '../../lib/api';
import * as authLib from '../../lib/auth';
import MotDePasseOubliePage from './MotDePasseOubliePage';

// forgotPassword() est mockee : ce test verifie le COMPORTEMENT de l'ecran
// (validation, appel, affichage), pas le reseau reel.
vi.mock('../../lib/auth');

function renderPage() {
  return render(
    <MemoryRouter>
      <MotDePasseOubliePage />
    </MemoryRouter>,
  );
}

describe('MotDePasseOubliePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche une erreur de validation sans appeler l'API si l'email est invalide", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Adresse email'), 'pas-un-email');
    await user.click(screen.getByRole('button', { name: 'Envoyer le lien' }));

    expect(screen.getByText('Adresse email invalide')).toBeInTheDocument();
    expect(authLib.forgotPassword).not.toHaveBeenCalled();
  });

  it("appelle forgotPassword et affiche le message generique renvoye par l'API", async () => {
    vi.mocked(authLib.forgotPassword).mockResolvedValue({
      message:
        'Si un compte existe pour cet email, un lien de reinitialisation a ete envoye.',
    });
    const user = userEvent.setup();
    renderPage();

    await user.type(
      screen.getByLabelText('Adresse email'),
      'alice@example.com',
    );
    await user.click(screen.getByRole('button', { name: 'Envoyer le lien' }));

    expect(
      await screen.findByText(
        'Si un compte existe pour cet email, un lien de reinitialisation a ete envoye.',
      ),
    ).toBeInTheDocument();
    expect(authLib.forgotPassword).toHaveBeenCalledWith('alice@example.com');
    // Le formulaire disparait au profit du message de succes.
    expect(screen.queryByLabelText('Adresse email')).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Retour à la connexion' }),
    ).toHaveAttribute('href', '/connexion');
  });

  it("affiche une erreur si l'appel API echoue de facon inattendue", async () => {
    vi.mocked(authLib.forgotPassword).mockRejectedValue(
      new ApiError('Erreur interne du serveur', 500),
    );
    const user = userEvent.setup();
    renderPage();

    await user.type(
      screen.getByLabelText('Adresse email'),
      'alice@example.com',
    );
    await user.click(screen.getByRole('button', { name: 'Envoyer le lien' }));

    expect(
      await screen.findByText('Erreur interne du serveur'),
    ).toBeInTheDocument();
  });
});

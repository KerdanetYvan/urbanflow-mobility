import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

// Test d'exemple : verifie que React Testing Library + Vitest sont
// correctement branches (rendu d'un composant, interaction utilisateur,
// assertion sur le DOM). Sert de reference pour les futurs tests de composants.
describe('App', () => {
  it('incremente le compteur a chaque clic sur le bouton', async () => {
    const user = userEvent.setup();
    render(<App />);

    const button = screen.getByRole('button', { name: /count is 0/i });
    expect(button).toBeInTheDocument();

    await user.click(button);

    expect(
      screen.getByRole('button', { name: /count is 1/i }),
    ).toBeInTheDocument();
  });
});

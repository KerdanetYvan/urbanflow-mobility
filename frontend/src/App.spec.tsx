import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

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

  it('navigue vers la page Profil au clic sur le lien correspondant', async () => {
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

import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import * as useAuthLib from '../../lib/useAuth';
import * as useOnlineStatusLib from '../../lib/useOnlineStatus';
import AppLayout from './AppLayout';

vi.mock('../../lib/useAuth');
vi.mock('../../lib/useOnlineStatus');

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/recherche']}>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route path="recherche" element={<p>Contenu</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('AppLayout - bandeau hors ligne (issue #10)', () => {
  beforeEach(() => {
    vi.mocked(useAuthLib.useAuth).mockReturnValue({
      isAuthenticated: false,
      setAuthenticated: vi.fn(),
    });
  });

  it("n'affiche aucun bandeau quand le navigateur est en ligne", () => {
    vi.mocked(useOnlineStatusLib.useOnlineStatus).mockReturnValue(true);

    renderLayout();

    expect(screen.queryByText('Hors ligne')).not.toBeInTheDocument();
  });

  it('affiche un bandeau explicite quand le navigateur est hors ligne', () => {
    vi.mocked(useOnlineStatusLib.useOnlineStatus).mockReturnValue(false);

    renderLayout();

    expect(screen.getByText('Hors ligne')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});

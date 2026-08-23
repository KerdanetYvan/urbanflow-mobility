import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ApiError } from '../../lib/api';
import { AuthProvider } from '../../lib/AuthProvider';
import { clearTokens } from '../../lib/authStorage';
import * as tripsLib from '../../lib/trips';
import HistoriquePage from './HistoriquePage';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

// Meme motif que ProfilPage.spec.tsx : garde l'export reel de tout sauf la
// fonction d'appel API, mockee explicitement.
vi.mock('../../lib/trips', async () => {
  const actual =
    await vi.importActual<typeof import('../../lib/trips')>('../../lib/trips');
  return { ...actual, getTripHistory: vi.fn() };
});

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <HistoriquePage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('HistoriquePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    clearTokens();
  });

  it('affiche un etat de chargement puis la liste des trajets recents', async () => {
    vi.mocked(tripsLib.getTripHistory).mockResolvedValue([
      {
        id: 'entry-1',
        originLat: 48.111,
        originLon: -1.682,
        originLabel: 'Part-Dieu',
        destinationLat: 48.127,
        destinationLon: -1.682,
        destinationLabel: 'Bellecour',
        lastSearchedAt: '2026-08-15T14:05:00.000Z',
      },
    ]);

    renderPage();

    expect(screen.getByText('Chargement…')).toBeInTheDocument();

    expect(await screen.findByText('Part-Dieu')).toBeInTheDocument();
    expect(screen.getByText('Bellecour')).toBeInTheDocument();
  });

  it("affiche l'etat vide quand aucun trajet n'a encore ete recherche", async () => {
    vi.mocked(tripsLib.getTripHistory).mockResolvedValue([]);

    renderPage();

    expect(
      await screen.findByText("L'historique des trajets récents sera affiché ici."),
    ).toBeInTheDocument();
  });

  it("affiche un libelle de repli (coordonnees) quand l'origine/la destination n'a pas de libelle", async () => {
    vi.mocked(tripsLib.getTripHistory).mockResolvedValue([
      {
        id: 'entry-1',
        originLat: 48.1111,
        originLon: -1.6822,
        destinationLat: 48.1271,
        destinationLon: -1.6823,
        lastSearchedAt: '2026-08-15T14:05:00.000Z',
      },
    ]);

    renderPage();

    expect(await screen.findByText('48.1111, -1.6822')).toBeInTheDocument();
    expect(screen.getByText('48.1271, -1.6823')).toBeInTheDocument();
  });

  it('affiche une erreur generique en cas de panne inattendue', async () => {
    vi.mocked(tripsLib.getTripHistory).mockRejectedValue(
      new Error('Panne reseau'),
    );

    renderPage();

    expect(
      await screen.findByText("Impossible de charger l'historique pour le moment."),
    ).toBeInTheDocument();
  });

  it('redirige vers la connexion si le chargement renvoie 401 (session expiree)', async () => {
    vi.mocked(tripsLib.getTripHistory).mockRejectedValue(
      new ApiError('Session expirée, veuillez vous reconnecter', 401),
    );

    renderPage();

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/connexion');
    });
  });
});

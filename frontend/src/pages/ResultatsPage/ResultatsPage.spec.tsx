import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { TripItinerary } from '../../lib/trips';
import ResultatsPage from './ResultatsPage';

const ORIGIN = { label: 'Gare Part-Dieu', lat: 45.76, lon: 4.86 };
const DESTINATION = { label: 'Hôtel de Ville', lat: 45.77, lon: 4.83 };

const FAST_ITINERARY: TripItinerary = {
  startTime: '2026-08-02T08:00:00.000Z',
  endTime: '2026-08-02T08:25:00.000Z',
  durationSeconds: 1500,
  transfers: 1,
  segments: [
    {
      mode: 'WALK',
      startTime: '2026-08-02T08:00:00.000Z',
      endTime: '2026-08-02T08:05:00.000Z',
      durationSeconds: 300,
      distanceMeters: 400,
      from: { name: 'Domicile', lat: 45.75, lon: 4.85 },
      to: { name: 'Arrêt Bellecour', lat: 45.751, lon: 4.851 },
      geometry: [
        { lat: 45.75, lon: 4.85 },
        { lat: 45.751, lon: 4.851 },
      ],
    },
    {
      mode: 'BUS',
      routeName: 'C1',
      startTime: '2026-08-02T08:05:00.000Z',
      endTime: '2026-08-02T08:25:00.000Z',
      durationSeconds: 1200,
      distanceMeters: 3000,
      from: { name: 'Arrêt Bellecour', lat: 45.751, lon: 4.851 },
      to: { name: 'Gare Part-Dieu', lat: 45.76, lon: 4.86 },
      geometry: [
        { lat: 45.751, lon: 4.851 },
        { lat: 45.76, lon: 4.86 },
      ],
    },
  ],
};

const SLOW_ITINERARY: TripItinerary = {
  startTime: '2026-08-02T08:00:00.000Z',
  endTime: '2026-08-02T08:45:00.000Z',
  durationSeconds: 2700,
  transfers: 0,
  segments: [
    {
      mode: 'WALK',
      startTime: '2026-08-02T08:00:00.000Z',
      endTime: '2026-08-02T08:45:00.000Z',
      durationSeconds: 2700,
      distanceMeters: 3200,
      from: { name: 'Domicile', lat: 45.75, lon: 4.85 },
      to: { name: 'Gare Part-Dieu', lat: 45.76, lon: 4.86 },
      geometry: [
        { lat: 45.75, lon: 4.85 },
        { lat: 45.76, lon: 4.86 },
      ],
    },
  ],
};

function renderPage(state?: {
  itineraries: TripItinerary[];
  origin: typeof ORIGIN;
  destination: typeof DESTINATION;
}) {
  return render(
    <MemoryRouter
      initialEntries={[{ pathname: '/resultats', state: state ?? null }]}
    >
      <Routes>
        <Route path="/resultats" element={<ResultatsPage />} />
        <Route path="/recherche" element={<p>Page de recherche</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ResultatsPage', () => {
  it("renvoie vers /recherche en l'absence de criteres de recherche (navigation directe, pas de resultat a afficher)", () => {
    renderPage();
    expect(screen.getByText('Page de recherche')).toBeInTheDocument();
  });

  it("affiche le contexte de la recherche et la liste dans l'ordre recu, sans re-trier", () => {
    renderPage({
      itineraries: [FAST_ITINERARY, SLOW_ITINERARY],
      origin: ORIGIN,
      destination: DESTINATION,
    });

    expect(
      screen.getByRole('link', { name: 'Modifier la recherche' }).closest('p'),
    ).toHaveTextContent('De Gare Part-Dieu à Hôtel de Ville');

    const cards = screen.getAllByRole('button', { name: /min/ });
    expect(cards).toHaveLength(2);
    // Le premier itineraire recu (le plus rapide) reste premier affiche.
    expect(cards[0]).toHaveTextContent('25 min');
    expect(cards[1]).toHaveTextContent('45 min');
  });

  it("ne montre jamais de valeur de score (uniquement l'ordre recu du backend)", () => {
    renderPage({
      itineraries: [FAST_ITINERARY],
      origin: ORIGIN,
      destination: DESTINATION,
    });

    expect(screen.queryByText(/score/i)).not.toBeInTheDocument();
  });

  it('presente le premier itineraire selectionne par defaut, avec son detail par segment', () => {
    renderPage({
      itineraries: [FAST_ITINERARY, SLOW_ITINERARY],
      origin: ORIGIN,
      destination: DESTINATION,
    });

    const cards = screen.getAllByRole('button', { name: /min/ });
    expect(cards[0]).toHaveAttribute('aria-current', 'true');
    expect(cards[1]).not.toHaveAttribute('aria-current');

    expect(screen.getByText('Bus C1')).toBeInTheDocument();
    expect(screen.getByText('Arrêt Bellecour → Gare Part-Dieu')).toBeInTheDocument();
  });

  it('change le detail affiche quand un autre itineraire de la liste est selectionne', async () => {
    const user = userEvent.setup();
    renderPage({
      itineraries: [FAST_ITINERARY, SLOW_ITINERARY],
      origin: ORIGIN,
      destination: DESTINATION,
    });

    const cards = screen.getAllByRole('button', { name: /min/ });
    await user.click(cards[1]);

    expect(cards[1]).toHaveAttribute('aria-current', 'true');
    expect(cards[0]).not.toHaveAttribute('aria-current');
    // Le detail par segment du deuxieme itineraire (trajet 100% marche) ne
    // contient plus de segment bus.
    expect(screen.queryByText('Bus C1')).not.toBeInTheDocument();
  });

  it("affiche un etat vide dedie (pas une erreur) quand aucun itineraire n'est trouve", () => {
    renderPage({ itineraries: [], origin: ORIGIN, destination: DESTINATION });

    expect(
      screen.getByText('Aucun itinéraire trouvé pour ce trajet.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Nouvelle recherche' }),
    ).toHaveAttribute('href', '/recherche');
  });

  it('la bascule mobile "Voir sur la carte" change son propre etat expanded', async () => {
    const user = userEvent.setup();
    renderPage({
      itineraries: [FAST_ITINERARY],
      origin: ORIGIN,
      destination: DESTINATION,
    });

    const toggle = screen.getByRole('button', { name: 'Voir sur la carte' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);

    expect(
      screen.getByRole('button', { name: 'Voir la liste' }),
    ).toHaveAttribute('aria-expanded', 'true');
  });
});

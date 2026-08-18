import { render, screen } from '@testing-library/react';
import type { TripItinerary } from '../../lib/trips';
import MapView from './MapView';

const ITINERARY: TripItinerary = {
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
        { lat: 45.755, lon: 4.855 },
        { lat: 45.76, lon: 4.86 },
      ],
    },
  ],
};

describe('MapView', () => {
  it("affiche un resume textuel et une legende des modes utilises (alternative a la carte)", () => {
    render(<MapView itinerary={ITINERARY} />);

    expect(
      screen.getByText('De Domicile à Gare Part-Dieu : 25 min, 1 correspondance.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Marche')).toBeInTheDocument();
    expect(screen.getByText('Bus C1')).toBeInTheDocument();
  });

  it(
    'affiche une vue par defaut (centree sur la metropole, sans marqueur) ' +
      "quand ni itineraire ni origine/destination ne sont connus (issue #110/#111, carte permanente)",
    () => {
      const { container } = render(
        <MapView itinerary={{ ...ITINERARY, segments: [] }} />,
      );
      // Vue permanente desormais (#110) : jamais d'ecran vide, meme sans
      // aucune donnee - voir RENNES_METROPOLE_CENTER dans MapView.tsx.
      expect(container).not.toBeEmptyDOMElement();
      expect(screen.queryByText(/De .* à .* :/)).not.toBeInTheDocument();
      expect(container.querySelector('.mapview-legend')).not.toBeInTheDocument();
    },
  );

  it("affiche seulement origine/destination sans resume ni legende quand l'itineraire n'est pas encore connu (issue #73, recherche en cours)", () => {
    const { container } = render(
      <MapView
        origin={{ lat: 45.75, lon: 4.85 }}
        destination={{ lat: 45.76, lon: 4.86 }}
      />,
    );

    expect(container).not.toBeEmptyDOMElement();
    expect(screen.queryByText(/De .* à .* :/)).not.toBeInTheDocument();
    expect(container.querySelector('.mapview-legend')).not.toBeInTheDocument();
  });

  it(
    "affiche un marqueur unique quand seule l'origine est connue " +
      '(issue #111 - formulaire de recherche, destination pas encore choisie)',
    () => {
      const { container } = render(
        <MapView origin={{ lat: 45.75, lon: 4.85 }} />,
      );

      expect(container).not.toBeEmptyDOMElement();
      expect(screen.queryByText(/De .* à .* :/)).not.toBeInTheDocument();
    },
  );

  it(
    'affiche un marqueur unique quand seule la destination est connue',
    () => {
      const { container } = render(
        <MapView destination={{ lat: 45.76, lon: 4.86 }} />,
      );

      expect(container).not.toBeEmptyDOMElement();
    },
  );

  describe('legende par ligne (issue #129, section 8.5)', () => {
    it('affiche un swatch par ligne colore avec la couleur GTFS quand elle est connue', () => {
      const itineraryWithColor: TripItinerary = {
        ...ITINERARY,
        segments: [
          ITINERARY.segments[0],
          { ...ITINERARY.segments[1], routeColor: '95C11E', routeTextColor: '1A171B' },
        ],
      };
      render(<MapView itinerary={itineraryWithColor} />);

      const busItem = screen.getByText('Bus C1').closest('.mapview-legend-item') as HTMLElement;
      const swatch = busItem.querySelector('.mapview-legend-swatch') as HTMLElement;
      expect(swatch).toHaveStyle({ background: '#95C11E' });
    });

    it('retombe sur la couleur du mode pour la legende quand le segment n a pas de couleur GTFS', () => {
      render(<MapView itinerary={ITINERARY} />);

      const busItem = screen.getByText('Bus C1').closest('.mapview-legend-item') as HTMLElement;
      const swatch = busItem.querySelector('.mapview-legend-swatch') as HTMLElement;
      expect(swatch).toHaveStyle({ background: '#2f6fed' });
    });

    it('affiche deux entrees distinctes pour deux lignes de bus differentes', () => {
      const twoLines: TripItinerary = {
        ...ITINERARY,
        segments: [
          { ...ITINERARY.segments[1], routeName: '24' },
          { ...ITINERARY.segments[1], routeName: 'C6' },
        ],
      };
      render(<MapView itinerary={twoLines} />);

      expect(screen.getByText('Bus 24')).toBeInTheDocument();
      expect(screen.getByText('Bus C6')).toBeInTheDocument();
    });

    it("n'affiche pas un libelle double (\"Bus Bus\") quand le segment n'a pas de routeName", () => {
      const noRouteName: TripItinerary = {
        ...ITINERARY,
        segments: [
          ITINERARY.segments[0],
          { ...ITINERARY.segments[1], routeName: undefined },
        ],
      };
      render(<MapView itinerary={noRouteName} />);

      // Repli de tripModeChips() sur le libelle du mode seul quand
      // `routeName` est absent - chipLabel() doit alors afficher "Bus" une
      // seule fois, pas "Bus Bus" (issue #129, regression finale review).
      expect(screen.getByText('Bus')).toBeInTheDocument();
      expect(screen.queryByText('Bus Bus')).not.toBeInTheDocument();
    });
  });
});

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
    expect(screen.getByText('Bus')).toBeInTheDocument();
  });

  it('ne rend rien si aucun segment (evite un crash carte sur itineraire vide)', () => {
    const { container } = render(
      <MapView itinerary={{ ...ITINERARY, segments: [] }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

import type { TripItinerary, TripSegment } from '../../lib/trips';
import { tripModeChips } from './tripModeChips';

/** Segment minimal pour ces tests - seuls `mode` et `routeName` comptent. */
function buildSegment(mode: string, overrides: Partial<TripSegment> = {}): TripSegment {
  return {
    mode,
    startTime: '2026-08-12T08:00:00.000Z',
    endTime: '2026-08-12T08:10:00.000Z',
    durationSeconds: 600,
    distanceMeters: 1000,
    from: { name: 'A', lat: 0, lon: 0 },
    to: { name: 'B', lat: 0, lon: 0 },
    geometry: [
      { lat: 0, lon: 0 },
      { lat: 0, lon: 0 },
    ],
    ...overrides,
  };
}

/** Itineraire minimal pour ces tests - seul `segments` compte. */
function buildItinerary(segments: TripSegment[]): TripItinerary {
  return {
    startTime: '2026-08-12T08:00:00.000Z',
    endTime: '2026-08-12T08:30:00.000Z',
    durationSeconds: 1800,
    transfers: Math.max(0, segments.length - 1),
    segments,
  };
}

describe('tripModeChips', () => {
  it('un segment BUS avec routeName produit un chip line avec ce libelle', () => {
    const itinerary = buildItinerary([buildSegment('BUS', { routeName: '24' })]);

    expect(tripModeChips(itinerary)).toEqual([
      { kind: 'line', mode: 'BUS', label: '24' },
    ]);
  });

  it('un segment BUS sans routeName retombe sur le libelle du mode', () => {
    const itinerary = buildItinerary([buildSegment('BUS')]);

    expect(tripModeChips(itinerary)).toEqual([
      { kind: 'line', mode: 'BUS', label: 'Bus' },
    ]);
  });

  it('deux lignes de bus distinctes produisent deux chips separes, dans l ordre du trajet', () => {
    const itinerary = buildItinerary([
      buildSegment('BUS', { routeName: '24' }),
      buildSegment('BUS', { routeName: 'C6' }),
    ]);

    expect(tripModeChips(itinerary)).toEqual([
      { kind: 'line', mode: 'BUS', label: '24' },
      { kind: 'line', mode: 'BUS', label: 'C6' },
    ]);
  });

  it('deux segments de la meme ligne ne produisent qu un seul chip', () => {
    const itinerary = buildItinerary([
      buildSegment('BUS', { routeName: '24' }),
      buildSegment('WALK'),
      buildSegment('BUS', { routeName: '24' }),
    ]);

    expect(tripModeChips(itinerary)).toEqual([
      { kind: 'line', mode: 'BUS', label: '24' },
      { kind: 'icon', mode: 'WALK' },
    ]);
  });

  it('les modes non-ligne produisent des chips icon, deduplique par mode', () => {
    const itinerary = buildItinerary([buildSegment('WALK'), buildSegment('WALK')]);

    expect(tripModeChips(itinerary)).toEqual([{ kind: 'icon', mode: 'WALK' }]);
  });

  it('preserve l ordre du trajet pour un melange de lignes et de modes non-ligne', () => {
    const itinerary = buildItinerary([
      buildSegment('WALK'),
      buildSegment('BUS', { routeName: '24' }),
      buildSegment('SUBWAY', { routeName: 'a' }),
      buildSegment('BUS', { routeName: 'C6' }),
    ]);

    expect(tripModeChips(itinerary)).toEqual([
      { kind: 'icon', mode: 'WALK' },
      { kind: 'line', mode: 'BUS', label: '24' },
      { kind: 'line', mode: 'SUBWAY', label: 'a' },
      { kind: 'line', mode: 'BUS', label: 'C6' },
    ]);
  });

  it('un itineraire sans segment renvoie une liste vide', () => {
    expect(tripModeChips(buildItinerary([]))).toEqual([]);
  });
});

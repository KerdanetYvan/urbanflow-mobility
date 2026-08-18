import type { TripSegment } from '../../lib/trips';
import { getSegmentColor } from './segmentColor';

/** Segment minimal pour ces tests - seuls mode/routeColor comptent. */
function buildSegment(mode: string, overrides: Partial<TripSegment> = {}): TripSegment {
  return {
    mode,
    startTime: '2026-08-18T08:00:00.000Z',
    endTime: '2026-08-18T08:10:00.000Z',
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

describe('getSegmentColor', () => {
  it('utilise la couleur de ligne GTFS (prefixee #) pour un segment BUS avec routeColor', () => {
    const segment = buildSegment('BUS', { routeColor: 'EE1D23' });
    expect(getSegmentColor(segment)).toBe('#EE1D23');
  });

  it('retombe sur la couleur du mode pour un segment BUS sans routeColor', () => {
    const segment = buildSegment('BUS');
    expect(getSegmentColor(segment)).toBe('#2f6fed');
  });

  it('ignore routeColor pour un mode sans notion de ligne (marche)', () => {
    const segment = buildSegment('WALK', { routeColor: 'EE1D23' });
    expect(getSegmentColor(segment)).toBe('#6b6375');
  });
});

import { act, renderHook } from '@testing-library/react';
import * as sharedMobilityLib from '../../lib/sharedMobility';
import type { SharedMobilityStation } from '../../lib/sharedMobility';
import { useSharedMobilityStations } from './useSharedMobilityStations';

vi.mock('../../lib/sharedMobility');

const STATION: SharedMobilityStation = {
  id: '5501',
  name: 'République',
  lat: 48.11,
  lon: -1.68,
  kind: 'station',
  bikesAvailable: 4,
  docksAvailable: 41,
  isRenting: true,
};

// Minuteurs simules (verifier la cadence de rafraichissement sans attendre
// reellement 60s) - vi.advanceTimersByTimeAsync (pas waitFor, incompatible
// avec les minuteurs simules) laisse aussi passer les microtaches reelles
// (resolution des promesses mockees). Enveloppe dans act() : la mise a jour
// d'etat qui en resulte (setStations) doit etre commitee avant l'assertion
// suivante, comme tout changement d'etat declenche pendant un test.
describe('useSharedMobilityStations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('charge les stations au montage', async () => {
    vi.mocked(sharedMobilityLib.fetchSharedMobilityStations).mockResolvedValue([
      STATION,
    ]);

    const { result } = renderHook(() => useSharedMobilityStations());
    await act(() => vi.advanceTimersByTimeAsync(0));

    expect(result.current).toEqual([STATION]);
    expect(sharedMobilityLib.fetchSharedMobilityStations).toHaveBeenCalledTimes(1);
  });

  it("conserve la derniere liste connue si un rafraichissement echoue (pas de crash, pas d'etat d'erreur)", async () => {
    vi.mocked(sharedMobilityLib.fetchSharedMobilityStations).mockResolvedValue([
      STATION,
    ]);
    const { result } = renderHook(() => useSharedMobilityStations());
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(result.current).toEqual([STATION]);

    vi.mocked(sharedMobilityLib.fetchSharedMobilityStations).mockRejectedValue(
      new Error('reseau indisponible'),
    );
    await act(() => vi.advanceTimersByTimeAsync(60_000));

    expect(result.current).toEqual([STATION]);
  });

  it('rafraichit toutes les 60 secondes tant que le composant reste monte', async () => {
    vi.mocked(sharedMobilityLib.fetchSharedMobilityStations).mockResolvedValue([]);
    renderHook(() => useSharedMobilityStations());
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(sharedMobilityLib.fetchSharedMobilityStations).toHaveBeenCalledTimes(1);

    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(sharedMobilityLib.fetchSharedMobilityStations).toHaveBeenCalledTimes(2);

    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(sharedMobilityLib.fetchSharedMobilityStations).toHaveBeenCalledTimes(3);
  });

  it('arrete de rafraichir au demontage', async () => {
    vi.mocked(sharedMobilityLib.fetchSharedMobilityStations).mockResolvedValue([]);
    const { unmount } = renderHook(() => useSharedMobilityStations());
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(sharedMobilityLib.fetchSharedMobilityStations).toHaveBeenCalledTimes(1);

    unmount();
    await act(() => vi.advanceTimersByTimeAsync(120_000));

    expect(sharedMobilityLib.fetchSharedMobilityStations).toHaveBeenCalledTimes(1);
  });
});

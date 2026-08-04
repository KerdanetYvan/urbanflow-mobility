import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { useGeolocation } from './useGeolocation';

function mockGeolocation(overrides: Partial<Geolocation> = {}) {
  const geolocation = {
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
    getCurrentPosition: vi.fn(),
    ...overrides,
  };
  vi.stubGlobal('navigator', { ...navigator, geolocation });
  return geolocation;
}

describe('useGeolocation', () => {
  afterEach(() => {
    // Demonte explicitement les hooks montes (declenche le cleanup de
    // l'effet, donc navigator.geolocation.clearWatch) AVANT de retirer le
    // stub de `navigator` ci-dessous - le cleanup automatique de Testing
    // Library (enregistre au niveau module, donc hors de ce describe)
    // s'executerait sinon apres vi.unstubAllGlobals(), plantant sur un
    // navigator.geolocation redevenu undefined.
    cleanup();
    vi.unstubAllGlobals();
  });

  it("ne sollicite pas le capteur GPS tant que 'enabled' est faux (pas de carte a afficher)", () => {
    const geolocation = mockGeolocation();
    renderHook(() => useGeolocation(false));

    expect(geolocation.watchPosition).not.toHaveBeenCalled();
  });

  it('expose la position renvoyee par watchPosition', async () => {
    const geolocation = mockGeolocation({
      watchPosition: vi.fn((success: PositionCallback) => {
        success({
          coords: { latitude: 45.76, longitude: 4.86 },
        } as GeolocationPosition);
        return 1;
      }),
    });
    void geolocation;

    const { result } = renderHook(() => useGeolocation(true));

    await waitFor(() => {
      expect(result.current).toEqual({
        status: 'watching',
        position: { lat: 45.76, lon: 4.86 },
      });
    });
  });

  it("passe en statut 'denied' si l'utilisateur refuse la permission, sans lever d'exception", async () => {
    mockGeolocation({
      watchPosition: vi.fn(
        (_success: PositionCallback, error: PositionErrorCallback) => {
          error({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError);
          return 1;
        },
      ),
    });

    const { result } = renderHook(() => useGeolocation(true));

    await waitFor(() => {
      expect(result.current).toEqual({ status: 'denied', position: null });
    });
  });

  it("passe en statut 'unsupported' si l'API n'existe pas sur ce navigateur", () => {
    vi.stubGlobal('navigator', { ...navigator, geolocation: undefined });

    const { result } = renderHook(() => useGeolocation(true));

    expect(result.current).toEqual({ status: 'unsupported', position: null });
  });

  it('ignore les mises a jour trop rapprochees dans le temps (frequence maitrisee, issue #9)', async () => {
    let capturedSuccess: PositionCallback | undefined;
    mockGeolocation({
      watchPosition: vi.fn((success: PositionCallback) => {
        capturedSuccess = success;
        success({
          coords: { latitude: 1, longitude: 1 },
        } as GeolocationPosition);
        return 1;
      }),
    });

    const { result } = renderHook(() => useGeolocation(true));
    await waitFor(() => {
      expect(result.current.position).toEqual({ lat: 1, lon: 1 });
    });

    // Deuxieme position quasi immediate : ignoree, sous le seuil de
    // frequence minimal.
    capturedSuccess?.({
      coords: { latitude: 2, longitude: 2 },
    } as GeolocationPosition);

    expect(result.current.position).toEqual({ lat: 1, lon: 1 });
  });

  it('desabonne watchPosition au demontage', () => {
    const geolocation = mockGeolocation({
      watchPosition: vi.fn(() => 42),
    });

    const { unmount } = renderHook(() => useGeolocation(true));
    unmount();

    expect(geolocation.clearWatch).toHaveBeenCalledWith(42);
  });
});

import { act, renderHook } from '@testing-library/react';
import { useGlyphScale } from './useGlyphScale';

/** Remplace le stub par defaut de test/setup.ts (matches: false) - besoin de controler la valeur exacte pour '(min-width: 768px)'. */
function stubDesktopMediaQuery(matches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mql = {
    matches,
    media: '(min-width: 768px)',
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    },
    dispatchEvent: () => false,
  };
  vi.stubGlobal('matchMedia', () => mql);
  return {
    triggerChange(next: boolean) {
      mql.matches = next;
      listeners.forEach((listener) =>
        listener({ matches: next } as MediaQueryListEvent),
      );
    },
  };
}

describe('useGlyphScale (issue #246, echelle des reperes de carte)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('desktop + preference normale -> echelle 1 (tailles historiques inchangees)', () => {
    stubDesktopMediaQuery(true);

    const { result } = renderHook(() => useGlyphScale());

    expect(result.current).toBe(1);
  });

  it('mobile + preference normale -> plus grand que desktop (acceptance #246)', () => {
    stubDesktopMediaQuery(false);

    const { result } = renderHook(() => useGlyphScale());

    expect(result.current).toBeGreaterThan(1);
  });

  it('preference "large" agrandit ENCORE, par-dessus l\'echelle ecran (desktop)', () => {
    localStorage.setItem('urbanflow.glyphSize.v1', 'large');
    stubDesktopMediaQuery(true);

    const { result } = renderHook(() => useGlyphScale());

    expect(result.current).toBeGreaterThan(1);
  });

  it('mobile + "large" cumule les deux facteurs (plus grand que mobile seul)', () => {
    stubDesktopMediaQuery(false);
    const { result: normalResult } = renderHook(() => useGlyphScale());

    localStorage.setItem('urbanflow.glyphSize.v1', 'large');
    const { result: largeResult } = renderHook(() => useGlyphScale());

    expect(largeResult.current).toBeGreaterThan(normalResult.current);
  });

  it("suit un changement de largeur d'ecran en direct", () => {
    const { triggerChange } = stubDesktopMediaQuery(true);
    const { result } = renderHook(() => useGlyphScale());
    expect(result.current).toBe(1);

    act(() => {
      triggerChange(false);
    });

    expect(result.current).toBeGreaterThan(1);
  });
});

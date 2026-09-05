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

describe('useGlyphScale (issue #246, echelle des reperes de carte, revue a la hausse par #272)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('desktop + preference "medium" (nouveau defaut) -> echelle 1.65 (1.5 x 1.1)', () => {
    stubDesktopMediaQuery(true);

    const { result } = renderHook(() => useGlyphScale());

    expect(result.current).toBeCloseTo(1.65);
  });

  it('mobile + preference "medium" -> plus grand que desktop (acceptance #246)', () => {
    stubDesktopMediaQuery(false);

    const { result } = renderHook(() => useGlyphScale());

    expect(result.current).toBeCloseTo(2.2);
  });

  it('preference "xlarge" agrandit ENCORE, par-dessus l\'echelle ecran (desktop)', () => {
    localStorage.setItem('urbanflow.glyphSize.v1', 'xlarge');
    stubDesktopMediaQuery(true);

    const { result } = renderHook(() => useGlyphScale());

    expect(result.current).toBeGreaterThan(1.65);
  });

  it('preference "small" reduit par rapport au defaut, sans jamais repasser sous les tailles historiques (#246)', () => {
    localStorage.setItem('urbanflow.glyphSize.v1', 'small');
    stubDesktopMediaQuery(true);

    const { result } = renderHook(() => useGlyphScale());

    expect(result.current).toBeLessThan(1.65);
    expect(result.current).toBeGreaterThanOrEqual(1);
  });

  it('mobile + "xlarge" cumule les deux facteurs (plus grand que mobile seul en "medium")', () => {
    stubDesktopMediaQuery(false);
    const { result: mediumResult } = renderHook(() => useGlyphScale());

    localStorage.setItem('urbanflow.glyphSize.v1', 'xlarge');
    const { result: xlargeResult } = renderHook(() => useGlyphScale());

    expect(xlargeResult.current).toBeGreaterThan(mediumResult.current);
  });

  it("suit un changement de largeur d'ecran en direct", () => {
    const { triggerChange } = stubDesktopMediaQuery(true);
    const { result } = renderHook(() => useGlyphScale());
    const desktopScale = result.current;

    act(() => {
      triggerChange(false);
    });

    expect(result.current).toBeGreaterThan(desktopScale);
  });
});

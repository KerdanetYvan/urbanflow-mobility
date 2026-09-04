import { act, renderHook } from '@testing-library/react';
import { useThemeSwitch } from './useThemeSwitch';

/** Remplace le stub par defaut de test/setup.ts (matches: false) pour ce fichier - besoin de controler la valeur exacte. */
function stubMatchMedia(matches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mql = {
    matches,
    media: '(prefers-color-scheme: dark)',
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

describe('useThemeSwitch (issue #245, switch a 2 positions)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sans preference enregistree, suit le systeme (clair -> isDark false)", () => {
    stubMatchMedia(false);

    const { result } = renderHook(() => useThemeSwitch());

    expect(result.current[0]).toBe(false);
  });

  it("sans preference enregistree, suit le systeme (sombre -> isDark true)", () => {
    stubMatchMedia(true);

    const { result } = renderHook(() => useThemeSwitch());

    expect(result.current[0]).toBe(true);
  });

  it("suit un changement de theme systeme en direct tant qu'aucun choix explicite n'a ete fait", () => {
    const { triggerChange } = stubMatchMedia(false);
    const { result } = renderHook(() => useThemeSwitch());
    expect(result.current[0]).toBe(false);

    act(() => {
      triggerChange(true);
    });

    expect(result.current[0]).toBe(true);
  });

  it('le premier clic fixe un choix explicite, qui ne suit plus le systeme ensuite', () => {
    const { triggerChange } = stubMatchMedia(false);
    const { result } = renderHook(() => useThemeSwitch());

    act(() => {
      result.current[1](); // toggle -> passe en 'dark' explicite (isDark etait false)
    });
    expect(result.current[0]).toBe(true);
    expect(localStorage.getItem('urbanflow.theme.v1')).toBe('dark');

    // Le systeme repasse en clair : le switch, desormais explicite, ne doit
    // plus bouger (pas de retour a 'system' - decision UX assumee).
    act(() => {
      triggerChange(false);
    });
    expect(result.current[0]).toBe(true);
  });

  it('un second clic rebascule vers le theme oppose', () => {
    stubMatchMedia(false);
    const { result } = renderHook(() => useThemeSwitch());

    act(() => {
      result.current[1]();
    });
    expect(result.current[0]).toBe(true);

    act(() => {
      result.current[1]();
    });
    expect(result.current[0]).toBe(false);
    expect(localStorage.getItem('urbanflow.theme.v1')).toBe('light');
  });
});

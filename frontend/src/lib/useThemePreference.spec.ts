import { act, renderHook } from '@testing-library/react';
import { useThemePreference } from './useThemePreference';

describe('useThemePreference (issue #245)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it("demarre sur 'system' quand rien n'est enregistre", () => {
    const { result } = renderHook(() => useThemePreference());

    expect(result.current[0]).toBe('system');
  });

  it('demarre sur la preference deja enregistree en localStorage', () => {
    localStorage.setItem('urbanflow.theme.v1', 'dark');

    const { result } = renderHook(() => useThemePreference());

    expect(result.current[0]).toBe('dark');
  });

  it('change la preference, le localStorage et le DOM ensemble', () => {
    const { result } = renderHook(() => useThemePreference());

    act(() => {
      result.current[1]('dark');
    });

    expect(result.current[0]).toBe('dark');
    expect(localStorage.getItem('urbanflow.theme.v1')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it("repasser sur 'system' retire data-theme du DOM", () => {
    const { result } = renderHook(() => useThemePreference());

    act(() => {
      result.current[1]('light');
    });
    act(() => {
      result.current[1]('system');
    });

    expect(result.current[0]).toBe('system');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });
});

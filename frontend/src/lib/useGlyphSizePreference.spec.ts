import { act, renderHook } from '@testing-library/react';
import { useGlyphSizePreference } from './useGlyphSizePreference';

describe('useGlyphSizePreference (issue #246)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("demarre sur 'normal' quand rien n'est enregistre", () => {
    const { result } = renderHook(() => useGlyphSizePreference());

    expect(result.current[0]).toBe('normal');
  });

  it('demarre sur la preference deja enregistree en localStorage', () => {
    localStorage.setItem('urbanflow.glyphSize.v1', 'large');

    const { result } = renderHook(() => useGlyphSizePreference());

    expect(result.current[0]).toBe('large');
  });

  it('change la preference et le localStorage ensemble', () => {
    const { result } = renderHook(() => useGlyphSizePreference());

    act(() => {
      result.current[1]('large');
    });

    expect(result.current[0]).toBe('large');
    expect(localStorage.getItem('urbanflow.glyphSize.v1')).toBe('large');
  });
});

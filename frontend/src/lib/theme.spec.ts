import {
  applyTheme,
  getStoredThemePreference,
  setStoredThemePreference,
} from './theme';

describe('theme (issue #245, réglage manuel clair/sombre)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it("renvoie 'system' par defaut, sans rien en localStorage", () => {
    expect(getStoredThemePreference()).toBe('system');
  });

  it("renvoie 'system' si la valeur stockee est corrompue/inattendue", () => {
    localStorage.setItem('urbanflow.theme.v1', 'sepia');

    expect(getStoredThemePreference()).toBe('system');
  });

  it('retrouve une preference light/dark valide deja enregistree', () => {
    localStorage.setItem('urbanflow.theme.v1', 'dark');

    expect(getStoredThemePreference()).toBe('dark');
  });

  it('setStoredThemePreference enregistre en localStorage et applique le DOM', () => {
    setStoredThemePreference('dark');

    expect(localStorage.getItem('urbanflow.theme.v1')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it("applyTheme('light'/'dark') pose data-theme sur <html>", () => {
    applyTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it("applyTheme('system') retire data-theme (repli sur prefers-color-scheme)", () => {
    document.documentElement.setAttribute('data-theme', 'dark');

    applyTheme('system');

    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });
});

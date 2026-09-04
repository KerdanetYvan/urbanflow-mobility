import {
  getStoredGlyphSizePreference,
  setStoredGlyphSizePreference,
} from './glyphSize';

describe('glyphSize (issue #246, taille des reperes de carte)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renvoie 'normal' par defaut, sans rien en localStorage", () => {
    expect(getStoredGlyphSizePreference()).toBe('normal');
  });

  it("renvoie 'normal' si la valeur stockee est corrompue/inattendue", () => {
    localStorage.setItem('urbanflow.glyphSize.v1', 'huge');

    expect(getStoredGlyphSizePreference()).toBe('normal');
  });

  it("retrouve une preference 'large' deja enregistree", () => {
    localStorage.setItem('urbanflow.glyphSize.v1', 'large');

    expect(getStoredGlyphSizePreference()).toBe('large');
  });

  it('setStoredGlyphSizePreference enregistre en localStorage', () => {
    setStoredGlyphSizePreference('large');

    expect(localStorage.getItem('urbanflow.glyphSize.v1')).toBe('large');
  });
});

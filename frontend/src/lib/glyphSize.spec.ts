import {
  getStoredGlyphSizePreference,
  setStoredGlyphSizePreference,
} from './glyphSize';

describe('glyphSize (issue #246, 4 paliers depuis #272)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renvoie 'medium' par defaut, sans rien en localStorage", () => {
    expect(getStoredGlyphSizePreference()).toBe('medium');
  });

  it("renvoie 'medium' si la valeur stockee est corrompue/inattendue", () => {
    localStorage.setItem('urbanflow.glyphSize.v1', 'huge');

    expect(getStoredGlyphSizePreference()).toBe('medium');
  });

  it("migre l'ancien 'normal' (#246) vers 'medium', le nouveau defaut (#272)", () => {
    localStorage.setItem('urbanflow.glyphSize.v1', 'normal');

    expect(getStoredGlyphSizePreference()).toBe('medium');
  });

  it("conserve un ancien 'large' (#246) tel quel : reste 'large' (#272)", () => {
    localStorage.setItem('urbanflow.glyphSize.v1', 'large');

    expect(getStoredGlyphSizePreference()).toBe('large');
  });

  it("retrouve une preference 'small' deja enregistree", () => {
    localStorage.setItem('urbanflow.glyphSize.v1', 'small');

    expect(getStoredGlyphSizePreference()).toBe('small');
  });

  it("retrouve une preference 'xlarge' deja enregistree", () => {
    localStorage.setItem('urbanflow.glyphSize.v1', 'xlarge');

    expect(getStoredGlyphSizePreference()).toBe('xlarge');
  });

  it('setStoredGlyphSizePreference enregistre en localStorage', () => {
    setStoredGlyphSizePreference('xlarge');

    expect(localStorage.getItem('urbanflow.glyphSize.v1')).toBe('xlarge');
  });
});

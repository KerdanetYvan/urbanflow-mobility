import { toHexColor } from './color';

describe('toHexColor', () => {
  it('prefixe # a une couleur hexadecimale brute (format OTP/GTFS)', () => {
    expect(toHexColor('EE1D23')).toBe('#EE1D23');
  });

  it('laisse inchangee une couleur deja prefixee', () => {
    expect(toHexColor('#EE1D23')).toBe('#EE1D23');
  });

  it('renvoie undefined pour une valeur absente', () => {
    expect(toHexColor(undefined)).toBeUndefined();
  });

  it('renvoie undefined pour une chaine vide', () => {
    expect(toHexColor('')).toBeUndefined();
  });
});

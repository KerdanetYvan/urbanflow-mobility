import { decodePolyline } from './polyline';

describe('decodePolyline', () => {
  it('decode une trace a 4 points (chaine capturee contre un vrai OTP, leg BUS)', () => {
    expect(decodePolyline('wtsdHnogI_q@_q@??_q@~p@')).toEqual([
      { lat: 48.111, lon: -1.682 },
      { lat: 48.119, lon: -1.674 },
      { lat: 48.119, lon: -1.674 },
      { lat: 48.127, lon: -1.682 },
    ]);
  });

  it('decode une trace a plusieurs points (chaine capturee contre un vrai OTP, leg WALK)', () => {
    expect(decodePolyline('wtsdHpogI_X|W_X~W_X_X_X_X')).toEqual([
      { lat: 48.111, lon: -1.68201 },
      { lat: 48.115, lon: -1.686 },
      { lat: 48.119, lon: -1.69 },
      { lat: 48.123, lon: -1.686 },
      { lat: 48.127, lon: -1.682 },
    ]);
  });

  it('renvoie un tableau vide pour une chaine vide', () => {
    expect(decodePolyline('')).toEqual([]);
  });
});

import { TransportMode } from '../profiles/transport-mode.enum';
import { DEFAULT_OTP_MODE_PARAM, toOtpModeParam } from './otp-modes';

describe('toOtpModeParam (issue #87)', () => {
  it("renvoie le mode par défaut (TRANSIT,WALK) quand aucun mode n'est fourni", () => {
    expect(toOtpModeParam()).toBe(DEFAULT_OTP_MODE_PARAM);
    expect(toOtpModeParam(undefined)).toBe(DEFAULT_OTP_MODE_PARAM);
    expect(toOtpModeParam([])).toBe(DEFAULT_OTP_MODE_PARAM);
  });

  it('traduit les modes de transport en commun cochés en modes OTP, WALK toujours inclus', () => {
    expect(toOtpModeParam([TransportMode.BUS])).toBe('WALK,BUS');
    expect(toOtpModeParam([TransportMode.METRO])).toBe('WALK,SUBWAY');
    expect(toOtpModeParam([TransportMode.TRAIN_TER])).toBe('WALK,RAIL');
  });

  it("combine plusieurs modes de transport en commun dans l'ordre reçu", () => {
    expect(
      toOtpModeParam([
        TransportMode.BUS,
        TransportMode.TRAM,
        TransportMode.METRO,
      ]),
    ).toBe('WALK,BUS,TRAM,SUBWAY');
  });

  it('ignore les modes pas encore routables par OTP (vélo, trottinette, covoiturage)', () => {
    expect(
      toOtpModeParam([
        TransportMode.CYCLING,
        TransportMode.SCOOTER,
        TransportMode.CARPOOLING,
        TransportMode.BUS,
      ]),
    ).toBe('WALK,BUS');
  });

  it('retombe sur le mode par défaut si seuls des modes non routables (ou la marche seule) sont cochés', () => {
    // Aucun transport en commun -> une recherche "à pied seule" n'a pas
    // d'intérêt sur cet écran, on considère alors tous les modes.
    expect(toOtpModeParam([TransportMode.CYCLING])).toBe(
      DEFAULT_OTP_MODE_PARAM,
    );
    expect(toOtpModeParam([TransportMode.WALKING])).toBe(
      DEFAULT_OTP_MODE_PARAM,
    );
    expect(toOtpModeParam([TransportMode.WALKING, TransportMode.SCOOTER])).toBe(
      DEFAULT_OTP_MODE_PARAM,
    );
  });

  it('dédoublonne les modes OTP identiques', () => {
    expect(toOtpModeParam([TransportMode.BUS, TransportMode.BUS])).toBe(
      'WALK,BUS',
    );
  });
});

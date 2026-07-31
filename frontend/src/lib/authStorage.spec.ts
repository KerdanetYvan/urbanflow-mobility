import { clearTokens, hasValidSession, saveTokens } from './authStorage';
import { fakeJwt } from '../test/fakeJwt';

describe('authStorage - hasValidSession', () => {
  afterEach(() => {
    clearTokens();
  });

  it("est faux quand aucun jeton n'est stocke", () => {
    expect(hasValidSession()).toBe(false);
  });

  it('est vrai avec un access token JWT non expire', () => {
    saveTokens({ accessToken: fakeJwt(900), refreshToken: fakeJwt(900) });
    expect(hasValidSession()).toBe(true);
  });

  it('est vrai quand seul le refresh token est encore valide (access token expire)', () => {
    saveTokens({ accessToken: fakeJwt(-60), refreshToken: fakeJwt(60 * 60 * 24) });
    expect(hasValidSession()).toBe(true);
  });

  it('est faux quand les deux jetons JWT sont prouves expires (issue #65)', () => {
    saveTokens({ accessToken: fakeJwt(-60), refreshToken: fakeJwt(-1) });
    expect(hasValidSession()).toBe(false);
  });

  it("reste vrai avec un jeton non-JWT illisible (fail-open : on ne peut pas conclure, l'appel API tranchera)", () => {
    saveTokens({ accessToken: 'fake-token', refreshToken: 'fake-refresh' });
    expect(hasValidSession()).toBe(true);
  });
});

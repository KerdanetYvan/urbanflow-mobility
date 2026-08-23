import { clearTokens, saveTokens } from './authStorage';
import { searchTrips } from './trips';

/**
 * Regression pour un bug decouvert en verifiant l'issue #112 en conditions
 * reelles (navigateur, pas un mock) : searchTrips utilisait apiGet (jamais
 * de jeton attache), alors que GET /trips est protege par
 * OptionalJwtAuthGuard cote backend et personnalise son comportement pour
 * un utilisateur authentifie (scoring selon le profil, issue #16 ;
 * enregistrement dans l'historique, issue #11/#112). Consequence en
 * production : ni la personnalisation, ni l'historique ne se declenchaient
 * jamais pour un utilisateur reellement connecte via l'UI - masque par les
 * tests d'ecran, qui mockent lib/trips.ts dans son ensemble (voir
 * RecherchePage.spec.tsx) et par la verification e2e de #11, faite via des
 * appels API directs avec le jeton force a la main plutot que via l'UI
 * reelle.
 */
describe('searchTrips (GET /trips, issue #7/#16/#11/#112)', () => {
  const SEARCH_PARAMS = {
    originLat: 48.1,
    originLon: -1.68,
    destinationLat: 48.11,
    destinationLon: -1.67,
  };

  afterEach(() => {
    clearTokens();
    vi.unstubAllGlobals();
  });

  it('attache le jeton stocke en en-tete Authorization quand un utilisateur est connecte', async () => {
    saveTokens({ accessToken: 'fake-access-token', refreshToken: 'fake-refresh' });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve([]),
    });
    vi.stubGlobal('fetch', fetchMock);

    await searchTrips(SEARCH_PARAMS);

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers.Authorization).toBe('Bearer fake-access-token');
  });

  it("n'attache aucun en-tete Authorization pour un utilisateur non connecte (recherche anonyme, issue #64)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve([]),
    });
    vi.stubGlobal('fetch', fetchMock);

    await searchTrips(SEARCH_PARAMS);

    const [, options] = fetchMock.mock.calls[0];
    expect(options?.headers?.Authorization).toBeUndefined();
  });
});

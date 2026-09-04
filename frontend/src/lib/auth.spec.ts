import { ApiError } from './api';
import { deleteAccount, logout } from './auth';
import { getAccessToken, saveTokens, clearTokens } from './authStorage';
import { getCachedTrip, saveTripToCache } from './tripCache';
import type { PlaceSuggestion } from './places';
import type { TripSearchResult } from './trips';

const ORIGIN: PlaceSuggestion = { label: 'Gare Part-Dieu', lat: 45.76, lon: 4.86 };
const DESTINATION: PlaceSuggestion = { label: 'Hôtel de Ville', lat: 45.77, lon: 4.83 };
const RESULT: TripSearchResult = {
  itineraries: [
    { startTime: 't0', endTime: 't1', durationSeconds: 600, transfers: 0, segments: [] },
  ],
};

/**
 * logout() (issue #65, durci par l'audit securite OWASP #262) : purge aussi
 * le cache de trajets, pas seulement les jetons - voir tripCache.ts pour le
 * risque (coordonnees GPS lisibles par un usager suivant sur un appareil
 * partage).
 */
describe('logout', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('efface les jetons stockes et le cache de trajets', () => {
    saveTokens({ accessToken: 'fake-access-token', refreshToken: 'fake-refresh' });
    saveTripToCache(ORIGIN, DESTINATION, RESULT);

    logout();

    expect(getAccessToken()).toBeNull();
    expect(getCachedTrip(ORIGIN, DESTINATION)).toBeNull();
  });
});

/**
 * deleteAccount() (issue #164, DELETE /users/me) - meme motif que
 * trips.spec.ts (recuperation reelle via un mock de fetch global) : verifie
 * le comportement REEL de la fonction (corps envoye, en-tete Authorization,
 * nettoyage des jetons), pas un mock de plus haut niveau comme dans
 * ProfilPage.spec.tsx.
 */
describe('deleteAccount (DELETE /users/me, issue #164)', () => {
  afterEach(() => {
    clearTokens();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("envoie le mot de passe de confirmation dans le corps de la requete, avec le jeton d'acces en en-tete", async () => {
    saveTokens({ accessToken: 'fake-access-token', refreshToken: 'fake-refresh' });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: () => Promise.resolve(null),
    });
    vi.stubGlobal('fetch', fetchMock);

    await deleteAccount('MotDePasse123!');

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('/users/me');
    expect(options.method).toBe('DELETE');
    expect(JSON.parse(options.body as string)).toEqual({
      password: 'MotDePasse123!',
    });
    expect(options.headers.Authorization).toBe('Bearer fake-access-token');
  });

  it('nettoie les jetons stockes apres une suppression reussie', async () => {
    saveTokens({ accessToken: 'fake-access-token', refreshToken: 'fake-refresh' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        json: () => Promise.resolve(null),
      }),
    );

    await deleteAccount('MotDePasse123!');

    expect(getAccessToken()).toBeNull();
  });

  it('efface aussi le cache de trajets apres une suppression reussie (audit securite OWASP #262)', async () => {
    saveTokens({ accessToken: 'fake-access-token', refreshToken: 'fake-refresh' });
    saveTripToCache(ORIGIN, DESTINATION, RESULT);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        json: () => Promise.resolve(null),
      }),
    );

    await deleteAccount('MotDePasse123!');

    expect(getCachedTrip(ORIGIN, DESTINATION)).toBeNull();
  });

  it(
    "propage l'erreur 403 (mot de passe incorrect) SANS tenter de " +
      'rafraichissement de jeton ni effacer les jetons stockes - ' +
      "contrairement a un 401 : voir backend/src/users/users.service.ts#remove " +
      'pour le choix du code HTTP (403, pas 401, precisement pour eviter ce ' +
      'mecanisme reserve a un jeton expire, voir authRequest dans lib/api.ts)',
    async () => {
      saveTokens({ accessToken: 'fake-access-token', refreshToken: 'fake-refresh' });
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: () =>
          Promise.resolve({ statusCode: 403, message: 'Mot de passe incorrect' }),
      });
      vi.stubGlobal('fetch', fetchMock);

      await expect(deleteAccount('MauvaisMotDePasse')).rejects.toMatchObject({
        message: 'Mot de passe incorrect',
        statusCode: 403,
      } satisfies Partial<ApiError>);

      // Un seul appel : pas de tentative de POST /auth/refresh (reservee au 401).
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(getAccessToken()).toBe('fake-access-token');
    },
  );
});

import { ApiError } from './api';
import { deleteAccount } from './auth';
import { getAccessToken, saveTokens, clearTokens } from './authStorage';

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

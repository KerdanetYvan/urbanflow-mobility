import { afterEach, describe, expect, it, vi } from 'vitest';
import { authGet } from './api';
import { clearTokens, getRefreshToken, saveTokens } from './authStorage';

/** Reponse fetch minimale (juste ce que `request()` de api.ts consomme). */
function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

describe('authRequest - rafraichissement du jeton (issue #268)', () => {
  afterEach(() => {
    clearTokens();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('ne declenche QU\'UN seul POST /auth/refresh quand plusieurs appels tombent en 401 en meme temps (single-flight)', async () => {
    saveTokens({ accessToken: 'access-expire', refreshToken: 'refresh-1' });

    const fetchMock = vi.fn((url: string, options?: RequestInit) => {
      if (url.endsWith('/auth/refresh')) {
        return Promise.resolve(
          jsonResponse(200, {
            accessToken: 'access-neuf',
            refreshToken: 'refresh-2',
          }),
        );
      }
      // Endpoint protege : 401 tant que l'access token est l'ancien, 200 une
      // fois rejoue avec le nouveau.
      const authHeader = (options?.headers as Record<string, string> | undefined)
        ?.Authorization;
      if (authHeader === 'Bearer access-neuf') {
        return Promise.resolve(jsonResponse(200, { data: 'ok' }));
      }
      return Promise.resolve(
        jsonResponse(401, { statusCode: 401, message: 'jeton expire' }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const [a, b] = await Promise.all([
      authGet<{ data: string }>('/ressource-a'),
      authGet<{ data: string }>('/ressource-b'),
    ]);

    expect(a).toEqual({ data: 'ok' });
    expect(b).toEqual({ data: 'ok' });

    const refreshCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith('/auth/refresh'),
    );
    expect(refreshCalls).toHaveLength(1);
    // La nouvelle paire a bien ete persistee.
    expect(getRefreshToken()).toBe('refresh-2');
  });

  it('nettoie les jetons et leve 401 si le rafraichissement echoue aussi', async () => {
    saveTokens({ accessToken: 'access-expire', refreshToken: 'refresh-mort' });

    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.endsWith('/auth/refresh')) {
          return Promise.resolve(
            jsonResponse(401, { statusCode: 401, message: 'refresh invalide' }),
          );
        }
        return Promise.resolve(
          jsonResponse(401, { statusCode: 401, message: 'jeton expire' }),
        );
      }),
    );

    await expect(authGet('/ressource')).rejects.toMatchObject({
      statusCode: 401,
    });
    expect(getRefreshToken()).toBeNull();
  });
});

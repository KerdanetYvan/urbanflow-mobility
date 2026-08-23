import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  saveTokens,
  type TokenPair,
} from './authStorage';

/**
 * URL de base de l'API, fournie par Vite via une variable d'environnement
 * prefixee VITE_ (seules celles-ci sont exposees au code cote client, par
 * design Vite - une securite pour ne jamais exposer accidentellement un
 * secret serveur au navigateur).
 */
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/**
 * Erreur levee quand l'API repond avec un code HTTP d'erreur. Porte le(s)
 * message(s) exact(s) renvoyes par le backend (voir AllExceptionsFilter
 * cote backend, qui peut renvoyer une chaine ou un tableau de messages de
 * validation), pour un affichage direct dans l'UI.
 */
export class ApiError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
}

/**
 * Effectue un appel JSON vers l'API et renvoie le corps de la reponse deja
 * parse. En cas d'erreur HTTP, leve une ApiError avec un message pret a
 * afficher (les tableaux de messages de validation sont joints en une
 * seule chaine lisible).
 */
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  // 204 No Content ou reponse vide : pas de JSON a parser.
  const body = response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
    const errorBody = body as ApiErrorBody | null;
    const message = Array.isArray(errorBody?.message)
      ? errorBody.message.join(', ')
      : (errorBody?.message ?? 'Une erreur est survenue');
    throw new ApiError(message, response.status);
  }

  return body as T;
}

export function apiPost<T>(path: string, data: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body: JSON.stringify(data) });
}

/**
 * GET non authentifie. Utilise par l'endpoint public /places : pas
 * d'en-tete Authorization, contrairement a authGet/apiGetWithOptionalAuth.
 */
export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path);
}

/**
 * GET avec jeton optionnel : attache l'access token stocke s'il existe,
 * sans jamais tenter de rafraichissement ni bloquer si absent/invalide
 * (contrairement a authGet) - pour un endpoint protege par
 * OptionalJwtAuthGuard cote backend (jamais de 401, voir
 * optional-jwt-auth.guard.ts : un jeton absent ou invalide degrade
 * simplement vers un comportement anonyme, ne rejette jamais la requete).
 * Utilise par GET /trips (recherche d'itineraire utilisable sans compte,
 * issue #64, mais personnalisee - scoring selon le profil, issue #16, et
 * historique, issue #11/#112 - si un jeton valide est fourni).
 */
export function apiGetWithOptionalAuth<T>(path: string): Promise<T> {
  const token = getAccessToken();
  return request<T>(path, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
}

/**
 * Echange le refresh token stocke contre une nouvelle paire de jetons et
 * les sauvegarde. Levee interne uniquement (voir authRequest) : jamais
 * appelee directement par les pages.
 */
async function refreshAccessToken(): Promise<string> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new ApiError('Session expirée', 401);
  }
  const tokens = await request<TokenPair>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
  saveTokens(tokens);
  return tokens.accessToken;
}

/**
 * Comme `request`, mais attache l'access token stocke en en-tete
 * Authorization. Si l'API repond 401 (access token expire - duree de vie
 * courte, voir backend/README.md), tente UNE fois un rafraichissement via
 * le refresh token avant de rejouer l'appel original. Si le rafraichissement
 * echoue aussi (refresh token expire/invalide), nettoie les jetons stockes :
 * a l'appelant de rediriger vers /connexion en voyant l'erreur remonter.
 */
async function authRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const callWithToken = (token: string | null) =>
    request<T>(path, {
      ...options,
      headers: { ...options?.headers, Authorization: `Bearer ${token ?? ''}` },
    });

  try {
    return await callWithToken(getAccessToken());
  } catch (error) {
    if (!(error instanceof ApiError) || error.statusCode !== 401) {
      throw error;
    }
    try {
      const newAccessToken = await refreshAccessToken();
      return await callWithToken(newAccessToken);
    } catch {
      clearTokens();
      throw new ApiError('Session expirée, veuillez vous reconnecter', 401);
    }
  }
}

export function authGet<T>(path: string): Promise<T> {
  return authRequest<T>(path);
}

export function authPost<T>(path: string, data: unknown): Promise<T> {
  return authRequest<T>(path, { method: 'POST', body: JSON.stringify(data) });
}

export function authPatch<T>(path: string, data: unknown): Promise<T> {
  return authRequest<T>(path, { method: 'PATCH', body: JSON.stringify(data) });
}

export function authDelete<T>(path: string): Promise<T> {
  return authRequest<T>(path, { method: 'DELETE' });
}

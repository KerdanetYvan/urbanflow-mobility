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

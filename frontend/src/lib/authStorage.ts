/**
 * Stockage local des jetons d'authentification (localStorage).
 *
 * Compromis assume pour le MVP : localStorage est simple et suffisant pour
 * une SPA sans backend-for-frontend dedie, mais reste accessible en
 * JavaScript, donc vulnerable en cas de faille XSS ailleurs dans l'app (un
 * cookie httpOnly serait plus robuste, au prix d'une architecture cookie
 * + CSRF + CORS credentials plus lourde). A reevaluer lors de l'audit
 * securite OWASP dedie (issue #21, Sprint 3).
 */

const ACCESS_TOKEN_KEY = 'urbanflow_access_token';
const REFRESH_TOKEN_KEY = 'urbanflow_refresh_token';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export function saveTokens(tokens: TokenPair): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

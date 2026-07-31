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

/**
 * Decode la date d'expiration (claim `exp`, en secondes epoch) portee par le
 * payload d'un JWT, SANS verifier sa signature - une verification cote
 * client ne remplace jamais la verification serveur (voir jwt.strategy.ts
 * cote backend, seule autorite reelle). Sert uniquement a eviter un
 * aller-retour reseau inutile pour un jeton dont on peut deja prouver
 * localement qu'il est perime (issue #65).
 *
 * Renvoie `null` si le jeton n'est pas un JWT lisible ou ne porte pas de
 * claim `exp` : on ne peut alors rien affirmer localement, l'appel API reste
 * seul juge (voir authRequest dans api.ts).
 */
function decodeJwtExpiryMs(token: string): number | null {
  try {
    const payloadSegment = token.split('.')[1];
    const base64 = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const payload: unknown = JSON.parse(atob(padded));
    const exp = (payload as { exp?: unknown }).exp;
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * Un jeton est considere utilisable s'il n'est PAS prouve expire localement.
 * Volontairement permissif ("fail-open") : un jeton illisible ou sans claim
 * `exp` reste utilisable (l'appel API tranchera) - seul un JWT bien forme
 * dont l'`exp` est reellement depassee est rejete ici, pour ne jamais
 * bloquer un utilisateur a cause d'un format de jeton qu'on ne saurait pas
 * decoder.
 */
function isTokenUsable(token: string | null): boolean {
  if (!token) return false;
  const expiryMs = decodeJwtExpiryMs(token);
  return expiryMs === null || expiryMs > Date.now();
}

/**
 * Y a-t-il une session localement plausible ? Vrai si l'access token OU le
 * refresh token est utilisable - un access token expire mais un refresh
 * token encore valide reste une session valide, puisque authRequest (voir
 * api.ts) rafraichira automatiquement au prochain appel authentifie. Faux
 * uniquement quand les DEUX jetons sont absents ou prouves expires : c'est
 * le seul cas ou RequireAuth/RedirectIfAuthenticated peuvent conclure sans
 * appel reseau (voir components/RequireAuth.tsx).
 */
export function hasValidSession(): boolean {
  return isTokenUsable(getAccessToken()) || isTokenUsable(getRefreshToken());
}

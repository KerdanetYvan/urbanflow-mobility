import { apiPost } from './api';
import { clearTokens, saveTokens, type TokenPair } from './authStorage';

interface RegisteredUser {
  id: string;
  email: string;
  createdAt: string;
}

/** Cree un compte (POST /users). Ne connecte pas automatiquement : voir login(). */
export function register(email: string, password: string): Promise<RegisteredUser> {
  return apiPost<RegisteredUser>('/users', { email, password });
}

/** Authentifie l'utilisateur et enregistre la paire de jetons obtenue. */
export async function login(email: string, password: string): Promise<void> {
  const tokens = await apiPost<TokenPair>('/auth/login', { email, password });
  saveTokens(tokens);
}

/**
 * Deconnecte l'utilisateur (issue #65). Purement local : le backend n'a pas
 * de mecanisme de revocation de jetons (JWT sans etat, voir auth.service.ts)
 * - se deconnecter, c'est juste oublier les jetons stockes cote client.
 */
export function logout(): void {
  clearTokens();
}

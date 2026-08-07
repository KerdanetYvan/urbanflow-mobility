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

/**
 * Demande de reinitialisation de mot de passe (issue #70/#71). Renvoie
 * toujours un message generique en 200, que l'email existe ou non (pas
 * d'enumeration, voir AuthService.forgotPassword cote backend) - jamais
 * d'erreur "metier" a gerer ici, uniquement une eventuelle erreur reseau.
 */
export function forgotPassword(email: string): Promise<{ message: string }> {
  return apiPost<{ message: string }>('/auth/forgot-password', { email });
}

/**
 * Confirmation de reinitialisation (issue #70/#71). Leve une ApiError (400)
 * si le token est invalide, expire ou deja utilise - message deja pret a
 * afficher tel quel (voir AuthService.resetPassword cote backend).
 */
export function resetPassword(
  token: string,
  newPassword: string,
): Promise<{ message: string }> {
  return apiPost<{ message: string }>('/auth/reset-password', {
    token,
    newPassword,
  });
}

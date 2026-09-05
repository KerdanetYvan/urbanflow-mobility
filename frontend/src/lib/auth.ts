import { apiPost, authDelete } from './api';
import { clearTokens, saveTokens, type TokenPair } from './authStorage';
import { clearRechercheSessionState } from './rechercheSessionState';
import { clearTripCache } from './tripCache';

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
 *
 * Purge aussi le cache de trajets et la recherche en cours persistee
 * (audit securite OWASP #262, issue #266) : une deconnexion explicite est
 * le signal le plus net qu'un autre usager peut reutiliser le meme
 * appareil - voir tripCache.ts#clearTripCache et
 * rechercheSessionState.ts#clearRechercheSessionState.
 */
export function logout(): void {
  clearTokens();
  clearTripCache();
  clearRechercheSessionState();
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

/**
 * Suppression definitive du compte (issue #164, droit a l'effacement RGPD
 * article 17) - DELETE /users/me, jamais DELETE /profiles/me
 * (`lib/profile.ts#deleteProfile`, qui n'efface QUE le profil de mobilite,
 * pas le compte lui-meme ni son historique/trajet suivi/abonnements push -
 * voir backend/src/users/users.service.ts#remove pour la cascade complete).
 * Le mot de passe confirme l'action cote backend (defense en profondeur,
 * pas seulement une boite de dialogue cote client - voir ProfilPage.tsx).
 * Leve une ApiError (401) si le mot de passe est incorrect.
 *
 * Nettoie les jetons locaux, le cache de trajets et la recherche en cours
 * persistee apres coup, comme logout() : le compte n'existe plus, il n'y a
 * plus rien a rafraichir/reutiliser (audit securite OWASP #262, issue #266).
 */
export async function deleteAccount(password: string): Promise<void> {
  await authDelete<void>('/users/me', { password });
  clearTokens();
  clearTripCache();
  clearRechercheSessionState();
}

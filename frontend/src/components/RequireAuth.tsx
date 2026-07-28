import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getAccessToken } from '../lib/authStorage';

interface RequireAuthProps {
  children: ReactNode;
}

/**
 * Protege une route : redirige vers /connexion si aucun access token n'est
 * stocke. Ne verifie pas la validite/expiration du token ici (ce serait
 * redondant) - c'est l'appel API lui-meme qui le fera, et gerera le
 * rafraichissement si besoin (voir lib/api.ts, authRequest).
 *
 * `state={{ from: location }}` conserve la page visee : ConnexionPage
 * pourra un jour s'en servir pour rediriger l'utilisateur vers sa
 * destination d'origine une fois connecte (pas implemente pour l'instant,
 * redirection systematique vers /profil apres connexion).
 */
function RequireAuth({ children }: RequireAuthProps) {
  const location = useLocation();

  if (!getAccessToken()) {
    return <Navigate to="/connexion" state={{ from: location }} replace />;
  }

  return children;
}

export default RequireAuth;

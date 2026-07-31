import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/useAuth';

interface RedirectIfAuthenticatedProps {
  children: ReactNode;
}

/**
 * Symetrique de RequireAuth : protege une route reservee aux visiteurs NON
 * connectes (ici /connexion). Un utilisateur deja authentifie qui atterrit
 * sur /connexion (lien direct, retour arriere du navigateur, favori...) est
 * renvoye vers /profil plutot que de revoir un formulaire de connexion deja
 * inutile pour lui.
 */
function RedirectIfAuthenticated({ children }: RedirectIfAuthenticatedProps) {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/profil" replace />;
  }

  return children;
}

export default RedirectIfAuthenticated;

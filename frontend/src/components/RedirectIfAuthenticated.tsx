import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/useAuth';
import { hasValidSession } from '../lib/authStorage';

interface RedirectIfAuthenticatedProps {
  children: ReactNode;
}

/**
 * Symetrique de RequireAuth : protege une route reservee aux visiteurs NON
 * connectes (ici /connexion). Un utilisateur deja authentifie qui atterrit
 * sur /connexion (lien direct, retour arriere du navigateur, favori...) est
 * renvoye vers /profil plutot que de revoir un formulaire de connexion deja
 * inutile pour lui.
 *
 * Meme durcissement que RequireAuth (issue #65) : recalcule hasValidSession()
 * directement plutot que de se fier au seul `isAuthenticated` du contexte,
 * potentiellement perime, et resynchronise le contexte via un effet si
 * besoin. Voir le commentaire de RequireAuth.tsx pour le detail.
 */
function RedirectIfAuthenticated({ children }: RedirectIfAuthenticatedProps) {
  const { isAuthenticated, setAuthenticated } = useAuth();
  const sessionIsValid = hasValidSession();

  useEffect(() => {
    if (isAuthenticated !== sessionIsValid) {
      setAuthenticated(sessionIsValid);
    }
  }, [isAuthenticated, sessionIsValid, setAuthenticated]);

  if (sessionIsValid) {
    return <Navigate to="/profil" replace />;
  }

  return children;
}

export default RedirectIfAuthenticated;

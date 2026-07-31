import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/useAuth';
import { hasValidSession } from '../lib/authStorage';

interface RequireAuthProps {
  children: ReactNode;
}

/**
 * Protege une route : redirige vers /connexion si aucune session n'est
 * localement plausible.
 *
 * Recalcule hasValidSession() directement a CHAQUE montage plutot que de se
 * fier uniquement a `isAuthenticated` du contexte (issue #65, durcissement) :
 * le contexte ne se met a jour que sur des evenements explicites
 * (login/logout/401, voir AuthProvider.tsx et ProfilPage.tsx) et peut donc
 * rester perime si les jetons ont expire "en silence" pendant que
 * l'utilisateur naviguait ailleurs sans appel API. Ici, /profil est une
 * route feuille : elle demonte/remonte reellement a chaque navigation
 * entrante, donc ce recalcul est bien fait a chaque fois que ca compte.
 *
 * hasValidSession() reste une heuristique cote client (voir authStorage.ts) :
 * un jeton present mais illisible n'est PAS traite comme invalide, seul un
 * JWT bien forme et reellement expire l'est. La verification faisant
 * vraiment foi reste l'appel API (authRequest dans lib/api.ts), qui gere
 * aussi le rafraichissement.
 *
 * L'effet resynchronise le contexte si besoin, pour que la nav (AppLayout)
 * cesse aussitot de proposer Profil/Historique des qu'une session perimee
 * est detectee ici.
 *
 * `state={{ from: location }}` conserve la page visee : ConnexionPage
 * pourra un jour s'en servir pour rediriger l'utilisateur vers sa
 * destination d'origine une fois connecte (pas implemente pour l'instant,
 * redirection systematique vers /profil apres connexion).
 */
function RequireAuth({ children }: RequireAuthProps) {
  const location = useLocation();
  const { isAuthenticated, setAuthenticated } = useAuth();
  const sessionIsValid = hasValidSession();

  useEffect(() => {
    if (isAuthenticated !== sessionIsValid) {
      setAuthenticated(sessionIsValid);
    }
  }, [isAuthenticated, sessionIsValid, setAuthenticated]);

  if (!sessionIsValid) {
    return <Navigate to="/connexion" state={{ from: location }} replace />;
  }

  return children;
}

export default RequireAuth;

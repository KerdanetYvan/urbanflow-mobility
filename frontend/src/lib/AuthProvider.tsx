import { useMemo, useState, type ReactNode } from 'react';
import { hasValidSession } from './authStorage';
import { AuthContext } from './authContext';

/**
 * Source de verite reactive pour l'etat de connexion, partagee par toute
 * l'application (issue #64).
 *
 * Pourquoi ce contexte est necessaire et qu'un simple `getAccessToken()` lu
 * au rendu ne suffit pas : AppLayout reste monte en continu pendant toute la
 * session (seul son <Outlet /> change d'un ecran a l'autre, voir
 * layouts/AppLayout.tsx). Or react-router construit l'element AppLayout UNE
 * SEULE fois (dans App.tsx, quand App() s'execute) et le reutilise tel quel
 * a chaque navigation - React voit alors la meme reference d'element et
 * n'appelle jamais une seconde fois le corps de la fonction AppLayout. Lire
 * localStorage directement dans son rendu ne se met donc jamais a jour apres
 * un login/logout. Passer par ce contexte force un re-rendu cible d'AppLayout
 * (et de tout composant qui appelle useAuth(), voir useAuth.ts) des que
 * setAuthenticated est appele, independamment de ce mecanisme de reutilisation
 * d'element.
 *
 * L'etat initial est lu une fois depuis authStorage au montage (via
 * hasValidSession(), pas juste "un jeton existe" - voir authStorage.ts,
 * durcissement issue #65) : coherent avec un rechargement de page ou
 * l'utilisateur est deja connecte.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(hasValidSession);

  const value = useMemo(
    () => ({ isAuthenticated, setAuthenticated: setIsAuthenticated }),
    [isAuthenticated],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

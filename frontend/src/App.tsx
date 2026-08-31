import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './layouts/AppLayout/AppLayout';
import RequireAuth from './components/RequireAuth';
import RedirectIfAuthenticated from './components/RedirectIfAuthenticated';
import Skeleton from './components/Skeleton/Skeleton';
import { AuthProvider } from './lib/AuthProvider';
import RecherchePage from './pages/RecherchePage/RecherchePage';

// Écran d'arrivée ("/" y redirige) : chargé d'emblée, pas de code-splitting
// (ce serait un flash de chargement pour quasiment tous les visiteurs).
// Les autres écrans sont chargés à la demande (issue #23, éco-conception) :
// leur JS ne pèse plus sur le premier chargement de /recherche.
const ConnexionPage = lazy(() => import('./pages/ConnexionPage/ConnexionPage'));
const ProfilPage = lazy(() => import('./pages/ProfilPage/ProfilPage'));
const HistoriquePage = lazy(
  () => import('./pages/HistoriquePage/HistoriquePage'),
);
const MotDePasseOubliePage = lazy(
  () => import('./pages/MotDePasseOubliePage/MotDePasseOubliePage'),
);
const ReinitialiserMotDePassePage = lazy(
  () => import('./pages/ReinitialiserMotDePassePage/ReinitialiserMotDePassePage'),
);

/**
 * Arbre de routes de l'application.
 *
 * Le routeur (BrowserRouter) est fourni par l'appelant (voir main.tsx en
 * production, MemoryRouter dans les tests) : ce composant ne fait que
 * declarer QUELLES routes existent, pas COMMENT elles sont servies. Ca
 * permet de tester la navigation sans dependre de l'URL reelle du navigateur.
 *
 * Toutes les routes sont imbriquees sous AppLayout (entete + navigation
 * commune), qui les affiche via son <Outlet />.
 *
 * AuthProvider enveloppe tout l'arbre (voir lib/authContext.tsx) : necessaire
 * pour qu'AppLayout puisse reagir immediatement a une connexion/deconnexion
 * bien qu'il reste monte en continu pendant toute la navigation.
 */
function App() {
  return (
    <AuthProvider>
      {/* Suspense unique autour de toutes les routes : le fallback ne
          s'affiche que le temps de télécharger le chunk d'un écran chargé à
          la demande (voir les `lazy(...)` ci-dessus), quasi imperceptible
          une fois le chunk en cache. */}
      <Suspense fallback={<Skeleton count={3} />}>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            {/* Route racine "/" : redirige vers l'ecran de recherche, point
                d'entree naturel de l'application, utilisable sans compte (voir
                issue #64 - la recherche ne doit pas etre un mur d'authentification). */}
            <Route index element={<Navigate to="/recherche" replace />} />
            <Route
              path="connexion"
              element={
                <RedirectIfAuthenticated>
                  <ConnexionPage />
                </RedirectIfAuthenticated>
              }
            />
            <Route
              path="profil"
              element={
                <RequireAuth>
                  <ProfilPage />
                </RequireAuth>
              }
            />
            <Route path="recherche" element={<RecherchePage />} />
            {/* /resultats fusionne dans /recherche (issue #73, docs/specs/
                refonte-visuelle-mobile-desktop.md section 2.7) : un lien
                direct/favori existant vers l'ancienne route est redirige,
                plutot que de casser silencieusement. */}
            <Route
              path="resultats"
              element={<Navigate to="/recherche" replace />}
            />
            <Route
              path="historique"
              element={
                <RequireAuth>
                  <HistoriquePage />
                </RequireAuth>
              }
            />
            {/* Public : un utilisateur qui a oublie son mot de passe n'est
                justement pas connecte (issue #71). */}
            <Route
              path="mot-de-passe-oublie"
              element={<MotDePasseOubliePage />}
            />
            {/* Route figee cote backend : le lien envoye par email pointe sur
                ${FRONTEND_URL}/reset-password?token=... (voir
                AuthService.forgotPassword, backend/src/auth/auth.service.ts). */}
            <Route
              path="reset-password"
              element={<ReinitialiserMotDePassePage />}
            />
          </Route>
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}

export default App;

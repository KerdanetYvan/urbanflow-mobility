import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './layouts/AppLayout/AppLayout';
import RequireAuth from './components/RequireAuth';
import RedirectIfAuthenticated from './components/RedirectIfAuthenticated';
import { AuthProvider } from './lib/AuthProvider';
import ConnexionPage from './pages/ConnexionPage/ConnexionPage';
import ProfilPage from './pages/ProfilPage/ProfilPage';
import RecherchePage from './pages/RecherchePage/RecherchePage';
import ResultatsPage from './pages/ResultatsPage';
import HistoriquePage from './pages/HistoriquePage';

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
          <Route path="resultats" element={<ResultatsPage />} />
          <Route path="historique" element={<HistoriquePage />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}

export default App;

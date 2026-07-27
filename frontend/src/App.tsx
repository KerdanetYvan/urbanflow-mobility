import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import ConnexionPage from './pages/ConnexionPage';
import ProfilPage from './pages/ProfilPage';
import RecherchePage from './pages/RecherchePage';
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
 */
function App() {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        {/* Route racine "/" : redirige vers l'ecran de connexion, point
            d'entree naturel de l'application pour un utilisateur non identifie. */}
        <Route index element={<Navigate to="/connexion" replace />} />
        <Route path="connexion" element={<ConnexionPage />} />
        <Route path="profil" element={<ProfilPage />} />
        <Route path="recherche" element={<RecherchePage />} />
        <Route path="resultats" element={<ResultatsPage />} />
        <Route path="historique" element={<HistoriquePage />} />
      </Route>
    </Routes>
  );
}

export default App;

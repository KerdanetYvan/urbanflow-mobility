import { NavLink, Outlet } from 'react-router-dom';
import './AppLayout.css';

/**
 * Description d'un lien de navigation : le libelle affiche et la route cible.
 */
interface NavItem {
  label: string;
  to: string;
}

// Liste unique des ecrans principaux de l'application. Modifier cette liste
// suffit a mettre a jour a la fois la navigation et les routes (voir
// src/App.tsx qui reutilise ces memes chemins).
const NAV_ITEMS: NavItem[] = [
  { label: 'Connexion', to: '/connexion' },
  { label: 'Profil', to: '/profil' },
  { label: 'Recherche', to: '/recherche' },
  { label: 'Résultats', to: '/resultats' },
  { label: 'Historique', to: '/historique' },
];

/**
 * Layout global de l'application : entete + navigation principale + zone de
 * contenu (<Outlet />, remplacee par l'ecran actif selon la route).
 *
 * Deux points d'accessibilite/UX a noter :
 * - Le "lien d'evitement" (skip link) permet a un utilisateur clavier de
 *   sauter directement au contenu principal sans devoir tabuler sur tous
 *   les liens de navigation a chaque changement de page.
 * - NavLink (plutot que Link) ajoute automatiquement `aria-current="page"`
 *   sur le lien actif, ce qui permet aux lecteurs d'ecran d'annoncer la
 *   page courante, et sert de crochet CSS pour la mettre en valeur.
 */
function AppLayout() {
  return (
    <div className="app-layout">
      <a href="#main-content" className="skip-link">
        Aller au contenu principal
      </a>

      <header className="app-header">
        <p className="app-title">UrbanFlow Mobility</p>
      </header>

      <nav className="app-nav" aria-label="Navigation principale">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} className="app-nav-link">
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* id cible du skip link ci-dessus */}
      <main id="main-content" className="app-content">
        <Outlet />
      </main>
    </div>
  );
}

export default AppLayout;

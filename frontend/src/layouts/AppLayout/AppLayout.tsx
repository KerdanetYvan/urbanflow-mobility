import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../lib/useAuth';
import './AppLayout.css';

/**
 * Description d'un lien de navigation : le libelle affiche, la route cible,
 * et a quel etat de connexion ce lien est reserve ('always' par defaut).
 *
 * "Resultats" ne fait volontairement pas partie de cette liste (issue #64) :
 * ce n'est pas un ecran permanent, on n'y arrive que depuis une recherche
 * lancee sur /recherche (voir issue #35), jamais via un clic direct en nav.
 */
interface NavItem {
  label: string;
  to: string;
  visibility: 'always' | 'authenticated-only' | 'guest-only';
}

// Liste unique des ecrans principaux de l'application. Modifier cette liste
// suffit a mettre a jour a la fois la navigation et les routes (voir
// src/App.tsx qui reutilise ces memes chemins).
const NAV_ITEMS: NavItem[] = [
  { label: 'Recherche', to: '/recherche', visibility: 'always' },
  { label: 'Connexion', to: '/connexion', visibility: 'guest-only' },
  { label: 'Profil', to: '/profil', visibility: 'authenticated-only' },
  { label: 'Historique', to: '/historique', visibility: 'authenticated-only' },
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
 *
 * Navigation conditionnelle selon l'authentification (issue #64) : passe par
 * useAuth() (voir lib/AuthProvider.tsx et lib/useAuth.ts) plutot que par une lecture directe de
 * localStorage. AppLayout reste monte en continu pendant toute la session
 * (seul son <Outlet /> change d'ecran en ecran) et react-router reutilise la
 * meme reference d'element a chaque navigation - lire localStorage
 * directement dans le rendu ne se serait donc jamais mis a jour apres un
 * login/logout. Le contexte force un re-rendu cible des que l'etat change.
 */
function AppLayout() {
  const { isAuthenticated } = useAuth();

  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (item.visibility === 'authenticated-only') return isAuthenticated;
    if (item.visibility === 'guest-only') return !isAuthenticated;
    return true;
  });

  return (
    <div className="app-layout">
      <a href="#main-content" className="skip-link">
        Aller au contenu principal
      </a>

      <header className="app-header">
        <p className="app-title">UrbanFlow Mobility</p>
      </header>

      <nav className="app-nav" aria-label="Navigation principale">
        {visibleNavItems.map((item) => (
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

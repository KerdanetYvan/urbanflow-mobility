import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import Alert from '../../components/Alert/Alert';
import { useAuth } from '../../lib/useAuth';
import { useOnlineStatus } from '../../lib/useOnlineStatus';
import { BrandMarkIcon, HistoryIcon, LockIcon, SearchIcon, UserIcon } from '../../components/icons';
import './AppLayout.css';

/**
 * Description d'un lien de navigation : le libelle affiche, la route cible,
 * l'icone associee (issue #73 - nav mobile "icones plutot que texte", voir
 * docs/specs/refonte-visuelle-mobile-desktop.md section 3), et a quel etat
 * de connexion ce lien est reserve ('always' par defaut).
 *
 * "Resultats" ne fait volontairement pas partie de cette liste (issue #64) :
 * ce n'est pas un ecran permanent, on n'y arrive que depuis une recherche
 * lancee sur /recherche (voir issue #35), jamais via un clic direct en nav.
 */
interface NavItem {
  label: string;
  to: string;
  icon: ReactNode;
  visibility: 'always' | 'authenticated-only' | 'guest-only';
}

// Liste unique des ecrans principaux de l'application. Modifier cette liste
// suffit a mettre a jour a la fois la navigation et les routes (voir
// src/App.tsx qui reutilise ces memes chemins).
const NAV_ITEMS: NavItem[] = [
  { label: 'Recherche', to: '/recherche', icon: <SearchIcon />, visibility: 'always' },
  { label: 'Connexion', to: '/connexion', icon: <LockIcon />, visibility: 'guest-only' },
  { label: 'Profil', to: '/profil', icon: <UserIcon />, visibility: 'authenticated-only' },
  {
    label: 'Historique',
    to: '/historique',
    icon: <HistoryIcon />,
    visibility: 'authenticated-only',
  },
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
  const isOnline = useOnlineStatus();
  const navRef = useRef<HTMLElement>(null);

  /**
   * Hauteur reelle de la nav mobile fixe (issue #251) - `.app-layout`
   * reservait un `padding-bottom` fige (`--space-8`, 48px, voir
   * AppLayout.css) suppose couvrir `.app-nav`, mais sa hauteur REELLEMENT
   * rendue (icone + libelle + paddings) le depasse (~59px mesures en
   * session) : le dernier contenu actionnable d'une page - ex. les boutons
   * "Passer"/"Continuer" de l'onboarding, le tout premier ecran qu'un
   * nouvel utilisateur voit - se retrouvait partiellement recouvert par la
   * nav, en violation directe de la contrainte PWA standalone de CLAUDE.md
   * ("la navigation en propre doit rester utilisable de façon autonome").
   *
   * Mesure la hauteur reelle au montage ET a chaque redimensionnement
   * (`ResizeObserver`, pas un simple calcul au montage) : couvre aussi bien
   * une rotation d'ecran que le zoom navigateur jusqu'a 200% (WCAG 1.4.4),
   * qui agrandit le libelle de nav (`--text-xs`, en rem) sans que la
   * fenetre elle-meme ne se redimensionne forcement de la meme façon.
   *
   * Ecrit directement en variable CSS globale (`--nav-height` sur
   * `<html>`) plutot que dans une feuille de style : c'est une mesure
   * runtime, pas une valeur de design figee - voir AppLayout.css
   * (`padding-bottom: var(--nav-height, var(--space-8))`, --space-8 en
   * repli tant que cet effet n'a pas encore tourne). `useLayoutEffect`
   * (pas `useEffect`) : applique la mesure AVANT le premier paint du
   * navigateur, pour eviter un flash au mauvais padding le temps qu'un
   * effet differe s'execute.
   */
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    function applyNavHeight() {
      document.documentElement.style.setProperty(
        '--nav-height',
        `${nav!.offsetHeight}px`,
      );
    }

    applyNavHeight();
    const observer = new ResizeObserver(applyNavHeight);
    observer.observe(nav);
    return () => observer.disconnect();
  }, []);

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
        {/*
          Traitement typographique du nom du produit (issue #159) : "Urban"
          en couleur de texte normale + "Flow" en ambre (--color-primary-
          emphasis, meme token que le reste de l'identite chromatique #158)
          forment ensemble le wordmark "UrbanFlow", visuellement distinct de
          "Mobility" qui reste un simple descriptif en retrait. Objectif de
          l'issue : rendre l'app identifiable sur une capture d'ecran sans
          lire le nom en entier - le mark SVG + la rupture de couleur au
          milieu du mot suffisent, pas besoin d'un logo image a charger.
        */}
        <p className="app-title">
          <BrandMarkIcon />
          <span className="app-title-wordmark">
            Urban<span className="app-title-accent">Flow</span>
          </span>
          <span className="app-title-suffix">Mobility</span>
        </p>
      </header>

      {/* Etat degrade explicite (F2, issue #10) - bandeau permanent tant que
          le navigateur se signale hors ligne (useOnlineStatus,
          navigator.onLine + evenements online/offline), visible sur tout
          ecran plutot qu'un simple echec silencieux au prochain appel
          reseau. Les resultats de recherche affiches depuis le cache local
          (lib/tripCache.ts) portent leur propre bandeau, plus specifique -
          voir RecherchePageResults. */}
      {!isOnline && (
        <Alert variant="warning" title="Hors ligne">
          Vous êtes actuellement hors ligne. Certaines fonctionnalités
          peuvent être indisponibles ou afficher des données non à jour.
        </Alert>
      )}

      <nav ref={navRef} className="app-nav" aria-label="Navigation principale">
        {visibleNavItems.map((item) => (
          <NavLink key={item.to} to={item.to} className="app-nav-link">
            <span className="app-nav-link-icon" aria-hidden="true">
              {item.icon}
            </span>
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

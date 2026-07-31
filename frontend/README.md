# Frontend — PWA UrbanFlow Mobility

Stack retenue (voir `../CLAUDE.md`) : **React + Vite (TypeScript)**, PWA via **Workbox** pour le service worker (voir [section PWA](#pwa-installabilité) ci-dessous, issue #19).

## Démarrage local

```bash
npm install
npm run dev
```

## Scripts disponibles

- `npm run dev` — serveur de développement
- `npm run build` — build de production (`tsc -b && vite build`)
- `npm run lint` — ESLint
- `npm run preview` — prévisualisation du build de production
- `npm test` — tests unitaires (Vitest, mode exécution unique)
- `npm run test:watch` — Vitest en mode watch
- `npm run test:cov` — tests avec rapport de couverture (`coverage/`, non versionné)

## Tests

Framework : **Vitest** + **React Testing Library** (`@testing-library/react`, `@testing-library/user-event`, matchers `@testing-library/jest-dom`).

- Environnement simulé : `jsdom` (voir `vite.config.ts`, clé `test`).
- `globals: true` : `describe`/`it`/`expect` disponibles sans import (cohérent avec Jest côté backend).
- `src/test/setup.ts` : chargé avant chaque fichier de test, ajoute les matchers `jest-dom`.

Convention de nommage : `<composant>.spec.tsx` (ou `.spec.ts` pour un fichier non-JSX), **colocalisé** à côté du fichier testé — même convention que le backend (`src/App.tsx` → `src/App.spec.tsx`).

## Charte graphique (design tokens)

`src/styles/tokens.css` est la **seule source de vérité** pour les couleurs, la typographie, l'espacement et les rayons de bordure (issue #52). Aucune valeur de couleur ou de taille ne doit être écrite en dur ailleurs — toujours passer par une variable définie ici, pour changer la charte en un seul endroit et garantir le support automatique du thème sombre (`@media (prefers-color-scheme: dark)`) partout dans l'app.

Point important sur le primaire (ambre) : il existe **trois variantes**, non interchangeables :

- `--color-primary` : fond d'une surface pleine (ex. bouton primaire). Vif, mais échoue le contraste WCAG utilisé comme texte sur fond de page (~2:1).
- `--color-on-primary` : texte/icône par-dessus un fond `--color-primary`.
- `--color-primary-emphasis` : le primaire utilisé comme texte, bordure ou anneau de focus **directement sur le fond de page** (ex. lien de nav actif) — conçu spécifiquement pour ce contraste-là (foncé en thème clair, clair en thème sombre), à l'inverse de `--color-primary`.

Avant d'ajouter une couleur en dur dans un nouveau composant, vérifier si un token existant convient déjà.

## Navigation et layout

- `react-router-dom` pour le routing (voir `src/App.tsx` pour l'arbre de routes). Le `BrowserRouter` est posé dans `src/main.tsx`, pas dans `App.tsx`, pour pouvoir tester la navigation avec un `MemoryRouter` à la place (voir `App.spec.tsx`).
- `src/layouts/AppLayout/AppLayout.tsx` : entête + navigation principale (`NavLink`, avec `aria-current="page"` automatique sur le lien actif) + zone de contenu (`<Outlet />`). Inclut un lien d'évitement (skip link) pour la navigation clavier.
- `src/pages/` : un dossier par écran principal (`ConnexionPage/`, `ProfilPage/`, `RecherchePage/`, `ResultatsPage.tsx`, `HistoriquePage.tsx`). `ConnexionPage` (F1, #33) et `ProfilPage` (F1, #34) sont implémentés ; les autres restent des placeholders, à remplir par leurs issues dédiées.
- `src/components/RequireAuth.tsx` : garde de route, redirige vers `/connexion` si aucun access token n'est stocké. Enveloppe la route `/profil` dans `App.tsx` ; à réutiliser pour toute future route nécessitant d'être connecté.
- Layout mobile-first (`AppLayout.css`, colocalisé avec `AppLayout.tsx`) : navigation fixée en bas de l'écran sur mobile (à portée du pouce), qui redevient une barre classique en haut à partir de 768px.

**Sécurité** : `react-router-dom` reste sur sa dernière version malgré une alerte `npm audit` (CVE sur le "RSC Mode", un mode framework avec actions serveur qu'on n'utilise pas ici — SPA client pur avec `BrowserRouter`). Revenir à une version antérieure réintroduirait une dizaine d'autres failles déjà corrigées entretemps.

## Authentification (F1)

- `src/lib/api.ts` — petit client fetch : lit l'URL de base dans `VITE_API_URL`, lève une `ApiError` avec le message déjà prêt à afficher (gère aussi bien un message simple qu'un tableau de messages de validation renvoyé par le backend).
- `src/lib/auth.ts` — `register()` (POST /users) et `login()` (POST /auth/login, enregistre les jetons). `register()` ne connecte pas automatiquement (le backend ne renvoie pas de jetons à l'inscription) : `ConnexionPage` enchaîne elle-même un `login()` juste après un `register()` réussi.
- `src/lib/authStorage.ts` — jetons stockés en `localStorage`. Compromis assumé pour le MVP (voir le commentaire dans le fichier) : plus simple qu'un cookie httpOnly, mais accessible en JS donc sensible en cas de faille XSS ailleurs — à réévaluer lors de l'audit sécurité OWASP dédié (issue #21, Sprint 3).
- `src/components/` — `Button/`, `FormField/`, `Alert/` : composants communs réutilisables, implémentent la charte graphique (issue #52). `ConnexionPage` est le premier écran à les utiliser ; les futurs écrans (recherche, résultats...) doivent les réutiliser plutôt que redéfinir leurs propres styles de bouton/champ.
- Validation double : côté client (retour immédiat, `ConnexionPage.tsx`) **et** côté serveur (jamais faire confiance uniquement au client) — les deux appliquent la même règle de mot de passe (8 caractères minimum, une majuscule, une minuscule, un chiffre, un caractère spécial) et le même message d'erreur.

## Profil de mobilité (F1)

- `src/lib/profile.ts` — `getMyProfile()`, `createProfile()`, `updateProfile()`, `deleteProfile()`, toutes via les helpers authentifiés de `api.ts` (en-tête `Authorization` automatique). `TRANSPORT_MODES` liste les modes de transport affichables dans le formulaire (mêmes valeurs que l'enum `TransportMode` du backend, dupliquées volontairement — pas de code partagé entre les deux projets).
- `src/lib/api.ts` — `authGet`/`authPost`/`authPatch`/`authDelete` : variantes authentifiées de la requête de base. En cas de 401 (access token expiré), tentent **une fois** un rafraîchissement via le refresh token stocké avant de rejouer l'appel ; si le rafraîchissement échoue aussi, nettoient les jetons et laissent l'erreur remonter (la page appelante redirige alors vers `/connexion`).
- `ProfilPage` : charge le profil au montage (`GET /profiles/me`) ; un 404 signifie "pas encore de profil" (formulaire vide, la sauvegarde fera un `POST` plutôt qu'un `PATCH`) — pas une erreur à afficher à l'utilisateur.

## PWA (installabilité)

Fondations PWA (issue #19) : manifest + service worker via **`vite-plugin-pwa`** (génère un service worker Workbox au build, stratégie `generateSW` — pas de fichier de service worker écrit à la main).

- `vite.config.ts` — configuration du plugin : manifest (nom, couleurs, icônes), `registerType: 'autoUpdate'` (le service worker se met à jour automatiquement, cohérent avec le déploiement continu du projet), et une règle de cache runtime `NetworkFirst` sur `/api/*` (réseau en priorité, repli sur le cache si hors-ligne — générique, couvrira aussi les futurs endpoints de recherche d'itinéraires sans modification).
- `public/favicon.svg` — monogramme "U" en ruban à largeur variable (fin aux extrémités, plein au centre du trait), branche gauche droite et volontairement plus longue que la branche droite qui se courbe vers l'extérieur. Couleurs `--color-primary`/`--color-on-primary` de `tokens.css`. **Généré, ne pas éditer à la main** — voir ci-dessous.
- `npm run favicon` (`scripts/generate-favicon.mjs`) — régénère `public/favicon.svg` à partir d'une ligne centrale paramétrique (le contour à largeur variable est calculé, pas dessiné à la main : SVG ne sait pas faire varier `stroke-width` le long d'un tracé). Pour ajuster le dessin (épaisseur, longueur des branches, couleurs), modifier les constantes en tête du script puis relancer — ne jamais éditer `favicon.svg` directement, il serait écrasé.
- `npm run icons` (`scripts/generate-pwa-icons.mjs`, dépendance `sharp`) — relance d'abord `npm run favicon`, puis régénère `public/pwa-192x192.png`, `public/pwa-512x512.png` et `public/apple-touch-icon.png` à partir du SVG. Commande à utiliser pour tout régénérer en une fois.
- `index.html` — balises Apple (`apple-touch-icon`, `apple-mobile-web-app-*`) ajoutées à la main : iOS ignore le manifest web pour l'icône et le mode plein écran. Le lien `<link rel="manifest">` et l'enregistrement du service worker sont eux injectés automatiquement au build par `vite-plugin-pwa`.

**Vérification** : `npm run build && npm run preview`, puis auditer `http://localhost:4173` avec Lighthouse. Catégorie PWA notée (manifest, service worker, icône maskable, splash screen) : 100/100 sur Lighthouse 10.4 — dernière version où cette catégorie est encore un score chiffré, Lighthouse 11+ l'a retirée de la config par défaut (les audits d'installabilité existent toujours individuellement mais ne sont plus groupés/notés). Utiliser `npx lighthouse@10.4.0 <url> --only-categories=pwa` pour reproduire un score comparable.

**Sécurité (audit npm)** : `vite-plugin-pwa` tire `workbox-build` qui dépend d'un ancien `rollup-plugin-off-main-thread` (via `ejs`/`jake`/`filelist`, vulnérabilités "high" côté `npm audit`). Ces paquets ne s'exécutent qu'au build (génération du service worker), jamais expédiés dans le bundle livré au navigateur — risque limité à la chaîne de build, pas à l'application en production. Pas de correctif amont disponible à ce jour sans rétrograder `vite-plugin-pwa` en semver majeur (voir aussi la note équivalente sur `react-router-dom` plus haut).

## Conventions à respecter

- Composants en **PascalCase** (`TripPlanner`, `MobilityDashboard`).
- Un composant/écran/layout qui a un fichier associé (CSS et/ou `.spec.tsx`) vit dans son propre dossier plutôt qu'à plat, tous nommés comme le composant : `components/Alert/Alert.tsx` + `Alert.css`, `pages/ProfilPage/ProfilPage.tsx` + `ProfilPage.css` + `ProfilPage.spec.tsx`. Un composant seul (pas de CSS ni de test dédié, ex. `icons.tsx`) reste un simple fichier à plat.
- Accessibilité **WCAG 2.1 AA** (rôles ARIA, contraste, navigation clavier) — voir la grille de conformité en annexe F du dossier de certification.
- Design mobile-first, cohérent avec un usage en mobilité à connectivité variable.

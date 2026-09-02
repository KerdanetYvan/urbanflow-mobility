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
- `src/test/setup.ts` : chargé avant chaque fichier de test, ajoute les matchers `jest-dom` **et** remplace `localStorage` par une implémentation en mémoire (issue #222) — Node 22+ expose un accesseur `localStorage` global expérimental qui masque celui de jsdom (`get`/`set` qui ne stockent rien sans le flag CLI `--localstorage-file`), faisant échouer en cascade toute suite touchant `localStorage` (directement ou via `authStorage.ts`/`AuthProvider`). Aucune configuration ni variable d'environnement à connaître : `npm test` fonctionne nativement quelle que soit la version de Node installée.

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

## Suivi de trajet et notifications push (F3, issue #18)

- `src/lib/followedTrip.ts` — `startFollowingTrip()`/`getCurrentFollowedTrip()`/`stopFollowingTrip()` (`POST`/`GET`/`DELETE /trips/current`, authentifiés). `toStartFollowingTripInput(itinerary)` construit le corps de la requête à partir d'un `TripItinerary` déjà reçu de `GET /trips` — origine/destination = premier/dernier segment, chaque segment réduit à `{mode, routeId, tripId}` (le trace/les couleurs ne servent à rien côté backend pour cette fonctionnalité). `getCurrentFollowedTrip()` ne lève jamais (404 backend ou toute autre erreur → `null`).
- `src/lib/push.ts` — `getVapidPublicKey()` (public), `subscribeToPush()`/`unsubscribeFromPush()` (authentifiés, `POST`/`DELETE /push/subscriptions`). `subscribeBrowserToPush()` enchaîne demande de permission `Notification` + `pushManager.subscribe()` : renvoie `null` (jamais d'exception) si l'API Push n'est pas supportée, si la permission est refusée, ou si le backend n'a pas de clé VAPID configurée — à l'appelant de proposer le repli bannière `Alert`.
- `src/components/TripFollowButton/` — bouton "Suivre ce trajet" / "Arrêter le suivi", placé dans le détail de l'itinéraire sélectionné (`ItinerarySegments`, `RecherchePageResults.tsx`, même emplacement que le bloc "Prochain passage", issue #173) — voir `docs/specs/f3-scoring-perturbations-suivi.md` section 2. Visiteur non connecté : le bouton reste visible, son clic renvoie vers `/connexion` plutôt que d'ouvrir le flux d'abonnement (section 3 du même spec).
- **Marqueur "Perturbation en cours"** (`ItinerarySegments`) — `itinerary.disrupted` (issue #18, `ScoringService` backend) affiche une bannière `Alert` (variant `warning`), volontairement distincte des badges qualitatifs (`Badge`, issue #126) — voir `docs/specs/f3-scoring-perturbations.md` section 3.3.
- **Reprise automatique** (`RecherchePage.tsx`) — au montage, un utilisateur authentifié avec un suivi actif (`GET /trips/current`) voit sa recherche origine/destination relancée automatiquement, pour atterrir directement sur l'écran de résultats déjà recalculé au tap sur une notification (aucune route `/résultats` dédiée ni paramètre d'URL, même contrainte que la relance depuis l'historique, issue #174 — même mécanisme réutilisé).
- **Service worker** (`public/push-sw.js`) — écouteurs `push`/`notificationclick` ajoutés au service worker généré par Workbox via `workbox.importScripts` (`vite.config.ts`) : la stratégie `generateSW` déjà en place pour la PWA (issue #19) ne permet pas d'injecter du code personnalisé directement, `importScripts()` est le mécanisme officiel de Workbox pour la compléter sans passer en mode `injectManifest` (qui changerait toute la stratégie de precache actuelle). `notificationclick` ouvre/réactive un onglet sur `/recherche`, où l'effet de reprise ci-dessus prend le relais.
- **Non vérifié en conditions réelles** dans cette session : pas de navigateur ni de backend/base de données vivants disponibles pour tester l'abonnement push, l'envoi réel d'une notification et sa réception par le service worker de bout en bout — vérifié uniquement au niveau unitaire (composants/hooks mockés) et par lecture du code généré (`dist/sw.js` contient bien `importScripts("/push-sw.js")`).

## Mode dégradé - cache des derniers trajets utiles (F2, issue #10)

- `src/lib/tripCache.ts` — cache local (`localStorage`) des derniers trajets recherchés avec succès. `saveTripToCache(origin, destination, result)` (appelé par `performSearch` après chaque `GET /trips` réussi) upsert par couple origine/destination (coordonnées, pas le libellé — une reformulation du géocodeur ne doit pas créer une seconde entrée), plafonné à **5 entrées**, purgé automatiquement au-delà de **24h** (`getCachedTrip`/`saveTripToCache` purgent à chaque appel, pas de tâche de fond dédiée). Fenêtre bien plus courte que les 12 mois de `TripHistoryEntry` (backend, issue #11) — cache distinct, fonction différente : résilience hors-ligne pour n'importe quel usager (y compris anonyme) plutôt que raccourcis de recherche pour un compte connecté.
- **Pas de chiffrement côté navigateur** (à la différence du chiffrement au repos backend, `createEncryptedColumnTransformer`) — décision documentée dans `tripCache.ts` : une clé de chiffrement embarquée dans le bundle JS n'offre aucune protection réelle contre le seul "attaquant" pertinent pour du stockage local (l'utilisateur de l'appareil lui-même). La mitigation qui compte ici, et que `CLAUDE.md` cite d'ailleurs séparément du chiffrement, est la **minimisation** (peu d'entrées, purge automatique courte) — voir `docs/specs/rgpd-geolocalisation.md` section 3.3.
- `RecherchePage.tsx` (`performSearch`) — si une recherche échoue **sans que le backend n'ait été joint** (`error` n'est pas une `ApiError`, typiquement `fetch` qui échoue faute de connexion) et qu'un trajet en cache correspond exactement à l'origine/destination demandée, les résultats en cache sont affichés (`Screen.fromCache: true`) plutôt qu'un retour au formulaire avec une erreur générique. Une `ApiError` (le backend a bien répondu, même en erreur) ignore le cache — la connexion n'est pas en cause.
- **Bandeau explicite** (`RecherchePageResults.tsx`, `ResultsList`) — "Résultats hors ligne" (`Alert`, variant `warning`), distinct du bandeau de repli existant (`fallback`, issue #190/#91) ; les deux peuvent coexister (un trajet en cache peut lui-même être un repli).
- `src/lib/useOnlineStatus.ts` + `AppLayout.tsx` — bandeau **permanent** (pas seulement au moment d'une recherche) tant que `navigator.onLine` signale une déconnexion, visible sur tout écran. Limite documentée dans le hook : `navigator.onLine` reflète la connexion réseau locale, pas une jointure réelle au backend — le repli sur le cache ci-dessus se déclenche donc aussi indépendamment, sur l'échec réel d'un appel réseau.

## Conventions à respecter

- Composants en **PascalCase** (`TripPlanner`, `MobilityDashboard`).
- Un composant/écran/layout qui a un fichier associé (CSS et/ou `.spec.tsx`) vit dans son propre dossier plutôt qu'à plat, tous nommés comme le composant : `components/Alert/Alert.tsx` + `Alert.css`, `pages/ProfilPage/ProfilPage.tsx` + `ProfilPage.css` + `ProfilPage.spec.tsx`. Un composant seul (pas de CSS ni de test dédié, ex. `icons.tsx`) reste un simple fichier à plat.
- Accessibilité **WCAG 2.1 AA** (rôles ARIA, contraste, navigation clavier) — voir la grille de conformité en annexe F du dossier de certification.
- Design mobile-first, cohérent avec un usage en mobilité à connectivité variable.

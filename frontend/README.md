# Frontend — PWA UrbanFlow Mobility

Stack retenue (voir `../CLAUDE.md`) : **React + Vite (TypeScript)**, PWA via **Workbox** pour le service worker (à mettre en place, voir issue dédiée).

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

## Navigation et layout

- `react-router-dom` pour le routing (voir `src/App.tsx` pour l'arbre de routes). Le `BrowserRouter` est posé dans `src/main.tsx`, pas dans `App.tsx`, pour pouvoir tester la navigation avec un `MemoryRouter` à la place (voir `App.spec.tsx`).
- `src/layouts/AppLayout.tsx` : entête + navigation principale (`NavLink`, avec `aria-current="page"` automatique sur le lien actif) + zone de contenu (`<Outlet />`). Inclut un lien d'évitement (skip link) pour la navigation clavier.
- `src/pages/` : un composant par écran principal (`ConnexionPage`, `ProfilPage`, `RecherchePage`, `ResultatsPage`, `HistoriquePage`) — pour l'instant des placeholders, à remplir par leurs issues dédiées respectives.
- Layout mobile-first (`AppLayout.css`) : navigation fixée en bas de l'écran sur mobile (à portée du pouce), qui redevient une barre classique en haut à partir de 768px.

**Sécurité** : `react-router-dom` reste sur sa dernière version malgré une alerte `npm audit` (CVE sur le "RSC Mode", un mode framework avec actions serveur qu'on n'utilise pas ici — SPA client pur avec `BrowserRouter`). Revenir à une version antérieure réintroduirait une dizaine d'autres failles déjà corrigées entretemps.

## Conventions à respecter

- Composants en **PascalCase** (`TripPlanner`, `MobilityDashboard`).
- Accessibilité **WCAG 2.1 AA** (rôles ARIA, contraste, navigation clavier) — voir la grille de conformité en annexe F du dossier de certification.
- Design mobile-first, cohérent avec un usage en mobilité à connectivité variable.

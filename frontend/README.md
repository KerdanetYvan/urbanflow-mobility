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

## Conventions à respecter

- Composants en **PascalCase** (`TripPlanner`, `MobilityDashboard`).
- Accessibilité **WCAG 2.1 AA** (rôles ARIA, contraste, navigation clavier) — voir la grille de conformité en annexe F du dossier de certification.
- Design mobile-first, cohérent avec un usage en mobilité à connectivité variable.

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

Les tests (Vitest + React Testing Library) seront ajoutés par une issue QA dédiée.

## Conventions à respecter

- Composants en **PascalCase** (`TripPlanner`, `MobilityDashboard`).
- Accessibilité **WCAG 2.1 AA** (rôles ARIA, contraste, navigation clavier) — voir la grille de conformité en annexe F du dossier de certification.
- Design mobile-first, cohérent avec un usage en mobilité à connectivité variable.

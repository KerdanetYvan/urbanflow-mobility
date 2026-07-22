# Frontend — PWA UrbanFlow Mobility

Stack retenue (voir `../CLAUDE.md`) : **React + Vite**, PWA via **Workbox** pour le service worker.

À initialiser, par exemple :

```
npm create vite@latest . -- --template react-ts
```

Conventions à respecter :

- Composants en **PascalCase** (`TripPlanner`, `MobilityDashboard`).
- Accessibilité **WCAG 2.1 AA** (rôles ARIA, contraste, navigation clavier) — voir la grille de conformité en annexe F du dossier de certification.
- Design mobile-first, cohérent avec un usage en mobilité à connectivité variable.

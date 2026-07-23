# Backend — API UrbanFlow Mobility

Stack retenue (voir `../CLAUDE.md`) : **NestJS** (Node.js / TypeScript), **TypeORM** pour l'accès à PostgreSQL/PostGIS.

TypeORM a été préféré à Prisma pour son support natif des colonnes géométriques PostGIS et son intégration officielle avec NestJS (`@nestjs/typeorm`).

## Démarrage local

```bash
npm install
npm run start:dev
```

Nécessite une variable d'environnement `DATABASE_URL` (voir `../.env.example`), lue soit depuis `backend/.env`, soit depuis `../.env` à la racine du projet.

## Scripts disponibles

- `npm run start:dev` — serveur en mode watch
- `npm run build` — compilation TypeScript
- `npm run lint` — ESLint
- `npm test` — tests unitaires Jest

## Tests

Framework : **Jest** (déjà configuré par le scaffold NestJS, voir le bloc `"jest"` dans `package.json`).

- `npm test` — lance tous les tests unitaires
- `npm run test:watch` — mode watch (relance à chaque sauvegarde)
- `npm run test:cov` — génère un rapport de couverture dans `coverage/` (non versionné)
- `npm run test:e2e` — tests end-to-end (config séparée dans `test/jest-e2e.json`)

Convention de nommage :

- Test unitaire : `<fichier>.spec.ts`, **colocalisé** à côté du fichier qu'il teste (ex. `src/common/filters/all-exceptions.filter.ts` → `src/common/filters/all-exceptions.filter.spec.ts`). Pas de dossier `__tests__` séparé, pour garder le test visible dès qu'on ouvre le fichier source.
- Test end-to-end : `test/<nom>.e2e-spec.ts`.

## Gestion des erreurs et logs

- `AllExceptionsFilter` (`src/common/filters/`) : filtre d'exceptions global, formate toute erreur en `{ statusCode, timestamp, path, message }`. Les erreurs non contrôlées (non-`HttpException`) sont masquées derrière un message générique côté client, mais loggées avec leur stack trace côté serveur — jamais l'inverse.
- `LoggingInterceptor` (`src/common/interceptors/`) : logge chaque requête HTTP (méthode, URL, statut, durée) via le logger `HTTP`.
- Niveaux de log : `error` pour les statuts ≥ 500, `warn` pour le reste des erreurs (4xx), `log` pour les requêtes normales.

## Conventions à respecter

- Endpoints REST en **pluriel, kebab-case** (`GET /trips`, `POST /reservations`).
- Services suffixés par leur rôle (`TripService`, `ReservationService`).
- Le service de scoring (partie 7.3 du dossier) est un module dédié, interrogé après chaque appel à OpenTripPlanner — poids clairs et modifiables, pas de modèle opaque.
- Authentification JWT + refresh tokens, mots de passe hachés avec bcrypt (voir annexes C et D du dossier de certification).
- Respect OWASP Top 10 sur l'ensemble des endpoints exposés.
- `synchronize` TypeORM n'est actif qu'en dehors de `NODE_ENV=production` (voir `src/app.module.ts`) — les migrations seront introduites avant tout déploiement en production.

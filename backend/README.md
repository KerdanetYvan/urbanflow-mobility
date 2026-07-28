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

## Authentification (F1)

- `POST /users` — inscription (`src/users/`). Cree le compte, mot de passe hache **bcryptjs** (10 rounds), ne renvoie jamais le hash au client. Ne connecte pas automatiquement l'utilisateur (le frontend enchaine lui-meme un login juste apres, voir `frontend/README.md`).
- `POST /auth/login` — connexion (`src/auth/`). Verifie l'email/mot de passe, renvoie une paire `{ accessToken, refreshToken }`. Message d'erreur volontairement identique que ce soit l'email inconnu ou le mot de passe incorrect (pas d'enumeration d'utilisateurs, OWASP).
- `POST /auth/refresh` — echange un refresh token valide contre une nouvelle paire de jetons.
- Access token : courte duree (`JWT_EXPIRATION`, 15 min par defaut), signe avec `JWT_SECRET`. Refresh token : longue duree (`JWT_REFRESH_EXPIRATION`, 7 j), signe avec un secret **different** (`JWT_REFRESH_SECRET`) — si l'un des deux secrets fuite, l'autre type de jeton ne peut pas etre forge.
- `JwtStrategy` + `JwtAuthGuard` (`src/auth/`) : protegent les endpoints necessitant une authentification (`@UseGuards(JwtAuthGuard)`) - premier usage reel avec les profils de mobilite ci-dessous.
- CORS activé (`CORS_ORIGIN` dans `.env`, `http://localhost:5173` par defaut) : necessaire des qu'un frontend sur un port different appelle l'API depuis un navigateur.

## Profil de mobilité (F1)

- `src/profiles/` : entité `MobilityProfile` (table `mobility_profiles`, relation one-to-one avec `User`) — préférences de transport (`preferredTransportModes`, voir `TransportMode`), contrainte d'accessibilité PMR (`reducedMobility`, mappée sur le paramètre de routage OpenTripPlanner correspondant), distance de marche max et nombre de correspondances max optionnels (`maxWalkingDistanceMeters`, `maxTransfers`). Pas de champ "éviter les escaliers" : le GTFS/OSM utilisé par OpenTripPlanner ne descend pas à ce niveau de détail.
- Toutes les routes (`POST /profiles`, `GET /profiles/me`, `PATCH /profiles/me`, `DELETE /profiles/me`) sont protégées par `JwtAuthGuard` et n'agissent **que** sur le profil de l'utilisateur authentifié (`user.sub` extrait du JWT via `@CurrentUser()`) — jamais d'id de profil fourni par le client dans l'URL, pour éliminer par construction tout risque d'IDOR.
- Pas de `GET /profiles/:id` générique : volontairement absent, un utilisateur ne peut jamais consulter le profil de quelqu'un d'autre.

## Conventions à respecter

- Endpoints REST en **pluriel, kebab-case** (`GET /trips`, `POST /reservations`).
- Services suffixés par leur rôle (`TripService`, `ReservationService`).
- Le service de scoring (partie 7.3 du dossier) est un module dédié, interrogé après chaque appel à OpenTripPlanner — poids clairs et modifiables, pas de modèle opaque.
- Authentification JWT + refresh tokens, mots de passe hachés avec bcrypt (voir annexes C et D du dossier de certification).
- Respect OWASP Top 10 sur l'ensemble des endpoints exposés.
- `synchronize` TypeORM (création automatique du schéma) est piloté par sa propre variable `TYPEORM_SYNC` (voir `src/app.module.ts`), indépendamment de `NODE_ENV` : les deux questions ("crée le schéma automatiquement ?" et "tourne-t-on en production ?") sont indépendantes. `TYPEORM_SYNC=true` reste nécessaire même en production tant qu'aucune migration TypeORM n'existe — à repasser à `false` une fois les migrations en place.

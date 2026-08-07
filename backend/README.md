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
- `npm run seed` — jeu de données de test (voir ci-dessous)
- `npm run migration:generate -- src/migrations/<Nom>` — génère une migration à partir du diff entités ↔ base connectée (voir ci-dessous)
- `npm run migration:run` / `npm run migration:revert` — applique/annule les migrations en attente

## Migrations (TypeORM CLI)

Le schéma est géré par des migrations versionnées (`src/migrations/`), pas par `synchronize` (voir plus bas). `src/data-source.ts` définit le `DataSource` utilisé par la CLI, indépendamment du bootstrap Nest (`app.module.ts`).

- Générer une migration après une modification d'entité : `npm run migration:generate -- src/migrations/NomDescriptif` (nécessite une base à jour par rapport à la dernière migration appliquée, pour que le diff ne porte que sur le changement en cours).
- Appliquer les migrations en attente : `npm run migration:run` (déjà lancé automatiquement au démarrage du conteneur `backend`, dev comme prod — voir `docker/backend.Dockerfile`/`backend.prod.Dockerfile`).
- Annuler la dernière migration appliquée : `npm run migration:revert`.
- En production, l'image ne contient pas `ts-node` (`npm ci --omit=dev`) : les scripts `*:prod` (`migration:run:prod`/`migration:revert:prod`) utilisent le binaire `typeorm` compilé contre `dist/data-source.js` plutôt que `typeorm-ts-node-commonjs`.

**Bootstrap ponctuel requis sur tout environnement existant** (déployé avant l'introduction des migrations, schéma déjà créé par `synchronize`) : la migration `Baseline` fait un `CREATE TABLE` qui échouera (`relation "users" already exists`) si elle s'exécute sur une base où `users`/`mobility_profiles` existent déjà. Avant le premier déploiement de ce changement en production, marquer `Baseline` comme déjà appliquée sans l'exécuter :

```sql
CREATE TABLE IF NOT EXISTS migrations (id SERIAL PRIMARY KEY, timestamp bigint NOT NULL, name character varying NOT NULL);
INSERT INTO migrations (timestamp, name) VALUES (1786032965519, 'Baseline1786032965519');
```

`migration:run:prod` exécutera alors uniquement `AccessibilityPreferences` (la vraie modification de schéma + le backfill des données existantes, voir issue #68) au démarrage suivant du conteneur. Étape à ne faire qu'une fois — les migrations futures s'appliqueront normalement.

## Documentation API (OpenAPI/Swagger)

Issue #38. Accessible sur `GET /api/docs` (interface Swagger UI) et `GET /api/docs-json` (schéma OpenAPI brut) **uniquement en développement** — désactivée si `NODE_ENV=production` (voir `docker/backend.prod.Dockerfile`, qui fixe cette variable ; vérifié manuellement : `404` sur `/api/docs` avec `NODE_ENV=production`, `200` sans). Exposer le schéma complet de l'API (routes, DTO, exemples) publiquement n'a pas de raison d'être une fois déployée.

- Chaque contrôleur porte `@ApiTags(...)` et documente ses réponses (`@ApiOperation`, `@ApiResponse`) ; chaque DTO documente ses champs (`@ApiProperty`/`@ApiPropertyOptional`, avec exemples). Les entités retournées directement (`MobilityProfile`) sont aussi annotées, sauf leurs relations internes (`user`) qui ne sont jamais sérialisées.
- `UpdateProfileDto` utilise le `PartialType` de `@nestjs/swagger` (pas `@nestjs/mapped-types`, retiré du projet) : seule la version swagger propage à la fois les décorateurs `class-validator` et `@ApiProperty` de `CreateProfileDto` vers le DTO partiel.
- Authentification Bearer déclarée une fois (`DocumentBuilder.addBearerAuth(..., 'access-token')` dans `main.ts`), référencée par `@ApiBearerAuth('access-token')` sur `ProfilesController` — cohérent avec `JwtAuthGuard`.
- Complète la collection Postman (`docs/postman/`, issue #31) plutôt que la remplacer : Swagger sert à l'exploration interactive au fil du développement, Postman reste la référence versionnée pour la validation reproductible.
- **Audit npm** : `@nestjs/swagger` tire une version vulnérable de `js-yaml` (DoS par parsing exponentiel, `npm audit`). Risque accepté : ce module ne traite jamais de YAML fourni par un utilisateur externe (uniquement l'introspection interne des routes/DTO), et n'est de toute façon jamais chargé en production (voir plus haut).

## Jeu de données de test (seed)

Issue #40 : permet de développer/démontrer en local sans dépendre des vraies données de la métropole. `src/seed/seed.ts` crée 3 comptes en passant par `UsersService`/`ProfilesService` (mêmes validations et même hachage bcrypt que l'inscription réelle via l'API, pas d'insertion SQL directe) :

| Compte | Mot de passe | Profil |
| --- | --- | --- |
| `antoine@urbanflow.test` | `Antoine123!` | Calqué sur le persona Antoine (dossier, partie 2.3) : préférences larges (marche, TC, trottinette), aucune préférence d'accessibilité cochée |
| `muriel@urbanflow.test` | `Muriel123!` | Calqué sur le persona Muriel : accessibilité fauteuil roulant, marche limitée et correspondances limitées (`accessibilityPreferences`) |
| `sans-profil@urbanflow.test` | `SansProfil123!` | Aucun profil créé — utile pour tester/démontrer l'état "profil pas encore créé" (`ProfilPage.tsx`, 404 sur `GET /profiles/me`) |

**Lancer le seed** (base déjà démarrée, `docker compose up` en cours) :

```bash
docker compose exec backend npm run seed
```

À l'intérieur du conteneur, `DATABASE_URL` pointe déjà vers `postgres` (le nom du service Docker) — pas de configuration supplémentaire. Pour lancer le script depuis l'hôte sans passer par le conteneur (ex. `postgres` démarré seul via `docker compose up -d postgres`), surcharger `DATABASE_URL` avec `localhost` à la place :

```bash
DATABASE_URL=postgresql://urbanflow:changeme@localhost:5432/urbanflow npm run seed
```

**Idempotent** : relancer le script ne duplique rien et n'écrase rien — un email déjà présent (`ConflictException` sur `UsersService.create`) est simplement signalé et ignoré, y compris pour le profil associé.

Mots de passe en clair volontairement dans `seed.ts` et ci-dessus : ce sont des identifiants de développement local documentés, pas des secrets applicatifs.

## Tests

Framework : **Jest** (déjà configuré par le scaffold NestJS, voir le bloc `"jest"` dans `package.json`).

- `npm test` — lance tous les tests unitaires
- `npm run test:watch` — mode watch (relance à chaque sauvegarde)
- `npm run test:cov` — génère un rapport de couverture dans `coverage/` (non versionné)
- `npm run test:e2e` — tests end-to-end (config séparée dans `test/jest-e2e.json`)

Convention de nommage :

- Test unitaire : `<fichier>.spec.ts`, **colocalisé** à côté du fichier qu'il teste (ex. `src/common/filters/all-exceptions.filter.ts` → `src/common/filters/all-exceptions.filter.spec.ts`). Pas de dossier `__tests__` séparé, pour garder le test visible dès qu'on ouvre le fichier source.
- Test end-to-end : `test/<nom>.e2e-spec.ts`.

**Collection Postman** (`docs/postman/`, issue #31) : validation manuelle et reproductible des endpoints, en complément des tests Jest — voir `docs/postman/README.md` pour l'utilisation. Vérifiable en CLI via `npx newman run docs/postman/UrbanFlow-Mobility.postman_collection.json`.

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

- `src/profiles/` : entité `MobilityProfile` (table `mobility_profiles`, relation one-to-one avec `User`) — préférences de transport (`preferredTransportModes`, voir `TransportMode`) et préférences d'accessibilité (`accessibilityPreferences`, voir `AccessibilityPreference` : `wheelchair_accessible`, `limit_walking_distance`, `limit_transfers`). Tableau extensible plutôt que des colonnes dédiées (issue #68) : chaque valeur cochée/décochée est pensée comme une entrée de pondération pour le futur service de scoring (partie 7.3 du dossier), jamais comme un seuil numérique ou un champ libre — un filtre éliminatoire ou une string ne peuvent pas alimenter un classement pondéré. Pas de champ "éviter les escaliers" : le GTFS/OSM utilisé par OpenTripPlanner ne descend pas à ce niveau de détail.
- Toutes les routes (`POST /profiles`, `GET /profiles/me`, `PATCH /profiles/me`, `DELETE /profiles/me`) sont protégées par `JwtAuthGuard` et n'agissent **que** sur le profil de l'utilisateur authentifié (`user.sub` extrait du JWT via `@CurrentUser()`) — jamais d'id de profil fourni par le client dans l'URL, pour éliminer par construction tout risque d'IDOR.
- Pas de `GET /profiles/:id` générique : volontairement absent, un utilisateur ne peut jamais consulter le profil de quelqu'un d'autre.

## Intégration OpenTripPlanner (F2)

- `OtpClientService` (`src/otp/`, issues #6 puis #81) — client REST partagé d'OpenTripPlanner, utilisé à la fois par `TripsModule` (planification) et `PlacesModule` (géocodage) plutôt que dupliqué. Formate date/heure dans le fuseau `OTP_TIMEZONE` (`Europe/Paris` par défaut, celui de l'`agency_timezone` du GTFS chargé) via `Intl.DateTimeFormat`, indépendamment du fuseau du conteneur (UTC par défaut).
- Gestion des erreurs OTP (`planTrip`) : jetons/coordonnées hors de la zone couverte par le graphe (erreur OTP `id: 400`) → `BadRequestException` ; OTP injoignable ou en erreur (réseau, HTTP non-2xx) → `ServiceUnavailableException` ; toute autre réponse d'erreur OTP (ex. aucun trajet possible) → tableau vide, **pas** une erreur (voir `docs/specs/f2-ecrans-planification.md` section 4 : "0 résultat" est un état vide, pas une erreur).
- `GET /trips` (`src/trips/`, issues #6 + #7) — recherche multimodale. Paramètres : `originLat`/`originLon`/`destinationLat`/`destinationLon` (coordonnées uniquement, pas d'adresse en texte libre) et `departureTime` optionnel (ISO 8601, absent = maintenant). Modes `TRANSIT,WALK` (vélo/trottinette en libre-service et covoiturage pas encore intégrés à OTP, voir F3). Pas de garde d'authentification : utilisable sans compte (voir issue #64).
- `TripsService` reformate la réponse OTP en itinéraires/segments (`TripItinerary`/`TripSegment`, `src/trips/dto/`) et affiche le nom **court** de la ligne (`routeShortName`, ex. `T1`) — le champ `route` d'OTP est le nom long, pas ce qu'un usager reconnaît (piège découvert en testant contre un vrai OTP). Tri des itinéraires : ordre natif OpenTripPlanner (durée croissante) pour l'instant — le classement pondéré arrivera avec le service de scoring (issue #16, Sprint 3, cadré par `docs/specs/f3-scoring-perturbations.md`), sans changement attendu côté frontend.
- `GET /places` (`src/places/`, issue #81) — autocomplétion origine/destination : `?query=<texte>` renvoie une liste de suggestions (`label`, `lat`, `lon`), déléguée au géocodeur REST intégré à OTP (`GET {OTP_URL}/geocode`, fonctionnalité sandbox **désactivée par défaut**, activée via `routing-engine/otp-config.json` monté dans le conteneur — voir `docker-compose.yml` et `routing-engine/README.md`). Indexe uniquement les noms d'arrêts/rues déjà chargés dans le graphe : pas de service de géocodage tiers. Aucune correspondance → tableau vide, pas une erreur. Pas de garde d'authentification (même raison que `/trips`).
- **Vérifié manuellement** contre une instance OTP réelle (voir `routing-engine/README.md` pour le jeu de données de test) : `GET /trips` entre `Place Centrale` et `Université` à 8h renvoie bien un trajet à pied et un trajet en bus `T1` de 10 minutes ; `GET /places` retrouve les 4 arrêts fictifs par préfixe de leur nom ; coordonnées hors zone / OTP arrêté / paramètres manquants → 400/400/503 selon le cas.

## Conventions à respecter

- Endpoints REST en **pluriel, kebab-case** (`GET /trips`, `POST /reservations`).
- Services suffixés par leur rôle (`TripService`, `ReservationService`).
- Le service de scoring (partie 7.3 du dossier) est un module dédié, interrogé après chaque appel à OpenTripPlanner — poids clairs et modifiables, pas de modèle opaque.
- Authentification JWT + refresh tokens, mots de passe hachés avec bcrypt (voir annexes C et D du dossier de certification).
- Respect OWASP Top 10 sur l'ensemble des endpoints exposés.
- Le schéma est géré par des migrations TypeORM versionnées (voir section "Migrations" plus haut), pas par `synchronize` (`TYPEORM_SYNC`, voir `src/app.module.ts`) — celui-ci reste disponible comme garde-fou manuel indépendant de `NODE_ENV`, mais doit rester à `false` en usage normal pour ne pas diverger des migrations.

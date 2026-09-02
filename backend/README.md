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
- `npm run import:gtfs` — ingestion du flux GTFS statique de la métropole (voir ci-dessous)
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

## Ingestion GTFS statique (F3)

Issue #12 : récupère le flux GTFS statique de la métropole, le valide (`stops.txt`/`routes.txt`/`trips.txt`/`calendar.txt` conformes au spec GTFS, `src/gtfs/gtfs-parser.ts`), upsert les arrêts géolocalisés dans PostGIS (`GtfsStop`, table `gtfs_stops`) et dépose le zip validé dans `routing-engine/data/` pour qu'OpenTripPlanner le charge au prochain démarrage (`docker compose up otp --build` — OTP ne recharge jamais son graphe à chaud, voir `routing-engine/README.md`).

**Source retenue** : flux open data réel de Rennes Métropole (réseau STAR), cohérent avec la relocalisation déjà faite des fixtures de test Lyon → Rennes (issue #8). URL republiée chaque nuit (`GTFS_SOURCE_URL`, voir `../.env.example`).

**Lancer l'import** (base et `otp` déjà démarrés, `docker compose up` en cours) :

```bash
docker compose exec backend npm run import:gtfs
```

Comme pour le seed, `DATABASE_URL` pointe déjà vers `postgres` à l'intérieur du conteneur. Pour lancer le script depuis l'hôte (ex. seuls `postgres`/`otp` démarrés via `docker compose up -d postgres otp`), surcharger `DATABASE_URL`, `GTFS_OTP_OUTPUT_PATH` et `GTFS_LOCAL_PATH` (chemins hôte plutôt que chemins du conteneur) :

```bash
DATABASE_URL=postgresql://urbanflow:changeme@localhost:5432/urbanflow \
GTFS_OTP_OUTPUT_PATH=../routing-engine/data/gtfs-metropole.zip \
npm run import:gtfs
```

**Tester sans dépendre du réseau** (jeu de données de test versionné, `routing-engine/test-fixtures/gtfs-test.zip`, voir `routing-engine/README.md`) : surcharger `GTFS_LOCAL_PATH` pour lire ce fichier local au lieu de télécharger `GTFS_SOURCE_URL` — le script saute alors le téléchargement, mais valide/upsert/écrit exactement comme avec un flux réel.

```bash
docker compose exec -e GTFS_LOCAL_PATH=routing-engine/test-fixtures/gtfs-test.zip backend npm run import:gtfs
```

**Idempotent** (`Repository.upsert`, clé de conflit `gtfs_id` — contrainte `UNIQUE`, voir la migration `GtfsStops`) : relancer l'import sur un flux déjà chargé met à jour les arrêts existants sans en dupliquer aucun.

**Portée volontairement limitée à `stops.txt`** (décidé en session) : `routes.txt`/`trips.txt`/`calendar.txt` sont validés mais pas dupliqués en base — OpenTripPlanner reste l'unique source de vérité pour le calcul d'itinéraires à partir du graphe complet qu'il construit lui-même. `gtfs_stops` sert aux futurs besoins du backend nécessitant une recherche géolocalisée sans interroger OTP (ex. raccourcis de recherche, issue #112).

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
- `POST /auth/forgot-password` / `POST /auth/reset-password` (issue #70) — reinitialisation de mot de passe par email. `forgot-password` renvoie **toujours** le meme message generique, que l'email existe ou non (meme raisonnement que `/auth/login`, OWASP - pas d'enumeration d'utilisateurs), et n'attend jamais l'envoi de l'email (fire-and-forget, erreur seulement loggee) pour ne pas laisser la latence de la reponse trahir si l'email existait. Le token de reinitialisation n'est **pas** un JWT (non revocable, pas a usage unique) : c'est un secret aleatoire de 256 bits (`crypto.randomBytes`), stocke hache en **SHA-256** (pas bcrypt - le token a deja une entropie suffisante, un hash rapide et deterministe permet en plus de retrouver l'utilisateur par simple recherche, ce qu'un hash bcrypt sale ne permettrait pas), expirant apres `RESET_TOKEN_EXPIRATION_MINUTES` (60 par defaut) et invalide des sa premiere utilisation (`reset_token_hash`/`reset_token_expires_at` sur `users`, migration `PasswordResetToken`).
- **Envoi d'email** (`src/mail/`, `MailService`) : `nodemailer` avec un transport SMTP generique, piloté par `MAIL_HOST`/`MAIL_PORT`/`MAIL_SECURE`/`MAIL_USER`/`MAIL_PASSWORD`/`MAIL_FROM`. Choix volontaire de **ne pas** dependre d'un SaaS externe (Resend, SendGrid...) pour ne pas etre soumis a un quota d'envoi tiers : en developpement, [MailHog](https://github.com/mailhog/MailHog) (`docker-compose.yml`) capture les emails sans les envoyer reellement, consultables sur `http://localhost:8025` ; en production, [Postfix](https://github.com/bokysan/docker-postfix) (`docker-compose.prod.yml`, image `boky/postfix`) relaie reellement les emails, avec generation automatique d'une cle DKIM (`DKIM_AUTOGENERATE=1`, persistee dans le volume `dkim_keys`). Limite assumee : la delivrabilite reelle (enregistrements DNS SPF + cle publique DKIM + rDNS/PTR sur l'IP du VPS) reste une etape manuelle a configurer chez le registrar/OVHcloud, non couverte par le code - sans elle, les emails partiront mais risquent d'atterrir en spam ou d'etre rejetes.
- `DELETE /users/me` (issue #164, droit a l'effacement RGPD article 17) - supprime definitivement le compte authentifie et, par cascade (`onDelete: 'CASCADE'` sur chaque relation - `MobilityProfile`, `TripHistoryEntry`, `FollowedTrip`, `PushSubscription`), toutes les donnees liees. Exige le mot de passe du compte en confirmation (`DeleteAccountDto`, verifie par `bcrypt.compare` cote serveur - jamais une simple confirmation client pour une action irreversible) ; renvoie **403** (pas 401) si le mot de passe est incorrect, distinction volontaire pour ne pas declencher a tort le rafraichissement automatique de jeton cote frontend, reserve a un 401 (voir `docs/specs/rgpd-geolocalisation.md` section 5.2). `JwtStrategy.validate()` verifie desormais, a chaque requete authentifiee, que l'utilisateur du jeton existe toujours en base (401 sinon) : les JWT etant sans etat (pas de liste de revocation dans ce projet), c'est ce qui coupe l'acces immediatement apres suppression du compte plutot que d'attendre l'expiration naturelle de l'access token (section 5.4 de la meme spec).

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

## Vélos/trottinettes en libre-service (GBFS, F3)

- `src/gbfs/` (issue #13) — connecteur **générique** du standard [GBFS](https://gbfs.org/) : `GbfsClientService` télécharge le fichier d'auto-découverte (`gbfs.json`) d'un opérateur, résout ses feeds `station_information`/`station_status` (stations à quai fixe) ou `free_bike_status` (véhicules free-floating, ex. trottinettes sans station) et les fusionne dans une forme unifiée (`SharedMobilityStation`). Aucun champ propre à un opérateur codé en dur — un nouvel opérateur s'intègre par simple ajout d'une entrée à `MOBILITY_OPERATORS` (`.env`), sans modification de code (critère d'interopérabilité, `CLAUDE.md` — architecture généralisée à plusieurs opérateurs simultanés par l'issue #15, voir plus bas).
- `GbfsCacheService` interroge en parallèle **chaque opérateur configuré publiant du GBFS** (`OperatorsService`, issue #15) et fusionne leurs stations en un seul cache — rafraîchi en tâche de fond (`@Cron(EVERY_MINUTE)`, alignement approximatif sur le TTL publié par l'opérateur STAR), gardé en **cache mémoire** (donnée volatile, aucune valeur à la persister en base contrairement aux arrêts GTFS, quasi-statiques). `GET /shared-mobility-stations` sert ce cache directement, sans jamais interroger les flux GBFS à la volée — cohérent avec l'éco-conception (pas un aller-retour réseau par requête entrante) et avec un usage attendu en continu côté carte (`MapView`, frontend). Chaque station porte `operatorId` (`SharedMobilityStation`) — un `id` de station n'est unique qu'au sein d'un même opérateur, `operatorId` lève toute ambiguïté une fois plusieurs opérateurs fusionnés.
- **Dégradation** : `GbfsClientService` ne lève jamais d'exception (même contrat que `NominatimClientService`) — une source injoignable/illisible renvoie `[]`, loggé en warn. `GbfsCacheService` va un cran plus loin : un rafraîchissement vide (tous opérateurs confondus) alors que le cache contenait déjà des stations est traité comme une panne transitoire et **ignoré** (les dernières données connues sont conservées) plutôt que de vider brutalement la carte — un réseau de libre-service métropolitain n'est en pratique jamais réellement à zéro station. L'échec d'UN opérateur ne prive pas les autres de leur propre mise à jour (`Promise.all` par opérateur, résultats fusionnés seulement ensuite).
- **Source retenue par défaut** : flux réel "le vélo STAR" de Rennes Métropole (station-based, aucune trottinette free-floating exploitée par cet opérateur à ce jour), republié en continu (`OperatorsService`, opérateur par défaut si `MOBILITY_OPERATORS` est absente — voir `../.env.example`) — même logique que `GTFS_SOURCE_URL` ci-dessus (donnée réelle plutôt qu'un jeu d'exemple).
- **Vérifié manuellement** contre le flux réel : `GET /shared-mobility-stations` renvoie 57 stations rennaises (`kind: 'station'`), compteurs `bikesAvailable`/`docksAvailable` cohérents avec `station_status`.

## Perturbations GTFS-Realtime (F3)

- `src/gtfs-realtime/` (issue #14) — abonnement + détection, standard [GTFS-Realtime](https://gtfs.org/realtime) (protobuf, bindings officiels `gtfs-realtime-bindings` maintenus par MobilityData/Google). `GtfsRealtimeClientService` télécharge et décode les flux **TripUpdate** (courses annulées, arrêts sautés) et **Alerts** (incidents, travaux, information trafic) d'un opérateur, et les traduit en `RealtimeDisruption[]` unifiées (`kind: 'cancellation' | 'skipped_stop' | 'alert'`).
- **Limite assumée, découverte en vérifiant contre le flux réel** : pas de retard chiffré en minutes. Le flux TripUpdate réel de STAR Rennes n'expose que des horaires absolus (`arrival.time`/`departure.time`), jamais le champ `delay` — calculer un delta fiable exigerait de le comparer à l'horaire théorique du GTFS statique (`stop_times.txt`), non ingéré à ce jour (voir "Ingestion GTFS statique" ci-dessus, portée volontairement limitée à `stops.txt`). La détection s'appuie donc sur des signaux sans ambiguïté — annulation de course (`trip.scheduleRelationship = CANCELED`), arrêt sauté (`stopTimeUpdate.scheduleRelationship = SKIPPED`) — et sur le texte des alertes opérateur, plutôt que d'inventer un chiffre de retard non calculable avec les données actuellement disponibles. **Impact pour l'implémentation de l'issue [#18](https://github.com/KerdanetYvan/urbanflow-mobility/issues/18)** (recalcul + notification push) : l'exemple de copie de notification `docs/specs/f3-scoring-perturbations.md` section 3.2 ("Votre bus T1 est retardé de 8 min") suppose un chiffre de retard indisponible en l'état — à reformuler autour du texte d'alerte opérateur (`headerText`) ou de la cause d'annulation/saut d'arrêt, sauf ingestion future de `stop_times.txt` pour permettre le calcul.
- `GtfsRealtimeCacheService` interroge en parallèle **chaque opérateur configuré** (`OperatorsService`, issue #15) pour ses flux TripUpdate/Alerts (chacun optionnel indépendamment) et garde le résultat en cache mémoire, tenu **par opérateur** (pas un simple tableau global) : l'échec transitoire d'un opérateur ne fait jamais perdre les données toujours à jour d'un autre. Même cadence que GBFS (`@Cron(EVERY_MINUTE)`). TripUpdate et Alerts, pour un même opérateur, restent rafraîchis et dégradés **indépendamment** (une source en panne ne prive pas l'autre, même esprit que `PlacesService`). Règle de dégradation **volontairement différente** de `GbfsCacheService` (issue #13) : le connecteur distingue explicitement un échec de récupération (`null`, cache précédent conservé pour CET opérateur/flux) d'un succès avec 0 résultat (`[]`, cache remplacé) — contrairement aux stations GBFS, une métropole *sans aucune perturbation en cours* est l'état normal et fréquent, pas un signe de panne ; traiter un tableau vide comme une panne supposée ferait perdurer indéfiniment une perturbation déjà résolue.
- `findDisruptions({ routeId?, tripId? })` — la "détection" au sens du critère d'acceptation de #14 : interroge le cache par ligne/course GTFS brute, tous opérateurs confondus. Conçue pour être appelée par un futur consommateur (#18) une fois qu'un `TripSegment` portera les identifiants GTFS bruts renvoyés par OpenTripPlanner (`route.id`/`trip.gtfsId`, pas encore mappés à ce jour — voir `OtpLeg`, `trips.service.ts`).
- **Pas de controller HTTP** : contrairement à `GbfsModule` (consommé directement par le frontend), ce module est une brique interne — `GtfsRealtimeCacheService` est exporté pour injection dans un futur module consommateur. Le déclenchement du recalcul de classement et de la notification push (dernier critère d'acceptation historique de #14, réassigné en session à #18 — voir `docs/sprints/sprint-4-plan.md`) reste hors périmètre de #14 : cette issue livre l'abonnement + la détection interrogeable, pas encore la notion de "trajet actuellement suivi" par un utilisateur (introduite par #18).
- **Source retenue par défaut** : flux réels STAR Rennes (TripUpdate + Alerts, `OperatorsService`, opérateur par défaut si `MOBILITY_OPERATORS` est absente — voir `../.env.example`) — même logique que `GTFS_SOURCE_URL` ci-dessus.
- **Vérifié manuellement** contre les flux réels : 282 arrêts sautés détectés sur le TripUpdate du moment, 54 alertes actives (dont une alerte réelle "Rénovation ascenseur - Triangle", cause `CONSTRUCTION`) correctement filtrées par `activePeriod`.

## Architecture pluggable pour un nouvel opérateur (F3, issue #15)

Formalise et généralise à plusieurs opérateurs simultanés ce que #13/#14 avaient déjà rendu générique par flux (un connecteur GBFS/GTFS-Realtime qui ne suppose rien d'un opérateur particulier, juste le standard) — jusqu'ici limité à UN SEUL opérateur configuré à la fois (une URL par variable d'environnement).

- **Interface commune** (`src/operators/interfaces/mobility-operator-config.interface.ts`) — `MobilityOperatorConfig` : `id`/`name` (identité de l'opérateur) + `gbfsDiscoveryUrl?`/`gtfsRealtimeTripUpdatesUrl?`/`gtfsRealtimeAlertsUrl?` (chaque flux optionnel indépendamment — un opérateur ne publiant que du GBFS, sans GTFS-Realtime, reste valide). `GbfsCacheService` (#13) et `GtfsRealtimeCacheService` (#14) consomment tous deux cette même forme pour savoir quels flux interroger, sans jamais coder en dur un opérateur particulier. Volontairement **pas d'URL GTFS statique** dans cette interface (voir "Hors périmètre" plus bas).
- **Configuration externalisée** (`src/operators/operators.service.ts`) — `OperatorsService#getOperators()` lit `MOBILITY_OPERATORS` (`.env`, tableau JSON conforme à `MobilityOperatorConfig`). Absente/invalide (JSON mal formé, tableau vide, aucune entrée avec `id`/`name`) → repli sur un opérateur par défaut codé en dur (flux réels de Rennes Métropole, déjà vérifiés par #13/#14) plutôt qu'une liste vide, qui viderait silencieusement la carte/la détection de perturbations. **Ajouter un opérateur = ajouter une entrée au tableau JSON, jamais modifier ce service ni les caches qui le consomment** — critère d'acceptation de #15.
- `GbfsCacheService`/`GtfsRealtimeCacheService` interrogent désormais **tous** les opérateurs publiant le flux concerné (`Array.filter` sur le champ d'URL correspondant), en parallèle, et fusionnent les résultats. Panne d'UN opérateur : les autres continuent d'être mis à jour normalement (`GtfsRealtimeCacheService` va plus loin, cache tenu **par opérateur** en interne — voir sa docstring — pour ne jamais perdre les données d'un opérateur B toujours en ligne si un opérateur A tombe en panne).
- `SharedMobilityStation` (#13) gagne `operatorId` — un `id` de station n'est garanti unique qu'au sein d'un même opérateur ; `operatorId` lève toute ambiguïté une fois plusieurs opérateurs fusionnés dans le même cache.
- **Test avec un flux opérateur fictif** (critère d'acceptation de #15) : `gbfs-cache.service.spec.ts`/`gtfs-realtime-cache.service.spec.ts` configurent un second opérateur entièrement fictif (`operateur-fictif`, aucune donnée réelle) aux côtés de STAR Rennes et vérifient la fusion, l'indépendance des pannes et le recoupement de `findDisruptions` à travers les deux opérateurs.
- **Hors périmètre, explicitement** : le GTFS **statique** (import unique dans le graphe d'OpenTripPlanner, `GtfsImportService`/`npm run import:gtfs`, issue #12) n'est PAS généralisé à plusieurs opérateurs par cette issue. Contrairement à GBFS/GTFS-Realtime (caches mémoire indépendants, simplement concaténables), faire cohabiter plusieurs flux GTFS statiques dans un même graphe OTP exigerait (1) qu'OTP charge plusieurs fichiers `.zip` au build (mode multi-feed, supporté nativement par OTP mais jamais exercé ici) ET (2) que les identifiants GTFS bruts (`route_id`/`trip_id`) conservent leur préfixe de feed à travers tout le pipeline de perturbations (`TripsService#stripOtpFeedPrefix`, issue #18 — aujourd'hui retiré volontairement puisqu'un seul feed est chargé dans OTP, un second opérateur GTFS statique casserait le recoupement de perturbations de #18 par collision d'identifiants entre opérateurs). Décision de session : risque et ampleur disproportionnés par rapport au périmètre de #15 (F3-transport, "flux GTFS/GBFS conforme" — ne mentionne pas explicitement le graphe de routage lui-même). La carte (GBFS) et la détection de perturbations (GTFS-Realtime) sont donc réellement multi-opérateurs dès aujourd'hui ; le calcul d'itinéraire (OTP) reste single-opérateur tant que #12/#18 n'auront pas été révisés dans ce sens.

## Suivi de trajet et notifications push (F3, scoring)

- `src/trips/following/` (issue #18) — le trajet actuellement suivi par un utilisateur, au plus un à la fois (`FollowedTrip`, relation `OneToOne` avec `User`, upsert au démarrage d'un nouveau suivi — même pattern que `MobilityProfile`). `POST /trips/current` démarre le suivi (nécessite un compte, voir `docs/specs/f3-scoring-perturbations-suivi.md` section 3), `GET /trips/current` le consulte, `DELETE /trips/current` l'arrête. Coordonnées/libellés chiffrés au repos (même mécanisme que `TripHistoryEntry`), `endTime`/`lastNotifiedDisruptionSignature` en clair (contrat RGPD détaillé dans `FollowedTrip`). Purge quotidienne des suivis expirés (`FollowedTripService#purgeExpired`, même mécanique que `TripHistoryService`).
- `src/push/` (issue #18) — abonnements et envoi de notifications Web Push (bibliothèque `web-push`, clés VAPID). `PushSubscription` (plusieurs par utilisateur, un par appareil) chiffrée au repos comme `FollowedTrip`. `GET /push/vapid-public-key` (public, nécessaire avant `pushManager.subscribe()` côté navigateur), `POST`/`DELETE /push/subscriptions` (authentifiés, upsert/retrait par endpoint — comparaison en mémoire après déchiffrement, une contrainte SQL `UNIQUE` est impossible sur une colonne chiffrée). Un abonnement signalé périmé par le service de push (404/410) est retiré automatiquement.
- `src/perturbations/` (issue #18) — `TripDisruptionMonitorService` assemble les briques précédentes : `@Cron(EVERY_MINUTE)` (cycle propre, indépendant de celui qui rafraîchit le cache GTFS-Realtime) qui recoupe les segments de chaque suivi actif avec `GtfsRealtimeCacheService#findDisruptions`, déclenche un recalcul (`TripsService#search`, dont le nouveau classement intègre déjà la pénalité de perturbation du `ScoringService`) et une notification push dès qu'une perturbation **nouvelle** (signature différente de la dernière notifiée) est détectée — anti-spam décrit dans la spec de cadrage section 4.
- **Portée** : le 3ᵉ critère GitHub historique de #14 (« déclenchement d'un recalcul ») est livré ici, pas dans #14 (voir `docs/sprints/sprint-4-plan.md`). Le point d'entrée UI (« Suivre ce trajet »), absent de toute spec avant cette issue, est cadré dans `docs/specs/f3-scoring-perturbations-suivi.md` (casquette PO, rédigée en session avant l'implémentation).
- **Scoring** (`src/scoring/scoring.service.ts`) — `ScoringService` est désormais aussi abonné au cache GTFS-Realtime (`GtfsRealtimeCacheService`, injecté) : un itinéraire dont au moins un segment est actuellement perturbé reçoit une pénalité fixe (`SCORING_WEIGHTS.PERTURBATION_PENALTY`, 15 points ≈ 15 min, calibrée à l'échelle de `DURATION_PER_SECOND`) et le champ `disrupted: true` (absent sinon) — critère « Perturbations GTFS-Realtime en cours » de `docs/specs/f3-scoring-perturbations.md` section 4.2, jusqu'ici non câblé.
- **`TripSegment` enrichi** (`src/trips/dto/trip-itinerary.dto.ts`) — `routeId`/`tripId` (identifiants GTFS bruts, préfixe de feed OTP retiré par `TripsService#mapLeg`/`stripOtpFeedPrefix`) exposés sur chaque segment, nécessaires au recoupement avec les perturbations GTFS-Realtime. Jamais affichés à l'usager (`routeName` reste le libellé).
- **Limite assumée** (héritée de #14, voir plus haut) : pas de retard chiffré en minutes dans la notification — texte basé sur l'alerte opérateur (`headerText`) ou une phrase générique pour une annulation/un arrêt sauté (`TripDisruptionMonitorService#buildNotificationBody`), jamais un chiffre inventé.
- **Non vérifié en conditions réelles** : `npm run migration:generate` nécessite une base Postgres vivante, indisponible dans l'environnement de cette session (pas de Docker local) — les deux migrations (`PushSubscriptions`, `FollowedTrips`) ont été écrites à la main sur le modèle des migrations existantes, avec des noms de contrainte explicites plutôt que les hash auto-générés habituels. À vérifier au premier `npm run migration:run` contre une vraie base avant déploiement. Web Push (envoi réel, abonnement navigateur, service worker côté frontend) non plus testé de bout en bout dans cette session.

## Conventions à respecter

- Endpoints REST en **pluriel, kebab-case** (`GET /trips`, `POST /reservations`).
- Services suffixés par leur rôle (`TripService`, `ReservationService`).
- Le service de scoring (partie 7.3 du dossier) est un module dédié, interrogé après chaque appel à OpenTripPlanner — poids clairs et modifiables, pas de modèle opaque.
- Authentification JWT + refresh tokens, mots de passe hachés avec bcrypt (voir annexes C et D du dossier de certification).
- Respect OWASP Top 10 sur l'ensemble des endpoints exposés.
- Le schéma est géré par des migrations TypeORM versionnées (voir section "Migrations" plus haut), pas par `synchronize` (`TYPEORM_SYNC`, voir `src/app.module.ts`) — celui-ci reste disponible comme garde-fou manuel indépendant de `NODE_ENV`, mais doit rester à `false` en usage normal pour ne pas diverger des migrations.

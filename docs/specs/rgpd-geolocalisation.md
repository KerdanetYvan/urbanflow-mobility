# RGPD — Chiffrement, rétention et purge des données de géolocalisation

> Casquette Dev BE — issue [#22](https://github.com/KerdanetYvan/urbanflow-mobility/issues/22), Sprint 3.
> S'applique à toute future colonne/donnée de géolocalisation introduite par [#11](https://github.com/KerdanetYvan/urbanflow-mobility/issues/11) (historique des trajets) et [#113](https://github.com/KerdanetYvan/urbanflow-mobility/issues/113) (adresses domicile/travail) — voir [4](#4-application-à-11113--obligations-pour-les-futures-colonnes).
> Le parcours utilisateur du droit à l'effacement (RGPD article 17) est documenté par [#164](https://github.com/KerdanetYvan/urbanflow-mobility/issues/164), section [5](#5-droit-à-leffacement-164--le-parcours-utilisateur-pas-seulement-le-mécanisme).

## 1. Constat de départ (pourquoi ce document précède toute colonne concrète)

Au moment de traiter #22 (session du 2026-08-19), **aucune donnée de géolocalisation utilisateur n'est encore persistée en base** :

- `mobility_profiles` (F1) ne contient que des tableaux de préférences (`preferred_transport_modes`, `accessibility_preferences`) — pas de coordonnées.
- Aucune table d'historique de trajets n'existe (`GET /trips` est un appel à la demande, jamais stocké côté serveur, voir `TripsService`).
- Le frontend n'a pas encore de cache local persistant des trajets (issue #11 partie FE) ni des positions géolocalisées.

Le plan de sprint anticipait ce point : #22 a été délibérément remonté avant #11 pour ne jamais ouvrir de fenêtre où des coordonnées seraient stockées sans chiffrement. Ce document construit donc le **mécanisme** (chiffrement au repos, section 2) et la **politique** (rétention/purge, section 3) par avance, pour que #11/#113 n'aient qu'à les appliquer à leurs nouvelles colonnes/caches — jamais à les concevoir eux-mêmes au moment d'introduire une donnée sensible.

## 2. Chiffrement au repos

### 2.1 Mécanisme

`backend/src/common/encryption/encrypted-column.transformer.ts` expose `createEncryptedColumnTransformer<T>()`, un [`ValueTransformer`](https://typeorm.io/entities#column-types) TypeORM générique :

- **AES-256-GCM** (chiffrement authentifié) : toute donnée altérée en base est détectée au déchiffrement (vérification du tag d'authentification), plutôt que renvoyée silencieusement corrompue.
- IV aléatoire à chaque écriture (12 octets, recommandation NIST SP 800-38D) : deux lignes portant la même coordonnée ne sont jamais distinguables en base — propriété importante pour la géolocalisation, où des valeurs répétées (ex. un même point de départ habituel) ne doivent pas être corrélables par simple comparaison du texte chiffré.
- Format de stockage auto-suffisant (`iv:authTag:ciphertext`, chacun en base64) : pas de colonne supplémentaire à prévoir pour l'IV.
- Générique (`<T>`) : fonctionne aussi bien pour un `number` (coordonnée) que pour une `string` (adresse textuelle, #113) via une sérialisation JSON interne.

### 2.2 Utilisation (pour #11/#113)

```ts
@Column({ type: 'text', transformer: createEncryptedColumnTransformer<number>() })
originLat: number;
```

- La colonne Postgres **doit** être typée `text` (le texte chiffré est une chaîne base64, pas la représentation native du type applicatif) — TypeORM applique la transformation de façon totalement transparente pour le reste du code (repositories, services), qui continue de manipuler des `number`/`string` normaux.
- Toute colonne portant une coordonnée (latitude/longitude), une adresse textuelle liée à une personne (domicile/travail) ou un point de trajet historisé doit passer par ce transformer — pas d'exception "temporaire" en clair en attendant une passe ultérieure.

### 2.3 Clé de chiffrement

- Variable d'environnement `GEOLOCATION_ENCRYPTION_KEY` (voir `.env.example`), attendue en base64, décodée en exactement 32 octets (AES-256) — génération : `openssl rand -base64 32`.
- Lue à chaque opération (pas mise en cache au chargement du module) : permet une rotation de clé sans redémarrage forcé de coordination particulière au niveau du transformer (la rotation elle-même — re-chiffrement des lignes existantes avec une nouvelle clé — reste un chantier opérationnel séparé, hors périmètre de ce document tant qu'aucune donnée réelle n'existe).
- Absente ou mal dimensionnée → erreur explicite au premier appel (`to()`/`from()`), jamais un chiffrement silencieusement affaibli.

## 3. Rétention et purge

### 3.1 Historique des trajets (#11)

- **Durée de vie** : les trajets historisés ne sont conservés que pour un usage fonctionnel direct (raccourcis de recherche rapide, #112) — pas d'archivage indéfini. Rétention proposée : **12 mois glissants**, alignée sur un usage réaliste ("mes trajets récents"), à confirmer par #11 au moment de cadrer sa table (nombre exact d'entrées conservées, ou fenêtre temporelle, selon ce qui s'avère le plus simple à interroger).
- **Purge** : suppression automatique des entrées dépassant la fenêtre de rétention — job planifié (ex. tâche cron NestJS, `@nestjs/schedule`) plutôt qu'une purge manuelle, pour ne jamais dépendre d'une intervention humaine régulière.
- **Suppression de compte** : `onDelete: 'CASCADE'` sur la relation vers `User` (même pattern que `mobility_profiles`, voir `MobilityProfile.user`) — l'historique disparaît immédiatement et entièrement avec le compte, pas de rétention résiduelle après suppression.

### 3.2 Adresses domicile/travail (#113)

- Pas de purge temporelle (une adresse domicile/travail est une donnée de profil durable, pas un historique) — seule la suppression explicite par l'utilisateur (édition du profil) ou la suppression du compte (`CASCADE`, même mécanisme que 3.1) les efface.

### 3.3 Cache local PWA

- Contrainte transverse déjà actée (`CLAUDE.md` : "durée de vie limitée du cache local côté PWA") — s'applique à tout cache local contenant des coordonnées.
- **Implémenté par [#10](https://github.com/KerdanetYvan/urbanflow-mobility/issues/10)** (pas #11, contrairement à ce que ce document anticipait — #11 a finalement porté l'historique de recherche côté backend uniquement, le cache local "mode dégradé" est une fonctionnalité distincte) : `frontend/src/lib/tripCache.ts`, `localStorage`, fenêtre de rétention de **24h** (bien plus courte que les 12 mois de 3.1 — fonction différente : résilience hors-ligne pour n'importe quel usager, pas des raccourcis de recherche pour un compte connecté), plafonné à 5 entrées, purge applicative à chaque lecture/écriture (pas de tâche de fond dédiée, `localStorage` n'ayant pas d'expiration native).
- **Pas de chiffrement au repos pour ce cache**, à la différence de 2.1/2.2 — décision documentée dans `tripCache.ts` : une clé de chiffrement embarquée dans le bundle JS livré au navigateur n'offre aucune protection réelle contre le seul "attaquant" pertinent pour du stockage local (l'utilisateur de l'appareil lui-même, ou quiconque y a déjà physiquement accès) — contrairement à une base serveur, dont un dump/backup peut fuiter indépendamment de l'utilisateur et où une clé côté serveur reste hors de portée du client. La mitigation qui compte réellement ici, et que `CLAUDE.md` cite d'ailleurs séparément du chiffrement dans la même phrase ("chiffrement au repos, ... durée de vie limitée du cache local côté PWA"), est la **minimisation** (peu d'entrées, fenêtre courte) — déjà appliquée ci-dessus.

### 3.4 Agrégation avant usage statistique

Critère d'acceptation de #22 : toute exploitation statistique future de données de géolocalisation (ex. trajets les plus recherchés à l'échelle de la métropole, dashboard interne) doit s'appuyer sur des données **agrégées** (comptages, moyennes par zone), jamais sur des coordonnées individuelles brutes déchiffrées à la volée pour l'analyse. Aucun usage statistique de ce type n'existe aujourd'hui dans le projet — ce point reste une contrainte à respecter par toute fonctionnalité qui en introduirait un, pas un mécanisme à construire maintenant.

## 4. Application à #11/#113 : obligations pour les futures colonnes

Checklist à cocher par #11 et #113 au moment d'introduire leurs colonnes de géolocalisation (chaque case couvre les deux issues — ne se coche que lorsque LES DEUX l'ont appliquée) :

- [x] Colonne typée `text`, `transformer: createEncryptedColumnTransformer<...>()` appliqué (section 2.2) — #11 fait (`TripHistoryEntry`, `backend/src/trips/history/trip-history-entry.entity.ts`, 6 colonnes chiffrées : coordonnées + libellés d'origine/destination), #113 fait (`MobilityProfile`, `backend/src/profiles/mobility-profile.entity.ts`, 6 colonnes chiffrées : `home_label`/`home_lat`/`home_lon`/`work_label`/`work_lat`/`work_lon`, migration `1787511641988-MobilityProfileHomeWork.ts`)
- [x] `GEOLOCATION_ENCRYPTION_KEY` renseignée dans l'environnement de déploiement concerné (dev, CI, prod) — absente en CI/tests, la valeur de test du fichier `.spec.ts` du transformer suffit, jamais une vraie clé de production dans un test — #11 vérifié en conditions réelles (round-trip chiffré/déchiffré contre la DB de dev), #113 vérifié de la même façon (création avec domicile complet, lecture déchiffrée via `GET /profiles/me`, colonnes confirmées chiffrées en base via `psql`)
- [x] Politique de rétention/purge définie et implémentée selon le type de donnée (section 3.1 ou 3.2) — #11 fait (`TripHistoryService#purgeExpired`, purge quotidienne automatique via `@Cron`/`@nestjs/schedule`, 12 mois glissants), #113 fait (aucune purge temporelle, conforme à la section 3.2 — donnée de profil durable, effacée uniquement par mise à jour explicite ou suppression du compte)
- [x] `onDelete: 'CASCADE'` sur toute relation vers `User` portant la donnée — #11 fait (`TripHistoryEntry.user`, `ManyToOne`, vérifié en conditions réelles), #113 fait (`MobilityProfile.user`, `OneToOne`, déjà en place avant #113 — vérifié en conditions réelles : la suppression d'un compte de test entraîne bien la suppression de son profil, domicile/travail inclus)

## 5. Droit à l'effacement (#164) : le parcours utilisateur, pas seulement le mécanisme

Les sections 3.1/3.2 documentaient déjà le **mécanisme** technique de suppression en cascade (`onDelete: 'CASCADE'`) — vérifié en conditions réelles dès #11/#113, avant même que #164 n'existe. Ce que #164 a ajouté, c'est le **moyen pour un utilisateur réel de le déclencher lui-même** (RGPD article 17) : jusqu'à cette issue, seule une suppression manuelle en base pouvait exercer ce droit, malgré un mécanisme déjà fonctionnel — constat de la revue de fin de Sprint 3 (`docs/sprints/sprint-3-retro.md`).

### 5.1 Point d'entrée

`DELETE /users/me` (`backend/src/users/users.controller.ts`), protégé par `JwtAuthGuard` — jamais un id de compte fourni par le client, toujours celui du jeton (`user.sub`), même principe IDOR que `ProfilesController` (issue #22/#68).

### 5.2 Confirmation explicite (nature destructive et irréversible)

Le mot de passe du compte est exigé dans le corps de la requête (`DeleteAccountDto`), vérifié côté **backend** (`UsersService#remove`, `bcrypt.compare`) avant toute suppression — jamais une simple confirmation côté client. Cohérent avec la contrainte posée dès la création de l'issue : "ne pas se reposer uniquement sur une boîte de dialogue côté client".

Côté frontend (`ProfilPage.tsx#AccountActions`), le bouton "Supprimer mon compte" ouvre un second état de confirmation (rappel explicite du caractère définitif + champ mot de passe) — jamais un `window.confirm()` navigateur, anti-pattern d'accessibilité pour une action de cette gravité.

**Choix du code HTTP en cas d'échec** : `403 Forbidden`, pas `401 Unauthorized`, pour un mot de passe de confirmation incorrect — décision technique notable découverte en implémentant #164. `authRequest` (`frontend/src/lib/api.ts`) interprète tout `401` comme "jeton d'accès expiré", tente automatiquement un rafraîchissement puis rejoue la requête ; en cas de nouvel échec, il efface les jetons stockés et annonce "Session expirée". Un mot de passe de confirmation erroné n'a rien à voir avec la validité du jeton — le signaler en 401 aurait fait perdre à tort sa session à un utilisateur authentifié qui s'est simplement trompé de mot de passe. `403` ne déclenche pas ce mécanisme : le message "Mot de passe incorrect" est affiché tel quel, sans effet de bord sur la session.

### 5.3 Suppression des données liées

Emportée par la cascade déjà en place et vérifiée (sections 3.1/3.2, plus `PushSubscription` et `FollowedTrip` introduits depuis par #18) : profil de mobilité, historique de trajets, trajet actuellement suivi, abonnements aux notifications push. Une seule ligne supprimée (`users`), Postgres se charge du reste dans la même transaction — pas de suppression manuelle une à une côté applicatif.

### 5.4 Invalidation des jetons

Les JWT de ce projet sont **sans état par construction** (voir `backend/src/auth/auth.service.ts`) — aucune liste de révocation n'existe, `logout()` côté frontend est déjà documenté comme "purement local" (`lib/auth.ts`). Sans changement supplémentaire, un access token déjà émis serait resté valide jusqu'à son expiration naturelle (15 min par défaut) même après suppression du compte.

`JwtStrategy.validate()` (`backend/src/auth/jwt.strategy.ts`) vérifie désormais, à **chaque requête authentifiée**, que l'utilisateur du jeton existe toujours en base — sinon `401 Unauthorized`. Compromis retenu plutôt que d'introduire une liste de révocation dédiée (portée disproportionnée pour ce projet) : un coût d'une requête DB supplémentaire par appel protégé, en échange d'une coupure d'accès immédiate après suppression plutôt qu'une attente de l'expiration du token. Le refresh token, lui, était déjà invalidé de fait : `AuthService#refresh` vérifie l'existence de l'utilisateur avant de renouveler la paire de jetons (comportement préexistant à #164, pas une nouveauté).

### 5.5 Code mort clarifié (`deleteProfile`)

`lib/profile.ts#deleteProfile()` (`DELETE /profiles/me`) restait un code mort avant #164 (aucun appelant dans l'app, cité dans le constat d'origine de l'issue) — et le reste après #164 : cette fonction supprime uniquement le *profil de mobilité* (préférences, domicile/travail), pas le compte. Ce n'est pas la même action que la suppression de compte (#164 introduit `lib/auth.ts#deleteAccount()`, `DELETE /users/me`, sans rapport avec `deleteProfile`) — les deux endpoints existent pour des besoins différents et légitimes (réinitialiser ses préférences sans perdre son compte, vs. exercer son droit à l'effacement). Décision : ne pas router `deleteProfile()` derrière un bouton pour cette issue (aucun critère d'acceptation de #164 ne demande "réinitialiser mes préférences" — ce serait une fonctionnalité distincte, hors périmètre) ; le code reste en l'état, testé, prêt à être branché le jour où un tel besoin se confirme.

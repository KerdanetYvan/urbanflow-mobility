# RGPD — Chiffrement, rétention et purge des données de géolocalisation

> Casquette Dev BE — issue [#22](https://github.com/KerdanetYvan/urbanflow-mobility/issues/22), Sprint 3.
> S'applique à toute future colonne/donnée de géolocalisation introduite par [#11](https://github.com/KerdanetYvan/urbanflow-mobility/issues/11) (historique des trajets) et [#113](https://github.com/KerdanetYvan/urbanflow-mobility/issues/113) (adresses domicile/travail) — voir [4](#4-application-à-11113--obligations-pour-les-futures-colonnes).

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

- Contrainte transverse déjà actée (`CLAUDE.md` : "durée de vie limitée du cache local côté PWA") — s'applique à tout cache local futur contenant des coordonnées (derniers trajets consultés en mode dégradé, position récente). Pas de mécanisme concret à ce jour puisque ce cache n'existe pas encore : à cadrer par l'issue qui l'introduira (probablement #11 côté FE), en respectant le même principe que 3.1 (fenêtre de rétention courte, purge automatique — `localStorage`/IndexedDB n'ont pas d'expiration native, la purge doit être gérée applicativement, ex. au démarrage du service worker).

### 3.4 Agrégation avant usage statistique

Critère d'acceptation de #22 : toute exploitation statistique future de données de géolocalisation (ex. trajets les plus recherchés à l'échelle de la métropole, dashboard interne) doit s'appuyer sur des données **agrégées** (comptages, moyennes par zone), jamais sur des coordonnées individuelles brutes déchiffrées à la volée pour l'analyse. Aucun usage statistique de ce type n'existe aujourd'hui dans le projet — ce point reste une contrainte à respecter par toute fonctionnalité qui en introduirait un, pas un mécanisme à construire maintenant.

## 4. Application à #11/#113 : obligations pour les futures colonnes

Checklist à cocher par #11 et #113 au moment d'introduire leurs colonnes de géolocalisation :

- [ ] Colonne typée `text`, `transformer: createEncryptedColumnTransformer<...>()` appliqué (section 2.2)
- [ ] `GEOLOCATION_ENCRYPTION_KEY` renseignée dans l'environnement de déploiement concerné (dev, CI, prod) — absente en CI/tests, la valeur de test du fichier `.spec.ts` du transformer suffit, jamais une vraie clé de production dans un test
- [ ] Politique de rétention/purge définie et implémentée selon le type de donnée (section 3.1 ou 3.2)
- [ ] `onDelete: 'CASCADE'` sur toute relation vers `User` portant la donnée

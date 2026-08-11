# Moteur de routage — OpenTripPlanner

OpenTripPlanner calcule les itinéraires multimodaux à partir de deux types de données à déposer dans `data/` avant le premier lancement de `docker compose up` :

1. Un **export GTFS** (statique) des réseaux de transport en commun de la métropole (`.zip`).
2. Un **extrait OpenStreetMap** de la zone couverte, au format `.osm.pbf`.

Les flux **GBFS** (vélos et trottinettes en libre-service) et **GTFS-Realtime** (perturbations) sont consommés dynamiquement par le service de scoring côté backend, pas par OTP directement au build — voir `../CLAUDE.md` et la partie 7.3 du dossier de certification.

Le dossier `data/` n'est volontairement pas versionné (voir `.gitignore`) : ces fichiers sont volumineux et propres à l'environnement de chaque développeur.

## Export GTFS réel de la métropole (F3)

Issue #12 : `backend/src/gtfs/` télécharge, valide et dépose ici le vrai export GTFS de Rennes Métropole (réseau STAR) — voir `../backend/README.md` section "Ingestion GTFS statique (F3)" pour la commande (`docker compose exec backend npm run import:gtfs`). Ce script écrit `data/gtfs-metropole.zip`, pris en compte par OTP au prochain `docker compose up otp --build` (`data/` n'étant pas versionné, cette copie doit être refaite sur chaque environnement, exactement comme la copie manuelle des fixtures ci-dessous).

## Vérification du tracé réel (`shapes.txt`, issue #90)

Une fois le vrai flux ingéré (#12), vérification faite en session que `shapes.txt` est bien présent dans l'export réel de Rennes Métropole/STAR (92 298 points, `trips.txt` référence bien `shape_id` pour chaque course) et qu'OTP l'exploite correctement pour tracer les segments de transport en commun.

**Extrait OSM réel utilisé pour la vérification** : aucun extrait OSM réel de Rennes n'était disponible dans le repo — plutôt qu'un extrait de toute la métropole (bbox réelle des 1528 arrêts : lat 47.97–48.30, lon -1.95 à -1.48, inutilement volumineux pour une vérification ciblée), extrait borné à la zone de la ligne de métro **a** (Kennedy ↔ La Poterie, bbox lat 48.075–48.13 / lon -1.73 à -1.63, calculée depuis les points de son tracé dans `shapes.txt`), récupéré via l'API Overpass et converti en `.osm.pbf` avec `osmium` (même outil que pour le fixture de test ci-dessous) :

```bash
curl "https://overpass-api.de/api/map?bbox=-1.73,48.075,-1.63,48.13" -o routing-engine/data/osm-rennes.osm
docker run --rm -v "$(pwd)/routing-engine/data:/data" ubuntu:24.04 bash -c "apt-get update -qq && apt-get install -y -qq osmium-tool && osmium cat /data/osm-rennes.osm -o /data/osm-rennes.osm.pbf --overwrite"
```

(Sous Git Bash/Windows, préfixer la commande `docker run` avec `MSYS_NO_PATHCONV=1` pour éviter que le chemin `/data` du conteneur ne soit réinterprété comme un chemin Windows.)

**Vérifié manuellement** : avec `gtfs-metropole.zip` (vrai flux, #12) + `osm-rennes.osm.pbf` dans `data/`, OTP construit le graphe sans erreur (`Graph built. |V|=46,777 |E|=116,972`, `Transit built. |Stops|=1,496 |Patterns|=347`). `GET /otp/routers/default/plan` entre J.F. Kennedy et La Poterie renvoie un segment `SUBWAY` (ligne `a`) avec un `legGeometry` de **295 points** (contre 2 pour une ligne droite) ; confirmé visuellement dans `MapView` (capture d'écran) : le tracé suit bien les rues du centre-ville de Rennes (Centre-Ville, Champ de Mars) plutôt qu'une ligne droite entre les deux arrêts. Critère d'acceptation de #90 validé, aucune modification de code nécessaire — le pipeline `OtpClientService`/`polyline.ts`/`TripsService`/`MapView` relayait déjà fidèlement tout `legGeometry` fourni par OTP (voir `backend/src/trips/trips.service.ts`, `mapGeometry`).

## Déploiement en production (issue #120)

`docker-compose.prod.yml` n'avait jamais eu de service `otp` depuis la mise en place du pipeline de déploiement (#24, Sprint 1) — retiré volontairement en attendant le vrai flux GTFS de la métropole (#12) et sa vérification (#90). Conséquence : `GET /trips` et `GET /places` étaient cassés sur le VPS, F2 (obligatoire) n'était pas démontrable en ligne. Réintroduit une fois les deux prérequis validés.

### Extrait OSM complet de la métropole

Contrairement à l'extrait borné à la ligne de métro **a** utilisé pour la vérification ciblée de #90 ci-dessus, la production a besoin d'un extrait couvrant toute la bbox des 1528 arrêts (lat 47.97–48.30, lon -1.95 à -1.48, déjà citée plus haut). Geofabrik (extrait régional Bretagne) plutôt que l'API Overpass publique, pour éviter le risque de quota/timeout déjà rencontré pour #90 :

```bash
curl -L "https://download.geofabrik.de/europe/france/bretagne-latest.osm.pbf" -o routing-engine/data/bretagne-latest.osm.pbf
docker run --rm -v "$(pwd)/routing-engine/data:/data" ubuntu:24.04 bash -c "apt-get update -qq && apt-get install -y -qq osmium-tool && osmium extract --bbox -1.95,47.97,-1.48,48.30 /data/bretagne-latest.osm.pbf -o /data/osm-metropole.osm.pbf --overwrite"
rm routing-engine/data/bretagne-latest.osm.pbf
```

(Même remarque que pour l'extrait ligne-a : sous Git Bash/Windows, préfixer `docker run` avec `MSYS_NO_PATHCONV=1` si le montage `/data` est mal interprété.)

**Vérifié manuellement (de-risking local avant déploiement)** : avec `gtfs-metropole.zip` (#12) + `osm-metropole.osm.pbf` dans `data/`, OTP construit le graphe complet en 36s (`Graph built. |V|=157,499 |E|=410,038`, `Transit built. |Stops|=1,496 |Patterns|=347`) et le sert sans erreur. Pic mémoire mesuré via `docker stats` pendant le build et une fois stabilisé : **2,79 Go**, très en dessous du budget du VPS-2 cible (8 Go, partagés avec `postgres`/`postfix`/`backend`) — pas besoin de contraindre le heap JVM (`JAVA_TOOL_OPTIONS=-Xmx...`, supporté par l'image si un jour nécessaire). `GET /otp/routers/default/plan` entre J.F. Kennedy et La Poterie renvoie bien un segment `SUBWAY` sur la ligne `a`, cette fois depuis le graphe métropolitain complet (pas l'extrait borné de #90).

### Runbook de bootstrap initial (premier déploiement avec données réelles)

`routing-engine/data/` n'est pas versionné (voir plus haut) : le déploiement continu (`git reset --hard` + rebuild, voir `.github/workflows/ci.yml`) ne le peuple pas automatiquement. Séquence à exécuter une fois sur le VPS après le premier déploiement de ce changement :

1. Le déploiement normal (push sur `main`) crée le conteneur `otp` mais il démarre avec un dossier `data/` vide.
2. Régénérer le vrai export GTFS directement sur le VPS (pas de transfert manuel nécessaire, le script télécharge `GTFS_SOURCE_URL`) :

   ```bash
   docker compose -f docker-compose.prod.yml exec backend npm run import:gtfs
   ```

3. Transférer l'extrait OSM métropolitain préparé localement (étape ci-dessus) vers le VPS — aucun mécanisme existant ne le fait automatiquement (fichier non versionné, pas de service d'ingestion OSM côté backend) :

   ```bash
   scp routing-engine/data/osm-metropole.osm.pbf <user>@<vps-host>:/home/ubuntu/app/routing-engine/data/
   ```

4. Reconstruire le graphe avec les deux fichiers en place :

   ```bash
   docker compose -f docker-compose.prod.yml up -d otp --build
   ```

5. Vérifier `GET /trips` et `GET /places` via le domaine public (Caddy → backend → `otp` interne).

### Rafraîchissement futur des données

- **GTFS** : réexécuter `docker compose -f docker-compose.prod.yml exec backend npm run import:gtfs` sur le VPS (idempotent, voir `backend/README.md`) puis relancer `otp` avec `--build` pour recharger le graphe.
- **OSM** : à refaire seulement si le réseau routier évolue significativement ou si la bbox de la métropole change — répéter l'extraction Geofabrik+osmium ci-dessus et retransférer le fichier par `scp` avant de relancer `otp --build`.

## Jeu de données de test (développement local)

Issue #40 : `test-fixtures/` fournit un **petit réseau synthétique versionné**, utile pour développer/démontrer sans dépendre du réseau (le script d'import ci-dessus sait lire ce fichier via `GTFS_LOCAL_PATH` au lieu de télécharger le vrai flux) ou pour tester OTP sans passer par le script d'import :

- `test-fixtures/gtfs-test.zip` — 4 arrêts (`A` Place Centrale, `B` Gare Test, `C` Université, `D` Hôpital, ~1,3 km entre arrêts adjacents), une ligne de bus fictive (`T1`) qui boucle entre eux, 3 départs par jour (8h, 12h, 18h). Généré à la main (pas un export réel) — voir `backend/src/seed/seed.ts` pour le jeu de comptes utilisateur correspondant.
- `test-fixtures/osm-extract.osm.pbf` — une seule rue en boucle qui passe par les 4 arrêts, suffisante pour qu'OTP construise un graphe piéton/vélo/voiture et calcule de vrais itinéraires porte-à-porte entre eux. Coordonnées purement fictives (aucune rue réelle). Généré depuis `test-fixtures/osm-extract-source.osm` (XML lisible, à éditer en cas de besoin), au format binaire `.osm.pbf` attendu par OTP :

  ```bash
  # Necessite osmium-tool - via un conteneur jetable si non installe localement :
  docker run --rm -v "$(pwd)/routing-engine/test-fixtures:/data" ubuntu:24.04 bash -c "apt-get update -qq && apt-get install -y -qq osmium-tool && osmium cat /data/osm-extract-source.osm -o /data/osm-extract.osm.pbf --overwrite"
  ```

  (Un fichier `.osm`/`.osm.xml` en clair ne suffit pas : OTP 2.5 attend le format binaire PBF quel que soit le nom de fichier fourni, y compris pour de tout petits extraits comme celui-ci.)

Contrairement à `data/`, `test-fixtures/` **est versionné** : les fichiers sont volontairement minuscules (quelques Ko), donc sans le problème de poids qui justifie de ne pas versionner `data/`.

**Utilisation** : copier **seulement ces deux fichiers** (jamais `osm-extract-source.osm`) dans `data/` avant `docker compose up` :

```bash
cp routing-engine/test-fixtures/gtfs-test.zip routing-engine/data/
cp routing-engine/test-fixtures/osm-extract.osm.pbf routing-engine/data/
```

⚠️ **Piège vécu** : si `osm-extract-source.osm` (le XML source, pas destiné à `data/`) se retrouve copié dans `data/` à côté du `.pbf`, OTP scanne le dossier, détecte les deux comme des sources OSM valides d'après leur extension, et peut choisir de charger le mauvais fichier (le XML brut) en tentant de le parser comme un binaire PBF — il plante alors en boucle de redémarrage avec `FileFormatException: Unexpectedly long header ... Possibly corrupt file` dans ses logs (`docker logs <container_otp>`). Si ça arrive, supprimer `osm-extract-source.osm` de `data/` (il n'a rien à y faire) et relancer OTP.

**Vérifié manuellement** (build du graphe + requête réelle) : avec ces deux fichiers, OTP construit le graphe sans erreur (`Graph built. |V|=11 |E|=22`, `Transit built. |Stops|=4 |Patterns|=1`) et répond correctement à une planification d'itinéraire — ex. `Place Centrale → Université` à 8h retourne un trajet en bus de 10 minutes sur la ligne `T1`, en plus de l'option à pied.

Distance volontairement pas trop courte entre arrêts adjacents (~1,3 km) : en dessous d'un certain seuil, OTP juge la marche "triviale" et ne propose jamais le bus dans les résultats — inutile pour tester un vrai scénario multimodal.

**Limitation propre à ce jeu de test : le tracé du bus `T1` s'affiche en ligne droite sur la carte (`MapView` côté frontend).** OpenTripPlanner ne peut fournir un tracé détaillé (`legGeometry`) suivant la route réellement empruntée par une ligne de transport en commun que si le GTFS source contient un fichier `shapes.txt` (forme précise du tracé) - `gtfs-test.zip` n'en fournit volontairement pas, pour rester minimal. Un segment à pied, lui, suit bien le réseau OSM (l'unique rue en boucle de ce fixture) : la limitation ne touche que les segments de transport en commun de ce jeu de données de test, **pas** le vrai flux de la métropole (`shapes.txt` réel confirmé exploité correctement, voir section "Vérification du tracé réel" ci-dessus, issue #90).

## Géocodeur (autocomplétion, issue #81)

`otp-config.json` (versionné, à la racine de `routing-engine/`, **pas** dans `data/`) active `SandboxAPIGeocoder`, une fonctionnalité d'OTP **désactivée par défaut** — sans lui, `GET {OTP_URL}/geocode` renvoie 404. `docker-compose.yml` le monte directement dans le conteneur (`/var/opentripplanner/otp-config.json`), donc rien à copier manuellement, contrairement aux fichiers de `data/`.

Le géocodeur indexe les noms d'arrêts/rues déjà chargés dans le graphe et fait du filtrage par **préfixe** (ex. `query=Uni` trouve "Université", mais une lettre isolée qui n'est pas en début de nom ne matche rien). Suffisant pour retrouver les 4 arrêts fictifs du jeu de données de test.

**Vérifié manuellement** : `GET {OTP_URL}/geocode?query=Gare` renvoie `[{"lat":48.119,"lng":-1.674,"description":"Gare Test","id":"1:B"}]` ; une requête sans correspondance renvoie `[]`.

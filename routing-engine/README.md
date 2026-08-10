# Moteur de routage — OpenTripPlanner

OpenTripPlanner calcule les itinéraires multimodaux à partir de deux types de données à déposer dans `data/` avant le premier lancement de `docker compose up` :

1. Un **export GTFS** (statique) des réseaux de transport en commun de la métropole (`.zip`).
2. Un **extrait OpenStreetMap** de la zone couverte, au format `.osm.pbf`.

Les flux **GBFS** (vélos et trottinettes en libre-service) et **GTFS-Realtime** (perturbations) sont consommés dynamiquement par le service de scoring côté backend, pas par OTP directement au build — voir `../CLAUDE.md` et la partie 7.3 du dossier de certification.

Le dossier `data/` n'est volontairement pas versionné (voir `.gitignore`) : ces fichiers sont volumineux et propres à l'environnement de chaque développeur.

## Export GTFS réel de la métropole (F3)

Issue #12 : `backend/src/gtfs/` télécharge, valide et dépose ici le vrai export GTFS de Rennes Métropole (réseau STAR) — voir `../backend/README.md` section "Ingestion GTFS statique (F3)" pour la commande (`docker compose exec backend npm run import:gtfs`). Ce script écrit `data/gtfs-metropole.zip`, pris en compte par OTP au prochain `docker compose up otp --build` (`data/` n'étant pas versionné, cette copie doit être refaite sur chaque environnement, exactement comme la copie manuelle des fixtures ci-dessous).

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

**Limitation connue : le tracé du bus `T1` s'affiche en ligne droite sur la carte (issue #8, `MapView` côté frontend).** OpenTripPlanner ne peut fournir un tracé détaillé (`legGeometry`) suivant la route réellement empruntée par une ligne de transport en commun que si le GTFS source contient un fichier `shapes.txt` (forme précise du tracé) - `gtfs-test.zip` n'en fournit volontairement pas, pour rester minimal. Un segment à pied, lui, suit bien le réseau OSM (l'unique rue en boucle de ce fixture) : la limitation ne touche que les segments de transport en commun de ce jeu de données de test. Voir l'issue [#90](https://github.com/KerdanetYvan/urbanflow-mobility/issues/90) pour la vérification à faire une fois le vrai export GTFS de la métropole chargé (`shapes.txt` réel, section "Export GTFS réel de la métropole" ci-dessus).

## Géocodeur (autocomplétion, issue #81)

`otp-config.json` (versionné, à la racine de `routing-engine/`, **pas** dans `data/`) active `SandboxAPIGeocoder`, une fonctionnalité d'OTP **désactivée par défaut** — sans lui, `GET {OTP_URL}/geocode` renvoie 404. `docker-compose.yml` le monte directement dans le conteneur (`/var/opentripplanner/otp-config.json`), donc rien à copier manuellement, contrairement aux fichiers de `data/`.

Le géocodeur indexe les noms d'arrêts/rues déjà chargés dans le graphe et fait du filtrage par **préfixe** (ex. `query=Uni` trouve "Université", mais une lettre isolée qui n'est pas en début de nom ne matche rien). Suffisant pour retrouver les 4 arrêts fictifs du jeu de données de test.

**Vérifié manuellement** : `GET {OTP_URL}/geocode?query=Gare` renvoie `[{"lat":48.119,"lng":-1.674,"description":"Gare Test","id":"1:B"}]` ; une requête sans correspondance renvoie `[]`.

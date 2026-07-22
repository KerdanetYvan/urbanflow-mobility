# Moteur de routage — OpenTripPlanner

OpenTripPlanner calcule les itinéraires multimodaux à partir de deux types de données à déposer dans `data/` avant le premier lancement de `docker compose up` :

1. Un **export GTFS** (statique) des réseaux de transport en commun de la métropole (`.zip`).
2. Un **extrait OpenStreetMap** de la zone couverte, au format `.osm.pbf`.

Les flux **GBFS** (vélos et trottinettes en libre-service) et **GTFS-Realtime** (perturbations) sont consommés dynamiquement par le service de scoring côté backend, pas par OTP directement au build — voir `../CLAUDE.md` et la partie 7.3 du dossier de certification.

Le dossier `data/` n'est volontairement pas versionné (voir `.gitignore`) : ces fichiers sont volumineux et propres à l'environnement de chaque développeur.

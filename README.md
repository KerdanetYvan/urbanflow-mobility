# UrbanFlow Mobility

Plateforme de mobilité urbaine intelligente — planification d'itinéraires multimodaux, profils de mobilité personnalisés, et classement des trajets en temps réel selon la météo, les perturbations et les préférences de l'usager.

Projet réalisé dans le cadre du Titre 6 Concepteur Développeur de Solutions Digitales (RNCP 36146). Le dossier de certification complet, avec l'ensemble des choix argumentés, se trouve dans le dossier parent (`UrbanFlow_Mobility_Dossier.md`).

## Stack

- **Frontend** : React + Vite, PWA (Workbox)
- **Backend** : NestJS (Node.js / TypeScript)
- **Base de données** : PostgreSQL + PostGIS
- **Moteur de routage** : OpenTripPlanner
- **Orchestration locale** : Docker Compose

## Structure du projet

```
UrbanFlow_Mobility/
├── frontend/          # PWA React (Vite)
├── backend/           # API REST NestJS
├── routing-engine/    # Configuration OpenTripPlanner + données GTFS/GBFS
├── docker/            # Dockerfiles
├── docker-compose.yml
├── .env.example
└── CLAUDE.md          # Contexte technique condensé (stack, conventions, contraintes)
```

## Démarrage

1. Copier `.env.example` vers `.env` et compléter les valeurs (secrets, clés API).
2. Déposer les données de transport dans `routing-engine/data/` (export GTFS de la métropole + extrait OpenStreetMap au format `.osm.pbf`).
3. Lancer l'environnement :

```
docker compose up --build
```

Le frontend, le backend, OpenTripPlanner et la base de données démarrent ensemble. Voir `CLAUDE.md` pour le détail des choix d'architecture et des conventions de code à respecter.

## État actuel

Cette arborescence est un point de départ : structure, configuration Docker et contexte de projet sont en place, mais le code applicatif (frontend et backend) reste à écrire.

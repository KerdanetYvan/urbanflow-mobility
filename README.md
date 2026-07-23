# UrbanFlow Mobility

[![CI](https://github.com/KerdanetYvan/urbanflow-mobility/actions/workflows/ci.yml/badge.svg)](https://github.com/KerdanetYvan/urbanflow-mobility/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Plateforme de mobilité urbaine intelligente — planification d'itinéraires multimodaux, profils de mobilité personnalisés, et classement des trajets en temps réel selon la météo, les perturbations et les préférences de l'usager.

Projet réalisé dans le cadre du Titre 6 Concepteur Développeur de Solutions Digitales (RNCP 36146). Le dossier de certification complet, avec l'ensemble des choix argumentés, se trouve dans le dossier parent (`UrbanFlow_Mobility_Dossier.md`).

## Suivi du projet

- [GitHub Project (Kanban, sprints, milestones)](https://github.com/users/KerdanetYvan/projects/1)
- [Issues](https://github.com/KerdanetYvan/urbanflow-mobility/issues)
- [CONTRIBUTING.md](CONTRIBUTING.md) — workflow Git, convention de commits, checklist de PR

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

### Démarrage partiel en développement

Tant que le frontend et/ou les données GTFS/OSM ne sont pas encore en place, on peut démarrer uniquement les services déjà prêts, par exemple :

```bash
docker compose up --build postgres backend
```

Le service `otp` redémarrera en boucle tant que `routing-engine/data/` ne contient pas d'export GTFS et d'extrait `.osm.pbf` valides — c'est attendu, ça ne bloque pas le backend ni la base de données.

## État actuel

Backend NestJS initialisé et connecté à PostgreSQL/PostGIS (validé via `docker compose up postgres backend`). Frontend encore à initialiser. Voir le [GitHub Project](https://github.com/users/KerdanetYvan/projects/1) pour l'avancement détaillé.

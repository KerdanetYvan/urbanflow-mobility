# UrbanFlow Mobility

[![CI](https://github.com/KerdanetYvan/urbanflow-mobility/actions/workflows/ci.yml/badge.svg)](https://github.com/KerdanetYvan/urbanflow-mobility/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Plateforme de mobilité urbaine intelligente — planification d'itinéraires multimodaux, profils de mobilité personnalisés, et classement des trajets en temps réel selon la météo, les perturbations et les préférences de l'usager.

Projet réalisé dans le cadre du Titre 6 Concepteur Développeur de Solutions Digitales (RNCP 36146). Le dossier de certification complet, avec l'ensemble des choix argumentés, se trouve dans le dossier parent (`UrbanFlow_Mobility_Dossier.md`).

## Suivi du projet

- [GitHub Project (Kanban, sprints, milestones)](https://github.com/users/KerdanetYvan/projects/1)
- [Issues](https://github.com/KerdanetYvan/urbanflow-mobility/issues)
- [CONTRIBUTING.md](CONTRIBUTING.md) — workflow Git, convention de commits, checklist de PR
- [DEFINITION_OF_DONE.md](DEFINITION_OF_DONE.md) — critères communs à toute issue considérée comme terminée

## Stack

- **Frontend** : React + Vite, PWA (Workbox)
- **Backend** : NestJS (Node.js / TypeScript)
- **Base de données** : PostgreSQL + PostGIS
- **Moteur de routage** : OpenTripPlanner
- **Orchestration locale** : Docker Compose

## Structure du projet

```text
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
2. Déposer les données de transport dans `routing-engine/data/` (export GTFS de la métropole + extrait OpenStreetMap au format `.osm.pbf`) — **ou**, pour un développement local sans dépendre des vraies données, copier le petit jeu de test versionné (`routing-engine/test-fixtures/`, voir `routing-engine/README.md`).
3. Lancer l'environnement :

```bash
docker compose up --build
```

Le frontend, le backend, OpenTripPlanner et la base de données démarrent ensemble. Voir `CLAUDE.md` pour le détail des choix d'architecture et des conventions de code à respecter.

Optionnel : peupler la base avec un jeu de comptes de test (issue #40, voir `backend/README.md` pour le détail des comptes créés) :

```bash
docker compose exec backend npm run seed
```

`docker compose up --build` a été validé avec les 4 services (postgres, otp, backend, frontend). Le service `otp` redémarrera en boucle tant que `routing-engine/data/` ne contient pas d'export GTFS et d'extrait `.osm.pbf` valides — c'est attendu et sans impact sur le reste de la stack ; ça sera résolu par le ticket d'ingestion GTFS (F3).

### Démarrage partiel en développement

Pour ne pas voir `otp` redémarrer en boucle tant que ses données ne sont pas prêtes, on peut démarrer uniquement les autres services :

```bash
docker compose up --build postgres backend frontend
```

### Le rechargement à chaud ne se déclenche pas après une modification

Sur Windows, les événements de changement de fichier ne remontent pas toujours de manière fiable à travers un bind mount Docker jusqu'au mode `--watch` de NestJS/Vite. Si le comportement observé ne correspond pas au code modifié, redémarrer le service concerné avant de chercher plus loin :

```bash
docker compose restart backend
```

## Hook de pre-commit (lint)

Un hook Husky + lint-staged (issue #269) lance ESLint (`--fix`) sur les seuls fichiers `.ts`/`.tsx` stagés de `frontend/` et `backend/` à chaque `git commit` — installé automatiquement via `npm install` à la racine (script `prepare`). Un commit contenant une erreur de lint non auto-corrigeable est bloqué avant même d'atteindre la CI.

En cas d'urgence (le hook bloque à tort, ou une correction doit être commitée telle quelle) : `git commit --no-verify` saute le hook local — la CI (`.github/workflows/ci.yml`) reste le filet de sécurité final, elle relance le même lint sur l'ensemble du projet à chaque push.

## Déploiement (production)

La solution est en ligne : **[urbanflow-mobility.kerdanetyvan.dev](https://urbanflow-mobility.kerdanetyvan.dev)**

- Hébergement : VPS OVHcloud (VPS-2, 4 vCPU / 8 Go, Ubuntu 26.04 LTS) — choix argumenté dans le dossier de certification (hébergement UE, RGPD).
- Accès SSH par clé uniquement (mot de passe désactivé), `ufw` (22/80/443 seulement) + `fail2ban` actifs.
- **Caddy** en reverse proxy sur l'hôte : HTTPS automatique (Let's Encrypt), sert le build statique du frontend (`/var/www/urbanflow-frontend`) et route `/api/*` vers le conteneur backend.
- `docker-compose.prod.yml` : `postgres` + `backend` + `postfix` (le frontend est servi en statique par Caddy, pas besoin de conteneur ; `otp` sera réintroduit avec les vraies données GTFS, F3). Le port du backend est lié à `127.0.0.1` uniquement — Docker contourne `ufw` pour les ports publiés, donc seul Caddy (sur l'hôte) peut atteindre le conteneur.
- Backend construit via `docker/backend.prod.Dockerfile` (multi-étapes : build TypeScript puis image finale sans devDependencies).
- `TYPEORM_SYNC=false` en production : le schéma est géré par les migrations TypeORM, lancées automatiquement au démarrage du conteneur backend (`npm run migration:run:prod`, voir `backend/README.md`).
- **`postfix`** (issue #70, réinitialisation de mot de passe par email) : relai SMTP sortant auto-hébergé (image `boky/postfix`), pas de SaaS externe pour ne pas dépendre d'un quota d'envoi tiers — voir `backend/README.md`. Étape manuelle **restant à faire côté DNS** (non couverte par le déploiement automatisé) : publier chez le registrar du domaine un enregistrement SPF, la clé publique DKIM générée par le conteneur (`DKIM_AUTOGENERATE=1`, volume `dkim_keys`), et configurer le rDNS/PTR de l'IP du VPS auprès d'OVHcloud — sans ces trois éléments, les emails partiront mais atterriront probablement en spam.

## État actuel

Backend NestJS et frontend Vite/React initialisés, orchestration Docker Compose validée de bout en bout (backend connecté à PostgreSQL/PostGIS, frontend accessible). Solution déployée en continu. Voir le [GitHub Project](https://github.com/users/KerdanetYvan/projects/1) pour l'avancement détaillé.

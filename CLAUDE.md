# UrbanFlow Mobility — Contexte projet

Ce fichier condense les décisions déjà actées dans le dossier de certification (Titre 6 CDSD, RNCP 36146). Il sert de contexte de démarrage pour le développement — pas la peine de redemander l'architecture ou les conventions, elles sont figées ci-dessous sauf indication contraire de l'utilisateur.

## Le projet

Plateforme de mobilité urbaine intelligente pour une métropole de 500 000 habitants : planification d'itinéraires multimodaux (transports en commun, vélos/trottinettes en libre-service, covoiturage), avec classement personnalisé des trajets et alertes en temps réel.

## Stack technique retenue

| Brique | Choix | Détail |
|---|---|---|
| Frontend | React + Vite, PWA (Workbox pour le service worker) | SPA découplée du backend |
| Backend | NestJS (Node.js / TypeScript) | API REST |
| Base de données | PostgreSQL + extension PostGIS | Données géospatiales natives |
| Moteur de routage | OpenTripPlanner | Calcul d'itinéraires à partir de flux GTFS / GBFS |
| Authentification | JWT avec refresh tokens, mots de passe hachés bcrypt | — |
| Hébergement cible | Scaleway ou OVHcloud | Contrainte RGPD + éco-conception (hébergement UE) |

Architecture : frontend SPA et backend API REST strictement séparés (pas de framework full-stack intégré), pour permettre une évolutivité indépendante des deux couches et la réutilisation future de l'API par d'autres canaux (mobile natif, partenaires).

## Fonctionnalités obligatoires (F1 à F3)

1. **F1 — Comptes et profils** : inscription, connexion, gestion d'un profil de mobilité (préférences de transport, contraintes d'accessibilité comme l'évitement des escaliers).
2. **F2 — Planification d'itinéraires** : recherche multimodale, géolocalisation en temps réel, affichage cartographique.
3. **F3 — Intégration transport** : connexion aux flux GTFS et GBFS des opérateurs de la métropole.

## Fonctionnalité complémentaire retenue : scoring d'itinéraires

OpenTripPlanner reste responsable du calcul des itinéraires possibles. Un service de scoring backend (NestJS) vient ensuite classer ces itinéraires selon plusieurs critères pondérés (temps de trajet, nombre de correspondances, météo en cours, perturbations GTFS-Realtime, préférences du profil de mobilité) — un système de poids clairs et modifiables, pas un modèle de ML opaque.

Flux : `OpenTripPlanner → Service de scoring (+ API météo, + GTFS-Realtime, + Profil de mobilité) → Itinéraires classés → PWA`.

Un abonnement aux mises à jour GTFS-Realtime permet de détecter une perturbation en cours de trajet et de déclencher un recalcul + notification push.

## Conventions de nommage

| Élément | Convention | Exemple |
|---|---|---|
| Endpoints API REST | Pluriel, kebab-case, verbes HTTP standards | `GET /trips`, `POST /reservations` |
| Tables de base de données | Pluriel, snake_case | `users`, `trip_segments`, `mobility_profiles` |
| Composants React | PascalCase | `TripPlanner`, `MobilityDashboard` |
| Services NestJS | Suffixe explicite du rôle | `TripService`, `ReservationService` |

## Documentation du code

Contrairement à la pratique par défaut de Claude Code (commenter seulement le non-évident), ce projet demande de **commenter un maximum** — c'est un projet pédagogique de certification, relu et noté, où la lisibilité et la pédagogie du code priment sur la concision :

- Commentaires de ligne sur les portions de logique non triviales, même quand le code est déjà lisible par lui-même.
- Commentaire au-dessus de chaque fonction/méthode expliquant ce qu'elle fait, ses paramètres et ce qu'elle retourne.
- Docstrings/JSDoc sur les fonctions et classes exportées (services, contrôleurs, composants).
- Cette règle s'applique à tout code écrit dans ce projet (backend, frontend, scripts), et prévaut sur l'instruction par défaut de sobriété en commentaires.

## Contraintes transverses à respecter dans le code

- **PWA** : manifest, service worker, installable sans store.
- **Responsive / UX** : utilisable sur mobile en priorité (usage en mobilité).
- **Sécurité — OWASP** : suivre les recommandations OWASP Top 10 sur l'API.
- **Éco-conception** : limiter les appels réseau superflus, chargement progressif des données.
- **Géolocalisation** : précision et fiabilité des données de position et d'itinéraires.
- **Accessibilité — WCAG 2.1 AA** : composants React accessibles (rôles ARIA, contraste, navigation clavier).
- **RGPD** : les données de géolocalisation sont sensibles — chiffrement au repos, agrégation avant tout usage statistique, durée de vie limitée du cache local côté PWA.
- **Interopérabilité** : nouveaux opérateurs de mobilité intégrables par simple ajout d'un flux GTFS/GBFS conforme, sans modification du code applicatif.
- **Performances** : fonctionnement correct en connectivité variable (mode dégradé, cache des derniers trajets utiles).
- **Sécurité des données sensibles** : accès à la base restreint aux services qui en ont besoin, séparation des rôles.

## Méthodologie

Sprints de 2 semaines (approche Agile inspirée de Scrum), chacun terminé par une revue fonctionnelle et une rétrospective. Projet mené individuellement — les rôles (Product Owner, Dev Frontend, Dev Backend, QA) sont tous portés par la même personne mais restent distingués pour clarifier sous quelle casquette une décision est prise.

## Outils

Git/GitHub, GitHub Projects (Kanban), GitHub Actions (CI : tests + lint à chaque push), Jest (tests unitaires), Postman (tests API), Figma (maquettes).

## Suivi du GitHub Project (Kanban)

Repo : `KerdanetYvan/urbanflow-mobility`. Project : [UrbanFlow Mobility](https://github.com/users/KerdanetYvan/projects/1) (project number 1, owner `KerdanetYvan`).

Deux champs distincts sur le board, à ne pas confondre :

- **Milestone** = à quel sprint la tâche est planifiée (Sprint 1/2/3, ou Stretch (post-MVP)).
- **Status** = où elle en est dans le flux (Backlog → Sprint courant → In Progress → Review/QA → Done).

Quand on travaille sur une issue en session, Claude Code doit tenir le Status à jour sans attendre qu'on le demande :

- Passer l'issue en **In Progress** dès qu'on commence à coder dessus.
- Passer l'issue en **Review/QA** dès qu'une PR liée est ouverte.
- Le passage en **Done** est géré par les workflows natifs du Project une fois activés côté UI (`Project → ⋯ → Workflows` : "Item closed" et "Pull request merged" → Status = Done) — l'API GitHub ne permet pas de configurer ces workflows par commande, seulement de les activer manuellement dans l'interface.

Commande utilisée pour modifier le Status d'un item (`gh` CLI, PowerShell) :

```bash
gh project item-edit --project-id "PVT_kwHOCjZVkc4BeKov" --id "<ITEM_ID>" --field-id "PVTSSF_lAHOCjZVkc4BeKovzhYm3is" --single-select-option-id "<OPTION_ID>"
```

Options du champ Status : Backlog `6a1fdd2b`, Sprint courant `a800da72`, In Progress `f47b8a18`, Review/QA `e4233821`, Done `46c90389`. L'ID d'item d'une issue s'obtient via `gh project item-list 1 --owner KerdanetYvan --format json`.

## Ce que ce dossier ne couvre pas encore

- Docker n'était pas un choix acté dans le dossier de certification — c'est un ajout pour l'environnement de dev local, pas une exigence du cahier des charges.
- Aucun code métier n'a encore été écrit : cette arborescence est un point de départ, pas une implémentation.

## Pour aller plus loin

Le dossier de certification complet (`UrbanFlow_Mobility_Dossier.md`, dossier parent) contient le détail argumenté de chaque choix : benchmarks technologiques (partie 3), diagrammes UML (partie 8), démarche qualité (partie 6), gestion des bogues (partie 9). À consulter si une décision semble ambiguë ou si une justification est nécessaire pour la soutenance.

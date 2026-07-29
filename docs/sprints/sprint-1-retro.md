# Compte-rendu — Sprint 1

> Casquette PO — issue [#28](https://github.com/KerdanetYvan/urbanflow-mobility/issues/28), fin de Sprint 1 (échéance 2026-08-04).

## 1. Résumé

**18/19 issues fermées, 6 jours d'avance sur l'échéance.** Aucun report nécessaire, aucun ticket à re-scoper en catastrophe. Seul le présent ticket (#28, revue de fin de sprint) restait ouvert.

## 2. Chronologie

**23/07 — Fondations**

- [#1](https://github.com/KerdanetYvan/urbanflow-mobility/issues/1) Initialiser le projet NestJS (`backend/`)
- [#2](https://github.com/KerdanetYvan/urbanflow-mobility/issues/2) Initialiser le projet Vite + React (`frontend/`)
- [#5](https://github.com/KerdanetYvan/urbanflow-mobility/issues/5) Environnement Docker Compose local
- [#27](https://github.com/KerdanetYvan/urbanflow-mobility/issues/27) Definition of Done du projet
- [#39](https://github.com/KerdanetYvan/urbanflow-mobility/issues/39) Logging et gestion centralisée des erreurs (backend)
- [#29](https://github.com/KerdanetYvan/urbanflow-mobility/issues/29) Configuration des tests backend (Jest)
- [#30](https://github.com/KerdanetYvan/urbanflow-mobility/issues/30) Configuration des tests frontend

**27-28/07 — F1 (comptes/profils), charte graphique, déploiement**

- [#37](https://github.com/KerdanetYvan/urbanflow-mobility/issues/37) Navigation générale et layout de l'application
- [#52](https://github.com/KerdanetYvan/urbanflow-mobility/issues/52) Charte graphique (identité visuelle)
- [#3](https://github.com/KerdanetYvan/urbanflow-mobility/issues/3) / [#33](https://github.com/KerdanetYvan/urbanflow-mobility/issues/33) Inscription-connexion (JWT) — back + écran
- [#24](https://github.com/KerdanetYvan/urbanflow-mobility/issues/24) Pipeline de déploiement (OVHcloud) — solution en ligne en continu depuis ce point
- [#4](https://github.com/KerdanetYvan/urbanflow-mobility/issues/4) / [#34](https://github.com/KerdanetYvan/urbanflow-mobility/issues/34) Gestion du profil de mobilité — back + écran

**29/07 — Clôture de sprint**

- [#25](https://github.com/KerdanetYvan/urbanflow-mobility/issues/25) Specs détaillées des écrans F2 (recherche, résultats, carte)
- [#59](https://github.com/KerdanetYvan/urbanflow-mobility/issues/59) Automatisation du passage en Review/QA à l'ouverture d'une PR liée
- [#19](https://github.com/KerdanetYvan/urbanflow-mobility/issues/19) PWA installable (manifest, service worker, icône)
- [#40](https://github.com/KerdanetYvan/urbanflow-mobility/issues/40) Jeu de données de test (seed) — comptes + GTFS/OSM de test

## 3. Revue fonctionnelle (relecture manuelle, 2026-07-30)

Relecture manuelle du site déployé (inscription/connexion, profil de mobilité, navigation) et de l'icône PWA installée. Constats :

- La connexion/déconnexion fonctionne, mais l'écran de connexion reste accessible une fois connecté, et aucun bouton de déconnexion n'existe sur le profil (qui, de plus, s'affichait sans authentification valide).
- Les préférences de transport en commun sont trop génériques (un seul mode `public_transport`, sans distinguer bus/métro/tram/train — pourtant gérés par des opérateurs différents).
- Le champ d'accessibilité (`reducedMobility`) regroupe des besoins très différents sous une seule case — contraire à l'intention posée dès le départ (voir [#4](https://github.com/KerdanetYvan/urbanflow-mobility/issues/4)/[#34](https://github.com/KerdanetYvan/urbanflow-mobility/issues/34)) de préférences actionnables plutôt qu'une case fourre-tout.
- Pas de mécanisme de mot de passe oublié.
- La navigation affiche tous les onglets sans condition (y compris "Résultats" comme onglet permanent, et "Historique" sans être connecté), alors que "Résultats" doit être l'issue d'une recherche, pas un onglet indépendant, et que l'app doit être utilisable sans compte (page d'accueil = recherche).
- La disposition est identique mobile/desktop (pas de vraie déclinaison desktop), et plusieurs écrans restent peu habillés visuellement.

## 4. Décisions de reprocessus

- **Sprint 2 démarré en avance**, sans modifier les dates de milestone (04/08 → 18/08 inchangées) : le rythme des sprints reste un repère stable, seul le *statut* des tickets avance plus tôt que prévu.
- **10 nouvelles issues** créées suite à la revue fonctionnelle ci-dessus et ajoutées au backlog Sprint 2 : [#64](https://github.com/KerdanetYvan/urbanflow-mobility/issues/64)–[#73](https://github.com/KerdanetYvan/urbanflow-mobility/issues/73) (navigation conditionnelle, déconnexion/garde d'authentification, granularité des modes de transport en commun, préférences d'accessibilité détaillées, mot de passe oublié, refonte visuelle mobile/desktop).
- **Convention confirmée** : toute tâche touchant à la fois back et front est scindée en deux issues distinctes (une casquette par issue), jamais une issue à cheval sur les deux — cohérent avec le pattern déjà en place ([#3](https://github.com/KerdanetYvan/urbanflow-mobility/issues/3)/[#33](https://github.com/KerdanetYvan/urbanflow-mobility/issues/33), [#4](https://github.com/KerdanetYvan/urbanflow-mobility/issues/4)/[#34](https://github.com/KerdanetYvan/urbanflow-mobility/issues/34)).
- **Charge du Sprint 2 revue à la hausse** : les 9 issues F2 déjà planifiées ([#6](https://github.com/KerdanetYvan/urbanflow-mobility/issues/6), [#7](https://github.com/KerdanetYvan/urbanflow-mobility/issues/7), [#8](https://github.com/KerdanetYvan/urbanflow-mobility/issues/8), [#9](https://github.com/KerdanetYvan/urbanflow-mobility/issues/9), [#26](https://github.com/KerdanetYvan/urbanflow-mobility/issues/26), [#31](https://github.com/KerdanetYvan/urbanflow-mobility/issues/31), [#35](https://github.com/KerdanetYvan/urbanflow-mobility/issues/35), [#36](https://github.com/KerdanetYvan/urbanflow-mobility/issues/36), [#38](https://github.com/KerdanetYvan/urbanflow-mobility/issues/38)) s'ajoutent désormais aux 10 issues F1/transverse ci-dessus (19 au total sur ce milestone). L'ordre de traitement reste à définir — voir suite de la conversation.

## 5. Milestones

- **Sprint 1** : aucun ajustement de date nécessaire, terminé en avance.
- **Sprint 2** (échéance 2026-08-18) : date inchangée, mais volume revu à la hausse suite à la revue fonctionnelle — à surveiller au fil du sprint, un report vers Sprint 3/Stretch reste possible si le rythme ne suit pas.
- **Sprint 3 / Stretch** : pas de changement à ce stade.

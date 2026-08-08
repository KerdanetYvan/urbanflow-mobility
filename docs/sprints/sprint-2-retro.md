# Compte-rendu — Sprint 2

> Casquette PO — issue [#103](https://github.com/KerdanetYvan/urbanflow-mobility/issues/103), fin de Sprint 2 (échéance 2026-08-18).

## 1. Résumé

**20/20 issues fermées, 10 jours d'avance sur l'échéance** (clôturé le 2026-08-08, échéance 2026-08-18) — même dynamique qu'en Sprint 1 (6 jours d'avance). Aucun report de dernière minute, aucun ticket re-scopé en catastrophe pendant le sprint lui-même.

En revanche, contrairement au Sprint 1, la CI verte ne garantissait pas que l'application déployée fonctionnait réellement : un incident de production a été découvert et corrigé **pendant cette revue**, pas avant (voir section 3). C'est le fait le plus important de ce compte-rendu, pas un détail.

## 2. Chronologie

**31/07 — Corrections issues de la revue de Sprint 1, cœur F2**

- [#64](https://github.com/KerdanetYvan/urbanflow-mobility/issues/64)/[#65](https://github.com/KerdanetYvan/urbanflow-mobility/issues/65) Navigation conditionnelle + déconnexion/garde d'authentification
- [#6](https://github.com/KerdanetYvan/urbanflow-mobility/issues/6)/[#7](https://github.com/KerdanetYvan/urbanflow-mobility/issues/7) Intégration OpenTripPlanner + recherche multimodale

**01/08 — Géocodage, QA, documentation API, specs F3**

- [#81](https://github.com/KerdanetYvan/urbanflow-mobility/issues/81) Endpoint de géocodage (`GET /places`)
- [#31](https://github.com/KerdanetYvan/urbanflow-mobility/issues/31) Collection Postman
- [#38](https://github.com/KerdanetYvan/urbanflow-mobility/issues/38) Documentation OpenAPI/Swagger
- [#26](https://github.com/KerdanetYvan/urbanflow-mobility/issues/26) Specs détaillées F3/scoring

**02/08 — Écrans de recherche et carte**

- [#35](https://github.com/KerdanetYvan/urbanflow-mobility/issues/35) Écran de recherche d'itinéraire
- [#8](https://github.com/KerdanetYvan/urbanflow-mobility/issues/8) Affichage cartographique du trajet

**03/08 — Écran de résultats**

- [#36](https://github.com/KerdanetYvan/urbanflow-mobility/issues/36) Écran de résultats — disposition "carte plein écran" décidée en session

**04/08 — Géolocalisation temps réel**

- [#9](https://github.com/KerdanetYvan/urbanflow-mobility/issues/9) Position utilisateur en temps réel sur la carte

**07/08 — Journée dense : accessibilité, transports en commun, mot de passe oublié**

- [#68](https://github.com/KerdanetYvan/urbanflow-mobility/issues/68)/[#69](https://github.com/KerdanetYvan/urbanflow-mobility/issues/69) Préférences d'accessibilité détaillées (back puis front) — introduit l'infrastructure de migrations TypeORM
- [#66](https://github.com/KerdanetYvan/urbanflow-mobility/issues/66)/[#67](https://github.com/KerdanetYvan/urbanflow-mobility/issues/67) Modes de transport en commun détaillés (back puis front)
- [#70](https://github.com/KerdanetYvan/urbanflow-mobility/issues/70)/[#71](https://github.com/KerdanetYvan/urbanflow-mobility/issues/71) Mot de passe oublié (back puis front) — nouvelle dépendance email (nodemailer, MailHog/Postfix auto-hébergés)

**08/08 — Refonte visuelle mobile/desktop, clôture**

- [#72](https://github.com/KerdanetYvan/urbanflow-mobility/issues/72)/[#73](https://github.com/KerdanetYvan/urbanflow-mobility/issues/73) Specs puis implémentation de la refonte mobile/desktop — fusion RecherchePage/ResultatsPage en un seul écran, correctif de centrage desktop

## 3. Revue de code, CI, **et incident de production découvert en session**

### 3.1 Ce qui était vérifiable sans navigateur

- CI verte sur les 8 derniers runs (`gh run list`) au moment de la clôture du sprint.
- Definition of Done ([#27](https://github.com/KerdanetYvan/urbanflow-mobility/issues/27)) : code revu, tests passants, documentation à jour — respectée sur le plan déclaratif.

### 3.2 L'incident : la CI verte cachait un backend indisponible en dev **et** en prod

En reprenant la revue le 2026-08-08/09, une vérification manuelle du site déployé (faite par l'utilisateur, pas par cette session — limite déjà signalée à chaque tâche frontend du sprint, aucun outil de navigateur automatisé disponible) a révélé que **le backend ne répondait plus du tout**, en dev comme en prod (502 en prod, `net::ERR_EMPTY_RESPONSE` en dev). Deux causes distinctes, cumulées :

1. **Dev** : le conteneur backend utilise un volume Docker anonyme pour `node_modules`, jamais renouvelé depuis l'ajout de `nodemailer` ([#70](https://github.com/KerdanetYvan/urbanflow-mobility/issues/70)) — le code source était à jour (bind mount) mais la dépendance manquait physiquement, faisant planter la compilation à chaud en boucle. Corrigé en session (`--renew-anon-volumes`).
2. **Prod** : deux problèmes indépendants qui se cumulaient —
   - Le conteneur `backend` plantait en boucle sur la toute première migration TypeORM (`Baseline`, `relation "users" already exists`) : la base de production a été créée **avant** l'introduction des migrations ([#68](https://github.com/KerdanetYvan/urbanflow-mobility/issues/68)), via l'ancien mécanisme `synchronize` — la table `migrations` était vide, donc TypeORM essayait de recréer un schéma déjà existant à chaque démarrage. Corrigé en session (insertion manuelle d'une ligne "Baseline déjà appliquée", puis les 3 vraies migrations en attente se sont appliquées normalement).
   - Le conteneur `postfix` refusait de démarrer faute de `MAIL_ALLOWED_SENDER_DOMAINS` dans le `.env` du serveur — ce fichier n'est pas versionné et n'a jamais reçu les nouvelles variables `MAIL_*` introduites par [#70](https://github.com/KerdanetYvan/urbanflow-mobility/issues/70). Corrigé en session (mise à jour manuelle du `.env` serveur par l'utilisateur).

**Cause racine du "jamais détecté avant" : la CI ne faisait jamais tourner le vrai build** (`nest build`/`tsc -b`, celui utilisé par les images Docker) — seulement lint + tests (Jest/Vitest, leur propre transformation TypeScript, plus tolérante). Le job "Déploiement production" de la CI ne vérifie pas non plus que le backend répond réellement après un déploiement — seulement que les commandes SSH/Docker se terminent sans erreur. Un déploiement peut donc être vert alors que le conteneur applicatif est en crash-loop.

**Corrigé** : [#104](https://github.com/KerdanetYvan/urbanflow-mobility/issues/104) (issue créée en session, [PR #105](https://github.com/KerdanetYvan/urbanflow-mobility/pull/105)) ajoute une étape de build réel dans les jobs `frontend`/`backend` de la CI. Documentation de `.env.example` clarifiée au passage (`MAIL_PORT`/`FRONTEND_URL` ont des valeurs différentes en prod, jamais explicité avant).

**Non traité, volontairement hors périmètre de cette correction** : le job de déploiement ne vérifie toujours pas que le site répond après coup (pas de health-check post-déploiement) — risque de récidive avec une cause différente. À évaluer pour Sprint 3 si le temps le permet, pas ajouté au backlog dans l'immédiat (pas demandé par l'utilisateur).

### 3.3 Revue fonctionnelle réelle (une fois le site de nouveau disponible)

Une fois l'incident résolu, l'utilisateur a mené une vraie revue fonctionnelle sur le site redevenu accessible (contrairement au reste de cette section, celle-ci porte sur l'UX vécue, pas seulement le code) et a identifié 6 constats, décomposés en issues Sprint 3 (voir section 4).

## 4. Décisions de reprocessus

- **CI durcie** : étape de build réel ajoutée avant tout déploiement ([#104](https://github.com/KerdanetYvan/urbanflow-mobility/issues/104)/[PR #105](https://github.com/KerdanetYvan/urbanflow-mobility/pull/105)).
- **6 constats de la revue fonctionnelle, décomposés en 9 nouvelles issues Sprint 3** (une casquette par issue, PO pour cadrer une décision de conception puis Dev FE/BE séparés à l'implémentation — même convention que [#68](https://github.com/KerdanetYvan/urbanflow-mobility/issues/68)/[#69](https://github.com/KerdanetYvan/urbanflow-mobility/issues/69), [#72](https://github.com/KerdanetYvan/urbanflow-mobility/issues/72)/[#73](https://github.com/KerdanetYvan/urbanflow-mobility/issues/73)) :
  - Onboarding du profil (remplace le formulaire vide silencieux sur 404) + redirection conditionnelle post-connexion (`/profil` si pas de profil, `/recherche` sinon) — [#106](https://github.com/KerdanetYvan/urbanflow-mobility/issues/106)/[#107](https://github.com/KerdanetYvan/urbanflow-mobility/issues/107).
  - Modes de transport de la recherche en filtre (tooltip/modale) plutôt qu'affichés en permanence — [#108](https://github.com/KerdanetYvan/urbanflow-mobility/issues/108)/[#109](https://github.com/KerdanetYvan/urbanflow-mobility/issues/109).
  - Carte permanente en fond + réagencement des champs sur `/recherche` (révise à nouveau [#73](https://github.com/KerdanetYvan/urbanflow-mobility/issues/73)) — [#110](https://github.com/KerdanetYvan/urbanflow-mobility/issues/110)/[#111](https://github.com/KerdanetYvan/urbanflow-mobility/issues/111).
  - Raccourcis de recherche rapide (historique) sous le formulaire — [#112](https://github.com/KerdanetYvan/urbanflow-mobility/issues/112), dépend de [#11](https://github.com/KerdanetYvan/urbanflow-mobility/issues/11) élargi.
  - Raccourcis domicile/travail dans le préremplissage de l'origine — [#113](https://github.com/KerdanetYvan/urbanflow-mobility/issues/113)/[#114](https://github.com/KerdanetYvan/urbanflow-mobility/issues/114), consommés par [#93](https://github.com/KerdanetYvan/urbanflow-mobility/issues/93) élargi.
- **[#11](https://github.com/KerdanetYvan/urbanflow-mobility/issues/11) et [#93](https://github.com/KerdanetYvan/urbanflow-mobility/issues/93) élargies et déplacées de Stretch vers Sprint 3** : ne sont plus de simples nice-to-have, elles deviennent des prérequis directs du nouveau flux de recherche rapide/raccourcis décidé en revue.
- **Priorisation de l'ordre de traitement Sprint 3 reportée à une session dédiée** (`sprint-3-plan.md` à produire séparément, même format que `sprint-2-plan.md`) — cette revue s'arrête à la décomposition en issues, pas à leur séquencement.

## 5. Milestones

- **Sprint 2** : clos sans changement de date, 10 jours d'avance.
- **Sprint 3** (échéance 2026-09-01) : **charge fortement revue à la hausse** — passe de 9 à **22 issues** (9 déjà planifiées F3/scoring/audits transverses + [#104](https://github.com/KerdanetYvan/urbanflow-mobility/issues/104) CI + 9 nouvelles issues de cette revue + [#11](https://github.com/KerdanetYvan/urbanflow-mobility/issues/11)/[#93](https://github.com/KerdanetYvan/urbanflow-mobility/issues/93) élargies et déplacées depuis Stretch). Même dynamique que Sprint 1→2 (voir `sprint-1-retro.md` section 4), mais plus prononcée. La date n'est pas ajustée dans l'immédiat — l'ordre de traitement (à définir dans `sprint-3-plan.md`) devra explicitement séparer ce qui est obligatoire pour la certification (F3, audits transverses) de ce qui peut glisser vers Stretch si le rythme ne suit pas, comme cadré lors de la revue de Sprint 1.

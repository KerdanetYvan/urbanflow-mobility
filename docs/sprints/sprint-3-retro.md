# Compte-rendu — Sprint 3

> Casquette PO — issue [#163](https://github.com/KerdanetYvan/urbanflow-mobility/issues/163), fin de Sprint 3 (échéance 2026-09-01).

## 1. Résumé

**24 issues fermées, 7 jours d'avance sur l'échéance** (clôturé le 2026-08-25, échéance 2026-09-01) — même dynamique que les Sprints 1 et 2 (respectivement 6 et 10 jours d'avance), malgré une charge revue fortement à la hausse en fin de Sprint 2 (9 → 23 issues séquencées, voir `sprint-2-retro.md` section 5). Toutes les phases obligatoires du plan de sprint (`sprint-3-plan.md`, Phases A à E : F3, scoring, refonte `/recherche`, domicile/travail, qualité transverse) sont terminées.

Contrairement au Sprint 2, aucun incident de production caché par une CI verte n'a été découvert en clôturant ce sprint — voir section 3. Trois points sont ressortis de cette clôture, tous traités en session : l'automatisation Dependabot, activée pendant ce sprint même (issue [#21](https://github.com/KerdanetYvan/urbanflow-mobility/issues/21)), avait accumulé 12 PR en une journée (triées, section 3.4) ; une vraie revue fonctionnelle API (stack Docker locale, pas de mocks) a révélé qu'**aucun utilisateur ne peut aujourd'hui exercer son droit à l'effacement RGPD** (section 3.1, issue [#164](https://github.com/KerdanetYvan/urbanflow-mobility/issues/164)) ; et la revue visuelle réelle menée par l'utilisateur, complétée par des retours de bêta-testeurs, a produit 11 constats supplémentaires (section 3.2). Au total, cette clôture ajoute **20 issues au milestone Stretch** — voir section 5.

[#42](https://github.com/KerdanetYvan/urbanflow-mobility/issues/42) ("documenter en continu les choix d'architecture"), volontairement exclue du séquencement par phases car c'est une discipline tenue tout au long du sprint plutôt qu'un jalon avec un début et une fin (voir `sprint-3-plan.md` ligne 23), a été migrée vers le milestone Stretch (décision utilisateur en session) — la discipline se poursuit avec le travail Stretch à venir plutôt que de rester ouverte sur un sprint clos. **24/24 issues du milestone Sprint 3 sont désormais fermées.**

## 2. Chronologie (par phase, voir `sprint-3-plan.md` pour le détail du séquencement)

**08/10–08/11 — Phase A : F3 obligatoire (fondations GTFS/OTP)**

- [#12](https://github.com/KerdanetYvan/urbanflow-mobility/issues/12)/[#90](https://github.com/KerdanetYvan/urbanflow-mobility/issues/90) Ingestion + vérification du flux GTFS réel (STAR Rennes Métropole)
- [#120](https://github.com/KerdanetYvan/urbanflow-mobility/issues/120) Déploiement d'OTP en production avec les vraies données GTFS/OSM

**08/11 — Phase B : Scoring**

- [#16](https://github.com/KerdanetYvan/urbanflow-mobility/issues/16) Service de scoring pondéré des itinéraires
- [#17](https://github.com/KerdanetYvan/urbanflow-mobility/issues/17) Intégration de l'API météo dans le scoring

**08/11–08/23 — Phase C : refonte `/recherche` et onboarding (la plus longue, la plus dense)**

- [#110](https://github.com/KerdanetYvan/urbanflow-mobility/issues/110)/[#111](https://github.com/KerdanetYvan/urbanflow-mobility/issues/111) Carte permanente + réagencement des champs
- [#126](https://github.com/KerdanetYvan/urbanflow-mobility/issues/126) Badges qualitatifs de scoring sur les résultats
- [#129](https://github.com/KerdanetYvan/urbanflow-mobility/issues/129) Badges de ligne par mode de transport, étendu en session à la couleur de ligne GTFS (08/12 → 08/18, la tâche la plus longue du sprint)
- [#127](https://github.com/KerdanetYvan/urbanflow-mobility/issues/127) Regroupement des itinéraires identiques par prochain passage
- [#106](https://github.com/KerdanetYvan/urbanflow-mobility/issues/106)/[#107](https://github.com/KerdanetYvan/urbanflow-mobility/issues/107) Onboarding du profil + redirection post-connexion
- [#108](https://github.com/KerdanetYvan/urbanflow-mobility/issues/108)/[#109](https://github.com/KerdanetYvan/urbanflow-mobility/issues/109) Filtre des modes de transport en popover
- [#22](https://github.com/KerdanetYvan/urbanflow-mobility/issues/22) Chiffrement RGPD des données de géolocalisation (remonté avant #11 par précaution, voir `sprint-3-plan.md` §"Pourquoi cet ordre")
- [#11](https://github.com/KerdanetYvan/urbanflow-mobility/issues/11) Historique des trajets récents — bug pré-existant découvert et corrigé en session (`searchTrips` n'attachait jamais le jeton d'auth, désactivant silencieusement le scoring personnalisé et l'enregistrement d'historique en production)
- [#112](https://github.com/KerdanetYvan/urbanflow-mobility/issues/112) Raccourcis de recherche rapide (historique)

**08/23–08/24 — Phase D : domicile/travail**

- [#113](https://github.com/KerdanetYvan/urbanflow-mobility/issues/113)/[#114](https://github.com/KerdanetYvan/urbanflow-mobility/issues/114) Adresses domicile/travail dans le profil — correctif inclus (`Object.assign` écrasait silencieusement les champs non fournis d'un `PATCH` partiel)
- [#93](https://github.com/KerdanetYvan/urbanflow-mobility/issues/93) Préremplissage de l'origine (position actuelle + raccourcis domicile/travail)

**08/24–08/25 — Phase E : qualité transverse (clôture)**

- [#32](https://github.com/KerdanetYvan/urbanflow-mobility/issues/32) Plan de tests transverse (checklists WCAG/OWASP/RGPD)
- [#20](https://github.com/KerdanetYvan/urbanflow-mobility/issues/20) Audit accessibilité WCAG 2.1 AA — 9/9 tests axe-core, une anomalie détectée et corrigée (marqueurs de carte Leaflet focusables sans nom accessible)
- [#21](https://github.com/KerdanetYvan/urbanflow-mobility/issues/21) Audit sécurité OWASP Top 10 — rate limiting + Helmet ajoutés, vulnérabilités npm corrigées, Dependabot configuré

**08/25 — Hors séquencement du plan initial : audit UX et clôture**

- Audit UX `/impeccable critique` du frontend (5 écrans clés) — score 27/40, décomposé en 5 issues [#158](https://github.com/KerdanetYvan/urbanflow-mobility/issues/158)–[#162](https://github.com/KerdanetYvan/urbanflow-mobility/issues/162), ajoutées au milestone Stretch
- [#41](https://github.com/KerdanetYvan/urbanflow-mobility/issues/41) (support de démonstration pour la soutenance) reportée au milestone Stretch — les fonctionnalités du sprint n'étaient pas stables assez tôt pour scénariser une démo dessus, comme anticipé dans `sprint-3-plan.md`
- Revue visuelle réelle par l'utilisateur + retours de bêta-testeurs (voir section 3.2) — 11 constats décomposés en 13 issues [#165](https://github.com/KerdanetYvan/urbanflow-mobility/issues/165)–[#177](https://github.com/KerdanetYvan/urbanflow-mobility/issues/177), ajoutées au milestone Stretch ; [#160](https://github.com/KerdanetYvan/urbanflow-mobility/issues/160) fermée, supersédée par [#171](https://github.com/KerdanetYvan/urbanflow-mobility/issues/171)/[#172](https://github.com/KerdanetYvan/urbanflow-mobility/issues/172)

## 3. Revue de code et CI

### 3.1 Revue fonctionnelle réelle (API, stack Docker locale)

Contrairement à la première version de cette rétro, une vraie revue fonctionnelle a été menée — pas seulement une revue de process/CI. Stack locale démarrée (`docker compose up`, backend + PostgreSQL/PostGIS + OTP + mailhog + frontend, vraies données GTFS/OSM Rennes Métropole), F1/F2/F3/scoring testés via de vrais appels API (pas de mocks) : inscription, doublon d'email, mot de passe faible, connexion, mauvais mot de passe, géocodage réel, recherche d'itinéraires avec vraies lignes de bus et couleurs GTFS, regroupement des prochains passages, domicile/travail (round-trip chiffré/déchiffré correct y compris les accents), historique enregistré après recherche authentifiée, rate limiting (429 après 10 req/min), en-têtes Helmet, mot de passe oublié (un seul email envoyé, pas d'énumération), validation des entrées, zone hors couverture gérée proprement.

**Un vrai gap trouvé, pas du polish** : aucun moyen pour un utilisateur d'exercer son droit à l'effacement (RGPD, article 17) — `DELETE /profiles/me` ne supprime que le profil, pas le compte ; aucun `DELETE /users/me` n'existe ; le frontend n'expose qu'une déconnexion ; `deleteProfile()` (`lib/profile.ts`) est du code mort, jamais appelé. Le mécanisme `CASCADE` en base est bien en place et documenté comme "vérifié en conditions réelles" (`docs/specs/rgpd-geolocalisation.md` section 3), mais cette vérification n'a pu se faire qu'en supprimant un compte directement en base — pas via un vrai parcours utilisateur. Décomposé en issue [#164](https://github.com/KerdanetYvan/urbanflow-mobility/issues/164) (Stretch, priorité haute).

Le parcours visuel/UX dans le navigateur (ce que cette session ne peut pas faire elle-même, faute d'outil de navigateur) reste à la charge de l'utilisateur, comme à chaque sprint précédent — voir section 3.2. Stack Docker locale arrêtée proprement (`docker compose down`) une fois les deux revues terminées.

### 3.2 Revue visuelle réelle (utilisateur) et retours de bêta-testeurs

Complète la section 3.1 : l'utilisateur a mené le parcours visuel dans le navigateur (stack locale démarrée en 3.1) et rapporté les retours de plusieurs bêta-testeurs, y compris un audit Lighthouse Google. **11 constats**, tous vérifiés dans le code avant découpage (fichiers et lignes précis, pas de supposition) :

- **Autocomplétion** (`AddressField`/`useAddressSuggestions.ts`) : position actuelle/domicile/travail/historique vivent dans des blocs séparés du dropdown au lieu d'y être intégrés dès le focus, avec sous-titre d'adresse — [#165](https://github.com/KerdanetYvan/urbanflow-mobility/issues/165)/[#166](https://github.com/KerdanetYvan/urbanflow-mobility/issues/166)
- **Libellés d'adresse confus** ("Pont Neuf (5070)") : confirmé que le géocodeur OTP n'indexe que des arrêts de transport, aucune donnée d'adresse postale réelle — décision utilisateur d'investir dans Nominatim auto-hébergé plutôt qu'un simple nettoyage d'affichage (lève la réserve RGPD qui avait écarté cette option pour #93, un service auto-hébergé n'étant pas un tiers) — [#167](https://github.com/KerdanetYvan/urbanflow-mobility/issues/167)/[#168](https://github.com/KerdanetYvan/urbanflow-mobility/issues/168)
- **Débordement des badges qualitatifs** : jusqu'à 2 badges accumulés par carte (`itineraryBadges.ts:110`), à limiter à 1 — [#169](https://github.com/KerdanetYvan/urbanflow-mobility/issues/169)
- **"Voir le détail" confus en desktop** (le clic sur la card affiche déjà le détail) mais légitime en mobile — [#170](https://github.com/KerdanetYvan/urbanflow-mobility/issues/170)
- **Fusion de la card recherche + la card résultats** pour modifier une recherche sans clic supplémentaire — chevauche directement le constat Impeccable [#160](https://github.com/KerdanetYvan/urbanflow-mobility/issues/160) (carte cachée par défaut) : **#160 fermée**, supersédée par [#171](https://github.com/KerdanetYvan/urbanflow-mobility/issues/171)/[#172](https://github.com/KerdanetYvan/urbanflow-mobility/issues/172)
- **"Prochain passage à..."** affiché dans la liste plutôt que dans le détail de l'itinéraire — [#173](https://github.com/KerdanetYvan/urbanflow-mobility/issues/173)
- **Page Historique jugée peu utile en l'état** (liste passive, aucune action) — décision utilisateur en session : la rendre interactive (relancer une recherche depuis une entrée) plutôt que la supprimer — [#174](https://github.com/KerdanetYvan/urbanflow-mobility/issues/174)
- **Bug bêta-testeurs** : l'erreur de correspondance des mots de passe (inscription) ne se réinitialise pas au changement de champ, confirmé dans le code (`ConnexionPage.tsx:79-84`, jamais nettoyé au `onChange`) — [#175](https://github.com/KerdanetYvan/urbanflow-mobility/issues/175)
- **`robots.txt` signalé invalide par Lighthouse** : confirmé absent de `frontend/public/` — [#176](https://github.com/KerdanetYvan/urbanflow-mobility/issues/176)
- **Formulations perçues comme "trop IA"** (tirets cadratiques) : 5 occurrences confirmées dans du texte utilisateur réel (hors commentaires) — [#177](https://github.com/KerdanetYvan/urbanflow-mobility/issues/177)

Décomposé en 13 issues Stretch ([#165](https://github.com/KerdanetYvan/urbanflow-mobility/issues/165)–[#177](https://github.com/KerdanetYvan/urbanflow-mobility/issues/177)) plutôt que traité à chaud, même logique que les constats Impeccable (section 3.1/4) — ne pas rouvrir de scope de dev en pleine clôture de sprint.

### 3.3 Ce qui était vérifiable sans navigateur (même limite qu'en Sprint 2 : pas d'outil de navigateur automatisé dans cette session)

- **CI verte sur `main`** : les 8 derniers runs (incluant le merge des PR [#143](https://github.com/KerdanetYvan/urbanflow-mobility/pull/143), [#144](https://github.com/KerdanetYvan/urbanflow-mobility/pull/144), [#145](https://github.com/KerdanetYvan/urbanflow-mobility/pull/145)) sont au vert — et depuis le durcissement post-Sprint 2 ([#104](https://github.com/KerdanetYvan/urbanflow-mobility/issues/104)), ce vert inclut désormais le vrai build (`nest build`/`tsc -b`), pas seulement lint + tests. La classe d'incident découverte en clôture de Sprint 2 (CI verte, build cassé en silence) est donc structurellement moins probable qu'avant.
- **24 issues closes** sur le milestone Sprint 3, seule [#42](https://github.com/KerdanetYvan/urbanflow-mobility/issues/42) reste ouverte (voir section 1).
- **Audit UX Impeccable** mené sur le code source + scan statique (revue de design par sous-agent + `detect.mjs`) : voir `.impeccable/critique/2026-08-25T15-49-51Z__rchepage-carte-recherchepageresults-historiquepage.md`. Aucune vérification navigateur réelle n'a été possible dans cette session pour cet audit précis — complété depuis par la revue visuelle réelle de l'utilisateur (section 3.2), qui a d'ailleurs recoupé un des constats Impeccable ([#160](https://github.com/KerdanetYvan/urbanflow-mobility/issues/160)/[#171](https://github.com/KerdanetYvan/urbanflow-mobility/issues/171)).

### 3.4 Point d'attention découvert en clôture : accumulation de PR Dependabot — triée en session

[#21](https://github.com/KerdanetYvan/urbanflow-mobility/issues/21) a activé Dependabot (`.github/dependabot.yml`, vérifications hebdomadaires) le 2026-08-25. Dès la première exécution, **12 PR ont été ouvertes en une seule journée**, dont plusieurs échouaient la CI — normal pour une première activation, ça se tasse ensuite à quelques PR par semaine.

**Ce n'était pas un incident** (contrairement à la découverte de Sprint 2) : la CI faisait exactement son travail en bloquant les montées de version majeures avant merge.

**Triage effectué en session** :

- **9 PR mergées** (CI verte, mineures/patch) : [#146](https://github.com/KerdanetYvan/urbanflow-mobility/pull/146) `actions/checkout`, [#147](https://github.com/KerdanetYvan/urbanflow-mobility/pull/147) `actions/setup-node`, [#148](https://github.com/KerdanetYvan/urbanflow-mobility/pull/148) `eslint` backend 9→10 (passe malgré le changement de version majeure), [#149](https://github.com/KerdanetYvan/urbanflow-mobility/pull/149) `@vitest/coverage-v8`, [#150](https://github.com/KerdanetYvan/urbanflow-mobility/pull/150) `globals`, [#154](https://github.com/KerdanetYvan/urbanflow-mobility/pull/154) `eslint` frontend (mergée après un rebase automatique Dependabot suite à un conflit avec les 8 autres merges), [#155](https://github.com/KerdanetYvan/urbanflow-mobility/pull/155) `@nestjs/common`, [#156](https://github.com/KerdanetYvan/urbanflow-mobility/pull/156) `vite`, [#157](https://github.com/KerdanetYvan/urbanflow-mobility/pull/157) `pg`.
- **3 PR fermées** (CI rouge, montées majeures incompatibles en l'état, commentées avec la raison) : [#151](https://github.com/KerdanetYvan/urbanflow-mobility/pull/151) `typescript` 6.0→7.0 frontend, [#152](https://github.com/KerdanetYvan/urbanflow-mobility/pull/152) `typescript` 5.9→7.0 backend, [#153](https://github.com/KerdanetYvan/urbanflow-mobility/pull/153) `@eslint/js` 9→10 backend — à retraiter manuellement si une montée vers TypeScript/ESLint majeur est souhaitée plus tard, hors scope de ce sprint.

Point de vigilance pour la suite : ce pic de 12 PR en un jour va se reproduire en plus petit chaque semaine tant que Dependabot tourne — pas de changement de configuration (ex. ignorer les majeures) demandé pour l'instant, décision à reprendre si le flux redevient envahissant.

## 4. Décisions de reprocessus

- **Audit UX Impeccable ajouté à la clôture de sprint** : constat que l'accessibilité (WCAG, [#20](https://github.com/KerdanetYvan/urbanflow-mobility/issues/20)) avait été auditée mais pas la qualité visuelle/UX globale depuis la refonte mobile/desktop du Sprint 2. Décomposé en 5 issues Stretch ([#158](https://github.com/KerdanetYvan/urbanflow-mobility/issues/158)–[#162](https://github.com/KerdanetYvan/urbanflow-mobility/issues/162)) plutôt que traité à chaud, pour ne pas rouvrir de scope non planifié juste avant la clôture — cohérent avec la décision prise en session de garder Phase E/clôture strictement dans son périmètre.
- **[#41](https://github.com/KerdanetYvan/urbanflow-mobility/issues/41) et [#42](https://github.com/KerdanetYvan/urbanflow-mobility/issues/42) reportées au milestone Stretch**, pas rescopées dans un Sprint 4 (aucun milestone Sprint 4 n'existe à ce jour) — décision utilisateur en session. Le milestone Sprint 3 est donc fermé à 24/24.
- **Triage Dependabot effectué en session** (voir section 3.4) : 9 PR mergées, 3 fermées. Point de vigilance conservé pour les prochaines semaines si le flux redevient envahissant, mais rien de plus à planifier dans l'immédiat.
- **Suppression de compte (droit à l'effacement RGPD) décomposée en issue** [#164](https://github.com/KerdanetYvan/urbanflow-mobility/issues/164) (voir section 3.1) : discussion dédiée en session avant création (le mécanisme technique `CASCADE` existant en base a été jugé suffisant pour ne pas traiter ça comme un incident bloquant), priorité haute sur Stretch plutôt que différé sans priorité.
- **11 constats de la revue visuelle utilisateur + bêta-testeurs, décomposés en 13 issues Stretch** [#165](https://github.com/KerdanetYvan/urbanflow-mobility/issues/165)–[#177](https://github.com/KerdanetYvan/urbanflow-mobility/issues/177) (voir section 3.2), même logique que l'audit Impeccable : traçage plutôt que correctifs à chaud en pleine clôture. Deux décisions de cadrage prises en session dans la foulée : investir dans Nominatim auto-hébergé plutôt qu'un simple nettoyage d'affichage des libellés d'adresse ([#167](https://github.com/KerdanetYvan/urbanflow-mobility/issues/167)/[#168](https://github.com/KerdanetYvan/urbanflow-mobility/issues/168)), et rendre la page Historique interactive plutôt que la supprimer ([#174](https://github.com/KerdanetYvan/urbanflow-mobility/issues/174)).
- **[#160](https://github.com/KerdanetYvan/urbanflow-mobility/issues/160) fermée**, supersédée par [#171](https://github.com/KerdanetYvan/urbanflow-mobility/issues/171)/[#172](https://github.com/KerdanetYvan/urbanflow-mobility/issues/172) (constat Impeccable recoupé par la revue visuelle utilisateur, traité en un seul endroit plutôt que dupliqué).

## 5. Milestones

- **Sprint 3** : clos sans changement de date, 7 jours d'avance, 24/24 issues fermées.
- **Stretch (post-MVP)** : s'enrichit de 20 issues au total cette clôture — [#41](https://github.com/KerdanetYvan/urbanflow-mobility/issues/41), [#42](https://github.com/KerdanetYvan/urbanflow-mobility/issues/42), [#158](https://github.com/KerdanetYvan/urbanflow-mobility/issues/158)–[#159](https://github.com/KerdanetYvan/urbanflow-mobility/issues/159), [#161](https://github.com/KerdanetYvan/urbanflow-mobility/issues/161)–[#162](https://github.com/KerdanetYvan/urbanflow-mobility/issues/162) (audit Impeccable, [#160](https://github.com/KerdanetYvan/urbanflow-mobility/issues/160) fermée depuis), [#164](https://github.com/KerdanetYvan/urbanflow-mobility/issues/164) (suppression de compte), [#165](https://github.com/KerdanetYvan/urbanflow-mobility/issues/165)–[#177](https://github.com/KerdanetYvan/urbanflow-mobility/issues/177) (revue visuelle utilisateur) — en plus du contenu déjà présent (GBFS, GTFS-Realtime, architecture pluggable, éco-conception, mode dégradé — voir `sprint-3-plan.md`). Seule [#164](https://github.com/KerdanetYvan/urbanflow-mobility/issues/164) est marquée priorité haute — le reste est du confort/polish ou des specs à cadrer avant chiffrage (Nominatim [#167](https://github.com/KerdanetYvan/urbanflow-mobility/issues/167), fusion des cards [#171](https://github.com/KerdanetYvan/urbanflow-mobility/issues/171), autocomplétion [#165](https://github.com/KerdanetYvan/urbanflow-mobility/issues/165)).
- **Sprint suivant** : aucun milestone créé à ce jour. Le milestone Stretch a nettement grossi lors de cette clôture (20 issues ajoutées en une session) — la revue et priorisation du backlog ([#163](https://github.com/KerdanetYvan/urbanflow-mobility/issues/163)) devra probablement faire le tri entre ce qui reste vraiment "post-MVP" et ce qui mérite un Sprint 4 dédié, plutôt que de tout laisser s'accumuler sur Stretch sans plan de traitement.

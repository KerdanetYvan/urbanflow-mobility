# Plan de traitement — Sprint 3

> Ordre de traitement décidé en session le 2026-08-09, à la suite de la revue de fin de Sprint 2 ([#103](https://github.com/KerdanetYvan/urbanflow-mobility/issues/103), voir `sprint-2-retro.md`).

## Comment reprendre après une coupure de session

Les cases ci-dessous font foi pour savoir où on en est : `[ ]` pas commencé, `[*]` en cours (travail démarré, PR pas encore ouverte), `[x]` travail terminé et validé, PR ouverte. Reprendre au premier item non `[x]`. Si le dernier item `[x]` a encore sa PR ouverte (pas mergée), vérifier d'abord si elle est prête à merger avant de démarrer autre chose.

En cas de doute (case pas à jour, session interrompue en plein travail), vérifier le **Status** réel des issues sur le [GitHub Project](https://github.com/users/KerdanetYvan/projects/1) (`gh project item-list 1 --owner KerdanetYvan --format json`) et resynchroniser les cases ci-dessous en conséquence. Si l'ordre lui-même ne correspond plus à la réalité (nouvelle issue ajoutée, priorité changée en cours de route), le mettre à jour ici plutôt que de laisser ce fichier se périmer silencieusement.

**Convention** (confirmée en Sprint 2, voir `sprint-2-plan.md`/`sprint-1-retro.md`) :

- Cocher `[*]` dès qu'on commence à travailler sur une issue, avant le premier commit.
- Cocher `[x]` juste avant d'ouvrir la PR, une fois le travail terminé et validé (tests/lint/vérification manuelle passés) — **toute la tâche part dans une seule PR**, ouverte une fois le travail fini, pas au milieu.
- Ne pas ouvrir la PR puis continuer à pousser des ajouts/correctifs dessus au fil de l'eau après coup, surtout si elle a déjà pu être mergée entre-temps. Si un besoin de retouche apparaît après avoir coché `[x]` mais avant d'ouvrir la PR, terminer la retouche d'abord, PUIS ouvrir la PR.
- **Ne pas ouvrir la PR sans le feu vert explicite de l'utilisateur**, même une fois le travail fini (précision ajoutée en session le 2026-08-09, suite à la PR #115 ouverte trop tôt) — signaler que la tâche est prête, attendre confirmation avant `gh pr create`.
- Le Status réel sur le board (In Progress / Review-QA / Done) continue d'évoluer séparément via l'automatisation PR (`Closes #N`) et les workflows natifs du Project — la case `[x]` ici n'attend pas que la PR soit mergée, seulement que le travail soit fini et prêt à être proposé en revue.

## Ordre retenu

Les 21 issues ouvertes du Sprint 3 (9 déjà planifiées F3/scoring/audits transverses + [#104](https://github.com/KerdanetYvan/urbanflow-mobility/issues/104) déjà clos + 9 nouvelles issues + [#11](https://github.com/KerdanetYvan/urbanflow-mobility/issues/11)/[#93](https://github.com/KerdanetYvan/urbanflow-mobility/issues/93) élargies, voir `sprint-2-retro.md`) — plus [#120](https://github.com/KerdanetYvan/urbanflow-mobility/issues/120) ajoutée en cours de sprint (voir Phase A) — sont regroupées en phases thématiques plutôt qu'entrelacées comme en Sprint 2 : les dépendances entre elles (specs PO avant implémentation Dev, disposition de base avant les fonctionnalités qui s'y superposent) sont plus fortes que ce qui justifiait un entrelacement.

[#42](https://github.com/KerdanetYvan/urbanflow-mobility/issues/42) ("documenter en continu les choix d'architecture") n'apparaît volontairement pas dans la liste ci-dessous : c'est une discipline à tenir tout au long du sprint (CLAUDE.md/mémoire tenus à jour à chaque décision), pas un jalon avec un début et une fin.

### Phase A — F3 obligatoire (fondations manquantes, le plus gros risque technique)

- [x] [#12](https://github.com/KerdanetYvan/urbanflow-mobility/issues/12) (Dev BE) — Ingestion des flux GTFS statiques de la métropole — source retenue : GTFS open data de Rennes Métropole (STAR), portée PostGIS limitée aux arrêts géolocalisés (`gtfs_stops`)
- [x] [#90](https://github.com/KerdanetYvan/urbanflow-mobility/issues/90) (Dev BE) — Vérifier le tracé réel (shapes.txt) des lignes de transport après ingestion GTFS — confirmé (métro ligne a, 295 points de tracé), voir `routing-engine/README.md`
- [x] [#120](https://github.com/KerdanetYvan/urbanflow-mobility/issues/120) (Dev BE) — Déployer OTP en production avec les vraies données GTFS/OSM — service réintroduit ([#121](https://github.com/KerdanetYvan/urbanflow-mobility/pull/121), fix du partage de volume en [#122](https://github.com/KerdanetYvan/urbanflow-mobility/pull/122)), vraies données GTFS/OSM déployées sur le VPS, `GET /trips`/`GET /places` vérifiés en production (graphe complet 1528 arrêts, `|V|=157,499 |E|=410,038`)

### Phase B — Scoring (fonctionnalité complémentaire argumentée)

- [ ] [#16](https://github.com/KerdanetYvan/urbanflow-mobility/issues/16) (Dev BE) — Service de scoring pondéré des itinéraires
- [ ] [#17](https://github.com/KerdanetYvan/urbanflow-mobility/issues/17) (Dev BE) — Intégration de l'API météo

### Phase C — Refonte `/recherche` et onboarding

- [ ] [#110](https://github.com/KerdanetYvan/urbanflow-mobility/issues/110) (PO) — Specs : carte permanente + réagencement des champs sur `/recherche`
- [ ] [#111](https://github.com/KerdanetYvan/urbanflow-mobility/issues/111) (Dev FE) — Implémenter la carte permanente + le réagencement
- [ ] [#106](https://github.com/KerdanetYvan/urbanflow-mobility/issues/106) (PO) — Specs de l'onboarding du profil + redirection post-connexion
- [ ] [#107](https://github.com/KerdanetYvan/urbanflow-mobility/issues/107) (Dev FE) — Implémenter l'onboarding + la redirection conditionnelle post-connexion
- [ ] [#108](https://github.com/KerdanetYvan/urbanflow-mobility/issues/108) (PO) — Specs des modes de transport en filtre sur l'écran de recherche
- [ ] [#109](https://github.com/KerdanetYvan/urbanflow-mobility/issues/109) (Dev FE) — Modes de transport en filtre sur l'écran de recherche
- [ ] [#22](https://github.com/KerdanetYvan/urbanflow-mobility/issues/22) (Dev BE) — RGPD : chiffrement des données de géolocalisation
- [ ] [#11](https://github.com/KerdanetYvan/urbanflow-mobility/issues/11) (Dev BE/FE) — Historique des trajets récents
- [ ] [#112](https://github.com/KerdanetYvan/urbanflow-mobility/issues/112) (Dev FE) — Raccourcis de recherche rapide (historique) sur l'écran de recherche

### Phase D — Domicile/travail

- [ ] [#113](https://github.com/KerdanetYvan/urbanflow-mobility/issues/113) (Dev BE) — Adresses domicile/travail dans le profil de mobilité
- [ ] [#114](https://github.com/KerdanetYvan/urbanflow-mobility/issues/114) (Dev FE) — Formulaire profil : configurer domicile/travail
- [ ] [#93](https://github.com/KerdanetYvan/urbanflow-mobility/issues/93) (Dev FE) — Pré-remplir l'origine de la recherche (position actuelle + raccourcis domicile/travail)

### Phase E — Qualité transverse (passe de clôture)

- [ ] [#32](https://github.com/KerdanetYvan/urbanflow-mobility/issues/32) (QA) — Plan de tests transverse (accessibilité, sécurité, RGPD)
- [ ] [#20](https://github.com/KerdanetYvan/urbanflow-mobility/issues/20) (Dev FE) — Audit accessibilité WCAG 2.1 AA
- [ ] [#21](https://github.com/KerdanetYvan/urbanflow-mobility/issues/21) (Dev BE) — Audit sécurité OWASP Top 10 sur l'API

### Phase F — Clôture soutenance

- [ ] [#41](https://github.com/KerdanetYvan/urbanflow-mobility/issues/41) (PO) — Préparer le support de démonstration pour la soutenance

## Pourquoi cet ordre (raisonnement complet en cas de doute)

- **Phase A en tête** : F1/F2 sont déjà couverts, F3 (vraies données GTFS de la métropole) ne l'est pas encore — c'est la dernière brique **obligatoire** du cahier des charges pas encore attaquée, et la plus susceptible de révéler des surprises (qualité de l'export réel, absence de `shapes.txt`...). [#90](https://github.com/KerdanetYvan/urbanflow-mobility/issues/90) dépend explicitement de [#12](https://github.com/KerdanetYvan/urbanflow-mobility/issues/12), s'enchaîne juste après pendant que le contexte est frais.
- **Phase B avant la refonte UX** : le scoring est la fonctionnalité complémentaire mise en avant dans le dossier de certification (partie 7.3) — pas obligatoire au sens strict comme F1/F2/F3, mais plus proche du cœur argumenté du projet que le polish d'écrans déjà fonctionnels. [#17](https://github.com/KerdanetYvan/urbanflow-mobility/issues/17) (météo) enrichit le service de [#16](https://github.com/KerdanetYvan/urbanflow-mobility/issues/16), donc après lui.
- **Phase C, carte permanente en tête de sous-groupe** : [#110](https://github.com/KerdanetYvan/urbanflow-mobility/issues/110)/[#111](https://github.com/KerdanetYvan/urbanflow-mobility/issues/111) changent la disposition de base de `/recherche`. Le filtre de modes ([#108](https://github.com/KerdanetYvan/urbanflow-mobility/issues/108)/[#109](https://github.com/KerdanetYvan/urbanflow-mobility/issues/109)) et les raccourcis d'historique ([#112](https://github.com/KerdanetYvan/urbanflow-mobility/issues/112)) vivent sur ce même écran : les construire sur la disposition finale évite de les refaire une fois [#111](https://github.com/KerdanetYvan/urbanflow-mobility/issues/111) livré. L'onboarding + redirection ([#106](https://github.com/KerdanetYvan/urbanflow-mobility/issues/106)/[#107](https://github.com/KerdanetYvan/urbanflow-mobility/issues/107)) s'intercale ici, assez indépendant visuellement mais utile tôt pour que la démo finale (Phase F) profite d'un parcours de connexion déjà cohérent.
- **[#22](https://github.com/KerdanetYvan/urbanflow-mobility/issues/22) remonté juste avant [#11](https://github.com/KerdanetYvan/urbanflow-mobility/issues/11)**, plutôt que laissé en Phase E avec le reste des audits transverses : [#11](https://github.com/KerdanetYvan/urbanflow-mobility/issues/11) va se mettre à **stocker** des coordonnées de trajets pour la première fois (nouveau besoin de persistance de données de géolocalisation). Faire l'audit/chiffrement RGPD après aurait laissé une fenêtre où ces données sont en base sans le chiffrement prévu. Décision prise en session le 2026-08-09.
- **[#11](https://github.com/KerdanetYvan/urbanflow-mobility/issues/11) reste une seule issue combinant Dev BE et Dev FE**, par exception à la convention "une issue = une casquette" confirmée en Sprint 2 : elle préexistait (Stretch, Sprint 1) avant que cette convention soit actée. À signaler si on souhaite la scinder avant de la démarrer, plutôt que de la traiter telle quelle.
- **Phase D (domicile/travail) après la Phase C** : assez indépendante du reste, aurait pu s'intercaler n'importe où — placée ici simplement parce qu'elle prolonge le même thème "raccourcis de recherche".
- **Phase E en fin de sprint plutôt qu'en tête** : auditer WCAG/OWASP avant la refonte UX (Phase C) aurait signifié ré-auditer une deuxième fois après. [#32](https://github.com/KerdanetYvan/urbanflow-mobility/issues/32) (checklist) précède [#20](https://github.com/KerdanetYvan/urbanflow-mobility/issues/20)/[#21](https://github.com/KerdanetYvan/urbanflow-mobility/issues/21) (qui la déroulent). [#22](https://github.com/KerdanetYvan/urbanflow-mobility/issues/22) en est volontairement sorti (voir plus haut) - pas du même risque de "cible mouvante" que WCAG/OWASP, qui portent sur l'UI/l'API dans leur ensemble.
- **[#41](https://github.com/KerdanetYvan/urbanflow-mobility/issues/41) en tout dernier** : scénariser une démo sur des fonctionnalités pas encore stables n'a pas de sens - attend que tout le reste soit livré.

Charge du sprint à surveiller : 21 issues séquencées (20 + [#120](https://github.com/KerdanetYvan/urbanflow-mobility/issues/120) ajoutée en cours de route) + [#42](https://github.com/KerdanetYvan/urbanflow-mobility/issues/42) en continu, contre 19+1 en Sprint 2 (qui avait fini 10 jours en avance). Si le rythme ne suit pas, les candidats les plus sûrs à glisser vers Stretch sont la Phase D (domicile/travail, confort plutôt qu'obligatoire) et la deuxième moitié de la Phase C ([#108](https://github.com/KerdanetYvan/urbanflow-mobility/issues/108)/[#109](https://github.com/KerdanetYvan/urbanflow-mobility/issues/109), [#112](https://github.com/KerdanetYvan/urbanflow-mobility/issues/112)) - jamais la Phase A (F3 obligatoire) ni la Phase E (contraintes transverses obligatoires elles aussi).

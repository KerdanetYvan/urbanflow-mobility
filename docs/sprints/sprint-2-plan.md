# Plan de traitement — Sprint 2

> Ordre de traitement décidé en session le 2026-07-30, à la suite de la revue de fin de Sprint 1 ([#28](https://github.com/KerdanetYvan/urbanflow-mobility/issues/28), voir `sprint-1-retro.md`).

## Comment reprendre après une coupure de session

Les cases ci-dessous font foi pour savoir où on en est : `[ ]` pas commencé, `[*]` en cours (travail démarré, PR pas encore ouverte), `[x]` travail terminé et validé, PR ouverte. Reprendre au premier item non `[x]`. Si le dernier item `[x]` a encore sa PR ouverte (pas mergée), vérifier d'abord si elle est prête à merger avant de démarrer autre chose.

En cas de doute (case pas à jour, session interrompue en plein travail), vérifier le **Status** réel des issues sur le [GitHub Project](https://github.com/users/KerdanetYvan/projects/1) (`gh project item-list 1 --owner KerdanetYvan --format json`) et resynchroniser les cases ci-dessous en conséquence. Si l'ordre lui-même ne correspond plus à la réalité (nouvelle issue ajoutée, priorité changée en cours de route), le mettre à jour ici plutôt que de laisser ce fichier se périmer silencieusement.

**Convention** (revue le 2026-07-31, voir la rétro ci-dessous) :

- Cocher `[*]` dès qu'on commence à travailler sur une issue, avant le premier commit.
- Cocher `[x]` juste avant d'ouvrir la PR, une fois le travail terminé et validé (tests/lint/vérification manuelle passés) — **toute la tâche part dans une seule PR**, ouverte une fois le travail fini, pas au milieu.
- Ne pas ouvrir la PR puis continuer à pousser des ajouts/correctifs dessus au fil de l'eau après coup, surtout si elle a déjà pu être mergée entre-temps (ça force à ouvrir une PR de rattrapage hors contexte, comme pour #64). Si un besoin de retouche apparaît après avoir coché `[x]` mais avant d'ouvrir la PR, terminer la retouche d'abord, PUIS ouvrir la PR.
- Le Status réel sur le board (In Progress / Review-QA / Done) continue d'évoluer séparément via l'automatisation PR (`Closes #N`) et les workflows natifs du Project — la case `[x]` ici n'attend pas que la PR soit mergée, seulement que le travail soit fini et prêt à être proposé en revue.

## Ordre retenu

Les 19 issues du Sprint 2 (9 F2 déjà planifiées + 10 issues de correction ajoutées suite à la revue de fin de Sprint 1) sont volontairement **entrelacées** plutôt que traitées par lot : F2 est la fonctionnalité obligatoire du dossier de certification, elle ne doit pas prendre de retard à cause de corrections F1, mais les deux correctifs de navigation les plus rapides valent la peine d'être faits immédiatement.

- [x] [#64](https://github.com/KerdanetYvan/urbanflow-mobility/issues/64) (Dev FE) — Navigation conditionnelle selon l'authentification ([PR #76](https://github.com/KerdanetYvan/urbanflow-mobility/pull/76) + [PR #77](https://github.com/KerdanetYvan/urbanflow-mobility/pull/77), Done)
- [x] [#65](https://github.com/KerdanetYvan/urbanflow-mobility/issues/65) (Dev FE) — Déconnexion + garde d'authentification sur le profil
- [x] [#6](https://github.com/KerdanetYvan/urbanflow-mobility/issues/6) (Dev BE) — Intégrer OpenTripPlanner au backend *(traité avec #7 dans une seule PR)*
- [x] [#7](https://github.com/KerdanetYvan/urbanflow-mobility/issues/7) (Dev BE) — Endpoint de recherche d'itinéraires multimodaux — `GET /trips` prend origine/destination en **lat/lon uniquement** (pas de texte libre), voir #81
- [x] [#81](https://github.com/KerdanetYvan/urbanflow-mobility/issues/81) (Dev BE) — Endpoint de géocodage (texte → coordonnées) pour l'autocomplétion — `GET /places`, délègue au géocodeur OTP (`otp-config.json`, `SandboxAPIGeocoder`)
- [x] [#31](https://github.com/KerdanetYvan/urbanflow-mobility/issues/31) (QA) — Collection Postman de tests API — `docs/postman/`, vérifiée via Newman (16 requêtes, 24 assertions)
- [ ] [#38](https://github.com/KerdanetYvan/urbanflow-mobility/issues/38) (Dev BE) — Documentation API (OpenAPI/Swagger)
- [ ] [#26](https://github.com/KerdanetYvan/urbanflow-mobility/issues/26) (PO) — Specs détaillées des écrans F3 et scoring
- [ ] [#35](https://github.com/KerdanetYvan/urbanflow-mobility/issues/35) (Dev FE) — Écran de recherche d'itinéraire
- [ ] [#8](https://github.com/KerdanetYvan/urbanflow-mobility/issues/8) (Dev FE) — Affichage cartographique du trajet
- [ ] [#36](https://github.com/KerdanetYvan/urbanflow-mobility/issues/36) (Dev FE) — Écran de résultats d'itinéraires
- [ ] [#9](https://github.com/KerdanetYvan/urbanflow-mobility/issues/9) (Dev FE) — Géolocalisation temps réel de l'utilisateur
- [ ] [#68](https://github.com/KerdanetYvan/urbanflow-mobility/issues/68) (Dev BE) — Remplacer "mobilité réduite" par des préférences d'accessibilité détaillées
- [ ] [#69](https://github.com/KerdanetYvan/urbanflow-mobility/issues/69) (Dev FE) — Formulaire de profil : préférences d'accessibilité détaillées
- [ ] [#66](https://github.com/KerdanetYvan/urbanflow-mobility/issues/66) (Dev BE) — Étendre les modes de transport en commun (bus/métro/tram/train-TER)
- [ ] [#67](https://github.com/KerdanetYvan/urbanflow-mobility/issues/67) (Dev FE) — Formulaire de profil : cases par mode de transport en commun
- [ ] [#70](https://github.com/KerdanetYvan/urbanflow-mobility/issues/70) (Dev BE) — Mot de passe oublié (endpoints + envoi d'email)
- [ ] [#71](https://github.com/KerdanetYvan/urbanflow-mobility/issues/71) (Dev FE) — Écrans de réinitialisation de mot de passe
- [ ] [#72](https://github.com/KerdanetYvan/urbanflow-mobility/issues/72) (PO) — Specs de la refonte visuelle mobile-first / desktop
- [ ] [#73](https://github.com/KerdanetYvan/urbanflow-mobility/issues/73) (Dev FE) — Refonte de la disposition mobile/desktop

## Pourquoi cet ordre (raisonnement complet en cas de doute)

- **#64/#65 en tête** : correctifs de navigation quasi gratuits, très visibles (un utilisateur connecté qui voit encore "Connexion" saute aux yeux dans n'importe quelle démo) — aucune raison de ne pas les caser immédiatement avant le reste.
- **#6 → #7 → #81 → #31 → #38 → #26 → #35 → #8 → #36 → #9** : le cœur F2, dans l'ordre de ses dépendances techniques (l'endpoint avant les écrans qui le consomment, la carte avant l'écran de résultats qui l'intègre d'après les specs [#25](https://github.com/KerdanetYvan/urbanflow-mobility/issues/25)). #81 (géocodage) juste après #7 : #35 (écran de recherche) en a besoin pour l'autocomplétion, identifié comme un trou du backlog en cadrant #7. Priorité haute car F2 est la fonctionnalité **obligatoire** du dossier de certification.
- **#68/#69 avant #66/#67** : la correction sur l'accessibilité était la plus explicitement prioritaire lors de la revue ("exactement ce que je ne voulais surtout pas faire").
- **#70/#71 (mot de passe oublié) et #72/#73 (refonte visuelle) en dernier** : les deux chantiers les plus lourds et les moins critiques pour la certification (nouvelle dépendance email pour l'un, refonte complète du layout pour l'autre) — peuvent glisser sur Sprint 3 sans mettre F2 en danger si le temps manque. #73 dépend en plus structurellement de #64.

Deux alternatives ont été écartées en session : un ordre strictement mélangé sans tenir compte de la charge (rejeté, ne priorise pas assez F2), et un ordre en deux blocs stricts (les 10 corrections d'abord, puis les 9 F2) — écarté car il fait courir le risque que F2 démarre trop tard si un des gros chantiers (mot de passe oublié, refonte visuelle) prend plus de temps que prévu.

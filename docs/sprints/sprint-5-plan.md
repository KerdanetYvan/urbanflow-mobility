# Plan de traitement — Sprint 5 (milestone Stretch)

> Ordre de traitement décidé en session le 2026-09-05, à la suite de la clôture du Sprint 4 (voir `sprint-4-retro.md`). Toutes les issues listées ici restent rattachées au milestone GitHub **"Stretch (post-MVP)"** — même décision qu'aux clôtures des Sprints 3 et 4 de ne pas créer de milestone "Sprint 5" séparé, ce fichier sert uniquement de séquencement de travail à l'intérieur de Stretch.

## Comment reprendre après une coupure de session

Les cases ci-dessous font foi pour savoir où on en est : `[ ]` pas commencé, `[*]` en cours (travail démarré, PR pas encore ouverte), `[x]` travail terminé et validé, PR ouverte. Reprendre au premier item non `[x]`. Si le dernier item `[x]` a encore sa PR ouverte (pas mergée), vérifier d'abord si elle est prête à merger avant de démarrer autre chose.

En cas de doute (case pas à jour, session interrompue en plein travail), vérifier le **Status** réel des issues sur le [GitHub Project](https://github.com/users/KerdanetYvan/projects/1) (`gh project item-list 1 --owner KerdanetYvan --format json`) et resynchroniser les cases ci-dessous en conséquence.

**Convention** (héritée de `sprint-2-plan.md`/`sprint-3-plan.md`/`sprint-4-plan.md`) :

- Cocher `[*]` dès qu'on commence à travailler sur une issue, avant le premier commit.
- Cocher `[x]` juste avant d'ouvrir la PR, une fois le travail terminé et validé (tests/lint/vérification manuelle passés) — toute la tâche part dans une seule PR, ouverte une fois le travail fini.
- **Ne pas ouvrir la PR sans le feu vert explicite de l'utilisateur**, même une fois le travail fini — signaler que la tâche est prête, attendre confirmation avant `gh pr create`.
- Le Status réel sur le board continue d'évoluer séparément via l'automatisation PR (`Closes #N`) et les workflows natifs du Project — la case `[x]` ici n'attend pas que la PR soit mergée, seulement que le travail soit fini et prêt à être proposé en revue.
- Au démarrage d'une phase, passer **toutes** ses issues en Status "In Progress" sur le board, pas seulement celle en cours de traitement.

## Ordre retenu

15 issues : 4 loose ends reportés du Sprint 4 ([#41](https://github.com/KerdanetYvan/urbanflow-mobility/issues/41)/[#42](https://github.com/KerdanetYvan/urbanflow-mobility/issues/42)/[#264](https://github.com/KerdanetYvan/urbanflow-mobility/issues/264)/[#268](https://github.com/KerdanetYvan/urbanflow-mobility/issues/268)) + 11 constats de la revue testeur qui a clôturé le Sprint 4 ([#272](https://github.com/KerdanetYvan/urbanflow-mobility/issues/272)–[#282](https://github.com/KerdanetYvan/urbanflow-mobility/issues/282)), regroupés en 6 phases thématiques.

### Phase A — Corrections rapides, indépendantes de tout le reste

- [ ] [#274](https://github.com/KerdanetYvan/urbanflow-mobility/issues/274) (Dev FE) — Ne plus afficher le badge "Le plus adapté à vos critères" quand aucun critère n'est sélectionné (`itineraryBadges.ts`, `computeItineraryBadges`) — remplacer par un libellé neutre ("Trajet le plus rapide").
- [ ] [#278](https://github.com/KerdanetYvan/urbanflow-mobility/issues/278) (Dev FE/BE) — Retirer covoiturage/trottinette du sélecteur de préférences de profil (`lib/profile.ts`, `ProfilPage.tsx`, enum backend) — tolérer en lecture les profils existants qui ont déjà coché l'une des deux valeurs.
- [ ] [#279](https://github.com/KerdanetYvan/urbanflow-mobility/issues/279) (Dev FE) — Vérifier l'état réel du texte "Voir le détail" en desktop (déjà masqué par #170) et le retirer complètement du DOM si confirmé inutile.

### Phase B — Bugs à reproduire avant de coder un correctif

- [ ] [#281](https://github.com/KerdanetYvan/urbanflow-mobility/issues/281) (Dev FE/BE) — Historique cassé en prod : reproduire en conditions réelles, vérifier logs backend + réponse de `GET /trips/history`, avant tout correctif.
- [ ] [#282](https://github.com/KerdanetYvan/urbanflow-mobility/issues/282) (Dev BE) — `PATCH /profiles/me` renvoie parfois une 500 : récupérer les logs prod au moment de l'erreur avant d'agir, piste prioritaire = cohérence des valeurs enum envoyées par le frontend.

### Phase C — Sécurité et dette de tests (conformité OWASP/WCAG du dossier)

- [ ] [#268](https://github.com/KerdanetYvan/urbanflow-mobility/issues/268) (Dev BE) — Implémenter la rotation du refresh token (OWASP, Annexe C du dossier de certification).
- [ ] [#264](https://github.com/KerdanetYvan/urbanflow-mobility/issues/264) (Dev FE) — Réécrire le test e2e WCAG du popover "Modes de transport", obsolète depuis le passage aux chips (#255).

### Phase D — Cluster carte et détail d'itinéraire (`RecherchePageResults.tsx`/`MapView.tsx`)

- [ ] [#272](https://github.com/KerdanetYvan/urbanflow-mobility/issues/272) (Dev FE) — Remplacer les 2 tailles de glyphes (normale/grande) par 4 (petite/moyenne/grande/très grande) — `useGlyphScale.ts`, `useGlyphSizePreference.ts`, sélecteur dans `ProfilPage.tsx`.
- [ ] [#273](https://github.com/KerdanetYvan/urbanflow-mobility/issues/273) (Dev FE) — Corriger le padding de `fitBounds` (`MapView.tsx`) pour qu'il tienne compte des panneaux flottants qui chevauchent la carte, par breakpoint.
- [ ] [#275](https://github.com/KerdanetYvan/urbanflow-mobility/issues/275) (Dev BE/FE) — Remonter le détail réel d'une perturbation (`kind`/`headerText` de `RealtimeDisruption`) jusqu'à `TripItinerary`, afficher un message spécifique à la place de l'encadré générique — reformuler au passage le tiret cadratique de ce message.
- [ ] [#280](https://github.com/KerdanetYvan/urbanflow-mobility/issues/280) (Dev FE) — Mobile : déployer le bandeau et défiler jusqu'au détail au tap sur une carte, puis retirer le texte "Voir le détail" mobile devenu inutile (dépend de #279 pour le nettoyage desktop équivalent).

### Phase E — Suivi de trajet (cadrage PO puis implémentation)

- [ ] [#276](https://github.com/KerdanetYvan/urbanflow-mobility/issues/276) (PO) — Décider si le suivi de trajet doit rester réservé aux comptes, ou si une portée réduite (suivi anonyme local, sans anti-spam serveur) vaut la peine d'être implémentée — trancher avant tout code.
- [ ] [#277](https://github.com/KerdanetYvan/urbanflow-mobility/issues/277) (Dev FE) — Distinguer les causes du message "Notifications désactivées" (VAPID absent côté backend, refus navigateur déjà mémorisé, refus à l'instant) et adapter le message en conséquence — vérifier la configuration VAPID réelle en prod au passage.

### Phase F — Discipline continue / clôture

- [ ] [#42](https://github.com/KerdanetYvan/urbanflow-mobility/issues/42) (PO) — Documenter en continu les choix d'architecture
- [ ] [#41](https://github.com/KerdanetYvan/urbanflow-mobility/issues/41) (PO) — Préparer le support de démonstration pour la soutenance

## Pourquoi cet ordre (raisonnement complet en cas de doute)

- **Phase A en tête** : trois corrections indépendantes, sans dépendance croisée ni exploration — le lot le plus rapide à écouler, même logique qu'en Sprint 4.
- **Phase B avant tout le reste UX** : deux bugs de production signalés sans repro précise ([#281](https://github.com/KerdanetYvan/urbanflow-mobility/issues/281)/[#282](https://github.com/KerdanetYvan/urbanflow-mobility/issues/282)) — les traiter tôt permet de savoir s'ils cachent un problème plus profond (comme l'avait révélé #11 en Sprint 3) avant d'investir dans les phases suivantes, plutôt que de les laisser traîner en fin de sprint.
- **Phase C avant le cluster carte** : [#268](https://github.com/KerdanetYvan/urbanflow-mobility/issues/268) (sécurité OWASP) et [#264](https://github.com/KerdanetYvan/urbanflow-mobility/issues/264) (dette de test WCAG) sont des exigences transverses du dossier de certification, pas du confort utilisateur — cohérent avec le traitement de l'identité visuelle/accessibilité en tête de Sprint 4 (Phase B de `sprint-4-plan.md`).
- **Phase D regroupée par fichier** : [#272](https://github.com/KerdanetYvan/urbanflow-mobility/issues/272)/[#273](https://github.com/KerdanetYvan/urbanflow-mobility/issues/273)/[#275](https://github.com/KerdanetYvan/urbanflow-mobility/issues/275)/[#280](https://github.com/KerdanetYvan/urbanflow-mobility/issues/280) touchent tous `RecherchePageResults.tsx`/`MapView.tsx` — les traiter ensemble évite les conflits de merge et les allers-retours sur les mêmes fichiers. [#280](https://github.com/KerdanetYvan/urbanflow-mobility/issues/280) en dernier de la phase car il referme la boucle ouverte par [#279](https://github.com/KerdanetYvan/urbanflow-mobility/issues/279) (Phase A).
- **Phase E après le cluster carte** : [#276](https://github.com/KerdanetYvan/urbanflow-mobility/issues/276) est une décision PO qui peut faire évoluer significativement [#277](https://github.com/KerdanetYvan/urbanflow-mobility/issues/277) (si le suivi anonyme est retenu, le flux de permission notification change) — les deux vivent dans `TripFollowButton`, pas de raison de les mélanger avec le cluster résultats/carte.
- **Phase F en tout dernier** : même raisonnement qu'aux Sprints 3 et 4 — scénariser une démo ([#41](https://github.com/KerdanetYvan/urbanflow-mobility/issues/41)) n'a de sens qu'une fois le reste stabilisé, et [#42](https://github.com/KerdanetYvan/urbanflow-mobility/issues/42) reste une discipline continue plutôt qu'un jalon avec un début et une fin propres.

**Point de vigilance** : contrairement au Sprint 4 (28 issues, delta connu dès le départ), ce plan ne compte que 15 issues séquencées — mais l'expérience du Sprint 4 montre qu'une bonne part du travail réel se découvre en testant en conditions réelles plutôt qu'en planifiant à l'avance. Ne pas être surpris si de nouvelles issues s'ajoutent en cours de route.

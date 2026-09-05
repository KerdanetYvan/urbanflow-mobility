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

15 issues : 4 loose ends reportés du Sprint 4 ([#41](https://github.com/KerdanetYvan/urbanflow-mobility/issues/41)/[#42](https://github.com/KerdanetYvan/urbanflow-mobility/issues/42)/[#264](https://github.com/KerdanetYvan/urbanflow-mobility/issues/264)/[#268](https://github.com/KerdanetYvan/urbanflow-mobility/issues/268)) + 11 constats de la revue testeur qui a clôturé le Sprint 4 ([#272](https://github.com/KerdanetYvan/urbanflow-mobility/issues/272)–[#282](https://github.com/KerdanetYvan/urbanflow-mobility/issues/282)).

**Principe de priorisation retenu (décision utilisateur en session, remplace le regroupement par fonctionnalité initialement proposé)** : on ne trie plus par brique technique mais par **visibilité de l'issue** — une carte mal centrée ou des glyphes trop petits touchent quiconque lance une recherche, connecté ou non, alors qu'une 500 sur `PATCH /profiles/me` ne touche qu'un utilisateur connecté en train d'éditer son profil, un cas plus proche du "bug MVP" ponctuel. D'où 3 paliers, dans cet ordre :

1. **Visibilité générale** (`/recherche`, connecté ou non) — la première chose vue par n'importe quel visiteur.
2. **Visibilité connecté** (profil, historique, suivi de trajet) — visible seulement après connexion.
3. **Fonctionnel / dette** — bugs et travaux sans visibilité UI directe (sécurité, tests, process).

### Phase A — Visibilité générale (`/recherche`, connecté ou non)

- [x] [#272](https://github.com/KerdanetYvan/urbanflow-mobility/issues/272) (Dev FE) — **Priorité du sprint** (décision utilisateur) : remplacer les 2 tailles de glyphes (normale/grande) par 4 (petite/moyenne/grande/très grande) — `useGlyphScale.ts`, `useGlyphSizePreference.ts`, sélecteur dans `ProfilPage.tsx`. Affiché sur la carte dès la première recherche, avant même toute connexion. Grillé en session (`/grill-me`) : "moyenne" devient le nouveau défaut (l'ancien maximum restait perçu comme minuscule), facteur d'écran de base revu à la hausse. Périmètre resserré après vérification visuelle réelle (Playwright) : seuls les pins origine/destination suivent ce réglage, pas les stations GBFS/correspondances/position (chevauchement illisible constaté en zone dense mobile sinon). Tests/lint/build verts, en attente de vérification locale par l'utilisateur avant PR.
- [x] [#273](https://github.com/KerdanetYvan/urbanflow-mobility/issues/273) (Dev FE) — Corriger le padding de `fitBounds` (`MapView.tsx`) pour qu'il tienne compte des panneaux flottants qui chevauchent la carte, par breakpoint — même écran que #272. Grillé en session (`/grill-me`) : mesure réelle des panneaux (`ResizeObserver`) plutôt qu'une constante figée, recalcul sur repli/déploiement du bandeau mobile en plus du changement d'itinéraire. Nouveau hook `useMapSafeAreaPadding` ; cas "point unique/vue par défaut" traité par projection du centre plutôt que `panBy`. Vérifié visuellement en réel (Playwright) : décalage horizontal correct en vue par défaut desktop, recadrage effectif au repli du bandeau mobile. Tests/lint/build verts.
- [ ] [#274](https://github.com/KerdanetYvan/urbanflow-mobility/issues/274) (Dev FE) — Ne plus afficher le badge "Le plus adapté à vos critères" quand aucun critère n'est sélectionné (`itineraryBadges.ts`, `computeItineraryBadges`) — remplacer par un libellé neutre ("Trajet le plus rapide"). Visible sur quasi toutes les recherches sans profil.
- [ ] [#279](https://github.com/KerdanetYvan/urbanflow-mobility/issues/279) (Dev FE) — Vérifier l'état réel du texte "Voir le détail" en desktop (déjà masqué par #170) et le retirer complètement du DOM si confirmé inutile.
- [ ] [#280](https://github.com/KerdanetYvan/urbanflow-mobility/issues/280) (Dev FE) — Mobile : déployer le bandeau et défiler jusqu'au détail au tap sur une carte, puis retirer le texte "Voir le détail" mobile devenu inutile (juste après #279, même nettoyage desktop/mobile).
- [ ] [#275](https://github.com/KerdanetYvan/urbanflow-mobility/issues/275) (Dev BE/FE) — Remonter le détail réel d'une perturbation (`kind`/`headerText` de `RealtimeDisruption`) jusqu'à `TripItinerary`, afficher un message spécifique à la place de l'encadré générique — reformuler au passage le tiret cadratique. Dernier de la phase : ne s'affiche que si une perturbation est réellement en cours, moins systématiquement visible que les 5 items précédents.

### Phase B — Visibilité connecté (profil, historique, suivi de trajet)

- [ ] [#278](https://github.com/KerdanetYvan/urbanflow-mobility/issues/278) (Dev FE/BE) — Retirer covoiturage/trottinette du sélecteur de préférences de profil (`lib/profile.ts`, `ProfilPage.tsx`, enum backend) — tolérer en lecture les profils existants qui ont déjà coché l'une des deux valeurs.
- [ ] [#281](https://github.com/KerdanetYvan/urbanflow-mobility/issues/281) (Dev FE/BE) — Historique cassé en prod : reproduire en conditions réelles, vérifier logs backend + réponse de `GET /trips/history`, avant tout correctif.
- [ ] [#276](https://github.com/KerdanetYvan/urbanflow-mobility/issues/276) (PO) — Décider si le suivi de trajet doit rester réservé aux comptes, ou si une portée réduite (suivi anonyme local, sans anti-spam serveur) vaut la peine d'être implémentée — trancher avant tout code.
- [ ] [#277](https://github.com/KerdanetYvan/urbanflow-mobility/issues/277) (Dev FE) — Distinguer les causes du message "Notifications désactivées" (VAPID absent côté backend, refus navigateur déjà mémorisé, refus à l'instant) et adapter le message en conséquence — vérifier la configuration VAPID réelle en prod au passage. Juste après #276 : la décision PO peut changer ce flux.

### Phase C — Fonctionnel / dette (sans visibilité UI directe)

- [ ] [#282](https://github.com/KerdanetYvan/urbanflow-mobility/issues/282) (Dev BE) — `PATCH /profiles/me` renvoie parfois une 500 : récupérer les logs prod au moment de l'erreur avant d'agir, piste prioritaire = cohérence des valeurs enum envoyées par le frontend. Un bug MVP ponctuel, pas une régression visible en continu.
- [ ] [#268](https://github.com/KerdanetYvan/urbanflow-mobility/issues/268) (Dev BE) — Implémenter la rotation du refresh token (OWASP, Annexe C du dossier de certification) — invisible pour l'utilisateur, exigence transverse du dossier.
- [ ] [#264](https://github.com/KerdanetYvan/urbanflow-mobility/issues/264) (Dev FE) — Réécrire le test e2e WCAG du popover "Modes de transport", obsolète depuis le passage aux chips (#255) — dette de test, aucune visibilité produit.
- [ ] [#42](https://github.com/KerdanetYvan/urbanflow-mobility/issues/42) (PO) — Documenter en continu les choix d'architecture
- [ ] [#41](https://github.com/KerdanetYvan/urbanflow-mobility/issues/41) (PO) — Préparer le support de démonstration pour la soutenance

## Pourquoi cet ordre (raisonnement complet en cas de doute)

- **Priorisation par visibilité plutôt que par brique technique** (décision utilisateur en session, remplace le découpage par fonctionnalité de la première version de ce plan) : ce qui est vu par le plus grand nombre d'utilisateurs, connectés ou non, passe avant ce qui n'est vu que par un utilisateur connecté, qui passe lui-même avant ce qui n'a aucune visibilité produit directe (sécurité, tests, process). Un bug "fonctionnel" comme [#282](https://github.com/KerdanetYvan/urbanflow-mobility/issues/282) (500 ponctuelle sur le profil) compte comme un simple bug MVP, pas comme prioritaire face à un défaut visible sur l'écran d'entrée de l'app.
- **[#272](https://github.com/KerdanetYvan/urbanflow-mobility/issues/272) en tête absolue** : les glyphes de carte s'affichent dès la première recherche, avant toute connexion — la surface la plus visible du produit.
- **Phase A ordonnée par fréquence d'affichage réelle** : carte ([#272](https://github.com/KerdanetYvan/urbanflow-mobility/issues/272)/[#273](https://github.com/KerdanetYvan/urbanflow-mobility/issues/273), toujours visible) puis liste de résultats ([#274](https://github.com/KerdanetYvan/urbanflow-mobility/issues/274)/[#279](https://github.com/KerdanetYvan/urbanflow-mobility/issues/279)/[#280](https://github.com/KerdanetYvan/urbanflow-mobility/issues/280), quasi toujours visible) puis détail conditionnel ([#275](https://github.com/KerdanetYvan/urbanflow-mobility/issues/275), seulement si une perturbation existe réellement). [#280](https://github.com/KerdanetYvan/urbanflow-mobility/issues/280) juste après [#279](https://github.com/KerdanetYvan/urbanflow-mobility/issues/279) : même nettoyage desktop/mobile, à ne pas séparer.
- **Phase B, [#276](https://github.com/KerdanetYvan/urbanflow-mobility/issues/276) avant [#277](https://github.com/KerdanetYvan/urbanflow-mobility/issues/277)** : la décision PO sur l'obligation de compte peut faire évoluer le flux de permission notification, pas de raison technique de les inverser.
- **Phase C, [#282](https://github.com/KerdanetYvan/urbanflow-mobility/issues/282) en tête** : reste un bug utilisateur (même ponctuel), à traiter avant la dette pure (sécurité/tests/process) qui n'a aucune visibilité produit. [#42](https://github.com/KerdanetYvan/urbanflow-mobility/issues/42)/[#41](https://github.com/KerdanetYvan/urbanflow-mobility/issues/41) restent en tout dernier, même raisonnement qu'aux Sprints 3 et 4 (démo/doc n'ont de sens qu'une fois le reste stabilisé).

**Point de vigilance** : contrairement au Sprint 4 (28 issues, delta connu dès le départ), ce plan ne compte que 15 issues séquencées — mais l'expérience du Sprint 4 montre qu'une bonne part du travail réel se découvre en testant en conditions réelles plutôt qu'en planifiant à l'avance. Ne pas être surpris si de nouvelles issues s'ajoutent en cours de route.

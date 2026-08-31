# Plan de traitement — Sprint 4 (milestone Stretch)

> Ordre de traitement décidé en session le 2026-08-25, à la suite de la revue de fin de Sprint 3 ([#163](https://github.com/KerdanetYvan/urbanflow-mobility/issues/163), voir `sprint-3-retro.md`). Toutes les issues listées ici restent rattachées au milestone GitHub **"Stretch (post-MVP)"** — décision utilisateur en session de ne pas créer de milestone "Sprint 4" séparé, ce fichier sert uniquement de séquencement de travail à l'intérieur de Stretch.

## Comment reprendre après une coupure de session

Les cases ci-dessous font foi pour savoir où on en est : `[ ]` pas commencé, `[*]` en cours (travail démarré, PR pas encore ouverte), `[x]` travail terminé et validé, PR ouverte. Reprendre au premier item non `[x]`. Si le dernier item `[x]` a encore sa PR ouverte (pas mergée), vérifier d'abord si elle est prête à merger avant de démarrer autre chose.

En cas de doute (case pas à jour, session interrompue en plein travail), vérifier le **Status** réel des issues sur le [GitHub Project](https://github.com/users/KerdanetYvan/projects/1) (`gh project item-list 1 --owner KerdanetYvan --format json`) et resynchroniser les cases ci-dessous en conséquence.

**Convention** (héritée de `sprint-2-plan.md`/`sprint-3-plan.md`) :

- Cocher `[*]` dès qu'on commence à travailler sur une issue, avant le premier commit.
- Cocher `[x]` juste avant d'ouvrir la PR, une fois le travail terminé et validé (tests/lint/vérification manuelle passés) — toute la tâche part dans une seule PR, ouverte une fois le travail fini.
- **Ne pas ouvrir la PR sans le feu vert explicite de l'utilisateur**, même une fois le travail fini — signaler que la tâche est prête, attendre confirmation avant `gh pr create`.
- Le Status réel sur le board continue d'évoluer séparément via l'automatisation PR (`Closes #N`) et les workflows natifs du Project — la case `[x]` ici n'attend pas que la PR soit mergée, seulement que le travail soit fini et prêt à être proposé en revue.

## Ordre retenu

28 issues du milestone Stretch (8 déjà présentes avant la clôture du Sprint 3 + 20 ajoutées lors de cette clôture — audit UX Impeccable, revue fonctionnelle API, revue visuelle utilisateur/bêta-testeurs — voir `sprint-3-retro.md` section 5), regroupées en 6 phases thématiques plutôt que traitées dans l'ordre de création.

### Phase A — Corrections rapides, indépendantes de tout le reste

- [x] [#175](https://github.com/KerdanetYvan/urbanflow-mobility/issues/175) (Dev FE) — Corriger l'erreur de correspondance des mots de passe qui ne se réinitialise pas — `handlePasswordChange`/`handleConfirmPasswordChange` (`ConnexionPage.tsx`) effacent `fieldErrors.password`/`confirmPassword` dès qu'un des deux champs change, plutôt que d'attendre le prochain submit. Test de régression ajouté.
- [x] [#177](https://github.com/KerdanetYvan/urbanflow-mobility/issues/177) (Dev FE) — Reformuler les textes UI utilisant des tirets cadratiques — 4 occurrences reformulées (`RecherchePageResults.tsx`, `RecherchePage.tsx`, `ProfilPage.tsx`) : ponctuation naturelle (point) pour les messages d'erreur, séparateur `·` déjà utilisé ailleurs dans le projet (`RecherchePage.tsx:144`, `RecherchePageResults.tsx:302`) pour le contexte de recherche. Tests mis à jour en conséquence.
- [x] [#162](https://github.com/KerdanetYvan/urbanflow-mobility/issues/162) (Dev FE) — Uniformiser le vocabulaire visuel de chargement — nouveau composant partagé `components/Skeleton/Skeleton.tsx` (extrait de l'ancien `ResultsSkeleton` de `RecherchePageResults.tsx`), utilisé sur Recherche/Résultats, Profil et Historique à la place du texte "Chargement…". Tests mis à jour en conséquence.
- [x] [#174](https://github.com/KerdanetYvan/urbanflow-mobility/issues/174) (Dev FE) — Rendre la page Historique interactive — bouton "Relancer cette recherche" sur chaque `HistoryEntryCard` (`HistoriquePage.tsx`), qui navigue vers `/recherche` avec origine/destination en état de navigation React Router. `RecherchePage.tsx` lit cet état au montage et relance la recherche via `handleQuickSearch` existante (issue #112), sans dupliquer sa logique. Conversion `TripHistoryEntry → PlaceSuggestion` factorisée dans `entryToPlaces` (`lib/trips.ts`), réutilisée aussi par `RechercheQuickShortcuts` (auparavant dupliquée). Tests ajoutés des deux côtés.
- [x] [#176](https://github.com/KerdanetYvan/urbanflow-mobility/issues/176) (Dev FE) — Ajouter un `robots.txt` valide — `frontend/public/robots.txt` minimal (`User-agent: *` / `Allow: /`), pas de directive `Sitemap` (aucun domaine de production ni `sitemap.xml` n'existe encore). Vérifié copié à la racine du build (`dist/robots.txt`) via `npm run build`.

### Phase B — Identité visuelle (audit Impeccable)

- [x] [#158](https://github.com/KerdanetYvan/urbanflow-mobility/issues/158) (Dev FE) — Faire gagner l'ambre déjà engagé (manifest/favicon) sur le bleu qui déborde — `--color-primary-emphasis` sur anneau de focus (`FormField.css`), bouton secondaire (`Button.css`), marqueurs origine/position carte (`MapView.tsx`/`.css`) ; skip-link passé à `--color-primary` + `--color-on-primary` (surface pleine, cas distinct de l'anneau/bordure). `--color-secondary` conservé en usage restreint (`--color-info`). Vérifié en thème clair et sombre, suite `test:e2e` WCAG toujours à 9/9.
- [x] [#159](https://github.com/KerdanetYvan/urbanflow-mobility/issues/159) (Dev FE) — Traitement visuel du nom UrbanFlow Mobility (`AppLayout`) — wordmark "UrbanFlow" (icône `BrandMarkIcon` + "Flow" en `--color-primary-emphasis`) suivi de "Mobility" en descriptif atténué ; bordure d'accent générique retirée (`index.css` h1 desktop, pattern "side-tab" signalé par l'audit Impeccable) et son équivalent sur `.app-header` desktop. Détecteur Impeccable et suite `test:e2e` WCAG (9/9) au vert, vérifié clair/sombre/mobile/desktop.

### Phase C — Refonte complète de l'écran `/recherche`

- [x] [#171](https://github.com/KerdanetYvan/urbanflow-mobility/issues/171) (PO) — Specs : fusionner la card de recherche et la card de résultats — `docs/specs/fusion-recherche-resultats.md` : panneau unique persistant (Vue Édition / Vue Résumé + liste) à la place des deux panneaux mutuellement exclusifs actuels, reprend la position du panneau résultats en desktop, bandeau mobile unifié à 3 états. Ferme aussi #160 (hauteur d'ouverture par défaut).
- [x] [#172](https://github.com/KerdanetYvan/urbanflow-mobility/issues/172) (Dev FE) — Implémentation — dépend de #171 — bascule Édition/Résumé ajoutée à `RecherchePageResults` (`isEditingSearch`/`renderEditForm`), formulaire factorisé en une fonction de rendu partagée (`RecherchePage.tsx`) réutilisée au premier chargement et en édition en place. `.recherche-panel-form` déplacé dans `RecherchePageResults.css`, repositionné bas-gauche en desktop (parité avec `.resultats-panel-list`, plus de saut de panneau) et hauteur d'ouverture mobile passée d'un `70vh` fixe à une hauteur intrinsèque plafonnée (ferme #160). Écart assumé par rapport à la spec : liste/détail démontés (pas seulement masqués) pendant l'édition, pour éviter un id de champ dupliqué dans le DOM — voir commentaire dans `RecherchePageResults.tsx`. 180/180 tests unitaires, 9/9 e2e WCAG, vérifié clair/sombre/mobile/desktop.
- [*] [#181](https://github.com/KerdanetYvan/urbanflow-mobility/issues/181) (Dev FE) — Remplacer les transitions sur `height` par `transform`/`grid-template-rows` (finding détecteur Impeccable, bandeau formulaire + panneau résultats) — juste après #172, sur les mêmes fichiers
- [ ] [#165](https://github.com/KerdanetYvan/urbanflow-mobility/issues/165) (PO) — Specs : fusionner position/domicile/travail/historique dans le champ d'autocomplétion
- [ ] [#166](https://github.com/KerdanetYvan/urbanflow-mobility/issues/166) (Dev FE) — Implémentation — dépend de #165
- [ ] [#161](https://github.com/KerdanetYvan/urbanflow-mobility/issues/161) (Dev FE) — Protection anti-débordement sur les libellés d'adresse
- [ ] [#169](https://github.com/KerdanetYvan/urbanflow-mobility/issues/169) (Dev FE) — Limiter l'affichage à un seul badge qualitatif par carte de trajet
- [ ] [#170](https://github.com/KerdanetYvan/urbanflow-mobility/issues/170) (Dev FE) — Retirer le texte "Voir le détail" en desktop (garder en mobile)
- [ ] [#173](https://github.com/KerdanetYvan/urbanflow-mobility/issues/173) (Dev FE) — Déplacer l'affichage du prochain passage vers le détail de l'itinéraire
- [ ] [#87](https://github.com/KerdanetYvan/urbanflow-mobility/issues/87) (Dev BE/FE) — Filtrer `GET /trips` par modes de transport préférés
- [ ] [#190](https://github.com/KerdanetYvan/urbanflow-mobility/issues/190) (Dev BE/FE) — Intégrer l'état vide au panneau fusionné + proposer un trajet à pied de repli — ajoutée en session le 2026-08-26 suite au constat que l'état vide casse encore la disposition carte+panneau après #171/#172. Traitée avant #91 : sert de fondation (état vide intégré au panneau) sur laquelle #91 vient ensuite ajouter son propre repli (bouton "prochain créneau"), plutôt que l'inverse. Vélo (GBFS) explicitement hors périmètre : `mode` figé à `TRANSIT,WALK` dans `OtpClientService`, pas encore de source de données vélo chargée dans OTP — backlog séparé, pas encore d'issue dédiée.
- [ ] [#91](https://github.com/KerdanetYvan/urbanflow-mobility/issues/91) (Dev BE/FE) — Suggérer le prochain créneau disponible si aucun itinéraire trouvé — dépend maintenant de #190 (voir ci-dessus) : s'ajoute a l'etat vide integre au panneau plutot que de le construire lui-meme.

### Phase D — Géocodage réel (Nominatim)

- [ ] [#167](https://github.com/KerdanetYvan/urbanflow-mobility/issues/167) (PO) — Specs : intégrer Nominatim auto-hébergé pour un géocodage d'adresses réel
- [ ] [#168](https://github.com/KerdanetYvan/urbanflow-mobility/issues/168) (Dev BE) — Implémentation — dépend de #167

### Phase E — F3/Scoring déjà en Stretch avant cette clôture

- [ ] [#23](https://github.com/KerdanetYvan/urbanflow-mobility/issues/23) (Dev FE) — Éco-conception : limiter les appels réseau
- [ ] [#13](https://github.com/KerdanetYvan/urbanflow-mobility/issues/13) (Dev BE) — Ingestion des flux GBFS (vélos/trottinettes libre-service)
- [ ] [#14](https://github.com/KerdanetYvan/urbanflow-mobility/issues/14) (Dev BE) — Abonnement aux mises à jour GTFS-Realtime
- [ ] [#18](https://github.com/KerdanetYvan/urbanflow-mobility/issues/18) (Dev BE/FE) — Recalcul automatique et notification push sur perturbation — dépend de #14
- [ ] [#10](https://github.com/KerdanetYvan/urbanflow-mobility/issues/10) (Dev FE) — Mode dégradé : cache des derniers trajets utiles
- [ ] [#15](https://github.com/KerdanetYvan/urbanflow-mobility/issues/15) (Dev BE) — Architecture pluggable pour un nouvel opérateur

### Phase F — Discipline continue / clôture

- [ ] [#42](https://github.com/KerdanetYvan/urbanflow-mobility/issues/42) (PO) — Documenter en continu les choix d'architecture
- [ ] [#41](https://github.com/KerdanetYvan/urbanflow-mobility/issues/41) (PO) — Préparer le support de démonstration pour la soutenance

## Pourquoi cet ordre (raisonnement complet en cas de doute)

- **Phase A en tête** : tout est indépendant, sans spec ni dépendance croisée — le lot le plus rapide à écouler, permet de nettoyer le terrain avant les phases plus lourdes. [#176](https://github.com/KerdanetYvan/urbanflow-mobility/issues/176) placée en dernier de la phase (décision utilisateur en session) plutôt qu'en tête comme le reste des petits fixes.
- **Phase B avant la Phase C** : les deux issues Impeccable ([#158](https://github.com/KerdanetYvan/urbanflow-mobility/issues/158)/[#159](https://github.com/KerdanetYvan/urbanflow-mobility/issues/159)) sont transverses à tout l'app (couleur d'interaction, nom du produit) — les traiter avant la refonte de `/recherche` évite de devoir retoucher les nouveaux composants de la Phase C une deuxième fois pour la couleur.
- **Phase C, fusion des cards en tête de sous-groupe** : [#171](https://github.com/KerdanetYvan/urbanflow-mobility/issues/171)/[#172](https://github.com/KerdanetYvan/urbanflow-mobility/issues/172) changent la disposition de base de l'écran. L'autocomplétion unifiée ([#165](https://github.com/KerdanetYvan/urbanflow-mobility/issues/165)/[#166](https://github.com/KerdanetYvan/urbanflow-mobility/issues/166)) et tous les ajustements de détail qui suivent (anti-débordement, badges, "Voir le détail", prochain passage, filtre de modes, prochain créneau) vivent sur ce même écran : les construire sur la disposition finale évite de les refaire une fois la fusion livrée — même logique que la Phase C de `sprint-3-plan.md`.
- **Phase D isolée plutôt qu'intégrée à la Phase C** : Nominatim est le plus gros investissement infra du lot (service auto-hébergé, import de données, décision d'articulation avec le géocodeur OTP) — suffisamment autonome pour être menée en parallèle de la Phase C si la charge de travail le permet, plutôt que de bloquer la refonte de `/recherche` derrière elle.
- **Phase E réordonnée à la demande** : [#23](https://github.com/KerdanetYvan/urbanflow-mobility/issues/23) (éco-conception) passée en tête plutôt qu'en fin de phase, [#15](https://github.com/KerdanetYvan/urbanflow-mobility/issues/15) (architecture pluggable) repoussée en dernier — décision utilisateur en session, pas de justification technique particulière au-delà de la préférence exprimée. [#18](https://github.com/KerdanetYvan/urbanflow-mobility/issues/18) reste après [#14](https://github.com/KerdanetYvan/urbanflow-mobility/issues/14) (dépendance directe : pas de recalcul sur perturbation sans l'abonnement GTFS-Realtime qui la détecte).
- **Phase F en tout dernier** : même raisonnement qu'en Sprint 3 — scénariser une démo ([#41](https://github.com/KerdanetYvan/urbanflow-mobility/issues/41)) sur des fonctionnalités pas encore stables n'a pas de sens, et [#42](https://github.com/KerdanetYvan/urbanflow-mobility/issues/42) reste une discipline continue plutôt qu'un jalon avec un début et une fin propres.

**Point de vigilance** (déjà signalé dans `sprint-3-retro.md` section 5) : 28 issues, c'est nettement plus qu'un sprint standard (Sprint 3 en comptait 24 sur 2 semaines pleines). Les Phases D et E sont les candidates les plus sûres à glisser plus loin si le rythme ne suit pas — aucune n'est bloquante pour la certification, contrairement aux phases obligatoires des sprints précédents.

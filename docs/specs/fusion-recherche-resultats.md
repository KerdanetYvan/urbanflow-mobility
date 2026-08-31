# Spécifications détaillées — Fusion des cards recherche/résultats sur `/recherche`

> Casquette PO — issue [#171](https://github.com/KerdanetYvan/urbanflow-mobility/issues/171), Sprint 4 (Phase C).
> Sert de base à l'implémentation Dev FE de l'issue [#172](https://github.com/KerdanetYvan/urbanflow-mobility/issues/172).
> Ferme également l'issue [#160](https://github.com/KerdanetYvan/urbanflow-mobility/issues/160) (voir section 3).

## 1. Périmètre

Constat de la revue fonctionnelle de fin de Sprint 3 (retour utilisateur, 2026-08-25) : `/recherche` présente aujourd'hui **deux panneaux mutuellement exclusifs** au-dessus de la carte permanente (issues [#110](https://github.com/KerdanetYvan/urbanflow-mobility/issues/110)/[#111](https://github.com/KerdanetYvan/urbanflow-mobility/issues/111), `docs/specs/recherche-carte-permanente.md`) :

- le panneau **formulaire** (`RecherchePage.tsx`, `.recherche-panel-form`), affiché tant qu'aucune recherche n'est en cours ;
- le panneau **résultats** (`RecherchePageResults.tsx`, `.resultats-panel-list` + bandeau `.resultats-sheet`), qui le remplace entièrement dès qu'une recherche est lancée.

`SearchContext` (le texte "De X à Y · Modifier la recherche" déjà présent en tête du panneau résultats) déclenche aujourd'hui un retour complet à l'écran formulaire au clic sur "Modifier" — les résultats disparaissent entièrement le temps de l'édition, alors que les critères modifiés (adresses, heure, modes) sont pourtant déjà pré-remplis en mémoire (`RecherchePage`, état jamais réinitialisé entre écrans). Ce document cadre la fusion des deux panneaux en **un seul**, qui persiste visuellement à travers les 3 états de la machine à états `Screen` (`formulaire` / `recherche` / `resultats`) plutôt que d'en faire apparaître/disparaître un second.

**Chevauche l'issue [#160](https://github.com/KerdanetYvan/urbanflow-mobility/issues/160)** (le bandeau formulaire mobile s'ouvre à 70vh par défaut, masquant la carte au premier contact) : une fusion des deux panneaux change de toute façon la hauteur d'ouverture par défaut de l'écran d'arrivée sur `/recherche` (voir section 3.2) — #160 est fermée au profit de celle-ci plutôt que traitée séparément.

**Hors périmètre** :
- Le contenu des champs eux-mêmes (autocomplétion, validation, filtre des modes de transport) est déjà cadré par `docs/specs/f2-ecrans-planification.md` section 2.1 et `docs/specs/filtre-modes-transport.md` — repris tel quel, seul son emplacement change.
- Le panneau détail segment par segment (`.resultats-panel-detail`, `ItinerarySegments`) n'est pas concerné par la fusion : il reste un panneau à part, inchangé.
- La technique d'animation d'ouverture/fermeture du bandeau (`transition: height`) est traitée par l'issue [#181](https://github.com/KerdanetYvan/urbanflow-mobility/issues/181), qui intervient juste après l'implémentation de cette spec sur les mêmes fichiers — cette spec ne prescrit aucune technique CSS d'animation, seulement la disposition et les états.
- L'état "recherche en cours" (squelette) et, à l'origine, l'état vide n'étaient pas des panneaux flottants — voir section 5. **Mis à jour par l'issue [#190](https://github.com/KerdanetYvan/urbanflow-mobility/issues/190)** : maintenant que le panneau fusionné existe, l'état vide y est intégré (carte plein écran conservée en fond), et un repli à pied est proposé quand aucun trajet en transport en commun n'est trouvé. L'état "recherche en cours" reste tel quel.

## 2. Disposition cible : un panneau unique, deux vues internes

Le panneau formulaire et le panneau résultats (liste) fusionnent en **un seul conteneur visuel**, monté en continu dès l'arrivée sur `/recherche` et jamais démonté/remonté en changeant d'état `Screen` — seul son **contenu interne** change. Ce conteneur a deux vues, mutuellement exclusives :

- **Vue Édition** : les champs actuels du formulaire, repris à l'identique (Origine, raccourcis d'origine, bouton Inverser, Destination, filtre Modes de transport, divulgation "Plus d'options" avec l'heure de départ, bouton "Rechercher"). Affichée par défaut à l'arrivée sur l'écran (aucune recherche encore lancée) et rappelable à tout moment via "Modifier".
- **Vue Résumé** : le résumé compact "De {origine} à {destination}" + un bouton "Modifier" (reprend `SearchContext` tel quel) suivi de la liste des itinéraires (`ResultsList`). Affichée par défaut dès qu'une recherche a produit des résultats.

**Bascule entre les deux vues** :
- "Modifier" (Vue Résumé → Vue Édition) : n'importe quand une fois des résultats obtenus, sans perdre la liste affichée en dessous à la fermeture.
- Un bouton "Annuler" apparaît dans la Vue Édition **uniquement si des résultats existent déjà** (retour à la Vue Résumé sans relancer de recherche — les champs modifiés restent tels quels en mémoire, rien n'est réinitialisé, cohérent avec le comportement déjà en place aujourd'hui pour les autres champs du formulaire).
- Soumettre le formulaire (bouton "Rechercher") depuis la Vue Édition relance la recherche comme aujourd'hui (`performSearch`) et fait automatiquement revenir à la Vue Résumé une fois les nouveaux résultats reçus — pas d'action manuelle supplémentaire nécessaire après une recherche réussie.

Ce découpage ne dépend pas de la présence de résultats à proprement parler mais d'un simple bascule Édition/Résumé : au tout premier chargement (aucune recherche encore lancée), seule la Vue Édition a un sens (pas de "Annuler" possible, pas de liste à résumer) — ce cas particulier est déjà couvert par la règle ci-dessus.

## 3. Comportement desktop vs mobile

### 3.1 Desktop (≥768px)

Le panneau fusionné reprend la **position et la largeur du panneau résultats actuel** (`.resultats-panel-list` : bas-gauche, 22rem) pour les 3 états de `Screen`, plutôt que la position du panneau formulaire actuel (haut-gauche). Objectif : aucun déplacement visuel du panneau au moment où les premiers résultats arrivent — seul son contenu interne bascule de la Vue Édition vers la Vue Résumé, la boîte elle-même ne bouge pas. Le panneau détail (`.resultats-panel-detail`, 20rem), à sa droite, n'apparaît que lorsqu'un itinéraire est sélectionné (inchangé).

### 3.2 Mobile

Le bandeau bas formulaire (`.recherche-panel-form`, 2 états) et le bandeau bas résultats (`.resultats-sheet`, 3 états) fusionnent en **un seul bandeau**, repris à 3 états unifiés :
- `collapsed` : poignée seule + aperçu — "Rechercher un trajet" tant qu'aucun résultat n'existe (état actuel de `.recherche-panel-form[data-sheet-state='collapsed']`), ou l'aperçu compact de l'itinéraire sélectionné une fois des résultats obtenus (`CompactPreview`, état actuel de `.resultats-sheet` repli).
- `body` : la Vue Édition ou la Vue Résumé + liste (section 2), selon la bascule en cours — remplace à la fois l'état `expanded` du bandeau formulaire et l'état `list` du bandeau résultats.
- `detail` : détail segment par segment de l'itinéraire sélectionné (inchangé, `ItinerarySegments`).

**Hauteur d'ouverture par défaut (ferme #160)** : le bandeau ne s'ouvre plus à `70vh` par défaut. Nouvelle règle, applicable aux deux vues du corps déplié (`body`) : hauteur intrinsèque du contenu (`height: auto` / `max-height`), plafonnée à `70vh` comme garde-fou sur les petits écrans en paysage, mais jamais imposée comme hauteur cible par défaut. Concrètement, la Vue Édition (peu de champs visibles par défaut, "Plus d'options" replié) occupe naturellement une fraction de l'écran bien inférieure à 70vh, laissant la carte majoritairement visible au premier chargement — sans qu'aucune valeur de hauteur fixe n'ait besoin d'être calculée à l'avance.

## 4. Interaction carte / panneau flottant

Aucun changement par rapport à la règle déjà actée dans `docs/specs/recherche-carte-permanente.md` section 4 : l'emprise qui capte les événements pointeur/molette doit correspondre exactement à l'emprise visuelle rendue du panneau fusionné, jamais au-delà. Le critère d'acceptation déjà en place s'applique tel quel au panneau unique résultant de cette fusion.

## 5. États non concernés par la fusion

Restent inchangés, hors périmètre de cette spec :
- **Recherche en cours** (`itineraries === null`) : squelette de chargement affiché dans le panneau (déjà le cas aujourd'hui via `.resultats-panel-list`/`.resultats-sheet`) — devient naturellement le contenu du panneau fusionné pendant le chargement, sans changement de comportement.
- **Résultat vide** (`itineraries.length === 0`) : à l'origine une page classique (`.resultats-page`), hors périmètre de *cette* spec. **Repris par l'issue [#190](https://github.com/KerdanetYvan/urbanflow-mobility/issues/190)** une fois le panneau fusionné livré : l'état vide est désormais rendu dans le panneau (même coquille que "recherche en cours", carte plein écran en fond avec origine/destination), `.resultats-page` supprimée, et l'action de recours est le "Modifier la recherche" de `SearchContext` (édition en place). Si un trajet à pied existe faute de transport en commun, il est proposé comme un résultat normal précédé d'un bandeau explicatif (`fallback: 'walk-only'` renvoyé par `GET /trips`).

## 6. Exemple (persona du dossier, partie 2.3)

**Antoine**, pressé, lance une recherche depuis son trajet habituel. Les résultats s'affichent dans le panneau bas-gauche (desktop) ; en parcourant la liste, il se rend compte qu'il préfère partir 15 minutes plus tard. Il clique "Modifier" : le panneau bascule sur la Vue Édition sans que la carte ni sa position de défilement dans la page ne bougent, ajuste l'heure dans "Plus d'options", clique "Rechercher" — le panneau revient automatiquement à la Vue Résumé avec la liste mise à jour, sans jamais avoir quitté ou rechargé l'écran des résultats.

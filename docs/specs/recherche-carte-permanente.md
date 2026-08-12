# Spécifications détaillées — Carte permanente et réagencement de `/recherche`

> Casquette PO — issue [#110](https://github.com/KerdanetYvan/urbanflow-mobility/issues/110), Sprint 3.
> Sert de base à l'implémentation Dev FE de l'issue [#111](https://github.com/KerdanetYvan/urbanflow-mobility/issues/111).

## 1. Périmètre

Constat de la revue fonctionnelle de fin de Sprint 2 (2026-08-09) : l'écran de recherche fusionné (issue [#73](https://github.com/KerdanetYvan/urbanflow-mobility/issues/73), `docs/specs/refonte-visuelle-mobile-desktop.md` section 2) n'affiche la carte plein écran (`MapView` `fullBleed`) qu'à partir des états `recherche`/`resultats` de `RecherchePage.tsx` — l'état `formulaire` reste une page normale sans carte. Ce document complète `refonte-visuelle-mobile-desktop.md` et `f2-ecrans-planification.md` sans les contredire : il cadre deux évolutions précises de l'écran `/recherche` déjà fusionné, pas une nouvelle refonte complète.

1. Rendre la carte permanente : fond des **3** états de la machine à états (`formulaire` compris), pas seulement `recherche`/`resultats`.
2. Réagencer les champs du formulaire pour tenir dans un espace flottant plus étroit qu'une page pleine largeur.

Un bug d'interaction carte/panneaux déjà présent sur l'écran de résultats est également cadré ici (section 4) puisque le nouveau panneau formulaire est exposé au même risque — sa correction fait partie du périmètre de #111.

**Hors périmètre** : le contenu des champs eux-mêmes (autocomplétion, validation) est déjà cadré par `f2-ecrans-planification.md` section 2.1 et n'est pas revu ici, seule leur disposition change.

## 2. Carte permanente sur les 3 états

La carte (`MapView` `fullBleed`) devient le fond visuel de `formulaire`, `recherche` et `resultats` — plus de retour à un flux de page classique pour le formulaire (`<section className="recherche-page">` aujourd'hui).

- **État `formulaire`** : carte affichée sans trace, origine/destination non géolocalisées tant qu'elles ne sont pas choisies — même traitement que l'état `recherche` actuel côté carte (`MapView` sans `itinerary`, éventuellement avec les marqueurs origine/destination dès qu'ils sont résolus).
- Le formulaire n'est plus une page dans le flux normal : il devient un panneau superposé à la carte, sur le même principe que les panneaux/bandeau déjà en place pour les résultats (`RecherchePageResults.tsx`) — pas un nouveau pattern d'interaction à apprendre pour l'utilisateur.
  - **Desktop (≥768px)** : panneau flottant en **haut-gauche** de l'écran (le panneau résultats occupe déjà le bas-gauche — les deux ne se chevauchent jamais, y compris lors d'un aller-retour formulaire ↔ résultats). Largeur alignée sur `.resultats-panel-list` (22rem) pour une cohérence visuelle entre les deux écrans.
  - **Mobile** : bandeau du bas, même famille de composant que `.resultats-sheet`, mais à **2 états** seulement (pas 3) :
    - `collapsed` : pastille "Rechercher un trajet" (équivalent du `CompactPreview` des résultats, mais invite à l'action plutôt qu'à résumer un choix déjà fait).
    - `expanded` : formulaire complet (section 3).
    - Pas de 3e état "détail" : un formulaire n'a rien d'équivalent au détail segment par segment d'un itinéraire.

## 3. Réagencement des champs

Le panneau/bandeau étant plus étroit qu'une page pleine largeur (22rem visé, contre 40rem pour `.recherche-page` aujourd'hui en desktop), les champs origine/destination restent **empilés** dans tous les cas — la disposition en grille 2 colonnes actuelle (`@media (min-width: 768px)` de `RecherchePage.css`) est abandonnée, elle supposait une page pleine largeur qui n'existe plus.

- **Toujours visibles** (identité de la recherche, jamais masqués) : champ Origine, bouton Inverser, champ Destination, bouton Rechercher.
- **Repliés par défaut** derrière une divulgation "Plus d'options" (fermée à l'ouverture) : date/heure de départ, modes de transport préférés. Réduit l'emprise verticale par défaut du panneau — cohérent avec le fait que ces deux champs sont déjà optionnels aujourd'hui (heure vide = "maintenant", modes vides = tous les modes).
- Le message d'invitation à se connecter (`recherche-guest-hint`) et l'`Alert` d'erreur ne s'affichent que dans l'état déplié du panneau/bandeau (pas de place dans la pastille repliée mobile). Si une erreur survient alors que le bandeau mobile est replié, il se déplie automatiquement pour la montrer — l'utilisateur ne doit jamais rater un message d'erreur parce que le bandeau était en position basse.

## 4. Interaction carte / panneaux flottants (corrige un bug existant)

**Règle transverse**, applicable au nouveau panneau formulaire **et** au panneau résultats déjà en production : la zone où un panneau/bandeau flottant capte les événements pointeur/molette doit correspondre **exactement à son emprise visuelle rendue**, jamais au-delà.

Bug constaté en session sur l'écran de résultats actuel (`RecherchePageResults.css`, `.resultats-panels`/`.resultats-panel`) : le pan (glisser) et le zoom (molette) de la carte sont bloqués sur une colonne qui s'étend sur **toute la hauteur de l'écran**, à la largeur et à la position horizontale d'une card flottante — pas seulement sur l'emprise réelle de cette card. Exemple concret : une card occupant `height: 33%; width: 150px; left: 30px; bottom: 10px` bloque aujourd'hui le pan/zoom sur toute la zone `height: 100%; width: 150px; left: 30px` — y compris la portion de carte visible au-dessus de la card, où l'utilisateur s'attend à pouvoir interagir normalement (le curseur y repasse de la main "grab" à la flèche par défaut).

Hypothèse technique pour #111 (à vérifier, pas prescriptive) : le conteneur flex `position: absolute` (`.resultats-panels`) ou ses enfants (`max-height: 100%` sans hauteur explicite) captent une zone de survol plus grande que leur rendu visuel réel.

**Critère d'acceptation** (#111, sur le panneau résultats existant et sur le nouveau panneau formulaire) : déplacer le curseur sur une portion de carte visible en dehors de l'emprise réellement rendue d'un panneau/card — même si cette zone est verticalement ou horizontalement alignée avec lui — doit permettre le pan et le zoom normalement.

## 5. Exemple (persona du dossier, partie 2.3)

**Antoine**, pressé, ouvre l'application sur son trajet habituel : la carte est immédiatement visible en fond (plus d'écran blanc le temps de remplir le formulaire), centrée sur sa position si la géolocalisation est disponible. Il ouvre la pastille "Rechercher un trajet", les champs Origine/Destination sont déjà suggérés depuis son historique de saisie navigateur, il n'a pas besoin d'ouvrir "Plus d'options" (l'heure "maintenant" et tous les modes lui conviennent). Une fois les résultats affichés, il peut faire glisser la carte pour repérer un arrêt à proximité sans que la card de résumé du trajet sélectionné, ancrée en bas de son écran, ne l'en empêche au-delà de sa propre hauteur.

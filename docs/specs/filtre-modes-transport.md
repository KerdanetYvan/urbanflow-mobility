# Spécifications détaillées — Filtre des modes de transport sur `/recherche`

> Casquette PO — issue [#108](https://github.com/KerdanetYvan/urbanflow-mobility/issues/108), Sprint 3.
> Sert de base à une issue Dev FE à ouvrir une fois ce document validé (voir #108, dépendance explicite).
> Décisions d'ouverture (popover vs modale, emplacement, contenu du badge) tranchées en session le 2026-08-19.

## 1. Périmètre

Aujourd'hui (issue [#111](https://github.com/KerdanetYvan/urbanflow-mobility/issues/111)), le `fieldset` "Modes de transport pour cette recherche" (`RecherchePage.tsx`, `TRANSPORT_MODES`) vit à l'intérieur de la divulgation `<details>` "Plus d'options", au même niveau que le champ date/heure de départ. Ce document cadre son **extraction** vers un filtre dédié, ouvert par un bouton toujours visible — indépendant de "Plus d'options", qui ne conserve donc plus que la date/heure de départ.

**Hors périmètre**, explicitement :

- Le contenu des modes eux-mêmes (`TRANSPORT_MODES`, `lib/profile.ts`) : réutilisé tel quel, pas redéfini ici.
- La sémantique "tableau vide = tous les modes" côté validation/appel API : déjà en place ([`f2-ecrans-planification.md`](f2-ecrans-planification.md) section 2.1), inchangée.
- Le fait que la sélection ne soit pas persistée dans le profil (modifiable pour cette recherche uniquement) : déjà acté, inchangé.
- La disposition générale de `/recherche` (panneau flottant desktop / bandeau mobile, champs toujours visibles vs repliés) : déjà cadrée par [`recherche-carte-permanente.md`](recherche-carte-permanente.md), ce document **révise uniquement** la sous-section "modes de transport" de sa section 3, sans contredire le reste.

## 2. Déclencheur : bouton dédié, toujours visible

Le filtre quitte "Plus d'options" pour devenir une action de premier niveau, au même titre que les champs Origine/Destination/Rechercher déjà toujours visibles ([`recherche-carte-permanente.md`](recherche-carte-permanente.md#3-réagencement-des-champs)) — pas la peine de déplier quoi que ce soit pour savoir si un filtre est actif ou pour le changer.

Ordre des champs dans `recherche-form` après extraction :

1. Origine / bouton Inverser / Destination (inchangé)
2. **Bouton "Modes de transport" (nouveau, remplace le `fieldset` sorti de "Plus d'options")**
3. "Plus d'options" (repliée par défaut) : ne contient plus que la date/heure de départ
4. Bouton "Rechercher"

Le bouton occupe sa propre ligne, pleine largeur (cohérent avec `.recherche-submit` juste en dessous) :

```text
[Origine.....................]
         ⇅
[Destination.................]
[🚌 Modes de transport........]
> Plus d'options
[      Rechercher            ]
```

Libellé du bouton : `"Modes de transport"` seul quand tous les modes sont considérés (aucune case cochée, sémantique inchangée), `"Modes de transport · N"` dès qu'au moins une case est cochée (voir [5](#5-indicateur-une-fois-le-filtre-fermé)).

## 3. Ouverture : popover ancré au bouton

Pattern retenu : **popover/dropdown ancré au bouton déclencheur** (pas de bottom-sheet ni de modale dédiée) — un seul pattern pour mobile et desktop, pas de disposition spécifique à réapprendre selon l'écran.

- Au clic sur le bouton, un panneau s'ouvre juste en dessous (`position: absolute`, ancré au bouton) — à l'intérieur du panneau/bandeau flottant existant, jamais en dehors de son emprise visuelle (même règle transverse que [`recherche-carte-permanente.md` section 4](recherche-carte-permanente.md#4-interaction-carte--panneaux-flottants-corrige-un-bug-existant) : pas de zone de survol/clic qui dépasserait le panneau rendu).
- Largeur du panneau alignée sur celle du panneau/bandeau parent (pas de débordement horizontal) ; hauteur maximale limitée avec défilement interne si les 8 modes de `TRANSPORT_MODES` ne tiennent pas dans l'espace disponible (cas le plus contraint : bandeau mobile en position "collapsed" bien qu'ouvrir le filtre depuis cet état n'ait pas de sens — voir [6](#6-cas-limites)).
- **Fermeture** : trois façons équivalentes, aucune n'est la seule voie possible (WCAG 2.1.1, navigation clavier) —
  - Clic en dehors du panneau
  - Touche `Échap`
  - Clic sur un bouton "Fermer" explicite en bas du panneau (pas seulement une fermeture implicite : un utilisateur au clavier ou au doigt doit avoir une cible claire, pas seulement compter sur le clic-dehors)
- Le focus clavier revient sur le bouton déclencheur à la fermeture, quelle que soit la méthode de fermeture utilisée.
- `aria-expanded` sur le bouton reflète l'état ouvert/fermé ; `aria-controls` le relie au panneau — même niveau d'effort ARIA que le reste de l'écran (voir `AddressField`, `RecherchePage.tsx` : "pas un pattern combobox ARIA complet - suffisant pour ce projet"), pas de `role="dialog"`/piège de focus complet, qui serait disproportionné pour un filtre secondaire non bloquant.

## 4. Contenu du panneau

Reprend le `fieldset`/les cases à cocher `TRANSPORT_MODES` existants tels quels (mêmes libellés, même comportement de bascule) — seul le conteneur change (panneau flottant plutôt qu'imbriqué dans `<details>`), pas la logique de sélection (`selectedModes`/`toggleMode` dans `RecherchePage.tsx`, inchangés).

Chaque case cochée/décochée **s'applique immédiatement** à l'état de la recherche (comme aujourd'hui) — pas de bouton "Appliquer" séparé à valider avant de fermer : cohérent avec le reste du formulaire, où aucun champ n'a de validation intermédiaire avant le submit global "Rechercher". Fermer le panneau ne réinitialise jamais la sélection déjà faite.

## 5. Indicateur une fois le filtre fermé

Le bouton déclencheur lui-même **est** l'indicateur (pas de badge séparé à côté) — décision tranchée en session : compteur seul, pas les icônes des modes sélectionnés.

| État | Libellé du bouton |
| --- | --- |
| Aucun mode coché (tous les modes considérés, défaut) | `Modes de transport` |
| Au moins un mode coché | `Modes de transport · N` (N = nombre de cases cochées) |

Pas de `"0 sélectionné"` affiché à l'état par défaut : afficher un compte de zéro serait trompeur au vu de la sémantique existante ("tableau vide = tous les modes", pas "aucun mode").

## 6. Cas limites

| Cas | Comportement |
| --- | --- |
| Aucun mode coché puis submit | Identique à aujourd'hui : `preferredTransportModes` vide envoyé/omis, tous les modes considérés côté résultats (aucun changement de contrat API) |
| Ouverture du filtre puis clic sur "Rechercher" sans le fermer explicitement | Le clic sur "Rechercher" (en dehors du panneau) ferme le filtre comme n'importe quel clic extérieur (voir [3](#3-ouverture--popover-ancré-au-bouton)), puis soumet normalement — pas de double action requise |
| Bandeau mobile en position "collapsed" | Le bouton "Modes de transport" n'est pas rendu dans cet état (le corps du formulaire ne l'est pas non plus, voir `recherche-panel-form-body` masqué hors "expanded") — pas de cas où le popover devrait s'ouvrir depuis un bandeau réduit |
| Réouverture du filtre après une première sélection | Les cases précédemment cochées restent cochées (état déjà porté par `RecherchePage.tsx`, pas de réinitialisation à l'ouverture) |

## 7. Exemple (persona du dossier, partie 2.3)

**Antoine**, pressé, n'a pas de moyen de transport personnel : il veut restreindre sa recherche aux seuls transports en commun (bus, tram, métro, train) et à la marche, sans perdre de temps à déplier un menu "Plus d'options" qu'il ne regarde jamais. Il voit directement le bouton "Modes de transport" sous le champ Destination, l'ouvre, coche Marche/Bus/Tram/Métro/Train (laissant Vélo, Trottinette et Covoiturage décochés — la sémantique de cases à cocher reste une liste d'inclusion, pas d'exclusion : cocher restreint aux modes cochés, ça n'écarte pas juste ceux décochés d'un ensemble par ailleurs complet), ferme d'un tap en dehors du panneau. Le bouton affiche désormais "Modes de transport · 5" — il sait d'un coup d'œil que son filtre est actif sans avoir eu à mémoriser ce qu'il a coché.

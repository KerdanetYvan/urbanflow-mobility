# Spécifications détaillées — Fusion position / domicile / travail / historique dans le champ d'autocomplétion

> Casquette PO — issue [#165](https://github.com/KerdanetYvan/urbanflow-mobility/issues/165), Sprint 4 (Phase C).
> Sert de base à l'implémentation Dev FE de l'issue [#166](https://github.com/KerdanetYvan/urbanflow-mobility/issues/166).

## 1. Périmètre

Constat de la revue fonctionnelle de fin de Sprint 3 (retour utilisateur, 2026-08-25) : sur `/recherche`, trois sources de raccourcis d'adresse vivent aujourd'hui dans des blocs **séparés du champ de saisie**, ce qui disperse l'aide au remplissage et allonge le panneau/bandeau formulaire (déjà pointé par [#110](https://github.com/KerdanetYvan/urbanflow-mobility/issues/110)/[#111](https://github.com/KerdanetYvan/urbanflow-mobility/issues/111)) :

| Source | Composant actuel | Emplacement | Contenu |
| --- | --- | --- | --- |
| Position GPS + domicile + travail | `OriginShortcuts` (inline `RecherchePage.tsx`) | Sous le champ **Origine** uniquement | Chips « Ma position actuelle », « Domicile », « Travail » |
| Historique des trajets ([#112](https://github.com/KerdanetYvan/urbanflow-mobility/issues/112)) | `RechercheQuickShortcuts` (inline `RecherchePage.tsx`) | Sous le bouton « Rechercher », hors `<form>` | Liste « {origine} → {destination} », relance la recherche complète |
| Suggestions du géocodeur ([#81](https://github.com/KerdanetYvan/urbanflow-mobility/issues/81)) | `AddressField` + `useAddressSuggestions.ts` | Dropdown ancré au champ | Résultats OTP, **à partir de 2 caractères saisis** (`useAddressSuggestions.ts:28`) |

Ce document cadre le regroupement des **trois** sources dans le dropdown de `AddressField` lui-même : la position, le domicile, le travail et les adresses récentes de l'historique s'affichent au focus quand le champ est vide, puis sont remplacés par les résultats du géocodeur dès la 2ᵉ frappe. Les deux blocs séparés (`OriginShortcuts` et `RechercheQuickShortcuts`) sont **supprimés**.

### 1.1 Sort de `RechercheQuickShortcuts` (relance de trajet complet, #112)

Le bloc « {origine} → {destination} » affiché sous le bouton « Rechercher », qui relançait toute la recherche en un tap, est **retiré**. L'historique ne subsiste sur `/recherche` que sous forme d'**adresses individuelles** dans le dropdown des champs (section 3).

Conséquence assumée : on perd le « relancer un trajet passé en un seul geste ». Justification du choix (décision PO, 2026-08-31) : l'objectif de #165 est de **dé-cliver** l'aide au remplissage, pas d'empiler un dropdown d'adresses *et* une liste de trajets sous le formulaire. Le relancement complet d'un trajet reste possible en deux temps (choisir l'origine puis la destination depuis les adresses récentes), et l'écran `/historique` complet ([#11](https://github.com/KerdanetYvan/urbanflow-mobility/issues/11)/[#174](https://github.com/KerdanetYvan/urbanflow-mobility/issues/174)) conserve, lui, un bouton « Relancer cette recherche » par trajet.

`entryToPlaces` (`lib/trips.ts`) **reste** : elle est partagée avec `HistoriquePage` (#174). Seuls le composant `RechercheQuickShortcuts` et sa constante `MAX_QUICK_SHORTCUTS` disparaissent.

### 1.2 Hors périmètre

- **Le géocodeur lui-même** : seuil de déclenchement (2 caractères), debounce (300 ms), format des résultats — inchangés (`useAddressSuggestions.ts`).
- **La géolocalisation** (`useGeolocation`, [#93](https://github.com/KerdanetYvan/urbanflow-mobility/issues/93)) : déclenchement à la demande, gestion des erreurs de permission — inchangés. Seul l'emplacement du **déclencheur** bouge (de la chip vers une entrée du dropdown).
- **Les champs domicile/travail de `ProfilPage.tsx`** : ils réutilisent le même composant `AddressField` mais ne doivent **pas** recevoir ce dropdown enrichi — voir section 6.

## 2. Comportement d'ensemble du champ

Le dropdown de `AddressField` (origine ou destination de `/recherche`) affiche, selon l'état de saisie :

| État du champ | Contenu du dropdown |
| --- | --- |
| **Vide** (`query` après `trim` = `''`) **et** focus dans le champ | Les **entrées rapides** : position (origine seule) + domicile + travail + adresses récentes — voir section 3. |
| **1 caractère saisi** | **Rien** (dropdown fermé). Les entrées rapides ne sont plus pertinentes dès qu'une adresse est en cours de frappe, et le géocodeur n'a pas encore de quoi répondre. |
| **≥ 2 caractères saisis** | Les **résultats du géocodeur**, comme aujourd'hui (aucun changement). |
| **Valeur sélectionnée** (`query` = libellé de l'entrée choisie) | **Rien** (dropdown fermé), comme aujourd'hui (`isResolved` dans `useAddressSuggestions.ts`). |

- **Ouverture** : au focus du champ s'il est vide (`onFocus`). Pas d'ouverture automatique si le champ contient déjà une valeur sélectionnée ou du texte.
- **Fermeture** : à la sélection d'une entrée, au `blur` du champ (avec le délai habituel permettant le clic sur une entrée), à `Échap`, ou dès que la saisie atteint 1 caractère.
- **Accessibilité** : on conserve le pattern actuel de `AddressField` — une simple `<ul>` de `<button>`, chacun nativement focusable/activable au clavier, **pas** de pattern combobox ARIA complet (cohérent avec la note déjà présente dans `AddressField.tsx` et le niveau d'effort d'accessibilité des écrans concernés). La région `aria-live="polite"` existante annonce le nombre d'entrées disponibles ; son texte est étendu pour couvrir les entrées rapides (ex. « 4 raccourcis disponibles » au focus, « 3 suggestions disponibles » après saisie).
- **Navigation clavier** : `Tab` / `Maj+Tab` parcourt les entrées comme les boutons qu'elles sont ; `Entrée` / `Espace` sélectionne. `Échap` referme le dropdown et laisse le focus dans le champ.

## 3. État « dropdown vide » (champ au focus, non saisi)

### 3.1 Ordre et composition

De haut en bas :

1. **Ma position actuelle** — **champ Origine uniquement**. Toujours présente (utilisable sans compte, cf. #64/#93). Absente du champ Destination : « aller vers ma position actuelle » n'a pas de sens en pratique (on y est déjà).
2. **Domicile** — si le profil connecté a un domicile enregistré (`profile.homeLat`/`homeLon` non nuls). Présente sur **Origine et Destination**.
3. **Travail** — même règle que Domicile, avec `profile.workLat`/`workLon`.
4. **Adresses récentes** — jusqu'à **4 entrées**, dérivées de l'historique déjà chargé au montage (`getTripHistory()`, `historyEntries`). Présentes sur **Origine et Destination**. (4 plutôt que 3 : depuis le retrait de `RechercheQuickShortcuts` (section 1.1), ce dropdown est la **seule** surface d'accès à l'historique sur `/recherche`.)

Soit, au maximum : 1 (position) + 1 (domicile) + 1 (travail) + 4 (historique) = **7 entrées** sur le champ Origine, **6** sur le champ Destination. Volontairement court : le dropdown ne doit pas dépasser la hauteur d'un écran mobile ni recouvrir la carte plus que les suggestions du géocodeur ne le font déjà.

### 3.2 Dérivation des « adresses récentes » depuis l'historique

`historyEntries` est une liste de **trajets** (couples origine/destination dédupliqués, `TripHistoryEntry`, triés par `lastSearchedAt` décroissant). On en extrait une liste d'**adresses** :

- Pour chaque entrée d'historique, dans l'ordre (plus récent d'abord), produire **deux** `PlaceSuggestion` candidates : son origine et sa destination (via la même conversion que `entryToPlaces` — libellé enregistré, ou coordonnées formatées en repli).
- **Dédupliquer** par coordonnées arrondies (même clé que celle utilisée pour les `key` React de la liste de suggestions : `lat`-`lon`), en gardant la première occurrence (donc la plus récente).
- **Exclure** de cette liste : l'adresse déjà retenue pour Domicile et celle retenue pour Travail (éviter d'afficher deux fois la même adresse sous deux étiquettes), ainsi que la valeur déjà sélectionnée dans **l'autre** champ (ne pas proposer comme destination l'origine qu'on vient de choisir).
- Tronquer à **4** (`MAX_RECENT_ADDRESSES`, voir section 3.1).

Cette dérivation est faite côté `RecherchePage` (qui détient déjà `historyEntries`, `homeShortcut`, `workShortcut`) et passée à `AddressField` en props — `AddressField` reste un composant de présentation sans logique métier, comme aujourd'hui.

### 3.3 Cas où il n'y a rien à proposer

- **Visiteur non connecté** : pas de profil, pas d'historique → le dropdown du champ Origine ne contient que **« Ma position actuelle »** ; celui du champ Destination est **vide et ne s'ouvre pas** (rien à montrer). Pas de message d'état vide, pas de bloc « connectez-vous » dans le dropdown (l'invitation à se connecter existe déjà en tête du formulaire, `recherche-guest-hint`).
- **Connecté, sans domicile/travail enregistrés, historique vide** : idem — Origine = « Ma position actuelle » seule, Destination = pas de dropdown.
- **Domicile ou travail non renseigné** : la ligne correspondante est simplement **omise** (comportement actuel de `OriginShortcuts`), sans espace réservé ni ligne grisée.

## 4. Contenu de chaque entrée : titre + sous-titre

Chaque entrée rapide est un bouton à **deux lignes** : un **titre** (rôle de l'entrée) et un **sous-titre** (l'adresse concrète, en plus petit et atténué). Les suggestions du géocodeur, elles, restent **sur une seule ligne** (`suggestion.label` seul) — le sous-titre ne concerne que l'état « dropdown vide ».

| Entrée | Titre | Sous-titre | Icône |
| --- | --- | --- | --- |
| Position | « Ma position actuelle » | « Votre position GPS » — ou « Localisation… » pendant l'acquisition | `MapPinIcon` |
| Domicile | « Domicile » | `profile.homeLabel` s'il existe, sinon les coordonnées formatées (`formatCoordinates(homeLat, homeLon)`) | `MapPinIcon` (ou une icône maison si disponible) |
| Travail | « Travail » | `profile.workLabel` s'il existe, sinon coordonnées formatées | `MapPinIcon` (ou une icône mallette si disponible) |
| Adresse récente | Le libellé de l'adresse (`originLabel`/`destinationLabel`), ou coordonnées formatées si absent | « Recherché récemment » | `HistoryIcon` |

Notes :

- **Sous-titre = adresse, titre = rôle** : l'utilisateur reconnaît d'abord *quoi* (« Domicile »), puis vérifie *où* (« 12 rue des Lilas »). Pour une adresse récente il n'y a pas de « rôle », donc le titre porte l'adresse et le sous-titre porte seulement le contexte (« Recherché récemment »).
- **Position en cours d'acquisition** : le titre reste « Ma position actuelle », le sous-titre passe à « Localisation… » et l'entrée est **désactivée** (`disabled`) le temps de l'acquisition — reprend le comportement actuel du bouton `OriginShortcuts` (`isLocating`).
- **Erreur de géolocalisation** (permission refusée, indisponible) : le message d'erreur s'affiche **sous le champ**, hors du dropdown (comme aujourd'hui : `positionError` / `recherche-origin-shortcuts-error`), et le dropdown se referme. On ne laisse pas une entrée en erreur dans la liste.
- **Troncature des libellés longs** : le titre et le sous-titre sont tronqués à une ligne chacun avec ellipsis — cadré séparément par [#161](https://github.com/KerdanetYvan/urbanflow-mobility/issues/161) (protection anti-débordement des libellés d'adresse), cette spec s'aligne dessus sans le redéfinir.

## 5. Sélection d'une entrée

- **Domicile / Travail / Adresse récente** : identique à la sélection d'une suggestion du géocodeur aujourd'hui — le champ prend `{ query: place.label, selected: place }`, le dropdown se ferme, aucun appel réseau, la recherche **n'est pas** relancée automatiquement (l'utilisateur complète l'autre champ puis soumet).
- **Ma position actuelle** : déclenche le flux de géolocalisation existant (`setWantsPosition(true)`). À réception de la position, le champ Origine prend le libellé « Ma position actuelle » et les coordonnées obtenues (comportement actuel, `RecherchePage.tsx` ~l.470). En cas d'échec : message d'erreur sous le champ, le champ Origine reste inchangé.
- Aucune entrée rapide ne relance la recherche : cohérent avec `OriginShortcuts` aujourd'hui, et distinct de `RechercheQuickShortcuts` (#112) qui, lui, relance (et reste hors de ce dropdown, section 1.1).

## 6. Règle de non-application aux champs domicile/travail de `ProfilPage`

`AddressField` est aussi utilisé par `ProfilPage.tsx` pour saisir les adresses de domicile et de travail ([#114](https://github.com/KerdanetYvan/urbanflow-mobility/issues/114)). Sur ces champs, le dropdown enrichi **ne doit pas apparaître** :

- Proposer « Domicile » / « Travail » comme entrée dans le champ qui sert justement à **définir** le domicile ou le travail est circulaire.
- « Ma position actuelle » et « adresses recherchées récemment » ne sont pas pertinentes pour enregistrer une **adresse permanente** de référence.

**Contrat** : les entrées rapides (position/domicile/travail/historique) sont un comportement **opt-in** de `AddressField`, activé explicitement par `RecherchePage` pour ses champs Origine/Destination, et **non activé** par `ProfilPage`. Par défaut (donc pour `ProfilPage` sans changement de son code d'appel), `AddressField` se comporte exactement comme aujourd'hui : uniquement les suggestions du géocodeur à partir de 2 caractères.

*Le nom exact de la prop (`quickEntries`, `shortcuts`, `showQuickEntries`…) et sa forme (booléen + props séparées, ou un objet unique) sont laissés à l'implémentation #166 — la seule contrainte est que l'absence de configuration = comportement actuel inchangé.*

Critère d'acceptation : après implémentation, ouvrir un champ domicile/travail vide dans `ProfilPage` **ne montre aucun dropdown** tant que moins de 2 caractères sont saisis ; le test correspondant est ajouté côté #166.

## 7. Points transverses

- **Éco-conception** : aucune requête réseau nouvelle. L'historique est déjà chargé une fois au montage de `RecherchePage` (`getTripHistory()`), le profil aussi (domicile/travail dérivés) ; la géolocalisation reste déclenchée uniquement au tap explicite. Le dropdown vide n'appelle jamais le géocodeur.
- **Mobile** : le dropdown des entrées rapides s'affiche dans le bandeau bas déplié, au-dessus de la carte, avec la même contrainte d'emprise pointeur que les suggestions du géocodeur (`docs/specs/recherche-carte-permanente.md` section 4). Sa hauteur suit son contenu (≤ 6 entrées), il ne force pas l'ouverture du bandeau à `70vh`.
- **Cohérence visuelle** : les entrées rapides et les suggestions du géocodeur partagent le même conteneur (`.address-suggestions`) et le même style de ligne ; seule la présence du sous-titre et de l'icône distingue une entrée rapide d'une suggestion géocodeur.
- **`OriginShortcuts` (chips) est supprimé** : son rôle est entièrement repris par les entrées « Ma position actuelle / Domicile / Travail » du dropdown du champ Origine. Le message d'erreur de géolocalisation qu'il hébergeait (`recherche-origin-shortcuts-error`) est conservé, rattaché au champ Origine.
- **`RechercheQuickShortcuts` est supprimé** (section 1.1) : plus de liste de trajets sous le bouton « Rechercher ». `entryToPlaces` (`lib/trips.ts`) est conservée (partagée avec `HistoriquePage`, #174).

## 8. Exemple (persona du dossier, partie 2.3)

Muriel, utilisatrice connectée, a enregistré son domicile (« 8 place du Marché ») mais pas son lieu de travail, et a récemment cherché des trajets vers « Gares » et « CHU Pontchaillou ».

1. Elle arrive sur `/recherche`, touche le champ **Origine** : le dropdown affiche « Ma position actuelle » (sous-titre « Votre position GPS »), « Domicile » (sous-titre « 8 place du Marché »), puis « Gares » et « CHU Pontchaillou » (sous-titre « Recherché récemment »). Pas de ligne « Travail » (non renseigné).
2. Elle tape « Domicile » d'un tap : le champ Origine se remplit, le dropdown se ferme, rien d'autre ne se passe.
3. Elle touche le champ **Destination** : le dropdown affiche « Domicile », « Gares », « CHU Pontchaillou » — pas de « Ma position actuelle », et « Domicile » n'apparaît pas en double même s'il est aussi l'origine choisie (exclu, section 3.2).
4. Elle commence à taper « rép… » : dès le 2ᵉ caractère, le dropdown bascule sur les résultats du géocodeur (« République », …), sur une seule ligne chacun.

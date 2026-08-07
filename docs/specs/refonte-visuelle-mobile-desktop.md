# Spécifications détaillées — Refonte visuelle mobile-first / desktop

> Casquette PO — issue [#72](https://github.com/KerdanetYvan/urbanflow-mobility/issues/72), Sprint 2 (revue de fin de Sprint 1).
> Sert de base à l'implémentation Dev FE de l'issue [#73](https://github.com/KerdanetYvan/urbanflow-mobility/issues/73) (refonte de la disposition mobile/desktop).

## 1. Périmètre

Ce document cadre :

1. La fusion des écrans Recherche et Résultats en un seul écran ([2](#2-fusion-recherche--résultats-en-un-seul-écran)).
2. L'habillage icônes de la navigation principale ([3](#3-navigation-principale-applayout)).
3. La correction de l'identité visuelle desktop, actuellement incohérente sur plusieurs écrans ([4](#4-identité-visuelle-desktop)).
4. La disposition mobile/desktop détaillée des écrans qui n'en ont pas encore ([5](#5-disposition-des-autres-écrans)).
5. Un inventaire consolidé de tous les écrans avec l'action requise pour chacun ([6](#6-inventaire-consolidé)).

**Hors périmètre**, volontairement :

- Le contenu réel de `HistoriquePage` : c'est un placeholder Stretch (post-MVP), sa vraie logique relève de l'issue dédiée à venir, pas de celle-ci. Seul son traitement visuel minimal de cohérence est cadré ici ([5.3](#53-historique)).
- Les règles de scoring et l'affichage des perturbations : déjà couverts par [`f3-scoring-perturbations.md`](f3-scoring-perturbations.md).
- Les champs, validations et cas limites de la recherche/résultats : déjà couverts par [`f2-ecrans-planification.md`](f2-ecrans-planification.md) et restent valables. Ce document **révise uniquement la structure d'écran** (deux écrans distincts → un seul, voir [2](#2-fusion-recherche--résultats-en-un-seul-écran)), pas leur contenu.

### 1.1 Principe directeur : mobile-first

Rappel (déjà appliqué à `RecherchePage`/`ResultatsPage`, voir `f2-ecrans-planification.md` section 1.1) : les écrans sont conçus d'abord pour mobile, puis adaptés aux écrans plus larges — jamais l'inverse. Ce document étend ce principe aux écrans qui n'en bénéficient pas encore d'une disposition desktop différenciée, et corrige les écrans où l'habillage desktop actuel est simplement absent ou incohérent plutôt que pensé.

## 2. Fusion Recherche + Résultats en un seul écran

### 2.1 Constat et justification

Aujourd'hui, `RecherchePage` (`/recherche`) et `ResultatsPage` (`/resultats`) sont deux routes distinctes reliées par une navigation React Router qui transporte les résultats déjà obtenus dans l'état de navigation (`navigate('/resultats', { state: { itineraries, origin, destination } })`). Ce découpage a un défaut structurel : un rechargement de page ou un accès direct à `/resultats` (lien partagé, favori, retour d'un ancien onglet) perd cet état — l'écran actuel s'en protège déjà en redirigeant silencieusement vers `/recherche` (`<Navigate to="/recherche" replace />` quand l'état est absent), preuve que ce n'est pas un cas limite négligeable.

Trois raisons motivent la fusion en un seul écran plutôt qu'un correctif ponctuel de ce garde-fou :

1. **Élimine la classe de bug par construction.** Si le formulaire et les résultats vivent dans le même composant, il n'y a plus d'état à transporter d'une route à l'autre, donc plus rien à perdre au rechargement.
2. **Cohérent avec la contrainte PWA standalone.** Le manifest utilise `display: 'standalone'` (`CLAUDE.md`, contrainte transverse PWA) : une fois installée, l'application s'ouvre sans barre d'adresse ni bouton "retour" du navigateur. La navigation propre de l'application doit donc rester utilisable de façon autonome — une transition d'état interne (rester sur `/recherche`, changer simplement ce qui s'affiche) est plus robuste sur ce point qu'une dépendance à la navigation par route.
3. **Permet le préremplissage.** Le lien "Modifier la recherche", déjà présent sur l'écran de résultats actuel, renvoie aujourd'hui vers un formulaire vide. Avec un seul écran, revenir au formulaire peut préremplir les critères de la recherche précédente (origine, destination, heure, modes) sans perte d'information.

### 2.2 Machine à états

L'écran unique `/recherche` a trois états :

| État | Déclencheur | Affiche |
| --- | --- | --- |
| `formulaire` | État initial, ou retour depuis `résultats` ("Modifier la recherche"), ou échec depuis `recherche` | Le formulaire de recherche (voir [2.3](#23-état-formulaire)) |
| `recherche` | Soumission valide du formulaire | La disposition résultats en chargement (voir [2.4](#24-état-recherche-chargement)) |
| `résultats` | Réponse reçue de `GET /trips` avec au moins un itinéraire | La disposition résultats peuplée (voir [2.5](#25-état-résultats)) |

Transition `recherche` → `formulaire` en cas d'échec (erreur API, adresse non résolue, etc.) : mêmes messages que ceux déjà spécifiés dans `f2-ecrans-planification.md` section 4 (`Alert` variant `error`), le formulaire réapparaît avec les valeurs telles que l'utilisateur les avait saisies (rien n'est perdu).

L'état vide (0 itinéraire trouvé) reste un sous-état de `résultats`, inchangé par rapport à la spécification actuelle (`f2-ecrans-planification.md` section 4, ligne "Aucun itinéraire trouvé").

### 2.3 État *formulaire*

Reprend tel quel l'écran `RecherchePage` actuel : champs, autocomplétion, validations, disposition mobile-first (origine/destination empilées puis côte à côte à partir de `768px`) — déjà conforme, voir `f2-ecrans-planification.md` sections 2.1 à 2.4. Aucun changement de contenu, seulement de contexte (fait partie du même composant que les deux autres états plutôt que d'être une route séparée).

### 2.4 État *recherche* (chargement)

Reprend la disposition "carte plein écran + panneaux/bandeau" de l'écran de résultats actuel (voir [2.5](#25-état-résultats)), déjà conforme mobile/desktop, mais dans un état intermédiaire :

- La carte affiche l'origine et la destination (marqueurs) **sans tracé d'itinéraire** — aucun trajet à dessiner tant que la réponse n'est pas arrivée. Nécessite que `MapView` accepte un mode sans itinéraire (voir [8](#8-composants)), qu'il ne propose pas aujourd'hui (le composant attend un `itinerary`).
- Les panneaux (desktop) / le bandeau (mobile) affichent un état de chargement (squelette ou indicateur simple) à la place des cartes-itinéraire, avec le contexte de recherche toujours visible ("De {origine} à {destination}").
- Le bouton de soumission du formulaire, lui, disparaît avec le formulaire — il n'y a plus de formulaire visible pendant cet état, seulement la disposition résultats en chargement.

### 2.5 État *résultats*

Reprend tel quel le contenu de l'écran de résultats actuel : cartes-itinéraire, sélection au clavier/tactile, détail segment par segment, carte plein écran avec tracé du trajet sélectionné, panneaux flottants desktop / bandeau à 3 états mobile — déjà conforme mobile/desktop (disposition "carte plein écran" décidée en session le 2026-08-03), voir `f2-ecrans-planification.md` section 3. Devient simplement le 3ᵉ état de l'écran unique plutôt qu'un écran séparé.

### 2.6 "Modifier la recherche"

Ne navigue plus vers une autre route : change l'état interne vers `formulaire`, en préremplissant les champs avec les derniers critères saisis (origine, destination, heure, modes de transport) — amélioration directe rendue possible par la fusion (impossible aujourd'hui, le formulaire actuel repart toujours vide).

### 2.7 Routing

- Suppression de la route `/resultats` dans `App.tsx` — tout vit désormais sous `/recherche`.
- Un lien externe ou favori existant vers `/resultats` doit rediriger vers `/recherche` (`<Navigate to="/recherche" replace />`), même pattern que le garde-fou actuel de `ResultatsPage` pour l'absence de contexte.
- `AppLayout` (`NAV_ITEMS`) n'est pas impacté : "Résultats" n'a jamais fait partie de la navigation principale (déjà noté dans `AppLayout.tsx`, ce n'est pas un écran permanent).

### 2.8 Impact sur `f2-ecrans-planification.md`

Une note de renvoi vers ce document est ajoutée en tête de la section 3 de `f2-ecrans-planification.md` ([voir le fichier](f2-ecrans-planification.md)) : la structure en deux écrans qu'elle décrit est révisée par la fusion ci-dessus, mais ses spécifications de champs, validations et cas limites restent la référence, inchangées.

## 3. Navigation principale (`AppLayout`)

### 3.1 État actuel

La structure responsive est déjà correcte et n'a pas besoin d'être repensée : nav fixée en bas de l'écran sur mobile (facile à atteindre au pouce), qui redevient une barre statique classique sous l'entête à partir de `768px` (`AppLayout.css` sections mobile et `@media (min-width: 768px)`). Le seul manque : les items de navigation (`NAV_ITEMS`, `AppLayout.tsx`) sont **uniquement du texte**, aucune icône — ce que demande explicitement l'issue [#72](https://github.com/KerdanetYvan/urbanflow-mobility/issues/72).

### 3.2 Disposition mobile

Chaque item de navigation devient **icône + court libellé texte sous l'icône** (pas une icône seule). Ce choix est tranché ainsi plutôt qu'une tab bar à icônes pures : la navigation ne comporte que 2 à 4 items selon l'état de connexion (`visibility: 'always' | 'authenticated-only' | 'guest-only'`), le coût d'espace d'un court libellé est négligeable, et il élimine toute ambiguïté sur le sens d'une icône (accessibilité — pas besoin de deviner le rôle d'un pictogramme).

Icônes nécessaires, à ajouter dans `frontend/src/components/icons.tsx` (même convention que l'existant : SVG monoline, `currentColor`, pas d'emoji) :

| Item de nav | Icône | Statut |
| --- | --- | --- |
| Recherche | Loupe | Nouvelle |
| Connexion | — | Réutilise `LockIcon` (déjà utilisée sur le champ mot de passe des écrans d'authentification, cohérente visuellement) |
| Profil | Silhouette / personne | Nouvelle |
| Historique | Horloge | Nouvelle |

### 3.3 Disposition desktop

La barre haute est déjà statique (`AppLayout.css`, `@media (min-width: 768px)`) : elle gagne simplement l'icône à côté du texte, sur une seule ligne — l'espace horizontal disponible permet les deux, contrairement au mobile où l'empilement icône/texte reste nécessaire.

## 4. Identité visuelle desktop

### 4.1 Bug de centrage — règle systématique à appliquer

Constat concret (pas une impression) : `ProfilPage.css` (`.profil-page { max-width: 28rem; }`) et `RecherchePage.css` (`.recherche-page { max-width: 32rem; }`) définissent une largeur maximale **sans `margin` pour centrer le bloc**, contrairement à `ConnexionPage.css` (`.connexion-page { max-width: 24rem; margin: var(--space-6) auto 0; }`). Résultat observable : sur un écran large, le contenu de Profil et Recherche reste collé au bord gauche de la zone de contenu, pendant que les écrans d'authentification (Connexion, Mot de passe oublié, Réinitialisation) sont correctement centrés — c'est cette incohérence, pas un manque de style en soi, qui donne l'impression d'un rendu cassé sur desktop.

**Règle à appliquer systématiquement lors de [#73](https://github.com/KerdanetYvan/urbanflow-mobility/issues/73)** : tout conteneur racine de page défini avec un `max-width` doit aussi porter `margin-inline: auto` (ou l'équivalent `margin: ... auto`). À vérifier sur l'ensemble des écrans, pas seulement les deux repérés ici — un oubli futur reproduirait le même défaut.

### 4.2 Respiration desktop

Le mobile est volontairement compact (espace limité, usage au pouce). Le desktop dispose de plus de place et doit s'en servir plutôt que de reproduire la même densité dans une colonne centrée entourée de vide : augmenter l'espacement vertical au-delà de `768px` (marge au-dessus du contenu de page, entre l'entête/la nav et le contenu) sur les écrans qui n'ont actuellement aucun ajustement d'espacement au passage desktop (Connexion, Profil, Mot de passe oublié, Réinitialisation — `RecherchePage`/`ResultatsPage` ont déjà des ajustements desktop dédiés).

### 4.3 Touches de couleur

Sans introduire de nouvel asset graphique (aucune maquette Figma n'existe dans ce repo) et sans s'écarter de la direction "minimal mais soigné" actée lors de la définition de la charte graphique (issues [#33](https://github.com/KerdanetYvan/urbanflow-mobility/issues/33) et [#52](https://github.com/KerdanetYvan/urbanflow-mobility/issues/52)) : deux touches ponctuelles suffisent à rompre l'impression de site "sans vie" sur desktop, en réutilisant les tokens de couleur déjà définis (`styles/tokens.css`, `--color-primary-emphasis`) —

- Une bordure d'accent sous `.app-header` en desktop (actuellement une simple bordure neutre `--color-border`).
- Un léger accent visuel sur les `<h1>` de page en desktop (par exemple une courte barre de couleur avant le titre) — cohérent avec `--color-primary-emphasis`, déjà utilisée comme couleur d'emphase ailleurs (item de nav actif, liens).

Ces deux touches sont volontairement limitées : l'objectif est de corriger l'impression de rendu cassé/vide, pas d'entamer une refonte de direction artistique.

## 5. Disposition des autres écrans

Les dispositions ci-dessous s'appuient sur la règle de centrage systématique ([4.1](#41-bug-de-centrage--règle-systématique-à-appliquer)) : elle n'est pas répétée à chaque écran.

### 5.1 Connexion / Mot de passe oublié / Réinitialisation

Les trois écrans partagent le même pattern "carte centrée" (`ConnexionPage`, `MotDePasseOubliePage`, `ReinitialiserMotDePassePage`), déjà correctement centré (voir [4.1](#41-bug-de-centrage--règle-systématique-à-appliquer)).

- **Mobile** : inchangé, déjà correct — carte pleine largeur (dans la limite de `max-width`), champs empilés.
- **Desktop** : carte légèrement élargie (`max-width` actuel de `24rem` reste étroit une fois centré sur un grand écran — proposer un élargissement modéré, sans viser une pleine largeur qui nuirait à la lisibilité d'un formulaire court). En mode inscription (`ConnexionPage`) et sur l'écran de réinitialisation, les deux champs mot de passe (nouveau + confirmation) passent côte à côte plutôt qu'empilés — différenciation réelle de disposition, pas un simple agrandissement de la version mobile.

### 5.2 Profil

- **Mobile** : inchangé, déjà correct — les deux `<fieldset>` (modes de transport préférés, préférences d'accessibilité) restent empilés verticalement.
- **Desktop** : les deux `<fieldset>` passent côte à côte, en deux colonnes — usage plus efficace de l'espace disponible, cohérent avec le principe "pas un simple étirement" de l'issue [#72](https://github.com/KerdanetYvan/urbanflow-mobility/issues/72).

### 5.3 Historique

`HistoriquePage` est un placeholder Stretch sans contenu réel (voir [1](#1-périmètre), hors périmètre). Traitement minimal de cohérence uniquement : appliquer le même habillage de base que les autres écrans (titre stylé, centrage) et un état "à venir" simple (texte centré, éventuellement une icône neutre) plutôt que le texte brut sans aucun style actuel — sans présupposer la disposition réelle de la fonctionnalité, qui sera cadrée par son issue dédiée le moment venu.

## 6. Inventaire consolidé

| Écran | État mobile actuel | État desktop actuel | Action requise | Priorité |
| --- | --- | --- | --- | --- |
| Recherche + Résultats (fusionnés) | Conforme (deux écrans séparés aujourd'hui) | Conforme (deux écrans séparés aujourd'hui) | Fusion en un seul écran/route avec machine à états ([2](#2-fusion-recherche--résultats-en-un-seul-écran)) — évolution de `MapView` requise | Haute (corrige un bug structurel) |
| Navigation (`AppLayout`) | Fonctionnelle, texte seul | Fonctionnelle, texte seul | Ajouter icônes ([3](#3-navigation-principale-applayout)) | Haute (demande explicite de l'issue) |
| Connexion / Mot de passe oublié / Réinitialisation | Conforme | Centré mais identique au mobile | Élargissement + champs mot de passe côte à côte en desktop ([5.1](#51-connexion--mot-de-passe-oublié--réinitialisation)) | Moyenne |
| Profil | Conforme | **Non centré (bug)** | Corriger le centrage + 2 colonnes desktop ([4.1](#41-bug-de-centrage--règle-systématique-à-appliquer), [5.2](#52-profil)) | Haute (bug visible) |
| Historique | Non stylé (placeholder) | Non stylé (placeholder) | Habillage minimal "à venir" ([5.3](#53-historique)) | Basse (contenu réel hors périmètre) |
| Entête (`.app-header`) et titres de page | Sobre, cohérent | Sobre mais identique au mobile, contribue à l'impression "sans vie" | Touches de couleur ([4.3](#43-touches-de-couleur)) | Moyenne |
| Tous les écrans (respiration desktop) | N/A | Densité mobile reproduite telle quelle sur grand écran | Espacement vertical accru au-delà de `768px` ([4.2](#42-respiration-desktop)) | Moyenne |

## 7. Breakpoint

Le seuil desktop `min-width: 768px` est déjà une convention de facto : il est répété littéralement dans `AppLayout.css`, `RecherchePage.css`, `ResultatsPage.css`, `MapView.css` et `index.css`. Il ne peut **pas** devenir une custom property CSS consultable depuis une media query — les media queries ne peuvent pas lire les variables CSS (`--breakpoint-*`) en CSS standard, seul un préprocesseur (Sass, PostCSS custom media) le permettrait, absent de ce projet. La convention `768px` est donc à documenter explicitement en commentaire dans `styles/tokens.css` (à côté des autres tokens, même si ce n'est pas une variable utilisable), pour qu'un futur écran reprenne le même seuil plutôt que d'en introduire un nouveau par erreur.

## 8. Composants

**Icônes à ajouter** (`icons.tsx`, voir [3.2](#32-disposition-mobile)) : recherche (loupe), profil (silhouette), historique (horloge). `LockIcon` (existante) est réutilisée pour "Connexion".

**Évolution de composant nécessaire** : `MapView` doit accepter un mode "origine/destination sans itinéraire" pour l'état *recherche* (chargement) de l'écran fusionné ([2.4](#24-état-recherche-chargement)) — aujourd'hui il attend systématiquement un `itinerary` à tracer.

**Piste de factorisation optionnelle, non bloquante pour [#73](https://github.com/KerdanetYvan/urbanflow-mobility/issues/73)** : `ConnexionPage.css`, `MotDePasseOubliePage.css` et `ReinitialiserMotDePassePage.css` dupliquent actuellement le même bloc de règles pour la carte centrée (fond, bordure, ombre, padding). Une classe partagée (ex. `.auth-card`) réduirait cette duplication, mais ne conditionne pas les corrections visuelles de ce document.

# Spécification — Badges de ligne différenciés par mode de transport

> Casquette Dev FE (+ un ajout ponctuel Dev BE, voir section 8) — issue [#129](https://github.com/KerdanetYvan/urbanflow-mobility/issues/129), Sprint 3.
> Demande formulée en session, hors du périmètre initial de [#126](https://github.com/KerdanetYvan/urbanflow-mobility/issues/126) (badges qualitatifs de scoring) et de [#127](https://github.com/KerdanetYvan/urbanflow-mobility/issues/127) (regroupement d'itinéraires) — design validé le 2026-08-12.
> Étendue en session le 2026-08-18 (section 8) : couleur par ligne (GTFS `route_color`/`route_text_color`) sur les badges et sur le tracé de la carte — revient sur la décision de couleur neutre de la section 4, voir section 8 pour le raisonnement.

## 1. Constat de départ

`getTripModeIcon` (`frontend/src/components/tripModeIcon.tsx`) affiche aujourd'hui le même pictogramme générique (`BusIcon`) pour les modes BUS/TRAM/RAIL/SUBWAY sur l'écran de résultats — un choix documenté comme volontaire ("un seul pictogramme générique pour tout transport en commun, le libellé textuel suffisant à les distinguer"). Ce libellé textuel n'est en réalité affiché qu'en détail déplié (`ItinerarySegments`, ex. "Bus C1") — pas dans la carte de résultat ni dans l'aperçu compact, où seul le pictogramme générique apparaît. Un utilisateur ne peut donc pas distinguer un trajet en bus 24 d'un trajet en bus C6 sans ouvrir le détail.

## 2. Périmètre

**Dans le périmètre** : la rangée de pictogrammes de mode affichée à deux endroits qui partagent aujourd'hui la même logique (`modesUsedBy()`, `RecherchePageResults.tsx`) :
- `ItineraryCard` — carte d'itinéraire de la liste de résultats.
- `CompactPreview` — résumé compact affiché dans la poignée du bandeau mobile replié.

**Étendu en session** (retour utilisateur après la première itération) : `ItinerarySegments` (détail déplié, segment par segment) affiche désormais aussi le badge de ligne à la place de l'icône générique, pour rester cohérent visuellement avec `ItineraryCard`/`CompactPreview` — le texte du libellé (ex. "Bus C1") reste inchangé, c'est la seule source d'information pour les lecteurs d'écran (le badge, comme l'icône avant lui, reste dans un conteneur `aria-hidden`).

## 3. Dédup par ligne, pas par mode

`modesUsedBy()` construit aujourd'hui l'ensemble unique des `segment.mode` d'un itinéraire (`[...new Set(...)]`), sans distinguer deux segments de même mode mais de ligne différente. Avec un badge qui affiche le numéro de ligne, ce comportement doit changer : un trajet Bus 24 → Métro a → Bus C6 doit afficher **3 badges distincts**, dans l'ordre du trajet — pas une seule pastille "Bus" fusionnant les deux lignes de bus.

Nouvelle fonction `tripModeChips(itinerary)` (remplace `modesUsedBy`), qui parcourt `itinerary.segments` dans l'ordre et produit une liste de "chips" :

```ts
export type TripModeChip =
  | { kind: 'icon'; mode: string }
  | { kind: 'line'; mode: string; label: string };
```

- Modes "de ligne" (BUS, TRAM, RAIL, SUBWAY) → `{ kind: 'line', mode, label }`, où `label` = `segment.routeName` s'il est renseigné, sinon le libellé du mode (`getModeStyle(mode).label`, ex. "Bus") en repli. Déduplication par la paire **(mode, label)** — deux segments Bus 24 consécutifs (ex. après une correspondance sans changement de ligne, cas rare mais possible) ne produisent qu'un seul badge.
- Autres modes (WALK, BICYCLE, SCOOTER, CAR, tout mode non répertorié) → `{ kind: 'icon', mode }`, comportement strictement inchangé : dédup par mode seul, rendu via `getTripModeIcon` comme aujourd'hui.

## 4. Composant `LineBadge`

Nouveau composant `frontend/src/components/LineBadge/LineBadge.tsx`, props `{ mode: string; label: string }`. Rendu : `<span className={...}>{label}</span>`, une classe de forme par mode :

| Mode | Forme | Mise en œuvre CSS |
| --- | --- | --- |
| BUS | Rectangle à coins droits | `border-radius: 0` |
| TRAM | Rectangle à coins arrondis | `border-radius: var(--radius-sm)` |
| SUBWAY (métro) | Cercle | `border-radius: 50%; aspect-ratio: 1` |
| RAIL (train, ex. RER/TER) | Rectangle à coins coupés ("ticket") | `clip-path: polygon(...)` (octogone) |

**Couleur (version initiale, revue en section 8)** : neutre, `color`/`border-color: var(--color-text-muted)` — la même teinte que les icônes de mode actuelles de cette rangée (`.resultats-card-modes`). Décision explicite de ne **pas** reprendre les couleurs catégorielles de `frontend/src/components/MapView/modeStyles.ts` : ce fichier documente lui-même ces couleurs comme validées pour un usage cartographique précis (contraste vs fond de carte), pas comme des couleurs d'interface — les réutiliser ici rouvrirait une validation de contraste WCAG 1.4.3 complète pour un gain visuel marginal. La forme et le texte du badge suffisent à différencier les lignes, sans dépendre de la couleur (WCAG 1.4.1 — cohérent avec le reste du projet, voir `.resultats-card.is-selected`).

> Cette décision est revisitée en section 8 : la couleur appliquée n'est plus la palette catégorielle de `modeStyles.ts` (qui reste hors sujet, l'objection ci-dessus tient toujours), mais la couleur **propre à la ligne** fournie par le GTFS de l'opérateur — une source différente, qui ne rouvre pas la même question de validation.

**Choix de la forme "train"** : un rectangle à coins coupés plutôt qu'une pilule totalement arrondie, pour éviter la confusion avec le badge de scoring qualitatif (`components/Badge/Badge.tsx`, issue #126) qui utilise déjà `--radius-full`. Les deux badges n'apparaissent pas dans la même rangée de la carte, mais restent visuellement distincts par choix.

## 5. Intégration

- `ItineraryCard` : la rangée `.resultats-card-modes` (`aria-hidden="true"`) itère `tripModeChips(itinerary)` au lieu de `modesUsedBy(itinerary)`, rendant `getTripModeIcon(chip.mode)` pour un chip `icon`, `<LineBadge mode={chip.mode} label={chip.label} />` pour un chip `line`.
- Le texte cache pour lecteurs d'écran (`modesLabel`, actuellement `modes.map(mode => getModeStyle(mode).label).join(', ')`) est reconstruit à partir des chips : un chip `line` contribue son `label` complet (ex. "Bus 24"), un chip `icon` contribue le libellé du mode comme aujourd'hui (ex. "Marche") — résultat "Marche, Bus 24, Métro a" par exemple.
- `CompactPreview` (`.resultats-sheet-preview-modes`, `aria-hidden="true"`) : même remplacement `modesUsedBy` → `tripModeChips`, sans texte caché additionnel (déjà le cas aujourd'hui, la poignée du bandeau porte son propre nom accessible via le texte visible).

## 6. Tests

- Nouveau `frontend/src/pages/RecherchePage/tripModeChips.spec.ts` (Vitest, unitaire pur, même style que `itineraryBadges.spec.ts`) :
  - un segment BUS avec `routeName` produit un chip `line` avec ce libellé.
  - un segment BUS sans `routeName` produit un chip `line` avec le libellé du mode ("Bus") en repli.
  - deux segments Bus de lignes différentes produisent deux chips distincts, dans l'ordre du trajet.
  - deux segments Bus de la même ligne (même `routeName`) ne produisent qu'un seul chip.
  - un segment WALK/BICYCLE/SCOOTER/CAR produit un chip `icon`, comportement de dédup par mode inchangé.
  - ordre préservé : un trajet Bus 24 → Métro a → Bus C6 produit `[line Bus 24, line Métro a, line Bus C6]` dans cet ordre.
- Extension de `RecherchePageResults.spec.tsx` : badge de ligne visible avec le bon texte et la bonne classe de forme sur `ItineraryCard`, dédup de deux lignes bus distinctes visible dans le DOM, icône marche inchangée, texte caché (`modesLabel`) mis à jour avec le numéro de ligne.

## 8. Extension — couleur de ligne (GTFS) sur les badges et la carte

> Ajoutée en session le 2026-08-18, à la demande utilisateur — revient sur la décision de couleur neutre de la section 4.

### 8.1 Constat

Le GTFS de Rennes Métropole (`routes.txt`) porte déjà `route_color`/`route_text_color` par ligne (ex. métro a = `EE1D23`/`FFFFFF`, ligne C1 = `95C11E`/`1A171B`) — vérifié en instance locale : OpenTripPlanner les relaie tels quels sur chaque `leg` de `GET /plan` (`"routeColor":"EE1D23"`, sans `#`). Rien n'est aujourd'hui transmis jusqu'au frontend : ni le backend (`TripSegment` n'a que `routeName`), ni l'app (badges neutres, tracé de carte coloré par mode via `modeStyles.ts`).

### 8.2 Flux de données (nouveau, Dev BE)

```text
OTP leg.routeColor / leg.routeTextColor
  → backend OtpLeg (otp/interfaces/otp-plan-response.interface.ts) — 2 champs optionnels ajoutés
  → TripsService#mapLeg — mappe vers TripSegment.routeColor / routeTextColor
  → TripSegment DTO (trips/dto/trip-itinerary.dto.ts) — routeColor?/routeTextColor? (ApiPropertyOptional)
  → frontend lib/trips.ts (type miroir de TripSegment)
```

Valeurs relayées brutes (sans `#`, telles que rendues par OTP) jusqu'au frontend, qui porte seul la responsabilité de préfixer `#` avant usage CSS (petit helper partagé, ex. `toHexColor()`) — pas de transformation côté backend, simple relais. Absence du champ (ligne sans couleur définie dans le GTFS source, cas non observé sur STAR aujourd'hui mais le typage reste optionnel) : `routeColor`/`routeTextColor` `undefined`, tous les consommateurs en aval retombent alors sur leur style neutre/par-mode actuel.

Cet ajout sort du périmètre strictement Dev FE de #129 (petite portion Dev BE, 3 fichiers) — exception ponctuelle documentée ici, dans le même esprit que celle déjà actée pour [#11](https://github.com/KerdanetYvan/urbanflow-mobility/issues/11) (voir `sprint-3-plan.md`).

### 8.3 `tripModeChips` : source commune carte + badges

`tripModeChips.ts` déplacé de `frontend/src/pages/RecherchePage/` vers `frontend/src/lib/` (avec son fichier de tests) : `MapView.tsx` en a désormais besoin en plus de `RecherchePageResults.tsx`, et `components/` ne doit pas dépendre d'un fichier logé sous `pages/`.

Le chip `line` gagne deux champs optionnels :

```ts
export type TripModeChip =
  | { kind: 'icon'; mode: string }
  | { kind: 'line'; mode: string; label: string; color?: string; textColor?: string };
```

`color`/`textColor` viennent de `segment.routeColor`/`routeTextColor` (premier segment rencontré pour la paire (mode, label) déduplicée — les segments d'une même ligne partagent la même couleur en pratique, aucune fusion de couleurs différentes à gérer).

### 8.4 `LineBadge` : fond plein

`LineBadge` accepte `color?`/`textColor?` en plus de `mode`/`label`. Si les deux sont fournis : style inline `{ background: '#'+color, color: '#'+textColor, borderColor: '#'+color }`, appliqué par-dessus la classe de forme existante (`line-badge--bus`/`--tram`/`--metro`/`--train`, inchangées). Si absents : classes CSS actuelles inchangées (fond transparent, texte/bordure `var(--color-text-muted)`) — le repli de la section 4 reste le comportement par défaut, pas supprimé.

### 8.5 `MapView` : tracé et légende par ligne

- **Tracé** : pour un segment BUS/TRAM/RAIL/SUBWAY, `pathOptions.color` = `'#' + segment.routeColor` si renseigné, sinon `getModeStyle(mode).color` (repli actuel, inchangé). WALK/BICYCLE/SCOOTER/CAR : inchangés, `modeStyles.ts` reste la seule source pour ces modes (pas de notion de "ligne").
- **Légende** (mode `boxed` uniquement, voir `MapViewProps.variant`) : remplace le calcul actuel par mode (`modesUsed`, dédup `segment.mode`) par `tripModeChips(itinerary)` — un swatch par ligne distincte avec sa couleur (ou la couleur de repli si absente), un swatch par mode pour le reste (marche, vélo...), même logique de dédup que les badges.

### 8.6 Accessibilité — limite assumée

Pas de vérification de contraste au runtime entre `route_color` et `route_text_color` : ces couleurs sont définies par l'opérateur (STAR) pour ses propres supports, on leur fait confiance telles quelles plutôt que de recalculer un ratio WCAG à l'affichage. Le filet de sécurité reste celui déjà en place depuis la section 4 : le texte de la ligne (ex. "C1") et la forme du badge restent le canal d'information indépendant de la couleur (WCAG 1.4.1), que la couleur GTFS soit lisible ou non pour un cas particulier. Aucune ligne du réseau STAR actuel ne pose de problème visible à l'usage, mais ce n'est pas garanti pour un futur opérateur GTFS ajouté (voir contrainte d'interopérabilité du projet) — limite acceptée, pas vérifiée automatiquement.

### 8.7 Tests (extension)

- Backend `trips.service.spec.ts` : mapping `routeColor`/`routeTextColor` depuis un leg OTP (présent → relayé tel quel ; absent → `undefined`, pas d'erreur).
- Frontend `tripModeChips.spec.ts` (déplacé) : `color`/`textColor` propagés sur un chip `line` quand le segment les porte ; absents → chip sans ces champs, repli neutre en aval.
- `LineBadge.spec.tsx` : style inline `background`/`color`/`borderColor` présent quand `color`/`textColor` fournis ; classes seules (pas de style inline) sinon.
- `MapView.spec.tsx` : `pathOptions.color` du `Polyline` d'un segment BUS/TRAM/RAIL/SUBWAY reflète `routeColor` quand présent ; légende affiche un swatch par ligne avec la bonne couleur.
- `RecherchePageResults.spec.tsx` : badge de ligne avec style inline coloré visible sur `ItineraryCard`.

## 9. Hors périmètre / limites acceptées

- Le réseau STAR (Rennes Métropole, seule source GTFS ingérée à ce jour) ne comporte pas de ligne RAIL — la forme "train" reste donc non démontrable avec les données réelles actuelles, mais le code la gère pour rester générique vis-à-vis du modèle OTP.
- Pas de vérification automatique de contraste sur les couleurs de ligne GTFS (voir section 8.6) — limite assumée, pas une lacune non documentée.

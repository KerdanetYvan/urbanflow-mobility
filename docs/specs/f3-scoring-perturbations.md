# Spécifications détaillées — Scoring et perturbations (F3)

> Casquette PO — issue [#26](https://github.com/KerdanetYvan/urbanflow-mobility/issues/26), Sprint 2.
> Sert de base à l'implémentation Dev BE des issues Sprint 3 [#16](https://github.com/KerdanetYvan/urbanflow-mobility/issues/16) (service de scoring), [#17](https://github.com/KerdanetYvan/urbanflow-mobility/issues/17) (intégration météo) et [#18](https://github.com/KerdanetYvan/urbanflow-mobility/issues/18) (recalcul + notification push).

## 1. Périmètre

Ce document cadre **l'expérience utilisateur et les règles métier** autour de deux sujets liés :

1. Quel rôle joue le score dans ce que voit l'utilisateur (uniquement le tri de la liste, jamais une valeur affichée) et les quelques badges qui viennent en renfort minimal.
2. Comment une perturbation détectée en cours de trajet est communiquée, et ce qui se passe quand l'utilisateur réagit à cette communication.

**Hors périmètre**, volontairement :

- L'algorithme de calcul lui-même (formule exacte, normalisation des critères) → implémentation [#16](https://github.com/KerdanetYvan/urbanflow-mobility/issues/16).
- Le choix de l'API météo et sa mise en cache → implémentation [#17](https://github.com/KerdanetYvan/urbanflow-mobility/issues/17).
- Le parsing du flux GTFS-Realtime et l'abonnement technique → implémentation [#18](https://github.com/KerdanetYvan/urbanflow-mobility/issues/18) et [#14](https://github.com/KerdanetYvan/urbanflow-mobility/issues/14).
- Les écrans de recherche/résultats/carte eux-mêmes → déjà cadrés par [#25](https://github.com/KerdanetYvan/urbanflow-mobility/issues/25) (`docs/specs/f2-ecrans-planification.md`). Ce document **complète** ce spec sans le contredire — en particulier, la règle "le score n'est jamais affiché tel quel" (section 3.1 du spec F2) reste acquise et structure toute la section 2 ci-dessous.

Ce document ne fixe pas non plus l'architecture technique du service de scoring : voir CLAUDE.md ("Fonctionnalité complémentaire retenue : scoring d'itinéraires") pour le flux déjà décidé (`OpenTripPlanner → Service de scoring (+ météo, + GTFS-Realtime, + profil) → Itinéraires classés → PWA`).

## 2. Rôle du score : trier la liste, jamais l'afficher

### 2.1 Principe

Le score n'a **aucune représentation visible**, ni directe ni indirecte (pas de badge de valeur, de note sur 10, de pourcentage, de couleur codant un niveau — cohérent avec la règle déjà actée en [#25](https://github.com/KerdanetYvan/urbanflow-mobility/issues/25) et avec WCAG 1.4.1, ne jamais coder une information uniquement par la couleur). Son seul effet observable par l'utilisateur est **l'ordre d'affichage de la liste** ([#36](https://github.com/KerdanetYvan/urbanflow-mobility/issues/36)).

Concrètement : si le profil de l'utilisateur préfère le vélo et le bus (`preferredTransportModes`), un itinéraire vélo et/ou bus reçoit un meilleur score et remonte au-dessus d'un itinéraire équivalent en métro/train — sans qu'aucun chiffre ne soit jamais montré, uniquement la position dans la liste. Voir section 4 pour le détail des critères qui déterminent ce classement.

### 2.2 Badges : un renfort minimal, jamais une explication du calcul

Au-delà du simple ordre, jusqu'à **2 badges maximum sur l'ensemble de la liste** (pas par itinéraire) mettent en avant un choix, toujours en langage qualitatif, jamais une valeur chiffrée :

1. **Un badge "meilleur choix global"** (libellé exact à affiner en maquette, ex. "Le plus adapté à vos critères") sur l'itinéraire déjà en tête de liste — renforce visuellement pourquoi il est en premier, sans révéler de valeur de score.
2. **Un badge optionnel ciblé sur un seul critère**, uniquement quand ce critère est explicitement prioritaire pour l'utilisateur d'après son profil (ex. `maxTransfers` renseigné) : affiché sur l'itinéraire de la liste qui satisfait le mieux CE critère précis, même si ce n'est pas celui en tête de liste — ex. "Le moins de correspondances" sur l'itinéraire ayant le moins de correspondances parmi les résultats affichés, si l'utilisateur cherche à les limiter. Donne une alternative visible à l'utilisateur qui voudrait arbitrer différemment du classement par défaut, sans jamais lui montrer pourquoi le classement par défaut a tranché autrement.

Règles :

- 2 badges maximum affichés simultanément sur toute la liste, jamais plus, jamais par itinéraire individuel — reste minimal, cohérent avec le principe mobile-first du spec F2 (rien qui alourdisse l'écran pour un usager pressé comme Antoine).
- **Au plus un badge par carte** ([#169](https://github.com/KerdanetYvan/urbanflow-mobility/issues/169)) : si l'itinéraire en tête de liste est *aussi* celui qui satisfait le mieux le critère ciblé, il ne porte **que** le badge "meilleur choix global" (prioritaire) — le badge ciblé n'est alors affiché nulle part, puisqu'aucun autre itinéraire ne se distingue sur ce critère. Le total sur la liste tombe à 1 dans ce cas.
- Formulations qualitatives uniquement (jamais "+12% plus rapide", jamais de minutage comparatif) : le badge signale un choix, il ne justifie jamais un calcul.
- Si aucun critère n'est explicitement prioritaire pour l'utilisateur (profil incomplet ou recherche sans compte, [#64](https://github.com/KerdanetYvan/urbanflow-mobility/issues/64)), seul le badge "meilleur choix global" s'affiche.

Le marqueur "Perturbation en cours" (voir section 3.3) est un cas à part : ce n'est pas un badge de transparence du score, mais une alerte de sécurité/actualité de trajet, affichée indépendamment de ces règles quel que soit le nombre de badges déjà utilisés.

## 3. Comportement lors d'une perturbation détectée en cours de trajet

### 3.1 Déclenchement

Le service de scoring (backend, [#18](https://github.com/KerdanetYvan/urbanflow-mobility/issues/18)) est abonné au flux GTFS-Realtime. Quand une perturbation touche un segment de l'itinéraire **actuellement suivi** par un utilisateur (pas n'importe quel itinéraire déjà consulté, seulement celui explicitement sélectionné comme "en cours"), il déclenche :

1. Un recalcul du classement des itinéraires alternatifs pour le même trajet origine/destination.
2. Une notification push vers le frontend.

Pas de polling fréquent côté frontend pour vérifier une perturbation : le mécanisme est évènementiel (abonnement GTFS-Realtime côté backend qui pousse l'information), cohérent avec la contrainte transverse éco-conception du projet (CLAUDE.md — limiter les appels réseau superflus).

### 3.2 Contenu de la notification

Notification système (Notification API via le service worker), volontairement minimale :

- **Titre** : "Perturbation sur votre trajet"
- **Corps** : une phrase courte et concrète, ex. "Votre bus T1 est retardé de 8 min — un nouvel itinéraire est disponible." Jamais de jargon technique (pas de code de perturbation GTFS-RT brut).
- Pas de détail du nouveau score dans la notification elle-même (cohérent avec la section 2) : juste de quoi donner envie de rouvrir l'app.

### 3.3 Réaction au tap

Taper la notification ouvre l'app **directement sur l'écran de résultats**, avec le classement déjà recalculé et l'itinéraire perturbé marqué par une alerte "Perturbation en cours" (visuellement distincte des badges de la section 2.2, voir la note en fin de cette section) — jamais un retour à l'écran de recherche : l'utilisateur ne doit pas retaper son trajet en cours de route.

### 3.4 Permission refusée ou app fermée

- **Permission notification refusée** : si l'app est ouverte au moment de la perturbation, une bannière `Alert` (variant `warning`, composant déjà existant — voir `frontend/src/components/Alert.tsx`) apparaît en haut de l'écran de résultats avec le même message que la notification. Si l'app est fermée, pas de mécanisme de repli (pas de SMS/email) pour cette version — limite acceptée, à documenter comme telle dans le dossier plutôt que de complexifier l'implémentation pour un canal secondaire.
- **App fermée, permission accordée** : la notification système fonctionne normalement (comportement standard d'un service worker enregistré), pas de développement supplémentaire attendu au-delà de l'enregistrement déjà prévu par la PWA ([#19](https://github.com/KerdanetYvan/urbanflow-mobility/issues/19)).

### 3.5 Fréquence et anti-spam

Un seul recalcul + une seule notification par perturbation détectée sur le trajet en cours — si la situation évolue encore (nouveau retard sur le même trajet), attendre un changement significatif (ex. delta de durée estimée supérieur à 5 minutes) avant de renotifier, pour ne pas harceler l'utilisateur de notifications à chaque micro-mise-à-jour du flux GTFS-RT.

## 4. Priorisation des critères de scoring par défaut

### 4.1 Ce qui reste filtré en amont par OpenTripPlanner, pas par le score

Révision issue #68 : le profil de mobilité expose désormais `accessibilityPreferences` (voir `AccessibilityPreference`, `backend/src/profiles/`), un tableau de préférences cochées/décochées plutôt que les anciens champs `reducedMobility`/`maxWalkingDistanceMeters`/`maxTransfers`. Une seule d'entre elles reste pensée comme un **filtre dur** transmis à OpenTripPlanner en amont du scoring, parce qu'elle correspond à une impossibilité physique et non à une simple préférence :

- `wheelchair_accessible` → paramètre OTP d'accessibilité fauteuil roulant : OTP ne renverrait que des itinéraires accessibles, le service de scoring n'aurait pas à y revenir. Câblage réel vers OTP hors périmètre de l'issue #68 (modèle de profil uniquement) — à traiter avec l'intégration OTP du scoring (#16).

`limit_walking_distance` et `limit_transfers` ne sont **plus** des bornes numériques transmises à OTP (un seuil "max" ne fait qu'éliminer des trajets, il ne les classe pas) : ce sont désormais des entrées de **pondération** du score, voir section 4.3.

### 4.2 Critères pondérés du score

| Critère | Poids par défaut | Détail |
| --- | --- | --- |
| Durée totale du trajet | 40 % | Porte-parole direct de la donnée OTP (`duration`) |
| Nombre de correspondances | 25 % | Une pénalité croissante au-delà d'une correspondance, pas un simple seuil binaire |
| Météo en cours | 15 % | Pénalise les segments marche/vélo/trottinette en cas de forte pluie ou de froid extrême ([#17](https://github.com/KerdanetYvan/urbanflow-mobility/issues/17)) ; nulle pour un trajet 100% transport en commun |
| Perturbations GTFS-Realtime en cours | 20 % | Pénalise un itinéraire dont un segment est actuellement annoncé perturbé, avant même que l'utilisateur ne l'ait sélectionné (utile dès l'écran de résultats initial, pas seulement en cours de trajet — voir section 3) |

Poids **volontairement simples et documentés en dur dans le code** (pas une configuration base de données/admin) au lancement : suffisant pour rester "un système de poids clairs et modifiables, pas un modèle de ML opaque" (CLAUDE.md), sans construire une interface de configuration non demandée par le cahier des charges.

### 4.3 Influence du profil sur la pondération

- `preferredTransportModes` : un itinéraire utilisant un mode **non coché** par l'utilisateur n'est pas exclu, seulement pénalisé (pénalité forte équivalente à environ un tiers de son score total, suffisante pour le reléguer en fin de liste sauf si aucune alternative ne respecte la préférence) — dans le même esprit que la règle déjà actée pour "0 résultat" (section 4 du spec F2) : un écran vide est pire qu'un résultat imparfait, donc jamais un filtre dur qui viderait la liste.
- Un profil qui n'a pas encore renseigné `preferredTransportModes` (tableau vide) reçoit le classement par défaut, sans pénalité de mode : cohérent avec le fait que la recherche reste utilisable sans compte ([#64](https://github.com/KerdanetYvan/urbanflow-mobility/issues/64)), où aucune préférence n'existe par construction.
- `limit_transfers` coché → augmente le poids du critère "nombre de correspondances" (tableau 4.2) pour ce profil, plutôt que d'éliminer les trajets à plus d'une correspondance (voir révision 4.1, issue #68) : reste une préférence classante, jamais un couperet qui pourrait vider la liste de résultats.
- `limit_walking_distance` coché → pénalise la distance de marche cumulée d'un itinéraire (donnée déjà disponible dans les segments OTP), avec le même principe : un poids plus fort, pas un rejet des trajets qui en comportent.
- Formules de pondération exactes (valeur du poids renforcé, courbe de pénalité pour la distance de marche) à trancher lors de l'implémentation du service de scoring (#16, Sprint 3) — hors périmètre de cette révision, qui ne porte que sur le modèle de profil.

## 5. Exemples (personas du dossier, partie 2.3)

- **Antoine** (pressé, aucune contrainte d'accessibilité, préférences larges) : les 4 critères s'appliquent sans repondération. Un itinéraire à pied sous la pluie battante perd des points face à une alternative en transport en commun légèrement plus longue.
- **Muriel** (`accessibilityPreferences: [wheelchair_accessible, limit_walking_distance, limit_transfers]`) : OTP ne renvoie que des itinéraires accessibles en fauteuil roulant (filtre amont, section 4.1) ; parmi ceux-ci, le classement pondère plus fortement les correspondances et la distance de marche (section 4.3) plutôt que d'éliminer les trajets qui en comportent.

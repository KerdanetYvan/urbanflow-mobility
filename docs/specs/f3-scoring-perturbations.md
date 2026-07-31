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

### 4.1 Ce qui est filtré en amont par OpenTripPlanner, pas par le score

Certaines préférences du profil de mobilité sont déjà transmises comme **contraintes natives de routage** à OpenTripPlanner, en amont du scoring — elles ne sont donc pas des critères de classement mais des filtres à la source :

- `reducedMobility` → paramètre OTP d'accessibilité fauteuil roulant (déjà noté dans `backend/src/profiles/mobility-profile.entity.ts`) : OTP ne renvoie que des itinéraires accessibles, le service de scoring n'a pas à y revenir.
- `maxWalkingDistanceMeters` / `maxTransfers`, quand renseignés → transmis à OTP comme bornes de recherche plutôt que comme pénalité de score après coup.

Le service de scoring ne fait donc que **classer** des itinéraires déjà conformes à ces contraintes dures — il n'a pas à les re-vérifier.

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
- Pas de re-pondération des 4 critères du tableau 4.2 par profil (ex. ne pas remonter "correspondances" à 40% pour un utilisateur en fauteuil roulant) : `reducedMobility` agit déjà en amont (section 4.1), une double action (filtre ET repondération) rendrait le comportement plus difficile à expliquer dans le dossier sans bénéfice utilisateur clair pour le MVP.

## 5. Exemples (personas du dossier, partie 2.3)

- **Antoine** (pressé, aucune contrainte d'accessibilité, préférences larges) : les 4 critères s'appliquent sans repondération. Un itinéraire à pied sous la pluie battante perd des points face à une alternative en transport en commun légèrement plus longue.
- **Muriel** (mobilité réduite, `maxTransfers: 0`) : OTP ne renvoie que des itinéraires accessibles avec au plus 0 correspondance (filtre amont, section 4.1) ; parmi ceux-ci, le classement reste piloté par les 4 critères du tableau 4.2 sans traitement spécial supplémentaire.

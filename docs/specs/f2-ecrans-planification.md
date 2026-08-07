# Spécifications détaillées — Écrans F2 (planification d'itinéraires)

> Casquette PO — issue [#25](https://github.com/KerdanetYvan/urbanflow-mobility/issues/25), Sprint 1.
> Sert de base à l'implémentation Dev FE des issues [#35](https://github.com/KerdanetYvan/urbanflow-mobility/issues/35) (écran de recherche) et [#36](https://github.com/KerdanetYvan/urbanflow-mobility/issues/36) (écran de résultats), toutes deux planifiées en Sprint 2.

## 1. Périmètre

Ce document cadre **trois zones d'écran** :

1. Recherche (route `/recherche`)
2. Résultats — liste classée (route `/resultats`)
3. Affichage carte — intégré à l'écran de résultats, pas une route séparée (voir [3.3](#33-carte))

**Hors périmètre**, volontairement, car couvert par un autre ticket PO dédié :

- Les règles détaillées d'affichage du score et son détail (transparence du calcul) → [#26](https://github.com/KerdanetYvan/urbanflow-mobility/issues/26)
- Le comportement attendu lors d'une notification de perturbation en cours de trajet → [#26](https://github.com/KerdanetYvan/urbanflow-mobility/issues/26)

Ce document ne fixe donc que la **structure et le comportement des écrans**, pas la logique de classement elle-même.

### 1.1 Principe directeur : mobile-first

Conformément à la contrainte transverse « Responsive / UX » du projet (usage prioritaire en mobilité, voir `CLAUDE.md`), les deux écrans sont conçus **d'abord pour mobile**, puis adaptés aux écrans plus larges — jamais l'inverse. Concrètement :

- Disposition en **colonne unique** par défaut (recherche comme résultats), aucun contenu côte à côte tant que l'espace mobile ne le permet pas.
- Les dispositions multi-colonnes (ex. liste + carte simultanées, [3.3](#33-carte)) sont des **améliorations progressives** activées à partir d'un certain seuil d'écran, jamais un pré-requis pour utiliser l'écran.
- Cibles tactiles (boutons, cases à cocher, items de liste) dimensionnées pour le doigt, pas seulement pour le curseur (WCAG 2.5.5).

## 2. Écran de recherche (`/recherche`, implémenté par #35)

### 2.1 Champs

| Champ | Type | Obligatoire | Comportement |
| --- | --- | --- | --- |
| Origine | Texte + autocomplétion adresse | Oui | Géocodage à la saisie (debounce), sélection dans une liste de suggestions |
| Destination | Texte + autocomplétion adresse | Oui | Idem origine |
| Inverser origine/destination | Bouton icône | — | Échange instantané des deux valeurs |
| Heure | Toggle "Partir à" / "Arriver avant" + sélecteur date/heure | Non | Par défaut "Partir à maintenant" |
| Modes de transport | Cases à cocher, pré-remplies depuis `preferredTransportModes` du profil (F1) | Non | Modifiable pour cette recherche uniquement, **non persisté** dans le profil |
| Rechercher | Bouton submit | — | Cf. section 2.4 (États), ci-dessous |

Réutilise les composants existants `FormField`, `Button` (voir `frontend/src/components/`) plutôt que d'en recréer — mêmes conventions d'accessibilité (label toujours visible, pas de placeholder-as-label) que l'écran profil.

### 2.2 Disposition (mobile-first)

- Champs empilés verticalement dans l'ordre du tableau [2.1](#21-champs) — pas de champs côte à côte sur mobile, y compris origine/destination.
- Le bouton "Rechercher" reste atteignable sans scroll excessif : à défaut de le rendre flottant/sticky en bas d'écran, il ne doit jamais se retrouver après une longue liste de champs optionnels (heure, modes) qui découragerait l'usage rapide visé pour un utilisateur comme Antoine (persona, dossier partie 2.3).
- Sur un écran plus large (tablette/desktop), les champs origine/destination peuvent passer côte à côte ; le reste de la disposition ne change pas.

### 2.3 Validations

- Origine et destination non vides au submit → sinon `FormField` bascule en état erreur (comme sur `ProfilPage`), focus posé sur le premier champ en erreur.
- Origine identique à destination → blocage côté client avant tout appel API, message "L'origine et la destination doivent être différentes."
- Une adresse saisie mais jamais sélectionnée dans la liste d'autocomplétion est traitée comme non résolue (voir la ligne « Adresse non résolue côté serveur » en [section 4](#4-cas-limites-et-gestion-derreur)).

### 2.4 États

- **Chargement** : bouton "Rechercher" désactivé, libellé "Recherche…" (même pattern que `isSaving` sur `ProfilPage`).
- **Succès** : navigation vers `/resultats`, critères transmis (origine/destination géocodées, heure, modes) via l'état de navigation React Router plutôt qu'en query params, pour éviter d'exposer des coordonnées précises dans l'URL (cf. contrainte RGPD géolocalisation du dossier, partie 10.2).
- **Échec** : voir [section 4](#4-cas-limites-et-gestion-derreur).

## 3. Écran de résultats (`/resultats`, implémenté par #36)

> **Structure révisée** par [`refonte-visuelle-mobile-desktop.md`](refonte-visuelle-mobile-desktop.md) section 2 (issue [#72](https://github.com/KerdanetYvan/urbanflow-mobility/issues/72)) : la route `/resultats` est fusionnée dans `/recherche` (machine à états, plus de route séparée). Les spécifications de contenu ci-dessous (liste, sélection, carte) restent la référence — seule la structure en deux écrans distincts est révisée.

### 3.1 Liste des itinéraires

Chaque itinéraire de la liste affiche :

- Icônes des modes utilisés (segments multimodaux)
- Durée totale + heure de départ → heure d'arrivée
- Nombre de correspondances
- Action "Voir le détail"

Affichage en **cartes empilées verticalement, pleine largeur** (pas de tableau), cohérent avec le principe mobile-first ([1.1](#11-principe-directeur--mobile-first)) — chaque carte reste l'unité tactile complète (toute la carte est cliquable/activable, pas seulement le lien "Voir le détail").

**Le score n'est jamais affiché tel quel** : c'est un critère de tri interne, pas une information montrée à l'utilisateur (pas de badge, pas de valeur numérique). La liste est déjà triée par le backend selon ce score (`GET /trips`, #7) — l'écran ne re-trie pas côté client, et n'a pas à connaître la valeur du score pour afficher la liste dans le bon ordre. Le détail éventuel des critères de classement (si un jour affiché) relève de [#26](https://github.com/KerdanetYvan/urbanflow-mobility/issues/26), pas de cet écran.

### 3.2 Sélection d'un itinéraire

Cliquer/activer un itinéraire de la liste :

- le marque comme sélectionné (état visuel + `aria-current`)
- affiche son détail : tracé sur la carte + décomposition segment par segment (mode, durée, arrêt de correspondance)

Doit être utilisable **au clavier seul** (tabulation + Entrée/Espace sur la carte-itinéraire) — la carte n'est jamais le seul moyen de sélectionner un trajet.

### 3.3 Carte

- Affiche le tracé de l'itinéraire **sélectionné** (pas les N itinéraires en même temps, pour rester lisible).
- Marqueurs : origine, destination, points de correspondance.
- Sur mobile (priorité du projet — usage en mobilité) : la liste est affichée en premier ; la carte est accessible via une bascule "Voir sur la carte" plutôt qu'un split-screen qui écraserait la liste sur petit écran.
- Sur desktop/tablette : liste à gauche, carte à droite, en simultané.
- La carte reste un **complément visuel** : la liste + le détail texte des segments constituent déjà l'alternative non-visuelle complète (aucune information n'existe uniquement sur la carte) — point à vérifier lors de l'implémentation, cf. WCAG 1.1.1.
- Choix de la bibliothèque cartographique laissé à l'implémentation (#36) ; à titre indicatif, une solution sans clé API commerciale (ex. Leaflet + tuiles OSM) resterait cohérente avec le choix déjà argumenté dans le dossier de certification (partie 3.3, moteur de calcul d'itinéraires) d'éviter une dépendance à un service tiers payant pour le cœur de la fonctionnalité. Le dossier n'étant pas versionné dans ce dépôt (voir `CLAUDE.md`, section scope), pas de lien direct ici.

### 3.4 Note de séquencement Sprint 2 / Sprint 3

Le score n'étant qu'un critère de tri interne ([3.1](#31-liste-des-itinéraires)), l'écran de résultats (#36) n'a **aucune dépendance visuelle** au service de scoring (#16) ni à l'intégration météo (#17), tous deux planifiés en Sprint 3 — #36 se contente d'afficher la liste dans l'ordre renvoyé par le backend, quel que soit le critère de tri utilisé à ce moment-là.

En Sprint 2, `GET /trips` (#7) peut donc renvoyer les itinéraires triés par ordre natif OpenTripPlanner (durée) : l'écran fonctionne sans modification. Quand #16/#17 seront livrés en Sprint 3 et changeront le critère de tri côté backend, l'écran n'a rien à changer non plus — aucune reprise de #36 à prévoir.

## 4. Cas limites et gestion d'erreur

| Cas | Écran concerné | Comportement attendu |
| --- | --- | --- |
| Aucun itinéraire trouvé (0 résultat renvoyé par `GET /trips`) | Résultats | État vide dédié (pas une erreur) : message clair + suggestion d'action (élargir la plage horaire, ajouter un mode de transport) |
| Adresse non résolue côté serveur (géocodage échoue) | Recherche | `Alert` variant `error`, pas de navigation vers `/resultats` |
| Origine = destination | Recherche | Blocage client avant tout appel API (voir [2.3](#23-validations)) |
| Erreur API générique / timeout du moteur de routage | Résultats | `Alert` variant `error` avec action "Réessayer" |
| Perte de connectivité pendant la recherche | Recherche / Résultats | Message dédié ("Connexion indisponible, réessayez") plutôt que l'erreur générique — cohérent avec le mode dégradé PWA (#19, cache des derniers itinéraires consultés) |
| Session expirée (401) pendant la recherche | Recherche / Résultats | Déjà géré au niveau de `lib/api.ts` (redirection vers `/connexion`) — à vérifier lors de l'implémentation, pas de logique supplémentaire attendue sur ces écrans |

## 5. Composants

**Réutilisés tels quels** : `FormField`, `Button`, `Alert` (`frontend/src/components/`).

**À créer** (portée de #35/#36, pas de ce ticket) :

- Icônes origine, destination, correspondance, et une par mode de transport (marche, vélo, trottinette, transport en commun, covoiturage) — même convention que `icons.tsx` (SVG monoline, `currentColor`, pas d'emoji).
- Un composant carte d'itinéraire (liste) et un composant carte géographique (`MapView` ou équivalent).

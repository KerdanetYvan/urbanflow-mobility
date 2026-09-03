# Spécifications détaillées — Onboarding du profil de mobilité et redirection post-connexion

> Casquette PO — issue [#106](https://github.com/KerdanetYvan/urbanflow-mobility/issues/106), Sprint 3.
> Sert de base à l'implémentation Dev FE de l'issue [#107](https://github.com/KerdanetYvan/urbanflow-mobility/issues/107).

## 1. Périmètre

Suite à la revue fonctionnelle de fin de Sprint 2 (session du 2026-08-09), ce document cadre **deux comportements liés** (pas deux sujets indépendants, l'un motive l'autre) :

1. Remplacer le formulaire vide sans guidance affiché aujourd'hui par `ProfilPage.tsx` quand l'utilisateur n'a pas encore de profil (`GET /profiles/me` → 404) par une séquence d'onboarding en plusieurs étapes.
2. Remplacer la navigation **inconditionnelle** vers `/profil` après une connexion réussie (`ConnexionPage.tsx`) par une redirection **conditionnelle** selon qu'un profil existe déjà ou non — sans ça, un utilisateur qui a déjà configuré son profil se retrouverait renvoyé vers l'onboarding à chaque connexion, ce que le comportement actuel fait déjà à tort (navigation en dur vers `/profil`).

**Hors périmètre**, explicitement :

- La branche "profil déjà existant" de `ProfilPage.tsx` (formulaire de modification pré-rempli, cas d'un utilisateur qui clique sur "Profil" dans la nav pour éditer ses préférences) : **inchangée**, aucun onboarding à revoir là — l'utilisateur l'a déjà vu une fois.
- Le modèle de données du profil et les endpoints `/profiles` : aucune évolution backend nécessaire, `GET /profiles/me` existe déjà et suffit à détecter l'absence de profil (voir `frontend/src/lib/profile.ts`).
- Le contenu des groupes de champs eux-mêmes (`TRANSPORT_MODES`, `ACCESSIBILITY_PREFERENCES`, et les adresses domicile/travail — voir [3.4](#34-étape-3--domicile-et-travail)) : réutilisés tels quels depuis `lib/profile.ts` / le formulaire d'édition, pas redéfinis ici.
- Le contenu de l'écran de connexion/inscription lui-même (champs, validation) : déjà stable, seule la destination de la navigation après succès change (section [2](#2-redirection-conditionnelle-post-connexion-connexionpagetsx)).

## 2. Redirection conditionnelle post-connexion (`ConnexionPage.tsx`)

### 2.1 Règle

`POST /auth/login` (et `POST /users` suivi de `POST /auth/login` pour l'inscription, voir le commentaire existant de `ConnexionPage.tsx`) ne renvoie que des jetons, jamais l'existence d'un profil — la décision de destination nécessite donc un appel dédié à `GET /profiles/me` juste après l'authentification réussie, avant `navigate()` :

1. `login()` (et `register()` le cas échéant) résolvent avec succès → jetons enregistrés, `setAuthenticated(true)`.
2. Appel de `getMyProfile()` (`lib/profile.ts`, déjà utilisé par `ProfilPage.tsx`).
3. Résultat 200 (profil existant) → `navigate('/recherche')`.
4. Erreur `ApiError` avec `statusCode === 404` (pas de profil) → `navigate('/profil')` — l'onboarding (section [3](#3-onboarding-du-profil-profilpagetsx-branche-pas-de-profil)) se déclenche alors automatiquement, `ProfilPage.tsx` n'a pas besoin de savoir qu'il a été atteint depuis ce chemin plutôt que via la nav.
5. Toute autre erreur (réseau, 500, timeout) → `navigate('/recherche')` **par défaut**, pas `/profil` (voir [2.2](#22-choix--pourquoi-recherche-par-défaut-en-cas-derreur-du-contrôle)).

L'état `isSubmitting` existant (libellé "Un instant…" sur le bouton submit) couvre déjà toute cette séquence, jusqu'à la navigation effective — pas de nouvel indicateur de chargement à introduire, l'utilisateur ne voit qu'un seul temps d'attente entre le clic et l'écran suivant.

### 2.2 Choix : pourquoi `/recherche` par défaut en cas d'erreur du contrôle

`/recherche` reste utilisable sans compte (issue [#64](https://github.com/KerdanetYvan/urbanflow-mobility/issues/64)) et ne dépend pas d'un profil pour fonctionner (voir `ScoringService`, qui applique ses critères de base sans profil). À l'inverse, si `GET /profiles/me` échoue pour une raison autre que "pas de profil" (réseau, panne serveur), `ProfilPage.tsx` affichera de toute façon son propre état d'erreur ("Impossible de charger le profil pour le moment.") en le rechargeant au montage — rediriger vers `/profil` dans ce cas précis ne ferait qu'exposer immédiatement cet écran d'erreur juste après une connexion par ailleurs réussie. Fail-open vers l'écran fonctionnel plutôt que vers un écran qui va lui-même échouer.

### 2.3 Cas limites

| Cas | Comportement |
| --- | --- |
| Connexion directe (mode `login`), profil existant | `/recherche` |
| Connexion directe (mode `login`), pas de profil | `/profil` (onboarding) |
| Inscription puis auto-login (mode `register`) | Toujours "pas de profil" en pratique (compte tout juste créé) → `/profil`. La vérification reste faite de la même façon que pour `login` (pas de branchement spécial "toujours onboarding après inscription") : plus simple à maintenir, et couvre correctement le cas rare d'un compte recréé après suppression d'un profil existant. |
| Échec de `getMyProfile()` (réseau/500) | `/recherche` (voir [2.2](#22-choix--pourquoi-recherche-par-défaut-en-cas-derreur-du-contrôle)) |

## 3. Onboarding du profil (`ProfilPage.tsx`, branche "pas de profil")

### 3.1 Structure générale

Séquence de **3 étapes**, une par groupe de champs déjà existant dans le formulaire d'édition — pas de nouveau regroupement à inventer, l'onboarding réutilise les blocs déjà présents, simplement présentés l'un après l'autre plutôt que sur un même écran :

1. **Étape 1 — Modes de transport préférés** (section [3.2](#32-étape-1--modes-de-transport-préférés))
2. **Étape 2 — Préférences d'accessibilité** (section [3.3](#33-étape-2--préférences-daccessibilité))
3. **Étape 3 — Domicile et travail** (section [3.4](#34-étape-3--domicile-et-travail)) — ajout issue [#236](https://github.com/KerdanetYvan/urbanflow-mobility/issues/236). L'onboarding sert à guider l'utilisateur sur **tout** ce que la page profil permet de renseigner ; il sautait jusqu'ici les deux adresses domicile/travail (issue [#114](https://github.com/KerdanetYvan/urbanflow-mobility/issues/114)), qu'il fallait donc découvrir seul plus tard dans le formulaire d'édition.

Chaque étape est **individuellement franchissable sans rien saisir** ("Passer") — cohérent avec le fait que ces champs sont déjà tous optionnels dans le formulaire non-onboarding (aucune préférence cochée = tableaux vides ; adresse laissée vide = simplement absente du payload, pas de « null » explicite — voir `ProfileInput`, PR #140). L'onboarding ne rend donc rien obligatoire qui ne l'était pas déjà — il ajoute seulement de la guidance sur un parcours qui reste entièrement facultatif dans son contenu.

Un indicateur d'étape ("Étape 1 sur 3") reste visible en permanence, avec le nom du groupe de champs en cours — sert de repère de progression, pas de barre de progression graphique complexe à justifier pour 3 étapes.

### 3.2 Étape 1 — Modes de transport préférés

- Reprend le `fieldset` "Modes de transport préférés" existant tel quel (mêmes cases à cocher, `TRANSPORT_MODES`).
- Un texte d'introduction courte remplace le paragraphe générique actuel de `ProfilPage.tsx` : quelque chose comme *"Quels modes de transport utilisez-vous le plus souvent ? Cela nous aide à classer vos itinéraires — vous pourrez changer cela à tout moment depuis votre profil."* — répond à la lacune actuelle (l'utilisateur ne sait pas qu'il doit cocher des cases ni pourquoi).
- Actions : **"Passer"** (secondaire, ne coche rien, avance à l'étape 2) / **"Continuer"** (primaire, avance à l'étape 2 en conservant la sélection courante).

### 3.3 Étape 2 — Préférences d'accessibilité

- Reprend le `fieldset` "Préférences d'accessibilité" existant tel quel (`ACCESSIBILITY_PREFERENCES`).
- Texte d'introduction dans le même esprit, orienté sur l'usage réel de ce critère (voir persona Muriel, dossier partie 2.3, section [5](#5-exemple-persona-du-dossier-partie-23)) : *"Avez-vous des contraintes de déplacement à prendre en compte ? Ces préférences influencent le classement de vos itinéraires, jamais un trajet ne sera exclu sur cette seule base."* — reprend la nuance déjà actée pour ce champ (pondération, pas filtre dur, voir le commentaire existant de `ProfilPage.tsx`).
- Actions : **"Passer"** (secondaire, ne coche rien, avance à l'étape 3 — la sélection courante est vidée) / **"Continuer"** (primaire, avance à l'étape 3 en conservant la sélection courante).

### 3.4 Étape 3 — Domicile et travail

- Reprend le bloc "Domicile et travail" du formulaire d'édition tel quel : deux `AddressField` (issue [#114](https://github.com/KerdanetYvan/urbanflow-mobility/issues/114)), un pour le domicile, un pour le travail, avec la même autocomplétion (`useAddressSuggestions` → `GET /places`).
- Texte d'introduction dans le même esprit que les deux premières étapes, orienté sur l'usage réel : *"Renseignez votre domicile et votre lieu de travail pour les retrouver en un geste comme point de départ d'une recherche. Facultatif, modifiable à tout moment depuis votre profil."* — reprend la finalité déjà actée pour ces champs (raccourcis d'origine sur `/recherche`, issue [#93](https://github.com/KerdanetYvan/urbanflow-mobility/issues/93)).
- Validation à l'identique du formulaire d'édition (`ProfilPage#handleSubmit`) : une adresse **tapée mais jamais choisie** dans la liste de suggestions est traitée comme non résolue → message d'erreur sous le champ, `createProfile()` **non appelé**, l'utilisateur reste sur l'étape 3. Un champ totalement vide n'est pas une erreur (l'adresse est simplement absente du payload).
- Actions : **"Passer"** (secondaire, ignore toute adresse éventuellement saisie sur cette étape, termine — voir [3.5](#35-navigation-entre-étapes--fin-de-la-séquence)) / **"Terminer"** (primaire, valide puis termine avec les adresses résolues).

### 3.5 Navigation entre étapes / fin de la séquence

- Un lien/bouton "Précédent" est disponible aux étapes 2 et 3 pour revenir à l'étape précédente sans perdre la saisie déjà faite (état local du composant, pas de sauvegarde intermédiaire côté serveur entre les étapes — voir [4](#4-cas-limites-et-gestion-derreur)).
- L'étape 3 ("Passer" ou "Terminer") déclenche l'unique appel réseau de toute la séquence : `createProfile({ preferredTransportModes, accessibilityPreferences, ...adresses résolues })` — **exactement le même payload** que le bouton "Enregistrer" du formulaire non-onboarding (tableaux éventuellement vides, clés d'adresse omises si non résolues). Aucun nouvel endpoint, aucune évolution du DTO `ProfileInput` (`homeLabel`/`homeLat`/`homeLon`/`workLabel`/`workLat`/`workLon` y existent déjà depuis #114).
- Succès de `createProfile()` → redirection vers `/recherche` (pas de maintien sur `/profil` : l'utilisateur vient de configurer son profil, la suite logique est d'utiliser l'application, pas de revoir un formulaire de confirmation). Diffère volontairement du comportement actuel du bouton "Enregistrer" (qui reste sur `/profil` avec un message de succès) — justifié uniquement dans le contexte onboarding, où l'utilisateur arrive tout juste de `ConnexionPage.tsx` avec l'intention de commencer à chercher un trajet.
- Échec de `createProfile()` (réseau, validation serveur) → `Alert` d'erreur affichée sur l'étape 3 en cours, exactement le même traitement d'erreur que le formulaire non-onboarding aujourd'hui (`ApiError.message` affiché tel quel) — l'utilisateur reste sur l'étape 3, peut réessayer "Terminer" sans revenir en arrière.

### 3.6 Disposition (mobile-first)

Même principe directeur que le reste de l'application (voir `f2-ecrans-planification.md` section [1.1](f2-ecrans-planification.md#11-principe-directeur--mobile-first)) : une étape à la fois occupe tout l'espace vertical utile, boutons d'action à pleine largeur en bas d'écran sur mobile — pas de disposition multi-colonnes pour l'onboarding (contrairement au formulaire non-onboarding, qui passe ses deux `fieldset` côte à côte à partir de 768px, `.profil-fieldsets`). À l'étape 3, les deux `AddressField` restent empilés verticalement quelle que soit la largeur (`.profil-addresses-fields`, déjà en colonne unique). Une seule étape visible à la fois quelle que soit la largeur d'écran : l'onboarding reste une séquence linéaire, l'affichage simultané des étapes contredirait le principe même d'une progression guidée.

## 4. Cas limites et gestion d'erreur

| Cas | Comportement |
| --- | --- |
| L'utilisateur quitte l'onboarding (navigation, fermeture d'onglet) avant l'étape 3 | Aucun profil créé — comportement identique à aujourd'hui (quitter `ProfilPage.tsx` sans cliquer "Enregistrer" ne crée rien). Un prochain accès à `/profil` relance l'onboarding depuis le début (pas de sauvegarde de progression intermédiaire, cohérent avec l'absence d'appel réseau avant l'étape 3). |
| L'utilisateur accède directement à `/profil` via la nav (pas via `ConnexionPage.tsx`), et n'a toujours pas de profil | Même onboarding déclenché — la séquence dépend uniquement du résultat de `GET /profiles/me` dans `ProfilPage.tsx` (déjà le cas aujourd'hui pour la branche "pas de profil"), pas du chemin de navigation emprunté pour y arriver. |
| `createProfile()` échoue plusieurs fois de suite à l'étape 3 | Pas de limite de tentative particulière à ajouter : mêmes garanties que le formulaire non-onboarding aujourd'hui (`isSaving` désactive le bouton pendant l'appel, réactivé après échec pour permettre un nouvel essai). |
| Session expirée en cours d'onboarding (jeton invalide) | Géré par le mécanisme déjà en place (`ProfilPage.tsx` intercepte un 401, `setAuthenticated(false)` + redirection vers `/connexion`) — inchangé, pas spécifique à l'onboarding. |

## 5. Exemple (persona du dossier, partie 2.3)

**Muriel**, qui doit éviter les trottoirs dégradés et limiter ses correspondances, vient de créer son compte. Après inscription, elle est automatiquement connectée et redirigée vers `/profil` (pas de profil existant, section [2](#2-redirection-conditionnelle-post-connexion-connexionpagetsx)). L'étape 1 (modes de transport) ne la concerne pas particulièrement : elle clique "Passer". L'étape 2 (accessibilité) est celle qui compte pour elle : elle coche "Limiter le nombre de correspondances", laisse le reste, puis "Continuer". À l'étape 3, elle saisit son domicile et le sélectionne dans la liste de suggestions, laisse le champ travail vide, puis "Terminer". Son profil est créé avec un critère d'accessibilité et une adresse domicile renseignés, elle atterrit directement sur `/recherche` — prête à lancer sa première recherche avec ce critère déjà pris en compte et son domicile proposé comme point de départ, sans étape de confirmation superflue.

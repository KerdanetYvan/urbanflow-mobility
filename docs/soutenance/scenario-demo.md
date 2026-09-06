# Scénario de démonstration — soutenance Titre 6

> Issue [#41](https://github.com/KerdanetYvan/urbanflow-mobility/issues/41). Casquette PO.
> Objectif : montrer F1, F2, F3 et la fonctionnalité au choix (scoring) en un parcours continu, chaque étape reliée à la partie du dossier qui l'argumente.
> Durée cible : **7 à 8 minutes** de démo dans les 20 minutes de présentation (voir `plan-presentation.md`).

## 0. Préparation (avant d'entrer)

| Élément | Détail |
|---|---|
| Environnement de démo | **Production** : `https://urbanflow-mobility.kerdanetyvan.dev` (données réelles Rennes Métropole : GTFS/GBFS STAR, OSM). |
| Repli si le réseau de la salle est mauvais | Stack locale : `docker compose up -d` (backend + PostGIS + OpenTripPlanner + Nominatim) et `cd frontend && npm run dev` → `http://localhost:5173`. Prévoir de l'avoir déjà lancée. |
| Repli si tout échoue | Les captures / la vidéo de secours (section « Captures de secours » ci-dessous). |
| Comptes de démonstration (jeu de données `npm run seed`) | `antoine@urbanflow.test` / `Antoine123!` (profil complet) · `muriel@urbanflow.test` / `Muriel123!` (préférences d'accessibilité) · `sans-profil@urbanflow.test` / `SansProfil123!` (arrive sur l'onboarding). |
| Fenêtres ouvertes d'avance | Onglet 1 : l'app. Onglet 2 : le dépôt GitHub (pour montrer le code / la CI si le jury demande). Onglet 3 : le dossier PDF. |
| Console navigateur | Fermée. Zoom à 100 %. Mode clair (le contraste projette mieux). |
| Notifications | Autoriser les notifications pour le site **avant** la démo (sinon le prompt casse le rythme). Vérifier `Notification.permission === "granted"`. |

Ordre volontaire : on part d'un visiteur anonyme (F2 utilisable sans compte), puis on crée le compte et le profil (F1), puis on montre l'effet du profil sur le classement (scoring), puis F3 (données opérateurs) est visible tout du long sur la carte, enfin l'alerte de perturbation.

---

## 1. F2 sans compte — la recherche est utilisable immédiatement

**But :** montrer que le cœur de valeur (planifier un trajet) ne demande pas de créer un compte. Décision de cadrage, [dossier §2.5](../rendus/UrbanFlow_Mobility_Dossier.md) et §7.

| Action | Résultat attendu | À dire |
|---|---|---|
| Ouvrir `/recherche` (page par défaut). | Carte centrée sur Rennes, panneau de recherche visible, aucun bandeau « connectez-vous ». | « La planification est ouverte à tout le monde. Le compte sert à personnaliser, pas à débloquer. » |
| Saisir une origine (ex. `Gares`) → choisir dans l'autocomplétion. Saisir une destination (ex. `République`) → choisir. | Les champs se remplissent, la carte ajuste le cadrage. | « L'autocomplétion interroge un géocodeur (Nominatim sur les données OpenStreetMap de la métropole) — [dossier §4.2](../rendus/UrbanFlow_Mobility_Dossier.md). » |
| Lancer la recherche. | Liste d'itinéraires classés + tracés sur la carte, segments colorés par mode, correspondances marquées. | « OpenTripPlanner calcule les itinéraires possibles à partir des flux GTFS ; ce qu'on voit ici est déjà **classé** par le service de scoring — j'y reviens. » |
| Ouvrir le détail d'un itinéraire (tap/clic sur une carte de résultat). | Détail segment par segment (ligne, arrêts, horaires, marche). | Montrer le badge « Trajet le plus rapide » (libellé neutre sans profil). |

**Relie à :** F2 (recherche multimodale, carte), F3 (données GTFS via OTP), §3.3, §4.1, §7.2.

---

## 2. F3 visible — les données opérateurs en temps réel

**But :** montrer que l'intégration transport n'est pas qu'un import statique.

| Action | Résultat attendu | À dire |
|---|---|---|
| Sur la carte de résultats, pointer une **station de vélos/trottinettes en libre-service** (marqueur GBFS). | Le marqueur affiche la disponibilité (nombre de vélos / de places). | « Ça, c'est du **GBFS** : la disponibilité en station, rafraîchie en tâche de fond côté serveur, pas à chaque requête — un choix d'éco-conception, [dossier §10.4](../rendus/UrbanFlow_Mobility_Dossier.md). » |
| S'il y a une perturbation active sur une ligne du résultat : montrer l'itinéraire marqué comme perturbé + le message spécifique. | Encadré décrivant la nature de la perturbation (annulation / arrêt sauté / texte d'alerte opérateur). | « Ça vient du flux **GTFS-Realtime** du même opérateur. Un itinéraire touché est **déprioritisé** dans le classement, jamais masqué. » |

**Relie à :** F3 (GTFS + GBFS des opérateurs), §3.2, Annexe A, §7.2.

> Si aucune perturbation n'est active au moment de la démo : le dire (« le réseau est nominal là maintenant »), et montrer le comportement via la capture de secours correspondante + l'étape 6 (alerte de suivi).

---

## 3. F1 — inscription et profil de mobilité

**But :** créer un compte et un profil, en montrant que le profil **sert** au classement.

| Action | Résultat attendu | À dire |
|---|---|---|
| Aller sur `/connexion` → se connecter avec `sans-profil@urbanflow.test`. | Redirection vers `/profil` en mode **onboarding** (pas encore de profil). | « Un compte fraîchement créé arrive ici : on explique à quoi sert chaque préférence avant de la demander. » |
| Parcourir l'onboarding : cocher des **modes préférés** (ex. Bus + Métro), une **contrainte d'accessibilité** (ex. « limiter les correspondances »). Valider. | Profil enregistré, retour à l'app. | « Les préférences ne filtrent pas les résultats, elles **pondèrent** le classement. Muriel n'est pas rangée dans une case “accessibilité” : sa contrainte entre dans le calcul de chaque trajet. [dossier §10.3](../rendus/UrbanFlow_Mobility_Dossier.md). » |
| (Optionnel) Montrer `/historique` : la recherche faite connecté y apparaît. | Liste des derniers trajets, bouton « Relancer cette recherche ». | « L'historique est chiffré au repos (AES-256-GCM, [dossier Annexe E](../rendus/UrbanFlow_Mobility_Dossier.md)), avec une rétention bornée — exigence RGPD sur des données de géolocalisation. » |

**Relie à :** F1 (inscription, profil), §4.4, §10.2, §10.3, Annexe C, Annexe E.

---

## 4. Scoring — le même trajet, classé différemment selon le profil

**But :** la démonstration clé. Montrer que le classement change avec le contexte et le profil.

| Action | Résultat attendu | À dire |
|---|---|---|
| Relancer **la même recherche** qu'à l'étape 1, maintenant connecté avec un profil. | Le classement peut différer : un itinéraire correspondant aux modes préférés remonte, un itinéraire à nombreuses correspondances descend si « limiter les correspondances » est coché. Le badge devient « Le plus adapté à vos critères ». | « Même moteur de routage, même trajet, classement différent. Le score est une **somme pondérée** : durée, correspondances, météo, perturbations, préférences — chaque critère a un poids explicite dans un fichier de configuration. Pas un modèle de ML : c'est justifiable et débogable. [dossier §7.3](../rendus/UrbanFlow_Mobility_Dossier.md). » |
| Se connecter en `antoine@urbanflow.test` (profil différent) et relancer. | Classement encore différent, cohérent avec l'autre profil. | « C'est ça, “le trajet le plus pertinent pour cette personne”, pas “le meilleur dans l'absolu”. » |
| (Si météo pluvieuse réelle sur Rennes) pointer un itinéraire vélo descendu dans le classement. | — | « La météo en cours est un critère de base, pas une préférence : un trajet vélo est déprioritisé sous forte pluie. » |

**Relie à :** fonctionnalité au choix (§7 entière), §7.3, diagrammes UML §8.

---

## 5. Suivre un trajet et recevoir une alerte de perturbation

**But :** montrer l'ajustement en cours de trajet (le 2ᵉ cas d'usage du scoring).

| Action | Résultat attendu | À dire |
|---|---|---|
| Dans le détail d'un itinéraire, cliquer **« Suivre ce trajet »** (connecté). | Confirmation du suivi. Le prompt de notification n'apparaît **pas** (déjà autorisé en préparation). | « L'app s'abonne aux notifications push (Web Push / VAPID) et enregistre le trajet suivi, chiffré au repos comme le reste. » |
| Expliquer le mécanisme (ou déclencher via la capture de secours) : quand une perturbation est détectée sur une ligne du trajet suivi, le backend relance un calcul et envoie une notification. | Notification système « Perturbation sur votre trajet ». À l'ouverture de l'app, itinéraires réévalués. | « L'utilisateur est prévenu **pendant** son trajet, pas une fois bloqué sur le quai. La notification est un signal ; le recalcul est déjà fait côté serveur. » |

**Relie à :** §7.2 (ajustement en cours de trajet), §7.3, §4.1 (canal de notifications).

---

## 6. Transverses — à glisser au fil de la démo, pas en bloc

| Contrainte | Quand le montrer | Phrase |
|---|---|---|
| **PWA** (C1) | Au début : icône « installer » dans la barre d'URL, ou l'app déjà installée. | « Installable sans store, service worker pour le hors-ligne partiel. » |
| **Responsive / mobile-first** (C2) | Réduire la fenêtre à ~390 px pendant une recherche. | « Conçue mobile d'abord : c'est un usage en mobilité. » |
| **Accessibilité WCAG 2.1 AA** (C7) | Naviguer une étape entièrement au clavier (Tab, Entrée, Échap sur la modale de filtres). | « Parcours complet au clavier, focus visible, audit axe-core rejoué à chaque push en CI. » |
| **Mode dégradé / connectivité variable** (C10) | Couper le réseau (DevTools offline) et recharger. | « Les derniers trajets utiles restent consultables, le cache local a une durée de vie bornée (RGPD). » |
| **Sécurité / RGPD** (C4, C8, C11) | Sur `/profil`, montrer la **suppression de compte** (double confirmation + mot de passe). | « Droit à l'effacement accessible directement, sans passer par un support. Chiffrement au repos, HTTPS, rate limiting, rotation du refresh token — audit OWASP en deux passes. » |

---

## Captures de secours (à préparer avant la soutenance)

À placer dans `docs/soutenance/captures/`. Objectif : pouvoir dérouler tout le scénario même sans réseau. Format PNG, 1 fichier par état.

| Fichier | État à capturer |
|---|---|
| `01-recherche-vide.png` | `/recherche` au chargement, visiteur anonyme, carte Rennes. |
| `02-resultats-anonyme.png` | Liste d'itinéraires + tracés carte, badge « Trajet le plus rapide », après une recherche Gares → République sans compte. |
| `03-detail-itineraire.png` | Détail segment par segment d'un itinéraire. |
| `04-gbfs-station.png` | Marqueur de station GBFS avec la disponibilité affichée. |
| `05-perturbation.png` | Un itinéraire marqué perturbé + le message spécifique (annulation / arrêt sauté / alerte opérateur). |
| `06-onboarding-profil.png` | `/profil` en mode onboarding, préférences cochées. |
| `07-historique.png` | `/historique` avec quelques trajets et le bouton « Relancer ». |
| `08-classement-avec-profil.png` | Même recherche que `02`, connecté avec profil, classement modifié, badge « Le plus adapté à vos critères ». |
| `09-suivi-actif.png` | Détail d'itinéraire avec « Suivre ce trajet » activé. |
| `10-notification-perturbation.png` | Notification système « Perturbation sur votre trajet » (capture d'écran OS). |
| `11-suppression-compte.png` | Modale de suppression de compte (double confirmation + champ mot de passe). |
| `12-clavier-focus.png` | Un élément interactif avec le contour de focus visible (navigation clavier). |
| `13-mobile-390.png` | La recherche rendue à 390 px de large. |
| `14-mode-degrade.png` | L'app hors-ligne servant un résultat depuis le cache. |

**Enregistrement vidéo de secours (recommandé) :** une capture d'écran de 2 à 3 minutes déroulant les étapes 1 → 5 sans commentaire, à lancer si la démo live échoue. À stocker aussi sur clé USB (le sujet demande « une alternative de secours : clé USB, accès à mon drive… »).

> Ces captures peuvent être générées en pilotant l'app avec Playwright sur la stack locale — demander si besoin d'un script.

---

## Si le jury coupe la démo pour poser une question

Points de reprise sûrs : après l'étape 1 (recherche faite), après l'étape 4 (classement personnalisé montré). Ne jamais rester bloqué sur une saisie : si l'autocomplétion rame, basculer sur la capture correspondante et continuer à l'oral.

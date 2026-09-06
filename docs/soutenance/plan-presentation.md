# Plan de présentation — soutenance Titre 6 (20 min)

> Issue [#41](https://github.com/KerdanetYvan/urbanflow-mobility/issues/41).
> Format officiel : **40 min = 20 min de présentation + 20 min d'échanges** (T6 CDSD, doc « Ma soutenance de titre »).
> Jury : 3 à 4 professionnels du digital, dont 1 représentant de l'école.
> À apporter : convocation, pièce d'identité, **1 exemplaire imprimé du dossier** (`docs/rendus/UrbanFlow_Mobility_Dossier.md` → PDF), ordinateur + chargeur + adaptateur, secours sur clé USB.

## Principe

La grille évalue des **critères précis** répartis sur 3 blocs. Le risque n'est pas de mal présenter, c'est de **laisser un critère non traité**. Ce plan associe chaque segment aux critères qu'il couvre, pour vérifier avant le jour J qu'aucun n'est oublié.

Ne pas lire le dossier. Le jury l'a déjà. La présentation raconte **le raisonnement** : pourquoi ces choix, ce qui a bougé, ce qu'on en retient.

## Minutage cible (20 min)

| # | Segment | Durée | Critères de la grille couverts |
|---|---|---|---|
| 1 | **Accroche + contexte client** | 1:30 | C1.1 (comprendre la demande, détacher les enjeux métiers) |
| 2 | **Du besoin exprimé au périmètre cadré** | 2:00 | C1.1 (hiérarchisation, dépasser les besoins immédiats, anticiper les évolutions) |
| 3 | **Les arbitrages techniques structurants** | 3:00 | C1.2 (état de l'art, recommandation argumentée, conséquences coût/délai/perf/pérennité) · C3.2 (framework, API, cloud) |
| 4 | **Architecture de la solution** | 2:30 | C1.3 (architecture logicielle, specs fonctionnelles, évolutivité comme clé des choix) |
| 5 | **Démo** (voir `scenario-demo.md`) | 7:30 | C3.1 (fonctionnalités livrées) · F1/F2/F3 + fonctionnalité au choix · C7/C1/C10 transverses montrés au fil |
| 6 | **Méthode itérative : le bilan** | 2:00 | C2.1 (outils/méthodo) · C2.2 (tests, points de friction, erreurs pré-prod, ajustements) |
| 7 | **Gestion des bogues : 1 cas concret** | 1:30 | C3.3 (identifier la source, corriger, valider) · C2.2 (amélioration continue) |
| 8 | **Post-mortem + feuille de route** | 1:00 | C1.1 (solution non figée) · C2.2 (bilan, ajustements pour la suite) |
| 9 | **Clôture** | 0:30 | — |

> Prévoir 1 min de marge (transitions, question courte pendant la démo). Si on déborde : raccourcir le segment 3 (les arbitrages sont dans le dossier) avant de toucher à la démo.

---

## Contenu segment par segment

### 1. Accroche + contexte client (1:30)

- Se présenter (nom, B3DEV, Titre 6). Une phrase.
- Le mail de Claire Hénette : une métropole de 500 000 habitants, congestion + pollution + **offre de mobilité fragmentée**. Une dizaine de fonctionnalités souhaitées.
- Le vrai besoin derrière la liste : réduire la congestion et la pollution, **reporter les trajets vers les mobilités douces**, donner à la collectivité de la visibilité sur les usages.
- Métropole de référence pour la réalisation : **Rennes Métropole** (données réelles GTFS/GBFS du réseau STAR, OpenStreetMap).

### 2. Du besoin exprimé au périmètre cadré (2:00)

- Montrer qu'on a **trié** la demande : cœur de métier (planifier) / leviers d'engagement (gamification, tableau de bord) / fiabilité du service (alertes).
- Périmètre livré : **F1 + F2 + F3** obligatoires, plus **une** fonctionnalité au choix (le sujet en impose au moins une) : l'**optimisation d'itinéraires par IA** — au sens d'une aide à la décision par pondération explicite, on y revient.
- Anticipation des évolutions : architecture pensée pour brancher un opérateur ou une ville de plus **sans réécriture** (chaque mode de transport = une source de données interchangeable). C'est un critère de la grille, pas un bonus.

### 3. Les arbitrages techniques structurants (3:00)

Prendre **3 arbitrages**, pas plus, et pour chacun : l'alternative écartée + la conséquence en coût / délai / performance / pérennité (c'est exactement ce que la grille demande à l'oral).

1. **Frontend/backend découplés** plutôt que full-stack intégré → sprints front/back en parallèle, scalabilité indépendante, **API réutilisable** par un futur client mobile ou des partenaires.
2. **OpenTripPlanner** plutôt qu'une API de routage commerciale → pas de coût récurrent à l'usage, pas de dépendance bloquante à un fournisseur, déploiement initial plus lourd assumé. Utilisé en production ailleurs (Rennes, Grenoble, Norvège, Finlande).
3. **PostgreSQL + PostGIS** plutôt que MySQL/MongoDB → requêtes géospatiales natives, open source (pas de licence), pas d'enfermement chez un hébergeur.
4. *(en réserve, si le temps le permet)* **PWA** plutôt que natif double plateforme ; **hébergement européen (OVHcloud)** plutôt que cloud américain → RGPD + éco-conception.

### 4. Architecture de la solution (2:30)

- Le schéma en couches ([dossier §4.1](../rendus/UrbanFlow_Mobility_Dossier.md)) : PWA → Caddy (reverse proxy) → API NestJS → PostgreSQL/PostGIS, avec OpenTripPlanner, le géocodeur, l'API météo et les flux opérateurs en services externes.
- Le flux de la fonctionnalité au choix : `OTP → service de scoring (+ météo + GTFS-Realtime + profil) → itinéraires classés → PWA`.
- Insister sur **où est placée la complexité** : le scoring, les caches temps réel, les notifications sont des **modules ajoutés au fil des itérations** sans toucher à la structure. C'est le fil rouge de la présentation.
- Renvoyer aux 3 diagrammes UML du dossier (§8) pour le détail.

### 5. Démo (7:30)

Dérouler `scenario-demo.md`. Ordre : recherche anonyme → données opérateurs sur la carte → création compte + profil → **même recherche, classement différent** → suivi + alerte perturbation. Glisser les transverses (clavier, mobile, mode dégradé, suppression de compte) au fil, pas en bloc.

Phrase d'ancrage à répéter : *« même moteur de routage, même trajet, classement différent selon la personne et le contexte »*.

### 6. Méthode itérative : le bilan (2:00)

- **5 sprints de 2 semaines**, chacun clos par une revue fonctionnelle et une rétrospective (`docs/sprints/`).
- Outils : Git/GitHub, GitHub Projects (Kanban), GitHub Actions (CI/CD), Jest/Vitest, Playwright + axe-core, Postman.
- **Le fait marquant** (la grille demande les points de friction et les erreurs de pré-production) : en Sprint 2, **la CI verte ne garantissait pas que la prod fonctionnait** — un incident de production a été découvert *pendant* la revue de sprint, pas avant. Conséquence méthodo : à partir de là, revue fonctionnelle systématique sur une stack proche de la prod, avec de vraies données, avant chaque clôture.
- Chiffres : 127 tickets fermés, 151 *pull requests* revues, ~272 + ~345 tests automatisés, audit OWASP en 2 passes, audit WCAG automatisé en CI ([dossier §6.4](../rendus/UrbanFlow_Mobility_Dossier.md)).

### 7. Gestion des bogues : 1 cas concret (1:30)

Prendre **l'historique vide en production** ([dossier §9.4](../rendus/UrbanFlow_Mobility_Dossier.md)) :

- **Symptôme** : historique vide alors que des recherches avaient été faites.
- **Source réelle** (pas le symptôme) : une variable d'environnement (la clé de chiffrement au repos) absente du fichier de configuration du serveur, maintenu à la main. Chaque écriture chiffrée échouait en silence.
- **Correction** : ajout de la variable.
- **Validation + mesure de fond** : validation au démarrage qui fait échouer le lancement si un secret critique manque, et une vérification de CI qui compare les variables du serveur à celles attendues.
- Le point à faire passer : *le correctif ponctuel ne suffit pas, chaque bogue se conclut par une mesure qui empêche la classe de problème de revenir silencieusement.*

### 8. Post-mortem + feuille de route (1:00)

- **Ce qui a bien fonctionné** : le découpage modulaire a tenu (aucune fonctionnalité ajoutée n'a demandé de revenir sur l'architecture) ; les revues manuelles en conditions réelles ont trouvé ce qu'aucun test automatisé ne voyait.
- **Ce qui serait fait autrement** : traiter la configuration de production comme du code dès le premier déploiement ; figer la portée plus explicitement dans le dossier (conçu / en cours / livré / hors périmètre) ; mettre l'audit d'accessibilité automatisé en place dès le premier écran.
- **Feuille de route post-MVP** ([dossier §11.1](../rendus/UrbanFlow_Mobility_Dossier.md)) : vélo/trottinette libre-service dans le calcul d'itinéraire, réservation unifiée, calculateur d'empreinte carbone, scoring prédictif une fois assez de données. Toutes se branchent sur l'existant.

### 9. Clôture (0:30)

- Une phrase : concevoir, ce n'est pas seulement faire fonctionner, c'est **décider où placer la complexité pour qu'elle serve l'usager**.
- Remercier, ouvrir les échanges.

---

## Les deux revues séparées (hors présentation)

Le jour de la soutenance comporte aussi, en face-à-face avec un évaluateur :

- **Revue de code** (C3.1) : préparer 2 ou 3 fichiers représentatifs à commenter — un service backend bien documenté (ex. `scoring.service.ts` ou `auth.service.ts`), un composant React, une migration. Savoir expliquer les conventions de nommage (§4.3), le choix de commenter abondamment (projet pédagogique), la gestion des erreurs.
- **Revue de test / bogues** (C3.3) : préparer un **échantillon de bogues traités** avec pour chacun : comment la source a été identifiée, le correctif, le test de non-régression ajouté. Les 3 cas du §9.4 + 2 ou 3 tirés des rétrospectives de sprint suffisent.

## Checklist avant d'entrer

- [ ] Dossier imprimé (page de garde : NOM, Prénom, B3DEV, Concepteur Développeur de Solutions Digitales).
- [ ] App de démo accessible (prod testée le matin même) + stack locale prête en repli.
- [ ] Captures de secours + vidéo sur le disque **et** sur clé USB.
- [ ] Notifications autorisées pour le site de démo.
- [ ] Onglets ouverts : app, dépôt GitHub (CI + code), dossier PDF.
- [ ] `questions-jury.md` relu.
- [ ] Minuté au moins une fois en conditions réelles (viser 18–19 min pour garder de la marge).

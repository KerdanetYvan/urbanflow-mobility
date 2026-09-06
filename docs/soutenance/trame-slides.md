# Trame de slides — à mettre en forme dans Canva

> Issue [#41](https://github.com/KerdanetYvan/urbanflow-mobility/issues/41). 20 min de présentation (voir minutage dans `plan-presentation.md`).
> **18 slides + 1 slide de repli.** Règle : peu de texte à l'écran (3 à 5 puces courtes, grandes), le détail est dans « Ce que je dis ». Le jury a déjà le dossier, ne pas le recopier.
> Gabarit conseillé : fond clair, une couleur d'accent, police sans-serif ≥ 24 pt pour le corps. Numéro de slide en pied.

---

## Slide 1 — Page de titre

**À l'écran**
- UrbanFlow Mobility
- Plateforme de mobilité urbaine intelligente
- Kerdanet Yvan — B3DEV — Concepteur Développeur de Solutions Digitales (RNCP 36146)
- Session septembre 2026

**Ce que je dis** (15 s)
> Bonjour, je suis Yvan Kerdanet, en B3DEV. Je vais vous présenter UrbanFlow Mobility, une plateforme de mobilité urbaine développée dans le cadre du Titre 6.

**Visuel** : capture de l'app (écran de recherche avec la carte) en fond, atténuée.

---

## Slide 2 — La demande

**À l'écran**
- Une métropole de 500 000 habitants, en transition écologique
- Congestion · pollution · **offre de mobilité fragmentée**
- Un mail, une dizaine de fonctionnalités souhaitées

**Ce que je dis** (45 s)
> Le point de départ est un mail d'une métropole : chaque mode de transport — bus, tram, vélos et trottinettes en libre-service, covoiturage — fonctionne avec son propre outil, sans vision d'ensemble pour l'usager. La demande liste une dizaine de fonctionnalités. Pour la réalisation, je me suis appuyé sur les données réelles de Rennes Métropole.

**Visuel** : icônes des modes de transport éclatées / non connectées.

---

## Slide 3 — Le vrai besoin derrière la liste

**À l'écran**
- Cœur de métier : planifier un trajet multimodal
- Leviers d'engagement : gamification, tableau de bord
- Fiabilité du service : alertes, signalement
- → objectif client : **reporter les trajets vers les mobilités douces**

**Ce que je dis** (45 s)
> Le travail de cadrage a consisté à trier cette liste. Derrière les fonctionnalités, le besoin réel du commanditaire est de réduire la congestion et la pollution en faisant basculer les trajets vers le vélo, les transports en commun, la marche, et de donner à la collectivité de la visibilité sur les usages.

**Visuel** : les 3 catégories en colonnes.

---

## Slide 4 — Le périmètre livré

**À l'écran**
- **F1** Comptes et profils de mobilité
- **F2** Planificateur multimodal + géolocalisation + carte
- **F3** Intégration GTFS et GBFS des opérateurs
- **+ 1 au choix** : optimisation d'itinéraires par IA

**Ce que je dis** (45 s)
> Le sujet impose trois fonctionnalités et au moins une fonctionnalité au choix. J'ai livré F1, F2, F3, et comme fonctionnalité au choix l'optimisation d'itinéraires par IA — au sens d'une aide à la décision, j'y reviens dans un instant.

**Visuel** : 3 + 1 blocs.

---

## Slide 5 — Concevoir une solution qui ne soit pas figée

**À l'écran**
- Nouvel opérateur ou nouvelle ville → un flux GTFS/GBFS de plus, **zéro code applicatif**
- Chaque mode de transport = une source de données interchangeable
- Développement itératif : intégrer sans remettre en cause l'existant

**Ce que je dis** (30 s)
> Un risque identifié dès le cadrage : produire une solution figée sur le périmètre initial. Deux décisions structurantes répondent à ça — une architecture où chaque mode de transport est une source de données interchangeable, et une méthode itérative. C'est un critère de la grille, pas un bonus.

**Visuel** : un bloc « socle » avec des connecteurs qui s'ajoutent.

---

## Slide 6 — Arbitrage 1 : frontend et backend découplés

**À l'écran**
- Choisi : PWA React + API REST NestJS, strictement séparées
- Écarté : framework full-stack intégré
- Conséquence : sprints parallèles · scalabilité indépendante · **API réutilisable** (mobile, partenaires)

**Ce que je dis** (40 s)
> Premier arbitrage. Plutôt qu'un framework full-stack, une PWA et une API séparées. Ça ne double pas le travail — même langage des deux côtés. Le gain : les deux couches se déploient et se testent indépendamment, et l'API est réutilisable telle quelle par un futur client mobile ou des partenaires.

---

## Slide 7 — Arbitrage 2 : OpenTripPlanner

**À l'écran**
- Choisi : OpenTripPlanner (open source)
- Écarté : API de routage commerciale
- Conséquence : pas de coût récurrent · pas de dépendance bloquante · déploiement initial plus lourd assumé
- En production ailleurs : Rennes, Grenoble, Norvège, Finlande

**Ce que je dis** (40 s)
> Pour le calcul d'itinéraires, OpenTripPlanner plutôt qu'une API commerciale. Le déploiement initial est plus lourd — un graphe à construire, des données à charger — mais pas de coût à l'usage, pas d'enfermement chez un fournisseur, et c'est éprouvé en production à l'échelle d'un pays.

---

## Slide 8 — Arbitrage 3 : PostgreSQL + PostGIS

**À l'écran**
- Choisi : PostgreSQL + extension PostGIS
- Écarté : MySQL, MongoDB, Firebase
- Conséquence : requêtes géospatiales natives · open source · pas d'enfermement hébergeur

**Ce que je dis** (30 s)
> Pour les données, PostgreSQL avec l'extension PostGIS : les requêtes géospatiales — proximité, emprises — sont natives et performantes, c'est open source, et ça ne lie pas le projet à un hébergeur unique.

**Visuel** : facultatif, tableau des 3 arbitrages regroupés si vous préférez condenser 6-7-8 en 2 slides.

---

## Slide 9 — Architecture en couches

**À l'écran**
- Schéma : PWA → Caddy → API NestJS → PostgreSQL/PostGIS
- Services externes : OpenTripPlanner · géocodeur · API météo · flux opérateurs
- Modules ajoutés au fil des itérations : scoring, caches temps réel, notifications

**Ce que je dis** (50 s)
> Voici l'architecture. Une PWA, un reverse proxy, l'API, la base. Le moteur de routage, le géocodeur, la météo et les flux opérateurs sont des services externes. Le point important : le service de scoring, les caches temps réel, les notifications ont été ajoutés au fil des sprints **sans toucher à cette structure**. C'est le fil rouge de ma présentation — décider où placer la complexité.

**Visuel** : le schéma mermaid du dossier §4.1, exporté en image ou refait dans Canva.

---

## Slide 10 — La fonctionnalité au choix : comment ça marche

**À l'écran**
- `OTP → scoring (+ météo + GTFS-Realtime + profil) → itinéraires classés → PWA`
- Score = **somme pondérée** de critères à poids explicites
- durée · correspondances · météo · perturbations · préférences du profil
- Pas un modèle de ML : justifiable, débogable, ajustable

**Ce que je dis** (50 s)
> OpenTripPlanner calcule les itinéraires possibles. Mon service de scoring les **classe** : il calcule un coût par somme pondérée, chaque critère a un poids explicite dans un fichier de configuration. J'ai choisi ça plutôt qu'un modèle d'apprentissage, volontairement : le résultat est justifiable au tableau, débogable, ajustable, et il ne dépend pas d'un historique d'usage qui n'existe pas encore. Le terme « IA » est celui du sujet, au sens d'aide à la décision automatisée.

**Visuel** : le schéma mermaid du dossier §7.3.

---

## Slide 11 — Démonstration

**À l'écran**
- « Démonstration »
- Recherche sans compte → données opérateurs → compte + profil → **même trajet, classement différent** → alerte de perturbation

**Ce que je dis** (15 s, puis bascule sur l'app)
> Je passe à la démonstration. Vous allez voir le parcours complet : une recherche sans compte, les données opérateurs sur la carte, la création d'un profil, l'effet du profil sur le classement, et l'alerte de perturbation en cours de trajet.

> **Dérouler `scenario-demo.md` (~7:30). Revenir aux slides après.**

---

## Slide 12 — Méthode : 5 sprints de 2 semaines

**À l'écran**
- 5 sprints, chacun clos par une revue fonctionnelle + une rétrospective
- Git/GitHub · GitHub Projects (Kanban) · GitHub Actions (CI/CD)
- Jest / Vitest · Playwright + axe-core · Postman

**Ce que je dis** (40 s)
> Le projet a été mené en 5 sprints de deux semaines, chacun clos par une revue fonctionnelle et une rétrospective, documentées dans le dépôt. Outils standards : Git, un Kanban, une chaîne d'intégration et de déploiement continus, des tests automatisés des deux côtés, un audit d'accessibilité rejoué à chaque push.

---

## Slide 13 — Le fait marquant : CI verte ≠ production qui fonctionne

**À l'écran**
- Sprint 2 : la CI était verte, la production était cassée
- Incident découvert **pendant** la revue de sprint, pas avant
- Ajustement méthodo : revue fonctionnelle systématique sur stack proche de la prod, vraies données, **avant** chaque clôture

**Ce que je dis** (50 s)
> Le fait le plus instructif : en Sprint 2, la chaîne d'intégration était au vert mais un incident de production a été découvert en faisant la revue de sprint, pas avant. Les tests automatisés valident le code, pas l'état réel du serveur déployé. À partir de là, revue fonctionnelle systématique sur une pile proche de la production avec de vraies données avant chaque clôture. Plusieurs défauts trouvés comme ça n'auraient jamais été vus autrement.

---

## Slide 14 — Bilan qualité, en chiffres

**À l'écran**
- 127 tickets fermés · 151 pull requests revues
- ~272 tests backend · ~345 tests frontend · audits e2e
- Audit OWASP en 2 passes · audit WCAG 2.1 AA automatisé en CI

**Ce que je dis** (30 s)
> En chiffres : 127 tickets fermés, 151 pull requests toutes passées en revue avant fusion, plus de 600 tests automatisés, un audit OWASP en deux passes, un audit d'accessibilité automatisé. La vérification a été continue, pas concentrée en fin de projet.

**Visuel** : gros chiffres, une couleur d'accent.

---

## Slide 15 — Gestion des bogues : un cas concret

**À l'écran**
- Symptôme : historique de trajets vide en production
- Source réelle : une variable d'environnement absente du serveur (fichier maintenu à la main)
- Correctif + **mesure de fond** : validation au démarrage + vérification de CI de la config serveur

**Ce que je dis** (50 s)
> Un exemple. L'historique s'affichait vide en production. Le symptôme n'était pas la cause : une variable d'environnement, la clé de chiffrement, n'avait pas été reportée sur le serveur, dont le fichier de config est maintenu à la main. Chaque écriture chiffrée échouait en silence. Correctif immédiat : ajouter la variable. Mais surtout, mesure de fond : une validation au démarrage qui fait échouer le lancement si un secret critique manque, et une vérification de CI qui compare la config du serveur à celle attendue. Chaque bogue se conclut par une mesure qui empêche la classe de problème de revenir.

---

## Slide 16 — Post-mortem

**À l'écran**
- A bien marché : le découpage modulaire a tenu · les revues manuelles réelles ont trouvé ce qu'aucun test ne voyait
- À refaire autrement : config de prod **comme du code** dès le jour 1 · figer la portée explicitement · audit d'accessibilité dès le premier écran

**Ce que je dis** (40 s)
> Ce que je retiens. Ce qui a bien marché : l'architecture modulaire a tenu, aucune fonctionnalité ajoutée n'a demandé d'y revenir ; et les revues manuelles en conditions réelles ont été le meilleur détecteur de défauts. Ce que je ferais autrement : traiter la configuration de production comme du code dès le premier déploiement, figer la portée plus explicitement dans le dossier, et mettre l'audit d'accessibilité automatisé en place dès le premier écran plutôt qu'à mi-parcours.

---

## Slide 17 — Feuille de route post-MVP

**À l'écran**
- Vélo/trottinette libre-service dans le calcul d'itinéraire
- Réservation unifiée
- Calculateur d'empreinte carbone
- Scoring prédictif (quand assez de données d'usage)
- → toutes se branchent sur l'existant

**Ce que je dis** (30 s)
> Les évolutions suivantes se branchent sur l'architecture actuelle : intégrer le libre-service au calcul d'itinéraire, la réservation unifiée, un calculateur d'empreinte carbone, et à terme un scoring prédictif une fois assez de données d'usage accumulées.

---

## Slide 18 — Clôture

**À l'écran**
- « Concevoir, ce n'est pas seulement faire fonctionner : c'est décider où placer la complexité pour qu'elle serve l'usager. »
- Merci — vos questions

**Ce que je dis** (20 s)
> Pour conclure : concevoir une solution, ce n'est pas seulement la faire fonctionner, c'est décider où placer la complexité pour qu'elle serve l'usager plutôt qu'elle ne lui soit imposée. Merci, je suis prêt pour vos questions.

---

## Slide de repli (à garder cachée, à afficher si la démo live échoue)

**À l'écran** : les captures de secours en mosaïque (voir `captures/`), dans l'ordre du scénario.

**Ce que je dis** : dérouler le commentaire de `scenario-demo.md` sur les captures.

---

## Notes de mise en forme Canva

- Slides 6-7-8 (les arbitrages) : si le rythme est trop lent, les condenser en **un seul tableau** sur 1 slide (colonnes : arbitrage / écarté / conséquence).
- Les deux schémas mermaid (§4.1 architecture, §7.3 scoring) : les exporter en PNG depuis un rendu Markdown, ou les redessiner simplement dans Canva. Ce sont les deux seuls visuels vraiment nécessaires.
- Prévoir la slide 11 (Démonstration) avec un minuteur mental : au-delà de 8 min de démo, conclure et revenir aux slides.
- Total visé : 18-19 min pour garder de la marge sur les 20.

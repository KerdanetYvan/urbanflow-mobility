# Questions probables du jury — préparation

> Issue [#41](https://github.com/KerdanetYvan/urbanflow-mobility/issues/41). 20 min d'échanges après la présentation.
> La grille valorise explicitement « une ouverture d'esprit constructive à la critique et à l'amélioration continue » et « l'emploi correct des terminologies métiers ». Ne pas se braquer sur une critique : reconnaître, expliquer le raisonnement, dire ce qu'on ferait autrement.

---

## Sur la fonctionnalité au choix (« IA »)

**« Vous parlez d'IA, mais c'est une somme pondérée. Où est l'IA ? »**
Le terme est celui du sujet (« Une IA d'optimisation d'itinéraires basée sur les conditions en temps réel »). Ce que j'ai livré est une **aide à la décision multicritère** : une fonction de coût par somme pondérée, chaque critère avec un poids explicite dans un fichier de configuration. C'est de l'IA au sens large d'aide à la décision automatisée, pas au sens d'un modèle d'apprentissage. J'ai fait ce choix délibérément pour un projet individuel : le résultat est justifiable, débogable, ajustable sans ré-entraînement, et il ne dépend pas d'un volume de données d'usage qui n'existe pas encore. La trajectoire vers un modèle prédictif est dans la feuille de route (§7.4, §11.1).

**« Comment sont calibrés les poids ? »**
Manuellement, à l'échelle d'un critère de référence : le coût par minute de trajet. Les autres critères sont calés là-dessus (par exemple, une perturbation détectée coûte l'équivalent d'un allongement de 15 minutes). Tout est dans `scoring-weights.const.ts`, un point d'entrée unique. Les préférences du profil (modes préférés, limiter les correspondances / la marche) modulent ces poids par utilisateur.

**« Et si deux critères se contredisent ? »**
Ils sont sommés, donc le classement tranche naturellement : un itinéraire rapide mais perturbé peut passer derrière un itinéraire un peu plus long mais fiable, sans jamais être exclu. Aucun filtre dur : un écran vide est pire qu'un résultat imparfait.

---

## Sur l'architecture

**« Pourquoi ne pas avoir pris une API de routage clé en main (Google, Mapbox) ? »**
Coût récurrent à l'usage, dépendance bloquante à un fournisseur, et pour une collectivité un enjeu de souveraineté. OpenTripPlanner est open source, tourne en production ailleurs à l'échelle d'un pays (Norvège, Finlande), et se pilote entièrement. Le coût, c'est un déploiement initial plus lourd (graphe à construire, données à charger), que j'ai assumé.

**« Le découplage front/back, ça double le travail, non ? »**
Pas dans les faits : même langage des deux côtés (TypeScript), un seul écosystème d'outils. Le gain est réel : l'API est réutilisable telle quelle par un futur client mobile ou des partenaires, et les deux couches se déploient et se testent indépendamment.

**« OpenTripPlanner et votre service de scoring, ça fait deux fois du calcul d'itinéraire ? »**
Non. OTP fait le **calcul de chemin** dans le graphe (algorithmes de plus court chemin, RAPTOR pour le transport en commun) et renvoie des itinéraires candidats complets. Mon service ne recalcule rien : il **classe** ces candidats déjà calculés. C'est du post-traitement, pas du routage.

**« Comment un nouvel opérateur s'intègre ? »**
Il publie un flux GTFS ou GBFS conforme, on l'ajoute à la configuration. Aucun code applicatif à modifier — c'est le sens du choix « chaque mode de transport = une source de données interchangeable ».

---

## Sur la méthode et le post-mortem

**« Vous êtes seul : comment un découpage en rôles (PO, dev, QA) a du sens ? »**
Les rôles ne sont pas des personnes mais des **casquettes** : à chaque décision, savoir sous quel angle je la prends. Une décision de périmètre (retirer le covoiturage du profil) est une décision PO ; le choix d'un pattern de test est une décision QA. Ça structure le raisonnement et ça rend la présentation lisible pour un commanditaire.

**« Votre post-mortem dit que la config de prod aurait dû être traitée comme du code dès le début. Pourquoi ne pas l'avoir fait ? »**
Je l'ai appris à la dure : deux fonctionnalités cassées en silence en production parce qu'une variable d'environnement n'avait pas été reportée sur le serveur. Sur le moment, le `.env` hors dépôt semblait suffisant pour ne pas versionner de secrets. La leçon : un fichier d'exemple versionné et une vérification d'écart en CI, ce que j'ai mis en place ensuite. C'est exactement le genre d'ajustement que la démarche itérative est censée produire.

**« La CI était verte mais la prod était cassée. C'est un échec de vos tests ? »**
C'est une limite que j'ai identifiée en Sprint 2 et corrigée dans la méthode : les tests automatisés valident le code, pas l'état réel du serveur déployé. À partir de là, revue fonctionnelle systématique sur une stack proche de la prod avec de vraies données avant chaque clôture de sprint. Plusieurs défauts trouvés comme ça n'auraient jamais été vus autrement.

**« Vous avez utilisé un assistant IA pour coder. Qu'est-ce qui est de vous ? »**
L'assistant accélère l'écriture, comme un autocomplete avancé. Chaque ligne est relue, comprise et validée avant intégration ; la responsabilité du code, sa correction et sa justification sont entièrement les miennes, y compris en revue de code face à face. Les décisions d'architecture, de périmètre et de méthode sont les miennes.

---

## Sur la sécurité et le RGPD

**« Comment protégez-vous les données de géolocalisation ? »**
Plusieurs couches : HTTPS de bout en bout, chiffrement applicatif au repos (AES-256-GCM, clé dédiée hors base, IV aléatoire à chaque écriture) sur l'historique, les adresses domicile/travail et le trajet suivi, rétention bornée, droit à l'effacement accessible depuis le profil, hébergement en France. Cartographie complète des risques en Annexe E du dossier.

**« Vous avez fait un audit OWASP. Qu'est-ce qu'il a révélé ? »**
Deux passes. Correctifs apportés : rate limiting sur les routes d'authentification, en-têtes de sécurité HTTP, restriction explicite de l'algorithme de signature des jetons. Une limite d'abord documentée puis levée : la **rotation stricte du refresh token** (avec détection de rejeu et révocation de session), implémentée dans une itération dédiée.

**« Le cache hors-ligne de la PWA contient des trajets. Et si le téléphone est volé ? »**
Le cache local a une durée de vie bornée et un contenu minimal : les derniers trajets utiles au mode dégradé, pas l'historique complet. C'est un arbitrage entre utilité en mobilité et exposition.

---

## Simulation : scénario de mise en danger de la solution (C2.3)

Le jury proposera un scénario menaçant la survie du projet. Méthode à appliquer à voix haute : **identifier la ou les sources réelles → mesurer l'impact sur l'avenir → actions court terme → actions moyen terme → préserver les gains passés.**

Exemples de scénarios plausibles et pistes de réponse :

**« L'opérateur de transport arrête de publier son flux GTFS-Realtime. »**
- Source : dépendance à une donnée tierce non contractualisée.
- Impact : perte de l'ajustement temps réel et de la pénalité de perturbation ; le calcul d'itinéraire de base (GTFS statique) continue de fonctionner.
- Court terme : mode dégradé explicite (bandeau « info temps réel indisponible »), le classement retombe sur les critères restants.
- Moyen terme : contractualiser l'accès aux flux avec la métropole, prévoir une source de secours (agrégateurs nationaux type transport.data.gouv.fr), surveiller la fraîcheur du flux avec alerte.
- Gains préservés : toute l'architecture pluggable reste valable, seule la configuration d'une source change.

**« OpenTripPlanner ne tient plus la charge quand l'usage décolle. »**
- Source : un seul nœud de routage.
- Impact : latence puis erreurs sur la recherche, cœur de valeur touché.
- Court terme : cache des itinéraires récents (déjà en place), file d'attente, limitation de débit.
- Moyen terme : plusieurs instances OTP derrière un répartiteur (l'API est déjà découplée et sans état côté routage), dimensionnement selon les pics observés — les déploiements OTP en Norvège tiennent 20 req/s, on a de la marge.
- Gains préservés : le découplage front/back et l'API sans état rendent la montée en charge horizontale possible sans réécriture.

**« Le RGPD se durcit et interdit de conserver l'historique de trajets. »**
- Source : évolution réglementaire.
- Impact : perte de l'historique et des raccourcis, pas du cœur fonctionnel.
- Court terme : passer la rétention à zéro (paramètre déjà existant), purge des données.
- Moyen terme : recueil de consentement explicite par fonctionnalité, historique optionnel et local uniquement.
- Gains préservés : le chiffrement au repos, la purge automatique et le droit à l'effacement sont déjà là ; c'est un resserrement de paramètres, pas une refonte.

---

## Questions terminologie (pièges rapides)

| Question | Réponse courte et juste |
|---|---|
| GTFS vs GBFS ? | GTFS = offre de transport en commun (lignes, arrêts, horaires). GBFS = mobilités en libre-service (vélos/trottinettes, disponibilité en station). |
| GTFS-Realtime ? | Extension temps réel de GTFS : perturbations, retards, positions. |
| RAPTOR ? | Algorithme de calcul d'itinéraires transport en commun par tours successifs, optimisé pour les correspondances. Utilisé par OpenTripPlanner. |
| PWA vs application native ? | PWA = application web installable avec service worker (hors-ligne partiel), une seule base de code, pas de store. |
| JWT ? | Jeton d'authentification signé et auto-porteur, vérifiable sans consulter la base. |
| Pourquoi PostGIS et pas juste PostgreSQL ? | Extension géospatiale : types géométriques, index et requêtes spatiales natives (proximité, emprises). |
| Somme pondérée / weighted sum model ? | Méthode d'aide à la décision : score global = combinaison linéaire de critères à poids explicites. |

## Si on ne sait pas

Le dire clairement, proposer où trouver la réponse (le dossier, le code), et ne pas inventer. « Je n'ai pas la valeur exacte en tête, c'est dans le fichier de configuration du scoring, je peux l'ouvrir. » vaut mieux qu'une approximation fausse.

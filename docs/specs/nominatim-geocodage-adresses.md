# Spécifications détaillées — Géocodage d'adresses réel via Nominatim auto-hébergé

> Casquette PO — issue [#167](https://github.com/KerdanetYvan/urbanflow-mobility/issues/167), Sprint 4 (Phase D).
> Sert de base à l'implémentation Dev BE de l'issue [#168](https://github.com/KerdanetYvan/urbanflow-mobility/issues/168).

## 1. Périmètre et contexte

### 1.1 Constat

L'autocomplétion origine/destination (`GET /places`, issue [#81](https://github.com/KerdanetYvan/urbanflow-mobility/issues/81)) délègue aujourd'hui **uniquement** au géocodeur intégré à OpenTripPlanner (`SandboxAPIGeocoder`, activé par `routing-engine/otp-config.json`). Ce géocodeur n'indexe que les **arrêts de transport** chargés dans le graphe (`stops.txt` du flux GTFS) :

- Constat de la revue fonctionnelle de fin de Sprint 3 (2026-08-25), reconfirmé en session le 2026-08-31 après bascule du dev local sur les vraies données STAR : une requête `République` renvoie **5+ entrées quasi identiques** — `République (1615)`, `République (1242)`, `République (1214)`… — une par poteau d'arrêt physique, chacune suffixée d'un **code arrêt entre parenthèses** sans signification pour l'usager.
- **Aucune adresse postale réelle** (numéro + type de voie + nom) n'est disponible : impossible de saisir « 12 rue de Nemours » comme origine.
- Le géocodeur OTP fait aussi du matching approximatif peu prévisible sur les fragments courts et supporte mal les accents (`Répu` → aucun résultat, `Republique` → OK).

### 1.2 Décision

Décision utilisateur en session (2026-08-25) : **investir dans un Nominatim auto-hébergé** plutôt qu'un simple nettoyage d'affichage. Nominatim est le géocodeur de référence sur données OpenStreetMap : il fournit de vraies adresses (numéro, voie, commune) et gère nativement le classement par pertinence, les accents et les fragments partiels.

### 1.3 Position RGPD (à documenter explicitement, demande de l'issue)

Une décision antérieure ([#93](https://github.com/KerdanetYvan/urbanflow-mobility/issues/93), `docs/sprints/sprint-3-plan.md` Phase D) avait **écarté le reverse geocoding via un service tiers** : transmettre la position GPS précise de l'utilisateur à un géocodeur externe créait une tension RGPD (donnée de localisation sensible envoyée hors de l'infrastructure du projet).

**Un Nominatim auto-hébergé lève cette réserve** : la requête de géocodage (texte tapé *ou*, à terme, coordonnées GPS) ne quitte jamais l'infrastructure propre du projet — aucun appel réseau vers un tiers, aucune donnée de localisation partagée. C'est le même raisonnement que le choix d'Open-Meteo (auto-hébergeable, hébergement UE) pour la météo du scoring, et cohérent avec la contrainte transverse « RGPD » de `CLAUDE.md`.

## 2. Articulation avec le géocodeur OTP existant

**Décision : coexistence des deux sources.** Nominatim ne remplace pas OTP.

| Source | Ce qu'elle sait faire | Ce qu'elle ne sait pas faire |
| --- | --- | --- |
| Géocodeur OTP (`/geocode`) | Les **arrêts de transport** réellement chargés dans le graphe, avec leurs coordonnées exactes (celles dont OTP a besoin pour le routage) | Les adresses postales |
| Nominatim | Les **adresses postales** et lieux OSM (rues, POI, communes) | Les arrêts GTFS (pas dans OSM sous une forme exploitable pour ça) |

Les deux répondent à un besoin réel de l'usager d'un planificateur d'itinéraire : partir/arriver **d'un arrêt** (« République ») ou **d'une adresse** (« 12 rue de Nemours »).

### 2.1 Comportement de `GET /places`

`PlacesService.search(query)` interroge **les deux sources en parallèle** et **fusionne** les résultats en une seule liste `PlaceSuggestion[]` :

1. Appel OTP `/geocode` (existant) + appel Nominatim (nouveau), en parallèle (`Promise.allSettled` — voir §5 pour la dégradation si l'une échoue).
2. **Arrêts en premier**, puis adresses. Justification : sur un planificateur d'itinéraire, un texte court tapé (« Rép », « Gare ») vise le plus souvent un arrêt ; les adresses complètent quand aucun arrêt ne correspond ou quand l'usager tape manifestement une adresse (chiffre + voie).
3. **Plafonds** : au plus **5 arrêts** + **5 adresses** (10 entrées max dans le dropdown — cohérent avec la hauteur du dropdown `AddressField`, `docs/specs/fusion-autocomplete-raccourcis.md` §3.1).
4. **Déduplication des arrêts** (voir §4.1) : les N poteaux `République (…)` deviennent **une seule** entrée `République`.

Pas de tri par score de pertinence inter-sources (arrêt vs adresse ne sont pas comparables) : l'ordre est simplement « arrêts (dédupliqués, ordre OTP) puis adresses (ordre de pertinence Nominatim) ».

### 2.2 Découpage code

- Nouveau client `NominatimClientService` (dans un module dédié, ex. `backend/src/geocoding/` ou `backend/src/places/nominatim/`), symétrique de `OtpClientService#geocode` : construit la requête HTTP vers le Nominatim interne, traduit la réponse en une forme neutre, traduit les erreurs (Nominatim injoignable → à traiter comme « pas de résultat adresse », pas comme un 503 global — voir §5).
- `PlacesService` orchestre l'appel aux deux clients et la fusion. `PlacesModule` importe le nouveau module en plus de `OtpModule`.
- Aucun changement de contrat côté `GET /places` **hormis** l'ajout du champ `kind` sur `PlaceSuggestion` (§4.3).

## 3. Le service Nominatim

### 3.1 Image et déploiement

- Service Docker **`nominatim`** ajouté à `docker-compose.yml` (dev) **et** `docker-compose.prod.yml`, image communautaire de référence (`mediagis/nominatim`, version majeure figée — à confirmer par #168 au moment de l'implémentation).
- Nominatim embarque sa **propre base PostgreSQL** (avec PostGIS + l'extension de recherche) — service **indépendant** du `postgres` applicatif du projet, dans un **volume Docker dédié** (`nominatim_data`), jamais mélangé aux données métier.
- Exposé **uniquement sur le réseau Docker interne** (comme `otp`) : le backend l'appelle via `NOMINATIM_URL` (ex. `http://nominatim:8080`), jamais exposé publiquement. Nouvelle variable dans `.env.example`.

### 3.2 Données à importer

- **Extrait OSM** couvrant Rennes Métropole. Le **département d'Ille-et-Vilaine** (`ille_et_vilaine.osm.pbf`, ~105 Mo via `download.openstreetmap.fr`, voir `routing-engine/README.md`) est le bon périmètre : il couvre entièrement la métropole avec une marge raisonnable, et reste léger pour un import Nominatim.
- **Ne pas réutiliser** l'extrait bbox `routing-engine/data/osm-metropole.osm.pbf` (38 Mo) préparé pour OTP : le découpage bbox coupe des relations/adresses au bord, Nominatim préfère un extrait administratif propre. Chaque moteur a son extrait.
- **Import** : étape de **bootstrap manuelle**, une seule fois par environnement (exactement comme la préparation de l'extrait OSM d'OTP et l'import GTFS `#12`). `data/` de Nominatim n'est pas versionné. À documenter dans `routing-engine/README.md` (ou un `README` dédié) : commande d'import, durée observée, empreinte disque finale.
- **Rafraîchissement** : ré-import ponctuel si le plan d'adressage de la métropole évolue significativement. Pas de mise à jour incrémentale automatique (replication OSM) dans un premier temps — hors périmètre.

### 3.3 Ressources — le point de vigilance

Nominatim est **réputé gourmand** :

- **Import** : pic mémoire de l'ordre de **2 à 4 Go** et **plusieurs dizaines de minutes** pour un extrait départemental (à mesurer et consigner par #168). L'import ne doit **pas** tourner en même temps qu'un build de graphe OTP sur une machine contrainte.
- **Service au repos** : empreinte plus modeste (~0,5 à 1 Go RAM), mais la **base importée occupe ~5 à 15 Go de disque** (index d'adresses).
- **Impact VPS-2 cible** (8 Go RAM, partagés avec `postgres` / `postfix` / `backend` / `otp` dont le pic mesuré est 2,8 Go — voir `routing-engine/README.md`) : le service Nominatim **au repos** rentre dans le budget. L'**import** en prod doit être fait comme un bootstrap contrôlé (idéalement import réalisé sur une machine plus large puis volume transféré, ou import séquencé quand OTP ne construit pas). #168 tranche la procédure exacte et la documente dans le runbook de déploiement.
- Si le disque du VPS ne suffit pas, alternative de repli à évaluer par #168 : réduire l'extrait à la bbox métropole stricte (moins d'adresses, moins de disque), en acceptant les effets de bord.

## 4. Format des libellés

### 4.1 Arrêt de transport (source OTP)

- **Retirer le code entre parenthèses** : `République (1615)` → `République`.
- **Dédupliquer** par nom d'arrêt : les poteaux `République (1615/1242/1214/…)` fusionnent en **une** entrée. Coordonnée retenue : celle du premier résultat OTP pour ce nom (le routage OTP re-rattachera de toute façon la position à l'arrêt le plus proche).
- Libellé final : le nom seul (`République`, `Gares`, `Beaulieu - Université`).

### 4.2 Adresse (source Nominatim)

Nominatim renvoie un objet `address` structuré + un `display_name` verbeux (« 12, Rue de Nemours, Centre, Rennes, Ille-et-Vilaine, Bretagne, France métropolitaine, 35000, France »). **Ne pas afficher `display_name`.**

Libellé construit à partir des champs structurés, format court :

```text
{numéro} {voie}, {commune}
```

- Ex. `12 Rue de Nemours, Rennes` ; `Boulevard de la Liberté, Rennes` (sans numéro si absent) ; `Cesson-Sévigné` (commune seule pour un résultat de type commune).
- Pas de code postal, pas de « France », pas de hiérarchie administrative intermédiaire — l'usager cherche dans **sa** métropole, ce contexte est implicite.
- #168 ajuste les cas particuliers (POI nommé, lieu-dit) au vu des retours réels de Nominatim, en gardant la règle « le plus court qui reste sans ambiguïté ».

### 4.3 Distinguer les deux à l'écran

`PlaceSuggestion` gagne un champ **`kind: 'stop' | 'address'`**.

- Contrat `GET /places` étendu (champ ajouté, non cassant : les libellés restent `label`/`lat`/`lon`).
- Côté frontend (implémentation dans #168 ou un petit suivi Dev FE — à la main du Dev FE) : le dropdown `AddressField` affiche une **icône discrète** devant l'entrée — puce transport pour `stop`, épingle/point pour `address` — sur le modèle des entrées rapides de `fusion-autocomplete-raccourcis.md`. Le `label` reste du texte propre sans suffixe type « · Arrêt ».
- Si le Dev FE ne reprend pas l'icône tout de suite, aucune régression : le `label` seul reste lisible.

## 5. Dégradation et erreurs

`GET /places` interroge deux sources ; l'indisponibilité de **l'une** ne doit pas casser l'autocomplétion :

| Situation | Comportement |
| --- | --- |
| Les deux sources répondent | Liste fusionnée normale (§2.1). |
| Nominatim injoignable / en erreur, OTP OK | Résultats **arrêts seulement**, `200`. Log serveur (niveau warning). Pas de 503. |
| OTP injoignable / en erreur, Nominatim OK | Résultats **adresses seulement**, `200`. (Aujourd'hui OTP down → 503 ; ce ticket **assouplit** ce point puisqu'une source de repli existe.) |
| Les deux injoignables | `503` (comportement actuel préservé quand plus rien ne répond). |
| Aucune correspondance dans l'une ou l'autre | Tableau vide pour cette source, ce n'est pas une erreur (règle inchangée). |

Seuil et debounce de l'autocomplétion (`useAddressSuggestions` : 2 caractères, debounce 300 ms) **inchangés**.

## 6. Reverse geocoding de la position GPS (#93)

**Reste hors périmètre de #167/#168**, mais le **blocage RGPD est levé** (§1.3 : Nominatim auto-hébergé, aucune donnée transmise à un tiers).

- Aujourd'hui : la position GPS pré-remplit l'origine avec le libellé fixe **« Ma position actuelle »** (`docs/sprints/sprint-3-plan.md`, #93). Ça continue à fonctionner, c'est suffisant.
- Évolution future possible (issue dédiée à créer si le besoin se confirme) : un endpoint `GET /places/reverse?lat=&lon=` utilisant le reverse geocoding de Nominatim pour remplacer « Ma position actuelle » par l'adresse réelle. Petit périmètre, à faire **après** #168 pour ne pas en alourdir la charge.

## 7. Contraintes transverses

- **RGPD** : aucune donnée de géolocalisation ni de recherche transmise hors de l'infrastructure du projet (Nominatim interne, non exposé). À rappeler dans `docs/specs/rgpd-geolocalisation.md` (§ sources externes) au moment de #168.
- **Éco-conception / interopérabilité** : Nominatim auto-hébergé = pas de quota d'API tiers, pas d'appel réseau externe par frappe utilisateur (uniquement du trafic interne au réseau Docker). Un opérateur d'une autre métropole se brancherait en ré-important l'extrait OSM correspondant, sans modification du code applicatif — cohérent avec la contrainte « interopérabilité » de `CLAUDE.md`.
- **Performances / mode dégradé** : la double source améliore la résilience de l'autocomplétion (une source down ≠ écran cassé, §5).
- **Sécurité** : le service Nominatim n'est jamais joignable depuis l'extérieur ; seul le backend l'appelle, en lecture seule.

## 8. Exemple (persona du dossier, partie 2.3)

Antoine tape « nemours » dans le champ Origine :

1. Le backend interroge OTP (`/geocode?query=nemours` → aucun arrêt de ce nom) **et** Nominatim en parallèle.
2. Nominatim renvoie plusieurs numéros de la rue de Nemours à Rennes.
3. `GET /places` renvoie une liste `kind: 'address'` : `1 Rue de Nemours, Rennes`, `5 Rue de Nemours, Rennes`, `12 Rue de Nemours, Rennes`… (5 max), libellés courts, sans code postal ni « France ».
4. Antoine choisit « 12 Rue de Nemours, Rennes » ; la recherche part de ces coordonnées, OTP rattache au réseau piéton le plus proche pour le premier tronçon à pied.

Puis il tape « répu » dans Destination :

1. Nominatim renvoie peu ou pas d'adresse pertinente ; OTP `/geocode` renvoie les poteaux `République (…)`.
2. Après déduplication du code arrêt, `GET /places` renvoie **une** entrée `kind: 'stop'` : `République`.

## 9. Ce que cette spec laisse à l'implémentation (#168)

- Choix précis de l'image Nominatim et de sa version.
- Commande et procédure d'import (dev + runbook prod), durée/empreinte mesurées et consignées.
- Réglages exacts de la requête Nominatim (paramètres `q` vs recherche structurée, `limit`, `countrycodes`, `viewbox`/`bounded` pour biaiser vers la métropole, `addressdetails`, langue `fr`).
- Construction fine du libellé adresse par type de résultat Nominatim (`house`, `street`, `city`, POI…).
- Tests (unitaires `PlacesService` fusion + dégradation, `NominatimClientService` mappe/erreurs) et vérification en conditions réelles sur de vraies adresses de Rennes Métropole.
- Reprise (ou non) de l'icône `kind` côté `AddressField`.

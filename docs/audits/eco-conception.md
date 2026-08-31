# Audit éco-conception — Limiter les appels réseau — Rapport

> Casquette Dev FE — issue [#23](https://github.com/KerdanetYvan/urbanflow-mobility/issues/23), Sprint 4 (phase E).
> Contrainte transverse « Éco-conception » du dossier de certification : _« limiter les appels réseau superflus, chargement progressif des données »_ (voir `CLAUDE.md`).

## 1. Méthodologie

Trois leviers, mesurés séparément puis ensemble :

1. **Cache runtime du service worker** — nouvelles règles Workbox (`frontend/vite.config.ts`) pour les tuiles cartographiques, le géocodage (`/places`) et les réponses d'API (`/trips`, `/profiles`), qui n'étaient pas mises en cache jusqu'ici.
2. **Chargement progressif du JS** — `React.lazy` sur les écrans hors `/recherche` (`frontend/src/App.tsx`), pour sortir leur code du paquet initial.
3. **Fréquence des appels déclenchés par la géolocalisation** — vérification que le throttle demandé par le critère d'acceptation existe déjà (issue #9).

**Mesure avant/après.** Les deux builds de production (`main` = avant, branche `feat/eco-conception-appels-reseau-23` = après) ont été servis par `vite preview` et pilotés par un navigateur Chromium (Playwright) sur un **parcours type** identique :

> chargement à froid de `/recherche` → saisie de l'origine (« republique ») → saisie de la destination (« gares ») → **Rechercher** → clic successif sur 3 itinéraires (chaque clic re-cadre la carte).

Ce parcours est joué **deux fois** dans le même contexte navigateur : un premier passage cache vide, un second passage une fois le service worker installé et ses caches amorcés (cas d'un utilisateur qui revient ou relance une recherche).

Le poids transféré est relevé via le Chrome DevTools Protocol (`Network.loadingFinished.encodedDataLength` = octets réellement sur le fil, `0` quand la réponse vient d'un cache). Backend, PostgreSQL/PostGIS, OpenTripPlanner et Nominatim tournaient en conditions réelles (données GTFS/OSM de Rennes Métropole), comme pour les autres vérifications du projet.

> **Limite de méthode.** Quand une requête de la page est satisfaite par le service worker via son propre `fetch()` (défaut de cache `CacheFirst` → réseau), le CDP rapporte `encodedDataLength = 0` pour la requête vue de la page : les totaux d'octets **« après » sont donc une borne basse** (l'égress réel sur défaut de cache est légèrement sous-compté). En revanche, le **nombre de requêtes** et le **nombre de réponses servies du cache** sont exacts, et suffisent à établir la tendance.

## 2. Critères d'acceptation

| Critère | Statut | Traitement |
|---|---|---|
| Debounce/throttle sur les appels déclenchés par la géolocalisation | ✅ déjà satisfait | `useGeolocation` (issue #9) : `MIN_UPDATE_INTERVAL_MS = 15 000` ms entre deux mises à jour de position, `enableHighAccuracy: false`, `maximumAge: 30 000` ms (accepte une position navigateur en cache), et abonnement `watchPosition` coupé tant que la carte n'est pas visible (prop `enabled`). L'autocomplétion d'adresse a par ailleurs un debounce de 300 ms + seuil de 2 caractères (`useAddressSuggestions`, issue #35). Aucun code ajouté ici, comportement vérifié conforme. |
| Chargement progressif (pagination/lazy loading) des listes de trajets | ✅ | La liste de trajets est déjà bornée côté serveur (`numItineraries = 5`, `backend/src/otp/otp-client.service.ts`) : pas de liste qui grandit, donc pas de pagination à ajouter. Le chargement progressif porte ici sur le **code de l'application** : `React.lazy` sur 5 écrans (voir §4). |
| Mesure avant/après (nombre de requêtes, poids des réponses) | ✅ | §3 ci-dessous. |

## 3. Mesures avant / après

### 3.1 Premier passage (cache vide)

| Indicateur | `main` (avant) | branche (après) | Écart |
|---|---:|---:|---:|
| Requêtes totales sur le parcours | 93 | 90 | −3 |
| Octets transférés (total) | **2 724 Ko** | **955 Ko** (borne basse) | **−65 %** |
| Tuiles OSM — requêtes | 82 | 80 | — |
| Tuiles OSM — servies du cache | 0 | **52** | +52 |
| Tuiles OSM — octets réseau | 2 570 Ko | 811 Ko | −68 % |
| JS (chargement de `/recherche`) | 133 Ko _(gzip)_ | 130 Ko _(gzip)_ | −2 % |
| CSS (chargement de `/recherche`) | 11,6 Ko _(gzip)_ | 11,5 Ko _(gzip)_ | — |

Même sur une première visite, le parcours re-demande des tuiles : le composant carte se remonte à chaque sélection d'itinéraire (voir §5) et re-sollicite des tuiles qui se recouvrent d'un cadrage à l'autre. La règle `CacheFirst` sur `osm-tiles` sert alors 52 de ces 80 requêtes depuis le cache du navigateur au lieu du réseau.

### 3.2 Second passage (service worker installé)

| Indicateur | `main` (avant) | branche (après) | Écart |
|---|---:|---:|---:|
| Requêtes totales sur le parcours | 93 | 90 | −3 |
| Octets transférés (total) | **2 584 Ko** | **307 Ko** (borne basse) | **−88 %** |
| Tuiles OSM — servies du cache | 0 / 82 | **70 / 80** | — |
| Tuiles OSM — octets réseau | 2 575 Ko | 307 Ko | −88 % |
| `/places` + `/trips` — octets réseau | ~9 Ko (à chaque visite) | 0 Ko (servis du cache) | — |
| App shell (JS + CSS + HTML) | 0 Ko _(déjà précaché)_ | 0 Ko _(déjà précaché)_ | — |

Le squelette applicatif (JS/CSS/HTML) était **déjà** servi hors-ligne par le précache Workbox sur `main` — ce n'est pas un apport de #23. L'apport de #23 est la **mise en cache runtime des tuiles, du géocodage et des réponses d'API**, qu'aucune règle ne couvrait : une visite de retour ou une relance de recherche passe de ~2,6 Mo à ~0,3 Mo.

## 4. Levier 2 — chargement progressif du JS (`React.lazy`)

`frontend/src/App.tsx` : `ConnexionPage`, `ProfilPage`, `HistoriquePage`, `MotDePasseOubliePage` et `ReinitialiserMotDePassePage` passent en `lazy(() => import(...))` sous un `<Suspense>` unique (fallback `Skeleton`). `RecherchePage` reste chargée d'emblée : `/` y redirige, un fallback de chargement y serait subi par quasiment tous les visiteurs.

Comparaison des builds de production :

| | `main` (avant) | branche (après) |
|---|---:|---:|
| JS chargé sur `/recherche` | 436,8 Ko / **132,9 Ko gzip** (1 fichier) | `index` 368,5 + `Button` 53,3 Ko = 421,8 Ko / **130,4 Ko gzip** (2 fichiers) |
| JS différé (chargé à la demande) | 0 | **17,3 Ko / 6,5 Ko gzip** (5 chunks) |
| CSS différé | 0 | 6,4 Ko / 2,0 Ko gzip (5 fichiers) |
| Entrées de précache Workbox | 9 | 22 |

**Gain immédiat modeste** (~2–3 Ko gzip, ~2 % du JS de `/recherche`) : l'écran d'arrivée embarque Leaflet, qui reste la dépendance lourde et n'est pas déplaçable sans dégrader le premier rendu. L'intérêt est **structurel** : le JS des écrans secondaires ne pèse plus sur le chemin critique, et l'écart se creuse à mesure que ces écrans s'étoffent (historique, profil) ou que de nouveaux écrans s'ajoutent. Le service worker précache maintenant ces chunks séparément, donc leur premier affichage reste instantané une fois l'app installée.

## 5. Remontage du composant carte à chaque itinéraire

Constat annexe de la mesure : `MapView` se remonte à neuf (`<MapContainer key={...}>`) à chaque sélection d'itinéraire, ce qui relance le montage de la carte et le chargement des tuiles du nouveau cadrage. Le cache `CacheFirst` de #23 en absorbe l'essentiel (tuiles déjà vues servies sans réseau), mais le remontage lui-même reste du travail évitable.

Son traitement est isolé dans une dernière étape de #23, à n'intégrer que si elle ne provoque aucune régression visuelle (recadrage impératif via `useMap()` plutôt que remontage). Décision et résultat consignés au **§6** ci-dessous.

## 6. Décision — remontage de `MapView`

**Intégré.** `MapView` ne remonte plus le `<MapContainer>` via une `key` : une
seule instance Leaflet vit pour toute la durée du composant, et les
changements de cadrage sont appliqués de façon impérative par un composant
enfant `MapViewController` (`useMap()` + `useEffect` déclenché sur `viewKey`,
la forme sérialisée stable de la vue cible → `map.fitBounds()` / `map.setView()`).

Vérification (build de prod, parcours : recherche puis 2 sélections
d'itinéraires) :

| | Avant #23 (`main`) | Après §3 (cache seul, `key` conservée) | Après §6 (recadrage impératif) |
|---|---:|---:|---:|
| Requêtes de tuiles sur le parcours | 82 | 80 (dont 52 servies du cache) | **67** |
| Nouvelles tuiles après un clic sur un itinéraire | rafale (remontage) | rafale absorbée par le cache | **0** |
| Instances `.leaflet-container` dans le DOM | 1 (recréée à chaque fois) | 1 (recréée à chaque fois) | **1 (jamais recréée)** |

- Aucune régression visuelle : captures headless (Chromium 1280×800) avant
  recherche / 1er itinéraire / 2e itinéraire **identiques** à `main` (même
  cadrage, mêmes marqueurs, même tracé).
- Aucune régression d'accessibilité : suite e2e WCAG `npm run test:e2e`
  **9/9** (dont « Recherche avec résultats », qui exerce la carte).
- Tests unitaires `MapView.spec.tsx` : 9/9 inchangés.

Le recadrage impératif supprime le rechargement de tuiles à chaque sélection
d'itinéraire (le cache runtime du §3 n'en absorbait que le coût réseau, pas
le travail de recréation du DOM ni les requêtes `CacheFirst` elles-mêmes).

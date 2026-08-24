# Plan de tests transverse — Accessibilité, sécurité, RGPD

> Casquette QA — issue [#32](https://github.com/KerdanetYvan/urbanflow-mobility/issues/32), Sprint 3.
> Formalise les checklists que dérouleront [#20](https://github.com/KerdanetYvan/urbanflow-mobility/issues/20) (audit WCAG) et [#21](https://github.com/KerdanetYvan/urbanflow-mobility/issues/21) (audit OWASP) une fois ce document validé. La section RGPD ([4](#4-checklist-rgpd-données-de-géolocalisation)) complète [`rgpd-geolocalisation.md`](rgpd-geolocalisation.md) sans le dupliquer.

## 1. Périmètre

Ce document **formalise** trois checklists — il ne les déroule pas lui-même (l'exécution est le travail de #20/#21, hors périmètre ici) :

1. Checklist WCAG 2.1 AA, à dérouler sur les écrans clés du frontend.
2. Checklist OWASP Top 10 (édition 2021), à dérouler sur les 5 contrôleurs de l'API.
3. Checklist RGPD, centrée sur les données de géolocalisation, en complément de ce que couvre déjà [`rgpd-geolocalisation.md`](rgpd-geolocalisation.md).

**Écrans clés concernés** (checklist WCAG) : `ConnexionPage`, `ProfilPage`, `RecherchePage`/`RecherchePageResults`, `HistoriquePage`, `MotDePasseOubliePage`, `ReinitialiserMotDePassePage`, ainsi que `AppLayout` (navigation commune à tous les écrans, cf. contrainte PWA du `CLAUDE.md` racine : pas de barre d'adresse/bouton retour une fois installée).

**Contrôleurs concernés** (checklist OWASP) : `auth`, `users`, `profiles`, `trips`, `places`.

**Hors périmètre** : le détail du chiffrement/rétention des données de géolocalisation (déjà spécifié et implémenté, [`rgpd-geolocalisation.md`](rgpd-geolocalisation.md) section 4) ; l'exécution des audits eux-mêmes (#20/#21).

## 2. Checklist WCAG 2.1 AA (à dérouler par #20)

### 2.1 Critères transverses (à vérifier sur chaque écran clé)

- [ ] Contraste texte/fond ≥ 4.5:1 (texte normal) / ≥ 3:1 (texte large, composants d'interface) — 1.4.3
- [ ] Navigation clavier complète : tout élément interactif atteignable au Tab, dans un ordre cohérent, focus visible en permanence — 2.1.1 / 2.4.7
- [ ] Aucun piège au clavier hors des cas volontaires déjà spécifiés (ex. fermeture du popover `TransportModesFilter` par `Échap`, voir [`filtre-modes-transport.md` §3](filtre-modes-transport.md#3-ouverture--popover-ancré-au-bouton)) — 2.1.2
- [ ] Champs de formulaire associés à un `<label>` explicite (pas seulement un `placeholder`) — 1.3.1 / 4.1.2
- [ ] Messages d'erreur de formulaire liés au champ concerné (`aria-describedby`) et annoncés (`aria-live` ou équivalent) — 3.3.1
- [ ] Cibles tactiles ≥ 44×44px, cohérent avec le principe mobile-first déjà acté ([`f2-ecrans-planification.md` §1.1](f2-ecrans-planification.md#11-principe-directeur--mobile-first)) — 2.5.5
- [ ] Hiérarchie de titres cohérente par écran (un seul `h1`, pas de saut de niveau) — 1.3.1
- [ ] Zoom texte à 200 % sans perte de contenu ni de fonctionnalité — 1.4.4
- [ ] Focus renvoyé à un endroit prévisible après une action (fermeture de popover, redirection post-connexion) — 2.4.3

### 2.2 Points d'attention spécifiques par écran

| Écran | Points d'attention |
| --- | --- |
| `ConnexionPage` | Lien "mot de passe oublié" atteignable au clavier ; messages d'erreur d'authentification non ambigus (pas de fuite d'info sur l'existence du compte, cohérent avec la checklist OWASP A07, [3.7](#37-a07--identification-and-authentication-failures)) |
| `ProfilPage` | Onboarding 2 étapes ([#107](https://github.com/KerdanetYvan/urbanflow-mobility/issues/107)) : progression annoncée aux lecteurs d'écran ; formulaire domicile/travail ([#114](https://github.com/KerdanetYvan/urbanflow-mobility/issues/114)) : chaque champ (`AddressField`) correctement labellisé |
| `RecherchePage` | `AddressField`/autocomplétion (pattern "combobox simplifié", déjà noté dans [`filtre-modes-transport.md` §3](filtre-modes-transport.md#3-ouverture--popover-ancré-au-bouton) comme "pas un pattern combobox ARIA complet") ; `OriginShortcuts` : libellé "Ma position actuelle" explicite, pas seulement une icône ; popover `TransportModesFilter` : `aria-expanded`/`aria-controls` déjà spécifiés, à vérifier en conditions réelles |
| `RecherchePageResults` | Carte (`MapView`) : pas de contenu informatif porté uniquement par la carte sans équivalent textuel (liste des itinéraires) ; badges de mode de transport ([#129](https://github.com/KerdanetYvan/urbanflow-mobility/issues/129)) et badges de scoring ([#126](https://github.com/KerdanetYvan/urbanflow-mobility/issues/126)) : contraste des couleurs de ligne GTFS, pas uniquement la couleur pour distinguer (1.4.1) |
| `HistoriquePage` | Liste de raccourcis/entrées : chaque item activable au clavier, pas seulement au clic/tap |
| `MotDePasseOubliePage` / `ReinitialiserMotDePassePage` | Formulaires courts : mêmes critères que 2.1, pas de point spécifique supplémentaire identifié |
| `AppLayout` | Navigation principale utilisable sans les affordances du navigateur (PWA `standalone`, voir `CLAUDE.md` racine) : retour arrière et changement d'écran doivent avoir un équivalent explicite dans l'UI |

## 3. Checklist OWASP Top 10 (à dérouler par #21)

Édition 2021, une ligne par catégorie, avec l'état constaté à date (2026-08-24) sur les 5 contrôleurs (`auth`, `users`, `profiles`, `trips`, `places`) — sert de point de départ à #21, pas un audit déjà mené.

### 3.1 A01 — Broken Access Control

- [ ] Vérifier que chaque route protégée porte bien `JwtAuthGuard` (accès complet) ou `OptionalJwtAuthGuard` (accès public avec personnalisation optionnelle, ex. `GET /trips`) selon l'intention réelle — pas de route sensible sans guard par oubli
- [ ] Vérifier l'absence d'IDOR : un utilisateur authentifié ne peut lire/modifier que ses propres ressources (`profiles`, `trips/history`) — pas de paramètre d'ID de ressource acceptant l'ID d'un autre utilisateur

### 3.2 A02 — Cryptographic Failures

- [x] Mots de passe hachés bcrypt (`auth.service.ts`) — déjà en place
- [x] Coordonnées/adresses de géolocalisation chiffrées au repos (AES-256-GCM) — déjà en place, voir [`rgpd-geolocalisation.md` §2](rgpd-geolocalisation.md#2-chiffrement-au-repos)
- [ ] Vérifier que `JWT_SECRET`/`GEOLOCATION_ENCRYPTION_KEY` sont bien de vrais secrets forts en production (pas de valeur par défaut du `.env.example` réutilisée)
- [ ] Vérifier que le trafic est bien servi en HTTPS une fois déployé (terminaison TLS côté hébergeur/reverse proxy)

### 3.3 A03 — Injection

- [x] Requêtes via TypeORM (repositories), pas de concaténation SQL brute constatée
- [x] `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`, `transform`, voir `main.ts`) — rejette les champs non déclarés plutôt que de les ignorer silencieusement
- [ ] Vérifier l'absence de requête SQL brute (`query()`) introduite depuis cet état des lieux

### 3.4 A04 — Insecure Design

- [ ] **Constat** : aucun mécanisme de limitation de débit (rate limiting) identifié sur l'API à date — `/auth/login` et `/auth/refresh-token` en particulier exposés sans protection contre le bruteforce ; à évaluer par #21 (ex. `@nestjs/throttler`)

### 3.5 A05 — Security Misconfiguration

- [x] CORS restreint à une origine configurée (`CORS_ORIGIN`), pas de `origin: true` (voir `main.ts`)
- [x] Documentation Swagger désactivée en production (`NODE_ENV !== 'production'`, voir `main.ts`)
- [ ] **Constat** : aucun en-tête de sécurité HTTP (`helmet` ou équivalent) identifié — à évaluer par #21

### 3.6 A06 — Vulnerable and Outdated Components

- [ ] Vérifier l'absence de vulnérabilité connue sur les dépendances (`npm audit` backend/frontend) et l'existence d'un mécanisme de mise à jour régulier (ex. Dependabot)

### 3.7 A07 — Identification and Authentication Failures

- [x] JWT avec refresh tokens (voir `auth.service.ts`, `refresh-token.dto.ts`) — déjà en place selon `CLAUDE.md`
- [ ] Vérifier la politique d'expiration/rotation du refresh token et sa révocation possible (déconnexion, compromission)
- [ ] Vérifier que les messages d'erreur de connexion ne distinguent pas "email inconnu" de "mot de passe incorrect" (évite l'énumération de comptes)

### 3.8 A08 — Software and Data Integrity Failures

- [ ] Vérifier que le pipeline CI (GitHub Actions) exécute bien lint + tests avant tout déploiement, et que `package-lock.json`/`package.json` (backend et frontend) sont versionnés et cohérents

### 3.9 A09 — Security Logging and Monitoring Failures

- [x] `LoggingInterceptor`/`AllExceptionsFilter` globaux (voir `main.ts`) — journalisation homogène déjà en place
- [ ] Vérifier qu'aucune donnée sensible (mot de passe en clair, jeton JWT complet, coordonnées de géolocalisation déchiffrées) n'apparaît dans les logs

### 3.10 A10 — Server-Side Request Forgery (SSRF)

- [ ] Vérifier que les appels sortants du backend vers OpenTripPlanner (`places`/`trips`) et l'API météo (`WeatherService`, [#17](https://github.com/KerdanetYvan/urbanflow-mobility/issues/17)) utilisent des URLs de configuration fixes, jamais une URL construite à partir d'une entrée utilisateur

## 4. Checklist RGPD (données de géolocalisation)

[`rgpd-geolocalisation.md`](rgpd-geolocalisation.md) couvre déjà en détail le chiffrement au repos et la politique de rétention/purge pour les colonnes concrètes ([#11](https://github.com/KerdanetYvan/urbanflow-mobility/issues/11)/[#113](https://github.com/KerdanetYvan/urbanflow-mobility/issues/113)) — non repris ici. Cette section couvre ce qui reste hors de son périmètre.

- [x] **Consentement du capteur GPS** : `useGeolocation` ne s'abonne à la position qu'à la demande explicite (`enabled`, activé au clic utilisateur — voir [#93](https://github.com/KerdanetYvan/urbanflow-mobility/issues/93), `OriginShortcuts`), jamais en tâche de fond au chargement d'un écran — pas de tracking caché
- [x] **Minimisation** : décision actée de ne pas faire de reverse geocoding de la position GPS précise vers un service tiers (voir [`sprint-3-plan.md`](../sprints/sprint-3-plan.md), item #93) — seul un libellé fixe ("Ma position actuelle") est affiché, aucune coordonnée précise n'est envoyée à un service externe pour résolution d'adresse
- [ ] **Cache local PWA** : durée de vie limitée pas encore implémentée (gap déjà identifié dans [`rgpd-geolocalisation.md` §3.3](rgpd-geolocalisation.md#33-cache-local-pwa)) — à cadrer par l'issue qui introduira ce cache
- [ ] **Droit à l'effacement partiel** : suppression de compte déclenche bien un `CASCADE` complet (vérifié pour #11/#113), mais aucun moyen d'effacer uniquement une adresse domicile/travail sans supprimer le compte entier (gap déjà signalé hors scope de [#114](https://github.com/KerdanetYvan/urbanflow-mobility/issues/114)) — à trancher : nécessaire avant soutenance ou reportable en Stretch
- [ ] **Information de l'utilisateur** : aucune page de politique de confidentialité/mentions légales identifiée dans le frontend à date — vérifier si le cahier des charges de certification l'exige pour la soutenance, sinon la documenter comme limitation assumée du MVP
- [ ] **Agrégation avant usage statistique** : critère déjà posé par [#22](https://github.com/KerdanetYvan/urbanflow-mobility/issues/22) ([`rgpd-geolocalisation.md` §3.4](rgpd-geolocalisation.md#34-agrégation-avant-usage-statistique)) — aucun usage statistique n'existe à date, rien à vérifier concrètement, à re-contrôler si une fonctionnalité de ce type apparaît avant la soutenance

# Audit de sécurité OWASP Top 10 — Rapport

> Casquette Dev BE — issue [#21](https://github.com/KerdanetYvan/urbanflow-mobility/issues/21), Sprint 3.
> Périmètre et méthodologie définis en amont dans [`docs/specs/plan-tests-transverse.md` §3](../specs/plan-tests-transverse.md#3-checklist-owasp-top-10-déroulée-par-21).

## 1. Méthodologie

Revue manuelle du code (lecture des contrôleurs, guards, pipes, configuration) complétée par une vérification en conditions réelles (services Docker démarrés : backend, PostgreSQL/PostGIS, OpenTripPlanner) pour les deux corrections apportées — pas un outil de scan automatisé (type ZAP/Burp), disproportionné pour l'échelle de cette API à ce stade du projet.

Périmètre : les 5 contrôleurs de l'API (`auth`, `users`, `profiles`, `trips`, `places`), un critère par catégorie de l'OWASP Top 10 (édition 2021), repris de la checklist établie par #32.

## 2. Résultat final

**10/10 catégories couvertes.** Deux anomalies détectées et corrigées, une limite documentée et reportée (voir [4](#4-limite-documentée-non-corrigée)).

Les critères d'acceptation de l'issue sont remplis :
- [x] Validation stricte des entrées (`class-validator`)
- [x] Protection contre l'injection SQL/NoSQL
- [x] Rate limiting sur les endpoints sensibles (auth)
- [x] Rapport d'audit documenté

## 3. Anomalies détectées et corrigées

### 3.1 A04 — Absence de limitation de débit sur l'authentification

**Constat.** Aucun mécanisme de rate limiting n'existait sur l'API : `/auth/login`, `/auth/refresh`, `/auth/forgot-password` et `/auth/reset-password` étaient exposés sans protection contre une attaque par force brute (essai automatisé de mots de passe, énumération de jetons de réinitialisation).

**Correctif.** `@nestjs/throttler` enregistré dans `AppModule` (configuration disponible pour toute l'app) et `ThrottlerGuard` appliqué spécifiquement à `AuthController` — 10 requêtes/minute/IP. Volontairement **non** appliqué en garde global : le reste de l'API (recherche d'itinéraires, géocodage) n'a pas besoin d'être limité de la même façon qu'un point d'entrée d'authentification, seule cible réaliste d'une attaque par force brute sur cette API.

Vérifié en conditions réelles : 12 requêtes consécutives vers `/auth/login` avec des identifiants invalides renvoient `401` puis basculent en `429 Too Many Requests` une fois le seuil atteint ; les mêmes 12 requêtes vers `GET /places` (hors périmètre du garde) renvoient toutes `200`.

### 3.2 A05 — Absence d'en-têtes de sécurité HTTP

**Constat.** Aucun en-tête de sécurité standard (`Content-Security-Policy`, `X-Content-Type-Options`, `Strict-Transport-Security`...) n'était posé sur les réponses de l'API.

**Correctif.** `helmet()` ajouté dans `main.ts`, avant tout autre middleware. Vérifié en conditions réelles : `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`, `X-DNS-Prefetch-Control` et `X-Frame-Options` confirmés présents sur les réponses.

### 3.3 A06 — Dépendances vulnérables, pas de mécanisme de mise à jour

**Constat.** `npm audit` remontait 4 vulnérabilités "high" côté backend et 7 (dont 1 "moderate") côté frontend, toutes avec un correctif disponible sans montée de version majeure. Aucun mécanisme de suivi régulier des dépendances (type Dependabot) n'était configuré.

**Correctif.** `npm audit fix` appliqué des deux côtés (0 vulnérabilité restante, confirmé par un nouveau `npm audit`) ; `.github/dependabot.yml` ajouté (`npm` sur `backend/` et `frontend/`, `github-actions` sur le pipeline CI, vérification hebdomadaire).

## 4. Limite documentée, non corrigée

**A07 — Pas de rotation stricte du refresh token.** `AuthService.refresh()` vérifie le refresh token présenté et émet une nouvelle paire de jetons, mais **n'invalide jamais l'ancien refresh token** : celui-ci reste valide jusqu'à sa propre expiration (7 jours), même après qu'un nouveau a été émis. Une vraie rotation (au sens OWASP) exigerait d'invalider systématiquement le jeton présenté et de détecter sa réutilisation (signal de vol) — ce qui suppose un stockage des jetons émis (ou de leur identifiant), absent aujourd'hui du modèle de données.

**Décision** : reportée en Stretch plutôt que corrigée dans le cadre de cette issue — une vraie rotation avec détection de réutilisation est une fonctionnalité à part entière (nouvelle table, logique de révocation, migration), disproportionnée par rapport au périmètre "audit + correctifs ciblés" de #21. Documentée ici pour rester visible plutôt que silencieusement oubliée.

## 5. Autres points déjà couverts, confirmés sans modification

- **A01 (contrôle d'accès)** : chaque contrôleur porte le garde correspondant à son intention (`JwtAuthGuard` sur `profiles`, mixte `OptionalJwtAuthGuard`/`JwtAuthGuard` sur `trips` selon la route, aucun sur `users`/`places` — public par conception). Aucun IDOR possible : `profiles`/`trips/history` n'exposent que des routes `/me` résolues via le jeton (`@CurrentUser()`), jamais un identifiant de ressource passé en paramètre.
- **A02 (cryptographie)** : mots de passe bcrypt, géolocalisation chiffrée AES-256-GCM (déjà couvert par #22, voir `rgpd-geolocalisation.md`), secrets de `.env.example` bien des valeurs de substitution (`changeme`), HTTPS géré par Caddy (Let's Encrypt automatique) en production, hors du périmètre de `docker-compose.prod.yml`.
- **A03 (injection)** : uniquement des requêtes via TypeORM, `ValidationPipe` global déjà strict (`whitelist`/`forbidNonWhitelisted`/`transform`), aucune requête SQL brute hors migrations.
- **A08 (intégrité)** : le job `deploy` du pipeline CI dépend explicitement de `[frontend, backend]` — un lint ou un test en échec bloque la mise en production.
- **A09 (journalisation)** : `LoggingInterceptor` ne journalise que méthode, route, code retour et durée — jamais le corps de la requête, donc jamais de mot de passe ni de jeton complet.
- **A10 (SSRF)** : les appels sortants (OpenTripPlanner, API météo) utilisent tous une URL de base fixée par configuration (`OTP_URL`) ou des coordonnées fixes (centre de la métropole) — jamais une URL construite à partir d'une entrée utilisateur.

## 6. Limites de cet audit

Revue manuelle et vérification ciblée des deux correctifs, pas un audit de sécurité mené par un tiers ni un scan automatisé (SAST/DAST). Ne remplace pas un test d'intrusion en bonne et due forme, hors périmètre réaliste pour ce projet à ce stade.

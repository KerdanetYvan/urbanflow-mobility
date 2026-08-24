# Audit d'accessibilité WCAG 2.1 AA — Rapport

> Casquette Dev FE — issue [#20](https://github.com/KerdanetYvan/urbanflow-mobility/issues/20), Sprint 3.
> Périmètre et méthodologie définis en amont dans [`docs/specs/plan-tests-transverse.md` §2](../specs/plan-tests-transverse.md#2-checklist-wcag-21-aa-à-dérouler-par-20).

## 1. Méthodologie

Audit automatisé via [axe-core](https://github.com/dequelabs/axe-core) piloté par Playwright (`@axe-core/playwright`), contre un vrai navigateur (Chromium) — contrairement aux tests unitaires Vitest (jsdom), seul un vrai moteur de rendu permet de vérifier fidèlement le contraste des couleurs et le comportement clavier réel.

L'audit tourne contre l'environnement de développement réel (`docker compose up` : backend, PostgreSQL/PostGIS, OpenTripPlanner avec les vraies données GTFS/OSM de Rennes Métropole, frontend), pas contre des mocks — cohérent avec la pratique de vérification "en conditions réelles" déjà suivie sur ce projet (issues #93, #107, #109, #112).

Script : `frontend/e2e/wcag-audit.spec.ts`. Exécution : `npm run test:e2e` (frontend), services Docker démarrés au préalable.

## 2. Écrans couverts

Les 7 écrans clés identifiés dans le plan de tests transverse, plus deux parcours dédiés à la navigation clavier :

| Écran | État vérifié |
|---|---|
| Connexion | Formulaire de connexion |
| Recherche | Formulaire vide (sans résultats) |
| Recherche | **Avec résultats** (recherche réelle : "Gares" → "République", données STAR Rennes Métropole) |
| Mot de passe oublié | Formulaire |
| Réinitialiser le mot de passe | Formulaire (avec jeton fictif dans l'URL, comme un vrai lien d'email) |
| Profil | Écran authentifié (compte de test dédié) |
| Historique | Écran authentifié (compte de test dédié) |
| Navigation clavier | Ouverture/fermeture au clavier du popover "Modes de transport" (`Enter`/`Échap`, retour du focus au déclencheur) |
| Navigation clavier | Parcours complet par tabulation sur le formulaire de recherche, sans piège au clavier |

## 3. Résultat final

**9/9 tests passent — 0 violation axe-core bloquante sur l'ensemble des écrans audités.**

Les critères d'acceptation de l'issue sont remplis :
- [x] Rôles ARIA sur les composants interactifs
- [x] Contraste des couleurs conforme
- [x] Navigation complète au clavier
- [x] Rapport d'audit (axe-core) sans erreur bloquante

## 4. Anomalie détectée et corrigée

**Marqueurs de carte (`MapView.tsx`) focusables sans nom accessible.** Le premier passage de l'audit a échoué sur l'écran "Recherche avec résultats" : axe-core a relevé une violation de la règle `button-name` (WCAG 4.1.2, Nom, rôle, valeur) sur les marqueurs Leaflet (origine, destination, correspondances, position utilisateur).

**Cause.** Leaflet rend par défaut un marqueur focusable au clavier (`tabindex="0"`, `role="button"`) et cliquable (classe `leaflet-interactive`), même en l'absence de tout gestionnaire d'événement — un comportement générique de la bibliothèque, pas une intention du code de ce projet. Or `MapView` marque déjà l'ensemble du conteneur cartographique en `aria-hidden="true"` (décision documentée : la carte est un complément visuel, son équivalent textuel complet — résumé, légende, cards d'itinéraire — est fourni ailleurs). Un marqueur focusable à l'intérieur d'un conteneur `aria-hidden` est atteignable au `Tab` sans jamais être annoncé par un lecteur d'écran : une impasse pour un usager au clavier.

**Correctif.** `interactive={false}` et `keyboard={false}` ajoutés sur les 6 marqueurs de `MapView.tsx` (origine, destination, point unique, correspondances, position utilisateur) : aucun de ces marqueurs n'a de comportement au clic dans ce projet, la solution retenue est donc de les retirer entièrement du parcours clavier plutôt que de leur ajouter un libellé, ce qui aurait contredit la décision déjà actée que la carte reste décorative pour les technologies d'assistance.

Aucune autre violation n'a été détectée sur le reste des écrans — cohérent avec l'effort d'accessibilité déjà investi au fil des sprints précédents (`FormField` avec labels/`aria-describedby` systématiques, `role="tablist"`/`aria-selected"` sur `ConnexionPage`, `aria-expanded`/`aria-controls` sur le popover `TransportModesFilter`, etc.).

## 5. Limites de cet audit

- Axe-core couvre une large part des critères automatisables (contraste, rôles ARIA, structure), mais pas l'ensemble de WCAG 2.1 AA : certains critères (pertinence du texte alternatif, ordre de lecture logique pour un lecteur d'écran réel, cohérence du sens des libellés) restent hors de portée d'un outil automatisé et nécessiteraient un test manuel avec un lecteur d'écran réel (NVDA, VoiceOver) — non réalisé ici, hors périmètre réaliste pour un projet individuel à ce stade.
- Les écrans authentifiés ont été vérifiés avec un compte de test fraîchement créé (profil vide) : les états "profil déjà rempli" et "historique non vide" n'ont pas été spécifiquement audités, bien que partageant la même structure de composants que les états vides déjà couverts.

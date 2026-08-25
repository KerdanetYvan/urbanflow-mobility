---
target: "frontend/src (écrans clés : ConnexionPage, ProfilPage/onboarding, RecherchePage+carte, RecherchePageResults, HistoriquePage)"
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-08-25T15-49-51Z
slug: rchepage-carte-recherchepageresults-historiquepage
---
Method: dual-agent (A: a6310a0aaedc411e1 · B: a1fbf7801a2e2928a)

## Design Health Score

| # | Heuristique | Score | Point clé |
|---|---|---|---|
| 1 | Visibilité de l'état système | 3 | Chargement en texte brut (Profil, Historique) vs squelette animé (Résultats) — deux registres pour la même idée |
| 2 | Adéquation système/monde réel | 3 | Vocabulaire naturel ("Domicile", "Travail"), badges qualitatifs sans score chiffré |
| 3 | Contrôle et liberté utilisateur | 3 | Sorties de secours nombreuses (Inverser, "Modifier la recherche", "Passer" à l'onboarding) |
| 4 | Consistance et standards | 2 | Identité chromatique double (ambre vs bleu) non tranchée sur les composants partagés |
| 5 | Prévention des erreurs | 3 | Validation miroir client/backend, distinction adresse tapée non résolue |
| 6 | Reconnaissance plutôt que rappel | 3 | Raccourcis origine (position/domicile/travail) + trajets récents |
| 7 | Flexibilité et efficacité | 3 | Filtre modes en popover dédié, raccourcis = relance directe sans re-saisie |
| 8 | Esthétique et minimalisme | 2 | Minimaliste mais générique — pas de personnalité visuelle propre, cf. verdict spécificité |
| 9 | Aide à la reconnaissance/récupération d'erreurs | 3 | Messages d'erreur API lisibles, `Alert` structuré |
| 10 | Aide et documentation | 2 | Pas d'aide contextuelle au-delà de `helpText` ponctuel, geste swipe jamais expliqué |
| **Total** | | **27/40** | **Acceptable** (haut de fourchette) |

## Design Specificity Verdict

**LLM assessment** : Interchangeable, pas encore "UrbanFlow". L'exécution est propre (cartes bordure+radius homogènes, boutons/formulaires cohérents), mais rien dans le vocabulaire visuel n'est identifiable comme spécifique au produit :
- Nom du produit en texte brut sans logo ni traitement typographique (`AppLayout.tsx:75`).
- La couleur de marque revendiquée (ambre, `tokens.css`) perd le terrain face au bleu secondaire sur les surfaces les plus fréquentées : anneau de focus des champs, bouton secondaire, marqueurs de carte (origine + position utilisateur), skip-link, alert "info" — deux teintes se disputent le rôle sans qu'aucune ne l'emporte.
- Retirer le texte "UrbanFlow Mobility" du header rendrait ConnexionPage/ProfilPage/HistoriquePage méconnaissables comme appartenant à ce produit précis.
- Deux éléments trahissent une vraie décision produit : la carte plein écran + panneaux flottants des résultats (motif Google Maps/Citymapper assumé), et les badges qualitatifs sans score chiffré — mais ce dernier, cœur différenciant du produit (scoring pondéré, dossier partie 7.3), porte le même style visuel qu'un badge SaaS générique.

**Scan déterministe** : 3 findings, tous `warning`, code de sortie 2 (non clean).
- `frontend/src/index.css:63` — règle **side-tab** : `border-left: 3px solid var(--color-primary-emphasis)` sur les `h1` desktop, décrite par le détecteur comme *"le tell le plus reconnaissable d'une UI générée par IA"*. Point de convergence notable avec l'Assessment A : ce choix (issue #73, commenté dans le code) visait justement à corriger une impression de rendu "sans vie" — l'intention était bonne, mais le motif retenu tombe exactement dans le générique que le verdict de spécificité ci-dessus déplore.
- `frontend/src/pages/RecherchePage/RecherchePage.css:307` et `RecherchePageResults.css:342` — règle **layout-transition** : `transition: height` anime une propriété de layout (thrash/jank potentiel), sur le bandeau formulaire et le panneau de résultats. Deuxième point de convergence : l'Assessment A signale ce même bandeau comme le geste swipe le moins bien expliqué et le plus sensible en usage mobile pressé (persona Casey) — la piste technique (transition non performante) et la piste UX (geste peu discoverable) pointent vers le même composant.

**Preuve navigateur** : indisponible pour ce run — aucun outil navigateur natif exposé dans cette session, et faire tourner la stack complète (backend + PostgreSQL/PostGIS + OpenTripPlanner avec données GTFS réelles) uniquement pour une capture d'écran aurait été disproportionné pour un audit de préparation de soutenance. Pas d'overlay visuel disponible dans cette passe — revue basée sur code source + scan statique uniquement.

## Overall Impression

Le socle est solide : composants réutilisés de façon disciplinée, design tokens centralisés, divulgation progressive bien maîtrisée (onboarding 2 étapes, bandeau replié, "Plus d'options"). Ce qui manque, ce n'est pas de la rigueur mais de la **personnalité** : rien à l'écran, hors le texte "UrbanFlow Mobility", ne permettrait à un jury de reconnaître ce produit précis sur une capture. La plus grande opportunité avant la soutenance : trancher l'identité chromatique (ambre ou bleu, pas les deux) et donner au badge de scoring — la fonctionnalité complémentaire la plus argumentée du dossier — un traitement visuel qui le distingue clairement du reste.

## Ce qui fonctionne bien

1. **Carte plein écran + panneaux flottants des résultats** : motif familier, cohérent avec l'usage en mobilité — jamais l'impression de quitter "le monde réel" pour un écran abstrait.
2. **Raccourcis contextuels** (position actuelle/domicile/travail, trajets récents) : réduisent activement la ressaisie, exactement ce qu'attend un usager régulier d'une app de mobilité urbaine.
3. **Badges qualitatifs sans score chiffré** : décision disciplinée qui évite la fausse précision d'un chiffre tout en restant lisible.

## Problèmes prioritaires

**[P1] Identité de couleur double, jamais tranchée**
*Pourquoi ça compte* : aucune des deux teintes ne domine assez pour ancrer une identité visuelle reconnaissable — directement lié au verdict de spécificité ci-dessus.
*Correctif* : choisir l'ambre OU le bleu comme couleur d'interaction dominante (focus, boutons, marqueurs de carte) ; garder l'autre en usage très restreint (un seul accent signature) plutôt qu'en concurrence sur les mêmes surfaces.
*Commande suggérée* : `/impeccable colorize`

**[P1] Aucune marque visuelle au-delà du texte**
*Pourquoi ça compte* : combiné au point précédent, aucune capture d'écran du produit n'est identifiable sans lire le nom en toutes lettres — un problème direct pour la mémorabilité en soutenance.
*Correctif* : un traitement typographique ou une mark minimale pour "UrbanFlow Mobility" dans `AppLayout.tsx`, cohérent avec la couleur tranchée du point précédent.
*Commande suggérée* : `/impeccable delight`

**[P2] La carte — élément le plus spécifique du produit — est cachée par défaut à l'arrivée sur `/recherche`**
*Pourquoi ça compte* : le bandeau formulaire s'ouvre à 70vh par défaut, masquant l'essentiel de la carte au premier contact, alors que c'est justement ce qui distingue le plus UrbanFlow d'un simple formulaire.
*Correctif* : réduire la hauteur par défaut du bandeau ou révéler davantage de carte au premier chargement, la géolocalisation/le contexte spatial devenant le premier élément vu.
*Commande suggérée* : `/impeccable layout`

**[P2] Débordement de texte non protégé sur les libellés d'adresse**
*Pourquoi ça compte* : ni les raccourcis pills, ni les entrées d'historique n'ont de `text-overflow`/`max-width` — une adresse réelle longue (immeuble + résidence + code postal, fréquent en zone urbaine dense) peut casser la mise en page.
*Correctif* : `text-overflow: ellipsis` + `max-width` cohérents sur `.recherche-quick-shortcut`, `.recherche-origin-shortcut`, `.historique-entry-route`.
*Commande suggérée* : `/impeccable harden`

**[P3] Vocabulaire de chargement incohérent entre écrans**
*Pourquoi ça compte* : squelette animé pulsé sur Résultats vs simple texte "Chargement…" sur Profil/Historique — deux registres visuels pour le même concept d'attente, nuit à la cohérence de heuristique #4.
*Correctif* : généraliser le composant squelette à tous les états de chargement, ou au minimum uniformiser le style du texte de chargement.
*Commande suggérée* : `/impeccable polish`

## Persona Red Flags

**Jordan (premier utilisateur)** : arrive sur `/recherche` sans compte — le bandeau à 70vh cache la carte, première impression "un formulaire" plutôt que "une app de mobilité qui me montre où je suis". Ne sait pas si le filtre "Modes de transport" du popover et les préférences de modes du profil s'additionnent ou lequel prime — aucun texte ne le précise à l'écran.

**Casey (mobile pressé, en marche/correspondance)** : le raccourci "Ma position actuelle" a le même poids visuel que "Domicile"/"Travail" — pas de mise en avant comme action rapide prioritaire. Le geste de swipe pour replier/déplier le bandeau (seuil 40px) exige une précision tactile difficile à garantir une main occupée, sans retour visuel en cas de geste raté.

**Riley (testeur de cas limites)** : adresse réelle longue dans les pills/historique casse potentiellement la mise en page (cf. P2 débordement). Itinéraire multi-correspondances multi-mode : puces de mode + badges qualitatifs cumulés peuvent gonfler la hauteur de carte sans plafond visible. Profil incomplet + recherche anonyme : le calcul de badges retombe silencieusement sur un seul badge, sans indication que c'est un état attendu plutôt qu'un bug.

## Minor Observations

- `Alert` cumule 3 signaux redondants pour un même message (titre "Erreur" + icône + pastille rouge) — sans gravité, juste un peu chargé.
- Bouton "Inverser" icône seule sans tooltip visuel — repose entièrement sur `aria-label`, correct côté accessibilité mais pas de confirmation visuelle desktop avant clic.
- `HistoriquePage.css` porte encore un commentaire signalant son propre statut de placeholder Stretch — à surveiller avant démo/soutenance si l'écran est montré.
- Fieldsets de préférences (accessibilité, modes de transport) dupliqués à l'identique entre `ProfilPage.css` et `RecherchePage.css` plutôt que factorisés — dette de cohérence à bas risque.

## Questions to Consider

- Le bleu occupe plus de surface d'interaction que l'ambre censé être la couleur de marque — UrbanFlow est-elle une app ambre ou une app bleue ? Le moment est-il venu de trancher plutôt que de laisser les deux se partager le rôle par accumulation de décisions locales ?
- Si on retire le mot "UrbanFlow Mobility" du header, combien d'écrans resteraient reconnaissables comme appartenant à ce produit précis plutôt qu'à un template générique de mobilité urbaine ?
- Le badge "le plus adapté à vos critères" — cœur différenciant argumenté dans le dossier de certification — mérite-t-il un traitement qui le distingue explicitement, plutôt qu'une pastille au style SaaS générique ?

# Complément de cadrage — Suivi de trajet et perturbations (F3, issue #18)

> Casquette PO. Complète `docs/specs/f3-scoring-perturbations.md` section 3
> ("Comportement lors d'une perturbation détectée en cours de trajet"), qui
> suppose déjà acquis un itinéraire "actuellement suivi" par l'utilisateur
> sans jamais cadrer comment il le devient. Rédigé avant l'implémentation
> Dev BE/FE de [#18](https://github.com/KerdanetYvan/urbanflow-mobility/issues/18),
> à la demande explicite de l'utilisateur en session (2026-09-02), même
> logique que les specs [#171](https://github.com/KerdanetYvan/urbanflow-mobility/issues/171)/[#165](https://github.com/KerdanetYvan/urbanflow-mobility/issues/165)
> avant leur implémentation.

## 1. Pourquoi ce complément

La section 3.1 du spec parle d'un itinéraire "explicitement sélectionné
comme en cours" — cette sélection n'existe nulle part dans l'app aujourd'hui
(vérifié : aucun bouton "suivre"/"commencer" sur l'écran de résultats,
`RecherchePageResults.tsx`, `selectedIndex` n'y est qu'un état d'affichage
local, jamais persisté). Ce document tranche cinq points que
`f3-scoring-perturbations.md` laisse implicites :

1. Où/quand ce choix se fait.
2. Authentifié uniquement, ou aussi sans compte ([#64](https://github.com/KerdanetYvan/urbanflow-mobility/issues/64)).
3. Ce que devient la règle anti-spam "delta > 5 min" (section 3.5) maintenant
   que [#14](https://github.com/KerdanetYvan/urbanflow-mobility/issues/14)
   a établi qu'aucun retard chiffré n'est disponible dans le flux réel
   (voir `backend/README.md` section "Perturbations GTFS-Realtime").
4. Le cycle de vie du suivi (démarrage, arrêt, expiration).
5. Le contrat RGPD de la donnée persistée.

Le reste de la section 3 (contenu de la notification, réaction au tap,
permission refusée/app fermée) reste acquis tel quel, sans modification.

## 2. Point d'entrée : "Suivre ce trajet"

- Bouton dans le **panneau détail** de l'itinéraire sélectionné
  (`.resultats-panel-detail` desktop / état `detail` du bandeau mobile —
  même emplacement que le bloc "Prochain passage",
  [#173](https://github.com/KerdanetYvan/urbanflow-mobility/issues/173)),
  **pas** sur chaque carte de la liste : suivre est un choix sur UN
  itinéraire précis, une fois qu'on l'a ouvert en détail — pas une action de
  parcours rapide de la liste.
- **Un seul trajet suivi à la fois** par utilisateur — démarrer un nouveau
  suivi remplace silencieusement le précédent (pas de multi-suivi,
  cohérent avec "le trajet actuellement suivi" au singulier dans le spec).
- Libellé "Suivre ce trajet" → bascule en "Arrêter le suivi" une fois actif.
  Le clic sur "Suivre" déclenche, dans l'ordre : (1) demande de permission
  `Notification` si pas déjà tranchée, (2) abonnement push du service
  worker, (3) enregistrement du suivi côté backend. Un refus de permission
  **n'empêche pas** le suivi lui-même (repli bannière `Alert`, section 3.4
  déjà actée) — seule la notification système en est privée.

## 3. Authentifié uniquement

Suivre un trajet **nécessite un compte** — même bascule que l'historique de
recherche ([#11](https://github.com/KerdanetYvan/urbanflow-mobility/issues/11)) :
la recherche reste utilisable sans compte, mais toute donnée de trajet
**persistée** au-delà d'une requête ponctuelle ne l'est qu'une fois
connecté. Raisons :

- Un trajet suivi est une donnée de géolocalisation sensible qui vit en base
  (pas seulement en mémoire le temps d'une requête) — même obligation RGPD
  que `TripHistoryEntry` (chiffrement au repos, rétention bornée, cascade de
  suppression avec le compte).
- Un abonnement push doit survivre une fermeture d'onglet : il a besoin
  d'une session stable à laquelle se raccrocher, qu'un visiteur anonyme n'a
  pas.
- Cohérent avec la suppression de compte
  ([#164](https://github.com/KerdanetYvan/urbanflow-mobility/issues/164)) :
  le suivi actif et l'abonnement push doivent disparaître avec le compte,
  sans mécanisme de nettoyage séparé à maintenir.

Le bouton "Suivre ce trajet" reste **visible** pour un visiteur non connecté
(pas masqué) : son clic renvoie vers `/connexion` plutôt que d'ouvrir le
flux d'abonnement — même traitement que les autres actions du produit qui
nécessitent un compte (raccourcis domicile/travail, historique).

## 4. Anti-spam sans delta chiffré

Remplace la règle "delta > 5 min" (section 3.5 du spec, inapplicable —
[#14](https://github.com/KerdanetYvan/urbanflow-mobility/issues/14) : le
flux réel n'expose aucun retard en minutes) par une comparaison de
**signature de la perturbation** : `kind + routeId + tripId + stopId +
headerText`. Une notification n'est renvoyée que si la perturbation
détectée a une signature différente de la dernière notifiée pour ce suivi —
une même perturbation qui persiste (même alerte, même arrêt sauté) ne
renotifie jamais deux fois ; une perturbation différente (nouvelle alerte,
nouvel arrêt sauté, la précédente s'étant résorbée) déclenche une nouvelle
notification.

## 5. Cycle de vie du suivi

- **Démarrage** : voir section 2.
- **Arrêt manuel** : bouton "Arrêter le suivi", à tout moment.
- **Expiration automatique** : à l'heure de fin de l'itinéraire suivi
  (`itinerary.endTime`, déjà connue au moment du démarrage du suivi) — pas
  de suivi qui continue indéfiniment après la fin théorique du trajet.
  Purge par un job quotidien, même mécanique que
  `TripHistoryService#handleDailyPurge` ([#11](https://github.com/KerdanetYvan/urbanflow-mobility/issues/11)).
- Un suivi actif n'empêche jamais une nouvelle recherche : lancer une
  nouvelle recherche pendant qu'un trajet est suivi ne l'arrête pas
  (l'utilisateur garde la liberté de consulter d'autres options sans perdre
  le fil de son trajet en cours) — seuls le bouton "Arrêter le suivi" ou
  l'expiration y mettent fin.

## 6. Contrat RGPD

`FollowedTrip` (nouvelle entité) : mêmes règles que `TripHistoryEntry` (voir
son commentaire de classe, `backend/src/trips/history/trip-history-entry.entity.ts`)
— coordonnées origine/destination et libellés chiffrés au repos
(`createEncryptedColumnTransformer`), `onDelete: CASCADE` sur la relation
`User`, timestamp de fin non chiffré (nécessaire pour filtrer/purger
directement en SQL). `PushSubscription` (endpoint + clés cryptographiques
du navigateur, standard Web Push) chiffrée de la même façon — un endpoint
push identifie un appareil de façon quasi unique, donnée personnelle au
même titre qu'une adresse IP.

## 7. Hors périmètre de #18 (rappel, déjà acté ailleurs)

- Retard chiffré en minutes dans la notification : nécessiterait
  `stop_times.txt` (voir [#14](https://github.com/KerdanetYvan/urbanflow-mobility/issues/14),
  non ingéré — portée de [#12](https://github.com/KerdanetYvan/urbanflow-mobility/issues/12)
  volontairement limitée à `stops.txt`).
- Multi-trajets suivis simultanément (section 2).
- Repli SMS/email si notification refusée et app fermée (section 3.4 du
  spec principal, déjà acté comme limite acceptée).

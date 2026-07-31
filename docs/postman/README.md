# Collection Postman — QA (issue #31)

`UrbanFlow-Mobility.postman_collection.json` couvre les endpoints de l'API backend, organisée par fonctionnalité (F1, F2, étendue au fil des sprints — voir aussi F3/scoring à venir).

## Utilisation

1. Lancer le backend (`docker compose up` ou `npm run start:dev` dans `backend/`).
2. Importer le fichier dans Postman (`File → Import`).
3. Vérifier/ajuster la variable de collection `baseUrl` (par défaut `http://localhost:3000`).
4. Lancer le dossier **Auth (F1)** en premier, dans l'ordre (requête par requête ou via le Runner) : "Inscription" génère un email unique à chaque exécution (`testEmail`, permet de relancer la collection sans collision "email déjà utilisé") et "Connexion" récupère les jetons, réutilisés automatiquement par les requêtes protégées suivantes (dossier "Profil de mobilité").
5. Les requêtes **Itinéraires (F2)** sont des endpoints publics (pas de jeton requis) et peuvent être lancées indépendamment. Elles utilisent les coordonnées du jeu de données de test (`routing-engine/test-fixtures/`, voir son README) — nécessite qu'OTP tourne avec ces fixtures chargées dans `routing-engine/data/`.

Chaque dossier `[Erreurs]` vérifie un cas limite (déjà couvert côté automatisé par les tests Jest — utile ici pour une vérification manuelle rapide sans relire le code).

## Vérifié avec Newman (CLI Postman)

```bash
npx newman run docs/postman/UrbanFlow-Mobility.postman_collection.json
```

16 requêtes, 24 assertions, 0 échec — vérifié à deux exécutions successives (reproductibilité de la génération d'email unique).

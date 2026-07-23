# Contribuer à UrbanFlow Mobility

Projet réalisé individuellement dans le cadre du Titre 6 Concepteur Développeur de Solutions Digitales (RNCP 36146). Les rôles (Product Owner, Dev Frontend, Dev Backend, QA) sont tous portés par la même personne, mais restent distingués dans les commits et les tickets pour clarifier sous quelle casquette une décision est prise.

## Méthodologie

Sprints de 2 semaines (Agile/Scrum), suivis sur le [GitHub Project](../../projects) associé à ce dépôt. Chaque sprint se termine par une revue fonctionnelle et une rétrospective, tracées dans les milestones et les issues fermées.

## Workflow Git

- `main` : branche protégée, toujours déployable. Merge uniquement via Pull Request.
- `feature/<sujet>` : nouvelle fonctionnalité (ex. `feature/trip-scoring`)
- `fix/<sujet>` : correction de bug (ex. `fix/gtfs-parsing`)
- `chore/<sujet>` : configuration, dépendances, CI

Chaque branche est liée à une issue du GitHub Project et fusionnée via Pull Request (voir le template de PR), même en solo — cela garde un historique clair et déclenche la CI avant tout merge sur `main`.

## Convention de commits

Ce projet suit les [Conventional Commits](https://www.conventionalcommits.org/) :

```text
<type>(<scope>): <description>

[corps optionnel]
```

Types utilisés : `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `ci`.

Exemples :

```text
feat(backend): ajoute le service de scoring d'itinéraires
fix(frontend): corrige l'affichage de la carte sur mobile
docs(claude): met à jour les conventions de nommage
```

## Avant d'ouvrir une Pull Request

1. Vérifier que les tests passent (`npm test` dans `frontend/` ou `backend/`)
2. Vérifier que le lint passe (`npm run lint`)
3. Vérifier que la CI GitHub Actions est verte
4. Renseigner le template de PR (ticket lié, checklist)

Une issue n'est réellement terminée que si elle satisfait la [Definition of Done](DEFINITION_OF_DONE.md).

## Conventions de code

Voir `CLAUDE.md` pour la stack technique, les conventions de nommage (endpoints, tables, composants) et les contraintes transverses (accessibilité, RGPD, sécurité OWASP, éco-conception) à respecter dans tout code ajouté.

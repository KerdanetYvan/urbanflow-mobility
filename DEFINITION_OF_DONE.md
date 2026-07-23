# Definition of Done

Une issue (user story, tâche technique, correction de bug) n'est considérée **terminée** que si tous les points pertinents ci-dessous sont satisfaits. Certains points ne s'appliquent pas à toutes les issues (ex. l'accessibilité ne concerne pas un ticket purement backend) — dans ce cas, ils sont simplement ignorés plutôt que cochés à tort.

## 1. Code

- [ ] Le code respecte les conventions de nommage et d'architecture du projet (`CLAUDE.md`).
- [ ] Le code a été relu avant merge — même en solo, la relecture du diff complet dans la Pull Request avant de merger (casquette QA relisant le travail de la casquette Dev) plutôt qu'un commit direct sur `main`.

## 2. Tests et CI

- [ ] Le lint passe (`npm run lint`, backend et/ou frontend selon ce qui a été modifié).
- [ ] Les tests unitaires pertinents passent (`npm test`) — écrits pour toute nouvelle logique métier non triviale.
- [ ] La CI GitHub Actions est verte sur la Pull Request avant le merge.

## 3. Contraintes transverses (si pertinentes à l'issue)

- [ ] **Accessibilité WCAG 2.1 AA** : rôles ARIA, contraste, navigation clavier sur tout nouveau composant d'interface.
- [ ] **Sécurité OWASP** : validation des entrées, pas de donnée sensible exposée, sur tout nouvel endpoint.
- [ ] **RGPD** : toute donnée de géolocalisation ou personnelle nouvellement stockée respecte la politique de rétention/chiffrement prévue.
- [ ] **Éco-conception** : pas d'appel réseau superflu ajouté sans raison.

## 4. Documentation

- [ ] Le `README.md` concerné (racine, `backend/`, `frontend/`, `routing-engine/`) est mis à jour si le comportement ou le démarrage du projet a changé.
- [ ] `CLAUDE.md` est mis à jour si une convention ou un choix d'architecture évolue.

## 5. Traçabilité

- [ ] La Pull Request référence l'issue (`Closes #N` si elle la termine complètement, `Refs #N` si elle n'avance que partiellement dessus).
- [ ] Le Status du GitHub Project reflète l'état réel (voir la section correspondante dans `CLAUDE.md`).

## 6. Déploiement (si applicable)

- [ ] Une fois le pipeline de déploiement en place (voir issue dédiée), tout changement mergé sur `main` doit pouvoir être redéployé sans intervention manuelle supplémentaire — la solution doit rester en ligne et à jour en continu, pas seulement au moment de la soutenance.

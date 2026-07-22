# Backend — API UrbanFlow Mobility

Stack retenue (voir `../CLAUDE.md`) : **NestJS** (Node.js / TypeScript).

À initialiser, par exemple :

```
npx @nestjs/cli new .
```

Conventions à respecter :

- Endpoints REST en **pluriel, kebab-case** (`GET /trips`, `POST /reservations`).
- Services suffixés par leur rôle (`TripService`, `ReservationService`).
- Le service de scoring (partie 7.3 du dossier) est un module dédié, interrogé après chaque appel à OpenTripPlanner — poids clairs et modifiables, pas de modèle opaque.
- Authentification JWT + refresh tokens, mots de passe hachés avec bcrypt (voir annexes C et D du dossier de certification).
- Respect OWASP Top 10 sur l'ensemble des endpoints exposés.

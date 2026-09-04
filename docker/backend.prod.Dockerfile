# Build multi-etapes : l'etape "builder" installe tout (y compris les
# devDependencies necessaires a la compilation TypeScript), l'etape finale
# ne garde que le code compile (dist/) et les dependances de production -
# image finale plus legere et sans outillage de dev inutile en production.

FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist

# Utilisateur non-root (audit securite OWASP #262, defense en profondeur) :
# l'image node:*-alpine officielle fournit deja un utilisateur "node"
# (uid/gid 1000), pas besoin d'en creer un. chown APRES les COPY ci-dessus
# (executes en root par defaut) plutot que --chown sur chaque COPY : une
# seule passe, plus simple a maintenir si d'autres COPY s'ajoutent.
RUN chown -R node:node /app
USER node

EXPOSE 3000

# Sonde de vie Docker (audit securite/fiabilite OWASP #262) : la route
# racine (AppController, "Hello World!") ne verifie rien en profondeur
# (pas de ping DB) mais suffit a detecter un processus Node plante/bloque -
# wget plutot que curl, seul disponible par defaut sur une image alpine.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["sh", "-c", "npm run migration:run:prod && node dist/main"]

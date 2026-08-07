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

EXPOSE 3000
CMD ["sh", "-c", "npm run migration:run:prod && node dist/main"]

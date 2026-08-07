# Dockerfile de développement pour l'API NestJS.

FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["sh", "-c", "npm run migration:run && npm run start:dev"]

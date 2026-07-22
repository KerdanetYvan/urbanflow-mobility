# Dockerfile de développement pour l'API NestJS.
# À ajuster une fois le projet initialisé : suppose un package.json avec un script "start:dev"
# (généré par `nest new .` ou équivalent).

FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "start:dev"]

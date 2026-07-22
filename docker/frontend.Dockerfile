# Dockerfile de développement pour la PWA React (Vite).
# À ajuster une fois le projet initialisé : suppose un package.json avec un script "dev"
# (généré par `npm create vite@latest .` ou équivalent).

FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]

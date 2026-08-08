FROM node:20-alpine AS builder

WORKDIR /app

# Copier les fichiers de dépendances
COPY package.json package-lock.json* ./
COPY apps/web/package.json ./apps/web/package.json

# Installer les dépendances
RUN npm ci || npm install

# Copier le code source complet
COPY . .

# Compiler le projet
RUN npm run build

# Image d'exécution légère
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY package.json package-lock.json* ./
COPY apps/web/package.json ./apps/web/package.json

RUN npm ci --only=production || npm install --only=production

COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps ./apps
COPY --from=builder /app/infra ./infra

EXPOSE 3001

CMD ["npx", "tsx", "apps/api/src/server.ts"]

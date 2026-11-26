# syntax=docker/dockerfile:1.7

# ─── Stage 1: builder ────────────────────────────────────────────────
# Compile le TypeScript avec toutes les devDependencies
FROM node:22-alpine AS builder
WORKDIR /app

# Installer les dépendances (couche cacheable tant que package.json ne change pas)
COPY package.json package-lock.json* ./
RUN npm ci

# Copier le code et compiler
COPY tsconfig*.json ./
COPY src ./src
RUN npm run build

# Nettoyer les devDependencies pour la couche prod
RUN npm prune --omit=dev


# ─── Stage 2: runtime ────────────────────────────────────────────────
# Image minimale, non-root, pas de npm/tsc
FROM node:22-alpine AS runtime
WORKDIR /app

# tini comme PID 1 pour forwarder SIGTERM proprement (shutdown gracieux NestJS)
RUN apk add --no-cache tini

# Copie des artefacts build + node_modules prod
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

# Utilisateur non-root (durcissement VPS-SOS)
RUN addgroup -S hp && adduser -S hp -G hp && chown -R hp:hp /app
USER hp

# NestJS écoute PORT ou 4000 par défaut
EXPOSE 4000

# Healthcheck via l'endpoint root de l'API (NestJS répond 404 sans auth, pas 5xx)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O- http://127.0.0.1:${PORT:-4000}/api/health 2>/dev/null \
      || wget -q --spider http://127.0.0.1:${PORT:-4000}/api 2>/dev/null \
      || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]

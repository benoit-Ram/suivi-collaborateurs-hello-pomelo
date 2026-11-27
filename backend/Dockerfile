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

# Upgrade des paquets Alpine (CVE fixes) + tini comme PID 1 pour forwarder SIGTERM
RUN apk upgrade --no-cache && apk add --no-cache tini

# Copie des artefacts build + node_modules prod
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

# Utilisateur non-root (durcissement VPS-SOS)
RUN addgroup -S hp && adduser -S hp -G hp && chown -R hp:hp /app
USER hp

# NestJS écoute PORT ou 4000 par défaut
EXPOSE 4000

# Healthcheck via l'endpoint /api/health (exposé par HealthModule, public).
# On utilise `node -e` plutôt que wget/curl pour ne pas dépendre de leur présence
# dans l'image alpine. Code 200 attendu quand le pool pg répond ; sinon exit 1.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+ (process.env.PORT||4000) +'/api/health').then(r=>{if(r.status!==200)process.exit(1)}).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]

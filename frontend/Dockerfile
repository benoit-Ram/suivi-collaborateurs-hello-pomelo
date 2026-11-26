# syntax=docker/dockerfile:1.7

# ─── Stage 1: builder ────────────────────────────────────────────────
# Compile le bundle Vite production
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# Config Vite + code
COPY vite.config.js index.html ./
COPY src ./src
COPY public ./public

# Build prod — vite build produit dist/ (static)
RUN npm run build


# ─── Stage 2: runtime ────────────────────────────────────────────────
# nginx:alpine pour servir le bundle static + SPA fallback
FROM nginx:1.29-alpine AS runtime

# Config nginx minimale : SPA routing + headers sécurité + health
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copier le bundle construit
COPY --from=builder /app/dist /usr/share/nginx/html

# nginx écoute sur 80 dans le container (Traefik route dessus)
EXPOSE 80

# Healthcheck sur un path servi statiquement
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:80/ || exit 1

# nginx démarre en PID 1 — pas besoin de tini
CMD ["nginx", "-g", "daemon off;"]

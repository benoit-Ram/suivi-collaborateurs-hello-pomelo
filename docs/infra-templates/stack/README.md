# suivi-collaborateurs-stack

Repo qui contient le `docker-compose.yml` lancé sur chaque droplet applicatif
(preprod et prod), ainsi que la config Traefik + cloudflared + agent Alloy.

## Ce qui tourne sur le droplet

```
[Cloudflare Zero Trust tunnel]
            │
            ▼
   ┌──────────────────┐
   │   cloudflared    │  (container, sortant uniquement)
   └─────┬────────────┘
         │
         ▼ (loopback via Docker network)
   ┌──────────────────┐
   │    traefik:v3    │  reverse proxy, routing par Host header
   └──┬────────┬──────┘
      │        │
      ▼        ▼
  frontend  backend    (containers applicatifs, images registry)
      │        │
      │        ▼
      │    managed-pg (external, VPC privé DO)
      │
      ▼
  agent Alloy → hub Grafana/Loki/Mimir Hello Pomelo
```

Un réseau Docker par environnement. Preprod et prod n'ont jamais aucun
container en commun.

## Secrets (jamais dans le repo)

Tous les secrets sont dans **Infisical**, dossier `/app/<env>` :
- `DATABASE_URL` (écrit par le repo infra via Terraform)
- `GOOGLE_CLIENT_ID` (public mais dans Infisical pour cohérence)
- `JWT_SECRET`
- `GOOGLE_SERVICE_ACCOUNT_KEY` (JSON)
- `CLOUDFLARED_TOKEN` (par env, fourni par le devops)

La CI stack utilise `infisical run` pour injecter les secrets dans
l'environnement avant de lancer `docker compose up`, pas de `.env` sur
le serveur (VPS-SEC02).

## Convention

- Un Compose par env : `docker-compose.preprod.yml` et `docker-compose.prod.yml`
  (avec un `docker-compose.base.yml` en override + Makefile)
- Images taguées par SHA court ou numéro de build, jamais `latest` (VPS-DEP06)
- Trivy scan avant `docker push` (dans le workflow du repo applicatif)

## Structure

```
.
├── docker-compose.base.yml          # services communs
├── docker-compose.preprod.yml       # overrides preprod
├── docker-compose.prod.yml          # overrides prod
├── traefik/
│   ├── traefik.yml                  # config statique (entrypoints, providers)
│   └── dynamic/
│       └── middlewares.yml          # middlewares (compression, headers, rate-limit)
├── alloy/
│   └── config.alloy                 # config agent observabilité
├── scripts/
│   ├── deploy.sh                    # appelé par la CI après pull image
│   └── rollback.sh
└── .github/
    └── workflows/
        └── deploy.yml               # build → pull image → compose up
```

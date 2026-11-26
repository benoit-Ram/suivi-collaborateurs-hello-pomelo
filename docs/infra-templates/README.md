# Templates infra pour suivi-collaborateurs

Préparé pendant que tu déjeunais, à review à ton retour. **Rien n'a été
poussé sur GitHub** — tout est local, prêt à migrer dans les 3 repos
quand on sera aligné sur la structure.

## Structure

```
infra-templates/
├── CHECKLIST_DEVOPS.md            ← À envoyer au devops d'Augustin en priorité.
│                                    Liste tout ce qu'il doit nous provisionner
│                                    (Infisical, DO, Cloudflare, Netbox, opkssh,
│                                    playbooks Ansible, Uptime Kuma).
│
├── infra/                         ← Futur repo `suivi-collaborateurs-infra`
│   ├── README.md
│   ├── providers.tf
│   ├── variables.tf
│   ├── main.tf                    + locals + rattachement projet DO
│   ├── droplet.tf                 + cloud-init bootstrap
│   ├── database.tf                Managed PG avec prevent_destroy sur prod
│   ├── network.tf                 VPC + firewall (tout fermé, cloudflared sortant)
│   ├── dns.tf                     CNAME Cloudflare vers tunnel
│   ├── backend.tf                 state sur DO Spaces (S3 API)
│   └── cloud-init.yml.tpl         hardening + Docker + user deploy
│
├── stack/                         ← Futur repo `suivi-collaborateurs-stack`
│   ├── README.md
│   ├── docker-compose.base.yml    cloudflared + traefik + backend + frontend + alloy
│   ├── docker-compose.preprod.yml
│   ├── docker-compose.prod.yml
│   ├── traefik/
│   │   ├── traefik.yml            config statique
│   │   └── dynamic/
│   │       └── middlewares.yml    CSP, HSTS, rate-limit
│   └── alloy/
│       └── config.alloy           host + Docker + journal → Loki/Mimir Hello Pomelo
│
├── .github-workflows/             ← À répartir dans les .github/workflows/ des 3 repos
│   ├── infra-plan.yml             plan sur PR, commente le plan dans la PR
│   ├── infra-apply.yml            apply preprod → gate manuel prod
│   ├── app-build.yml              build + Trivy scan + push + dispatch stack
│   └── stack-deploy.yml           opkssh SSH + compose up + smoke test
│
└── migration/
    └── migrate-data.sh            pg_dump Supabase → pg_restore DO Postgres
```

## Suite logique du projet

1. **Envoyer `CHECKLIST_DEVOPS.md` au devops d'Augustin** — débloque tout le reste
2. **Pendant qu'il provisionne** : nettoyer et pusher la PR #67 (migration Kysely + Docker)
3. **Créer les 3 repos** (`suivi-collaborateurs-infra`, `-app` renommage, `-stack`) sur `benoit-Ram`
4. **Pousser ces templates** dans les repos correspondants
5. **1er `terraform apply` preprod** → droplet + DB + DNS câblés
6. **Ansible playbook** post-bootstrap (opkssh + Wazuh + Alloy)
7. **1er `docker compose up` sur preprod** via le repo stack
8. **Migrer les data** (script `migrate-data.sh`)
9. **Smoke test fonctionnel preprod** avec les 60 collabs
10. **Gate manuel → prod**
11. **Repointer DNS `rh.pomelo-dev.fr`** et go live 120 users

## Ce qui reste dans le repo actuel (applicatif) après rename

- `backend/` (code NestJS + Kysely + Dockerfile)
- `frontend/` (code Vite + Dockerfile + nginx.conf)
- `docker-compose.yml` → **à supprimer** ou renommer en `docker-compose.dev.yml`
  (le compose prod vit maintenant dans le repo stack)
- `.github/workflows/build.yml` (mis à jour selon `.github-workflows/app-build.yml`)
- La PR #67 (migration Supabase → Kysely + Docker) à mergeer d'abord

## Points qui demandent décision avec le devops

- **Registry** : DO (`registry.digitalocean.com/...`) ou OVHcloud Managed Private Registry ? Le standard Notion dit OVH mais Augustin a dirigé Benoit vers DO. À confirmer.
- **Infisical self-hosted ou cloud** : URL dans providers.tf à ajuster
- **Playbook Ansible** : fourni par Palett ou à construire
- **Backup Managed DB** : DO fournit 7j auto, prévoir aussi un dump quotidien vers Spaces pour la rétention plus longue
- **Convention noms Netbox** : format à valider

# suivi-collaborateurs-infra

Repo Terraform de l'app RH interne Hello Pomelo.

## Ce qu'il provisionne

Par environnement (`preprod`, `prod`) :

- Droplet Digital Ocean (Ubuntu 24.04 LTS, 1 vCPU / 1 GB RAM, FRA1)
- Managed PostgreSQL DO (déjà créée pour prod : `hp-suivi-collaborateurs-db`)
- VPC dédié
- Firewall DO (SSH restreint + 80/443 bloqués par défaut — tout passe par Cloudflare Tunnel)
- Entrée DNS Cloudflare (CNAME tunnel)
- Projet DO assignment (ressources taguées sous le projet "Suivi Collaborateurs")
- Machine identity Infisical OIDC pour le futur stack-CI

## Secrets

Backend state Terraform : bucket DO Spaces `hp-tf-state-suivi-collaborateurs`
(credentials dans Infisical `/bootstrap`, lus par la CI uniquement).

Rien dans le code, rien dans les Terraform outputs sensibles (marqués
`sensitive = true` et envoyés vers Infisical via le provider Infisical).

## CI/CD

- `terraform plan` sur chaque PR (workflow `plan.yml`)
- `terraform apply` sur merge dans `main` (workflow `apply.yml`)
- Auth OIDC Infisical → récupère `DO_API_TOKEN`, `DO_SPACES_*`, `CLOUDFLARE_API_TOKEN`

## Structure

```
.
├── main.tf                 # providers + locals
├── variables.tf            # env, région, SSH keys, tailles
├── outputs.tf              # ip droplet, db connection string → vers Infisical
├── droplet.tf              # droplet + cloud-init bootstrap
├── database.tf             # managed PG (import de l'existant pour prod)
├── network.tf              # VPC + firewall
├── dns.tf                  # CNAME Cloudflare
├── infisical.tf            # machine identity stack-CI
├── providers.tf            # digitalocean, cloudflare, infisical
├── backend.tf              # S3 backend sur DO Spaces
├── terraform.tfvars        # NON COMMITÉ (vars sensibles) — exemple dans tfvars.example
└── environments/
    ├── preprod.tfvars
    └── prod.tfvars
```

Chaque PR = plan sur preprod ET prod (2 workspaces distincts).

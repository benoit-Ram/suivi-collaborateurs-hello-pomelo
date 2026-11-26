# Managed PostgreSQL DO.
# Pour PROD : la DB `hp-suivi-collaborateurs-db` existe déjà (créée à la main
#             dans cette session). On l'importe plutôt que de la recréer :
#               terraform import digitalocean_database_cluster.pg <uuid>
# Pour PREPROD : nouvelle instance, name suffixé par env.

resource "digitalocean_database_cluster" "pg" {
  name       = "${local.project_slug}-db"
  engine     = "pg"
  version    = "17"
  size       = var.database_cluster_slug # db-s-1vcpu-1gb = $15/mo
  region     = var.region
  node_count = 1
  private_network_uuid = digitalocean_vpc.main.id
  tags       = local.tags

  maintenance_window {
    day  = "sunday"
    hour = "03:00:00" # heure UTC = 04:00 Paris été, 04:00 Paris hiver
  }

  lifecycle {
    # Ne pas détruire la DB prod par accident (il faudra un terraform destroy
    # explicite + confirmation).
    prevent_destroy = true
  }
}

# Base applicative + user dédié (pas le `doadmin` par défaut)
resource "digitalocean_database_db" "app" {
  cluster_id = digitalocean_database_cluster.pg.id
  name       = "suivi_collaborateurs"
}

resource "digitalocean_database_user" "app" {
  cluster_id = digitalocean_database_cluster.pg.id
  name       = "hp_app"
}

# Seul le droplet applicatif accède à la DB (trusted sources = IP privée)
resource "digitalocean_database_firewall" "pg" {
  cluster_id = digitalocean_database_cluster.pg.id
  rule {
    type  = "droplet"
    value = digitalocean_droplet.app.id
  }
}

# Connection string poussée dans Infisical pour que le repo stack la récupère
# au deploy sans jamais passer par GitHub secrets ou un .env.
resource "infisical_secret" "database_url" {
  name         = "DATABASE_URL"
  env_slug     = var.environment
  workspace_id = var.infisical_workspace_id
  folder_path  = "/app"
  value        = "postgres://${digitalocean_database_user.app.name}:${digitalocean_database_user.app.password}@${digitalocean_database_cluster.pg.private_host}:${digitalocean_database_cluster.pg.port}/${digitalocean_database_db.app.name}?sslmode=require"
}

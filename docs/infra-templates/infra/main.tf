locals {
  project_slug = "hp-suivi-collaborateurs-${var.environment}"
  tags = [
    "project:suivi-collaborateurs",
    "env:${var.environment}",
    "managed:terraform",
  ]
}

# Résolution des SSH keys (noms → ids) à partir des clés team Palett
data "digitalocean_ssh_keys" "team" {
  filter {
    key    = "name"
    values = var.ssh_authorized_keys
  }
}

# Projet DO qui regroupe droplet + DB + domaine
data "digitalocean_project" "suivi" {
  name = var.do_project_name
}

# VPC privé dédié à ce projet+env (isolation réseau réciproque preprod/prod)
resource "digitalocean_vpc" "main" {
  name     = "${local.project_slug}-vpc"
  region   = var.region
  ip_range = var.environment == "prod" ? "10.20.0.0/24" : "10.21.0.0/24"
}

# Assignment : ratttache toutes les ressources créées ici au projet DO
resource "digitalocean_project_resources" "assign" {
  project = data.digitalocean_project.suivi.id
  resources = concat(
    [digitalocean_droplet.app.urn],
    # Managed DB rattachée aussi (recréée ou importée selon database.tf)
    try([digitalocean_database_cluster.pg.urn], []),
  )
}

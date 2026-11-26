variable "environment" {
  description = "Nom de l'environnement (preprod | prod)."
  type        = string
  validation {
    condition     = contains(["preprod", "prod"], var.environment)
    error_message = "environment doit être \"preprod\" ou \"prod\"."
  }
}

variable "region" {
  description = "Région DO pour le droplet et la DB."
  type        = string
  default     = "fra1"
}

variable "droplet_size" {
  description = "Taille du droplet (slug DO)."
  type        = string
  default     = "s-1vcpu-1gb" # $6/mo, upsize facile si saturation
}

variable "do_project_name" {
  description = "Nom du projet DO qui regroupe les ressources."
  type        = string
  default     = "Suivi Collaborateurs"
}

variable "database_cluster_slug" {
  description = "Slug cluster DO pour la Managed DB (null = utiliser l'existante)."
  type        = string
  default     = "db-s-1vcpu-1gb"
}

variable "ssh_authorized_keys" {
  description = "Noms des SSH keys DO team Palett autorisées à root@droplet au bootstrap. opkssh prend le relais ensuite."
  type        = list(string)
  default     = ["Benoit — Suivi Collaborateurs"]
}

variable "domain_root" {
  description = "Zone Cloudflare racine qui contient rh.pomelo-dev.fr."
  type        = string
  default     = "pomelo-dev.fr"
}

variable "cloudflared_tunnel_id" {
  description = "ID du tunnel Cloudflare Zero Trust pour cet env (préalablement créé par le devops)."
  type        = string
}

# Credentials (récupérées en OIDC depuis Infisical au runtime CI, jamais en dur)
variable "do_api_token"            { type = string; sensitive = true }
variable "cloudflare_api_token"    { type = string; sensitive = true }
variable "infisical_client_id"     { type = string; sensitive = true }
variable "infisical_client_secret" { type = string; sensitive = true }

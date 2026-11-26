terraform {
  required_version = ">= 1.9"
  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.52"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.49"
    }
    infisical = {
      source  = "infisical/infisical"
      version = "~> 0.15"
    }
  }
}

provider "digitalocean" {
  # DO_API_TOKEN récupéré en OIDC depuis Infisical /bootstrap
  token = var.do_api_token
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

provider "infisical" {
  host = "https://app.infisical.com" # ou l'URL auto-hébergée Hello Pomelo
  auth = {
    universal = {
      client_id     = var.infisical_client_id
      client_secret = var.infisical_client_secret
    }
  }
}

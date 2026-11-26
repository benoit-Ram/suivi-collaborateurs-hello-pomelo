# DNS Cloudflare : CNAME vers le tunnel cloudflared de cet env.
# Le tunnel a été créé manuellement par le devops et son ID est passé en var.

data "cloudflare_zone" "root" {
  name = var.domain_root
}

locals {
  hostname = var.environment == "prod" ? "rh" : "preprod.rh"
}

resource "cloudflare_record" "app" {
  zone_id = data.cloudflare_zone.root.id
  name    = local.hostname
  type    = "CNAME"
  value   = "${var.cloudflared_tunnel_id}.cfargotunnel.com"
  proxied = true
  ttl     = 1 # Auto, obligatoire quand proxied=true
  comment = "Managed by Terraform — suivi-collaborateurs ${var.environment}"
}

output "public_url" {
  value = "https://${local.hostname}.${var.domain_root}"
}

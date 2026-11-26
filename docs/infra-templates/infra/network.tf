# Firewall DO : bloque TOUT en entrée sauf l'IPv4/6 de Cloudflare (pour le tunnel
# cloudflared qui tourne sur le droplet et qui se connecte à Cloudflare en
# sortie). En vrai, le tunnel sortant n'a besoin d'aucun port entrant — on
# autorise juste SSH restreint depuis quelques /32 pour urgence.

resource "digitalocean_firewall" "app" {
  name        = "${local.project_slug}-fw"
  droplet_ids = [digitalocean_droplet.app.id]

  # SSH : limité aux IPs devops (à mettre à jour selon la team)
  # En temps normal, l'accès SSH passe par opkssh via jeton OIDC donc on
  # peut même ne rien exposer en 22. À choisir.
  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = var.ssh_allowed_cidrs
  }

  # Pas de 80/443 inbound : le tunnel Cloudflare Zero Trust fait tout en
  # sortant depuis le container cloudflared.

  # Tout outbound ouvert (le droplet a besoin de pull docker images, registry,
  # Infisical, Cloudflare, Alloy hub, Wazuh manager, etc.)
  outbound_rule {
    protocol              = "tcp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
  outbound_rule {
    protocol              = "udp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
  outbound_rule {
    protocol              = "icmp"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}

variable "ssh_allowed_cidrs" {
  description = "CIDRs autorisés en SSH (urgence / debug). Mettre à [] pour fermer complètement et ne passer que par opkssh."
  type        = list(string)
  default     = []
}

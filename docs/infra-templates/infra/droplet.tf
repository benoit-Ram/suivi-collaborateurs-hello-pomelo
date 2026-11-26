# Droplet applicatif : exécute Docker Compose (repo stack).
# Cloud-init bootstrap : docker + opkssh + Wazuh agent + Alloy agent, puis le
# repo stack prendra la main pour pull les containers et les lancer.

resource "digitalocean_droplet" "app" {
  name       = local.project_slug
  image      = "ubuntu-24-04-x64"
  region     = var.region
  size       = var.droplet_size
  vpc_uuid   = digitalocean_vpc.main.id
  ssh_keys   = data.digitalocean_ssh_keys.team.ssh_keys[*].id
  monitoring = true
  tags       = local.tags

  user_data = templatefile("${path.module}/cloud-init.yml.tpl", {
    environment        = var.environment
    cloudflared_tunnel = var.cloudflared_tunnel_id
    wazuh_manager      = var.wazuh_manager_url
    alloy_hub          = var.alloy_hub_url
  })

  lifecycle {
    # Ne pas recréer sur simple changement d'image ou d'user_data (ansible
    # post-provisioning gère les updates runtime).
    ignore_changes = [image, user_data]
  }
}

# IP publique du droplet (utile pour SSH debug + health check externe)
output "droplet_ipv4" {
  value = digitalocean_droplet.app.ipv4_address
}

output "droplet_ipv4_private" {
  value = digitalocean_droplet.app.ipv4_address_private
}

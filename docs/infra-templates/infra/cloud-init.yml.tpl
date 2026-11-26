#cloud-config
# Bootstrap minimal du droplet. Installe Docker + Compose + outils de base.
# Le vrai setup (opkssh, Wazuh, Alloy agents) est fait ensuite par Ansible
# via un playbook commun Palett que le devops nous donnera.

package_update: true
package_upgrade: true

packages:
  - ca-certificates
  - curl
  - gnupg
  - lsb-release
  - unattended-upgrades     # VPS-SOS02 : security updates auto
  - fail2ban                # VPS-PPL06 : blocage tentatives SSH
  - jq
  - ufw

write_files:
  # Marqueur d'environnement — utile pour les scripts du repo stack
  - path: /etc/hp-environment
    content: |
      HP_ENV=${environment}
      HP_PROJECT=suivi-collaborateurs
    permissions: "0644"

  # Désactiver l'auth par password (VPS-PPL02)
  - path: /etc/ssh/sshd_config.d/99-hp-hardening.conf
    content: |
      PasswordAuthentication no
      KbdInteractiveAuthentication no
      PermitRootLogin prohibit-password
    permissions: "0644"

runcmd:
  # Reload sshd avec la config hardening
  - systemctl reload ssh

  # Install Docker Engine depuis les repos officiels
  - install -m 0755 -d /etc/apt/keyrings
  - curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  - chmod a+r /etc/apt/keyrings/docker.asc
  - echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list
  - apt-get update
  - apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

  # User `deploy` non-root utilisé par opkssh + le repo stack
  - useradd -m -s /bin/bash -G docker deploy
  - passwd -l deploy  # mot de passe verrouillé (VPS-IAM04)

  # Tag l'étape "bootstrap ok" pour qu'Ansible puisse chaîner proprement
  - touch /var/lib/hp-bootstrap-done

final_message: "HP droplet ${environment} bootstrap done. Ansible playbook à lancer depuis la CI stack pour opkssh + Wazuh + Alloy."

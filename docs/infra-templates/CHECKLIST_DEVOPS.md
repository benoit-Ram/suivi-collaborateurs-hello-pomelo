# Onboarding devops — projet "suivi-collaborateurs"

Checklist à envoyer au devops dédié par Augustin (team Palett). Tout est
prérequis pour appliquer le standard VPS Hello Pomelo (Notion /VPS) sur
une app RH interne 120 users.

## Contexte

- Repo applicatif existant : `github.com/benoit-Ram/suivi-collaborateurs-hello-pomelo`
  (PR #67 ouverte avec migration Supabase → Kysely + Dockerfiles)
- Hébergeur : **Digital Ocean**, team Palett (DO project `Suivi Collaborateurs` créé)
- Managed PostgreSQL DO `hp-suivi-collaborateurs-db` déjà créée ($15.15/mo, FRA1)
- Domaine cible : `rh.pomelo-dev.fr` (DNS actuellement pointé sur ancien VPS OVH, à repointer)

## Ce qu'il me faut

### 1. GitHub

- [ ] Ajouter `benoit-Ram` (Benoit) à l'org GitHub **`Hello-Pomelo`** avec droits lecture sur :
  - repo `template-projet-infra` (ou équivalent)
  - repo `template-projet-stack` (ou équivalent)
  - 1 projet exemple (CAR Avenue ou RAGT, pour copier la structure)
- [ ] Me dire si les 3 repos du projet doivent vivre sur `benoit-Ram` ou sur l'org `Hello-Pomelo` (standard dit template, mais Benoit m'a dit sur son perso — à trancher)

### 2. Infisical

- [ ] Créer un **projet Infisical** "suivi-collaborateurs" avec 2 environnements : `preprod` et `prod`
- [ ] Créer 2 **sub-projets** par convention :
  - `suivi-collaborateurs-infra-secrets` (dossiers `/bootstrap`, `/registry`, `/deploy/vps`)
  - `suivi-collaborateurs-app-vars` (variables applicatives : `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `JWT_SECRET`, `GOOGLE_*`, etc.)
- [ ] Créer 3 **machine identities** OIDC :
  - `infra-ci` → sujet OIDC `repo:benoit-Ram/suivi-collaborateurs-infra:*`, accès lecture `/bootstrap` + écriture sur `/registry` et `/deploy/vps`
  - `app-ci` → sujet OIDC `repo:benoit-Ram/suivi-collaborateurs-app:*`, lecture `/registry/push`
  - `stack-ci` → sujet OIDC `repo:benoit-Ram/suivi-collaborateurs-stack:*`, lecture `/registry/pull`, `/deploy/vps`, et `suivi-collaborateurs-app-vars`
- [ ] Remplir `/bootstrap` avec :
  - `DO_API_TOKEN` (token Digital Ocean team Palett, scope Write)
  - `DO_SPACES_ACCESS_KEY` + `DO_SPACES_SECRET_KEY` (pour le bucket Terraform state)
  - `OVH_*` si on fait aussi la registry OVHcloud

### 3. Digital Ocean

- [ ] Créer un **bucket DO Spaces** `hp-tf-state-suivi-collaborateurs` (région FRA1, privé) pour le state Terraform — credentials dans Infisical `/bootstrap`
- [ ] Créer un **container registry DO** `registry.digitalocean.com/hp-suivi-collaborateurs` avec 2 robots : `push` et `pull` (ou utiliser OVHcloud Managed Private Registry si c'est ce qui est utilisé pour les autres projets Palett)
- [ ] Confirmer que la Managed DB `hp-suivi-collaborateurs-db` déjà créée doit être conservée, ou que Terraform doit la recréer (si elle doit être taguée projet "Suivi Collaborateurs" et pas "Palett")

### 4. Cloudflare Zero Trust

- [ ] Créer **2 tunnels** nommés :
  - `suivi-collaborateurs-preprod` → cible `preprod.rh.pomelo-dev.fr`
  - `suivi-collaborateurs-prod` → cible `rh.pomelo-dev.fr`
- [ ] Me transmettre les tokens tunnel (à stocker dans Infisical `suivi-collaborateurs-app-vars/preprod/CLOUDFLARED_TOKEN` et idem prod)
- [ ] Configurer les routes publiques : `rh.pomelo-dev.fr` → container frontend du droplet, port 80

### 5. DNS (OVH)

- [ ] Attendre la création des tunnels Cloudflare puis créer 2 CNAME :
  - `preprod.rh.pomelo-dev.fr` CNAME `<tunnel-id>.cfargotunnel.com`
  - `rh.pomelo-dev.fr` CNAME `<tunnel-id>.cfargotunnel.com`
- [ ] Désactiver l'ancien enregistrement A pointant vers `141.94.92.9` (VPS OVH repris par TMA ELE Dev)

### 6. Netbox

- [ ] Créer 2 VMs dans Netbox :
  - `hp-suivi-collaborateurs-preprod` (client: Hello Pomelo interne, environnement: preprod, hébergeur: DO)
  - `hp-suivi-collaborateurs-prod` (client: Hello Pomelo interne, environnement: prod, hébergeur: DO)
- [ ] Confirmer la convention de nommage (format `hp-<projet>-<env>` OK ?)

### 7. opkssh

- [ ] Configurer l'autorisation OIDC pour que le repo `benoit-Ram/suivi-collaborateurs-stack` puisse SSH en tant qu'utilisateur `deploy` sur les 2 droplets
- [ ] Me transmettre la config exacte à mettre dans `/etc/opk/auth_id`

### 8. Observabilité

- [ ] Ajouter 2 sondes **Uptime Kuma** sur `https://preprod.rh.pomelo-dev.fr/api/health` et `https://rh.pomelo-dev.fr/api/health` (endpoint livré dans la PR #67)
- [ ] Me transmettre l'URL d'écriture **Loki** et **Mimir** pour la config Alloy, avec les credentials à mettre dans Infisical
- [ ] Me transmettre la config **Wazuh** (manager URL + enrolment password) à injecter dans le playbook Ansible
- [ ] Vérifier que les alertes Grafana sont routées vers une liste de diffusion / Slack pour ce projet

### 9. Ansible

- [ ] Me donner accès au repo des **playbooks Ansible** communs (OS hardening + Docker + opkssh + Wazuh agent + Alloy agent) — a priori dans l'org `Hello-Pomelo`
- [ ] Confirmer si Ansible est lancé par Terraform (cloud-init) ou en post-provisioning dédié

## Ce que je fournis de mon côté

- ✅ PR #67 : refonte Supabase → Kysely + Dockerfiles backend/frontend + compose dev local
- ✅ Endpoint `/api/health` public pour sondes externes
- ✅ 60 collabs importés dans Supabase cloud (à migrer vers DO Postgres) — dump JSON dispo
- ✅ Squelettes Terraform / stack / workflows prêts dans scratchpad local (à review avant push)
- ✅ Script `migrate-data.sh` : dump Supabase + restore DO Postgres via `pg_dump`/`pg_restore`

## Deadline soft

Launch 120 users RH était prévu "en cours" en mai 2026. Décalé par :
- VPS OVH repris par TMA ELE Dev
- Refonte Kysely nécessaire pour pointer sur Managed DB
- Adoption du standard VPS Hello Pomelo

Reprise cible : dès que les items ci-dessus sont fournis, compter ~1 jour pour câbler + tester preprod, puis go live prod.

# Intégration Google — guide de configuration

L'app RH sait envoyer des mails Gmail et écrire des events Google Calendar pour
le compte de chaque collaborateur, via un **service account GCP avec délégation
à l'échelle du domaine** (Domain-Wide Delegation). Côté code, tout est déjà en
place dans `backend/src/modules/google-integration/` mais reste **inactif tant
que les variables d'environnement ne sont pas renseignées**.

## Étapes — à faire une seule fois

### 1. Créer un projet GCP (ou réutiliser celui du Google Sign-In)

Le même projet que celui utilisé pour `GOOGLE_CLIENT_ID` convient.

### 2. Activer les APIs nécessaires

Dans la console GCP → **APIs & Services → Library**, activer :
- Gmail API
- Google Calendar API
- Google Drive API (facultatif — pour l'archive PDF)
- Admin SDK API (facultatif — pour le provisioning auto)

### 3. Créer un service account

**IAM & Admin → Service Accounts → Create Service Account** :
- Nom : `hp-rh-integration`
- ID : `hp-rh-integration@<project>.iam.gserviceaccount.com`
- Rôles : aucun GCP role nécessaire (pas d'accès à des ressources GCP)
- **Create key** → type JSON → téléchargez le fichier (ne le versionnez JAMAIS)

Notez le **Unique ID** numérique du service account — il servira à la délégation.

### 4. Activer la délégation à l'échelle du domaine

Sur la page du service account, cocher **"Enable Google Workspace Domain-wide
Delegation"** (dans "Details" ou "Advanced settings" selon l'UI).

### 5. Déléguer les scopes depuis Google Workspace Admin

Super-admin du Workspace Hello Pomelo → [admin.google.com](https://admin.google.com) → **Security → Access and data control → API controls → Domain-wide delegation → Add new**.

- **Client ID** : le Unique ID numérique du service account
- **OAuth scopes** (virgule) :
  ```
  https://www.googleapis.com/auth/gmail.send,https://www.googleapis.com/auth/calendar.events
  ```
  (ajouter `drive.file` et `admin.directory.user.readonly` plus tard pour les
  phases 4 et 5).

**⚠️ Attention** : ce paramétrage permet au service account d'agir pour
n'importe quel utilisateur `@hello-pomelo.com`. Scopes à minimiser.

### 6. Renseigner les variables d'environnement

Dans `backend/.env` sur le VPS (`/home/ubuntu/suivi-collaborateurs-hello-pomelo/backend/.env`) :

```
# Identité du service account — depuis le JSON téléchargé
GOOGLE_SA_EMAIL=hp-rh-integration@<project>.iam.gserviceaccount.com
GOOGLE_SA_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Compte impersonné par défaut pour les envois "système" (from)
GOOGLE_IMPERSONATE_DEFAULT=noreply@hello-pomelo.com
GOOGLE_MAIL_FROM=noreply@hello-pomelo.com

# Activation des features (toutes OFF par défaut)
GOOGLE_MAIL_ENABLED=true
GOOGLE_CALENDAR_ENABLED=true
```

> **Private key** : dans le JSON, la valeur `private_key` contient des
> `\n` littéraux qu'il faut **conserver tels quels** (avec les guillemets autour
> de la valeur). Le code les convertit automatiquement en vrais retours ligne.

Puis `sudo systemctl restart hp-backend` (ou redeploy via `git push`).

### 7. Tester

Depuis l'app :
- Créer une demande de congé en tant que collab → le manager doit recevoir un mail.
- Approuver la demande en tant que manager/admin → le collab reçoit un mail ET un event apparaît dans son Google Calendar.
- Refuser → mail de refus, pas d'event.
- Si la demande avait été approuvée puis annulée → l'event du Calendar est supprimé.

Logs côté backend (journalctl ou logs PM2) :
- `MailerService` : `Mail sent to …` ou `Mail send failed for …`
- `CalendarService` : `Calendar event created/updated for …`

## Matrice des features

| Feature | Module | Flag env | Status |
|---|---|---|---|
| Mail sur création demande congé (manager) | `notifications.onAbsencePending` | `GOOGLE_MAIL_ENABLED` | ✅ Phase 0 |
| Mail sur approbation/refus congé (collab) | `notifications.onAbsenceApproved/Refused` | `GOOGLE_MAIL_ENABLED` | ✅ Phase 0 |
| Sync congé → Google Calendar collab | `CalendarService.upsertAbsenceEvent` | `GOOGLE_CALENDAR_ENABLED` | ✅ Phase 0 |
| Notification staffing (assignment créé) | TODO | `GOOGLE_MAIL_ENABLED` | ⏳ Phase 1 |
| Rappel entretien J-5 (mail + event) | TODO | `GOOGLE_MAIL_ENABLED` | ⏳ Phase 1 |
| Digest manager hebdo | TODO | `GOOGLE_MAIL_ENABLED` | ⏳ Phase 2 |
| Archive PDF entretiens → Drive | TODO | `GOOGLE_DRIVE_ENABLED` | ⏳ Phase 3 |
| Sync Workspace Directory (provisioning) | TODO | `GOOGLE_DIRECTORY_ENABLED` | ⏳ Phase 4 |

## Limites / Risques

- **Rate limits Gmail API** : 1 milliard d'unités/jour en Workspace, 250 unités
  par `send` → OK pour 120 users.
- **Bouncing** : si un collab a une mauvaise adresse (ex: compte désactivé), le
  mail échoue silencieusement (`logger.warn` backend). Pas de retry auto.
- **Impersonation** : le service account a carte blanche sur les boîtes mail et
  calendriers. Garder la clé privée secrète (pas dans git, pas dans logs).
- **Calendar event ID collision** : utilise l'UUID de l'absence (préfixé
  `hpabs`). Pas de collision possible.
- **Si le collab supprime manuellement l'event Calendar** : on ne le recrée pas
  automatiquement. Prochain update (approbation re-faite) le recréera.

## Désactivation d'urgence

Si un problème survient en prod (spam, boucle, etc.) :

```
# Sur le VPS, éditer backend/.env et passer à false :
GOOGLE_MAIL_ENABLED=false
GOOGLE_CALENDAR_ENABLED=false
# Puis restart
sudo systemctl restart hp-backend
```

Les features redeviennent no-op immédiatement sans redéploiement.

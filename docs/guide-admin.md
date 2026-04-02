# Guide Administrateur — Suivi Collaborateurs Hello Pomelo

---

## Tableau de bord

Votre page d'accueil affiche une vue d'ensemble de l'entreprise.

**Ce que vous y trouvez :**
- **Indicateurs clés** : nombre total de collaborateurs, arrivées du mois, entretiens mensuels complétés, demandes de congés en attente
- **Alertes** : entretiens non remplis, objectifs expirés, fins de période d'essai proches — cliquez sur une alerte pour accéder au profil concerné
- **Graphiques** : répartition des objectifs par statut, répartition par équipe, tendance de complétion des entretiens sur 6 mois
- **Annuaire rapide** : recherche et filtrage par équipe, clic sur une fiche pour accéder au profil

---

## Collaborateurs

Gestion complète de l'équipe.

| Action | Comment |
|--------|---------|
| **Ajouter** | Bouton "+ Ajouter", remplir prénom, nom, poste (obligatoires) + email, bureau, équipe, contrat, manager... |
| **Modifier** | Clic sur ✏️ dans la liste |
| **Supprimer** | Clic sur 🗑️ — si la personne est manager, une popup propose de réassigner ses managés |
| **Rechercher** | Barre de recherche par nom, email ou poste |
| **Trier** | Clic sur les en-têtes de colonnes (nom, poste, équipe, manager, date d'entrée) |

---

## Profil collaborateur

Accessible en cliquant sur un nom. Affiche toutes les infos + 3 onglets.

**Actions disponibles :**
- ✏️ Modifier les informations
- 👁 Voir comme (ouvre le portail collaborateur en tant que cette personne)
- 📥 Export CSV de la fiche
- 📄 Synthèse PDF (objectifs + entretiens + congés sur une période)

**Onglet Objectifs :** créer, modifier, supprimer des objectifs individuels. Chaque modification est historisée (date, auteur, ce qui a changé).

**Onglet Entretien RH :** voir et remplir les retours manager pour chaque mois. Les réponses du collaborateur sont visibles en lecture seule. Un entretien est verrouillé après le 5 du mois suivant.

**Onglet Onboarding :** notes d'intégration, matériel fourni, accès créés + champs personnalisés libres.

---

## Congés & Absences

4 sous-onglets pour gérer les demandes.

**En attente :** liste des demandes avec boutons Approuver / Refuser. Le refus ouvre une fenêtre pour saisir le motif.

**Historique :** toutes les demandes passées, filtrables par collaborateur.

**Calendrier :** vue mensuelle de toute l'équipe — vert = approuvé, orange = en attente, gris = weekend.

**Soldes :** tableau des soldes de congés avec calcul automatique (solde initial + acquisition mensuelle − jours pris). Modifiable par collaborateur.

---

## Objectifs

**Individuels :** vue groupée par collaborateur. Créer, modifier, supprimer des objectifs avec progression, dates, récurrence. Historique des modifications.

**Équipe :** créer des objectifs partagés par équipe (ex: "Atteindre 100 clients", "Réduire le temps de réponse"). Visibles par tous les membres de l'équipe dans leur portail.

---

## Organigramme

**Vue arborescente** de la hiérarchie. Cliquez sur un nom pour accéder au profil.

**Modifier une relation** : cherchez un collaborateur, assignez-lui un manager (ou aucun).

**Export PDF** : bouton "Exporter en PDF" — génère un document horodaté avec l'arbre complet + statistiques (nombre de managers, équipes, etc.).

---

## Paramètres

**Listes de référence :** personnalisez les équipes, bureaux, types de contrat et types de poste. Ces listes alimentent les menus déroulants dans les formulaires.

**Questions d'entretien :** définissez les questions posées chaque mois au manager et au collaborateur. Deux types disponibles : texte libre ou notation 1-5. Réordonnez par priorité. Les modifications s'appliquent aux entretiens du mois suivant.

**Périodes de fermeture :** déclarez les fermetures entreprise (Noël, été...) pour information.

---

## Fonctionnalités transversales

- **Recherche globale** (Ctrl+K) : trouvez un collaborateur depuis n'importe quelle page
- **Mode sombre** : activable via le bouton 🌙 en bas de la sidebar
- **Notifications** : badge sur "Congés" indiquant le nombre de demandes en attente
- **Responsive** : utilisable sur mobile (menu hamburger)

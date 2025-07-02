# 📦 Shopopti+ – Version 6.8-final

## ✅ Nouveautés
- Refactor complet de la structure du projet pour une compatibilité parfaite avec Vercel
- Séparation claire des composants, pages, modules, services et contextes
- Ajout d’un `.env.example` pour la configuration environnementale sécurisée
- Nettoyage des fichiers inutiles et suppression des dossiers corrompus

## 🛠️ Corrections
- Correction des erreurs de build liées aux fichiers `.DS_Store`, `node_modules`, `package.json` mal positionné
- Suppression des dépendances externes conflictuelles
- Réorganisation du dépôt Git avec branche `v6.8`

## 🔐 Sécurité & Optimisation
- Ajout de `.gitignore` complet pour éviter les secrets (`.env`) et les fichiers locaux sensibles
- Normalisation des scripts shell (ex: `fix-vercel.sh`)
- Préparation pour la branche `v6.9` (Analytics, Stripe Billing, Assistant AI...)

### 🛠 Installation

Avant d'exécuter les commandes de build ou de lint, installez d'abord les dépendances :

```bash
npm ci  # ou npm install
```

```bash
git tag v6.8-final
git push origin v6.8-final
```

### 📄 Variables d'environnement pour les intégrations

Ajoutez les variables suivantes à votre fichier `.env` selon les services utilisés :

* `AIRTABLE_API_KEY` – Clé API Airtable pour créer des enregistrements.

* `NOTION_API_KEY` – Jeton d’intégration Notion pour ajouter des pages.

* `ZAPIER_WEBHOOK_URL` *(optionnel)* – URL de base pour les hooks Zapier.

### 📡 Routes API AutoDS

Ces routes simulées permettent d'interagir avec le fournisseur AutoDS via les fonctions Supabase :

* `POST /functions/v1/providers/autods` – récupérer des produits
* `POST /functions/v1/providers/autods/categories` – lister les catégories
* `POST /functions/v1/providers/autods/orders` – créer une commande
* `GET  /functions/v1/providers/autods/orders/{id}` – vérifier le statut d'une commande

2. 🚀 Déployer sur Vercel :

```bash
vercel --prod
```

3. 📦 Continuer sur la prochaine version :

```bash
git checkout -b v6.9
```

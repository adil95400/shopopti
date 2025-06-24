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

---

### 🚀 Étapes suivantes

1. 🏷️ Créer un tag Git :
```bash
git tag v6.8-final
git push origin v6.8-final

## Google Sheets Integration

The application can export accounting and reporting data directly to Google Sheets.
To enable this feature:

1. Create a project on the [Google Cloud Console](https://console.cloud.google.com/).
2. Enable the **Google Sheets API** and configure an OAuth consent screen.
3. Generate OAuth client credentials for a web application and obtain an API key.
4. Add the following variables to your `.env` file (see `.env.example`):

   ```bash
   VITE_GOOGLE_API_KEY=your_google_api_key
   VITE_GOOGLE_CLIENT_ID=your_google_client_id
   ```

When exporting reports you will be prompted to sign in with your Google account so the data can be written to your spreadsheet.

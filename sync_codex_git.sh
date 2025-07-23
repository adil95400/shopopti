#!/bin/bash

echo "🔄 Synchronisation Codex → GitHub en cours..."

cd "$(dirname "$0")/.." || exit 1

if [ ! -d ".git" ]; then
  echo "🆕 Dépôt Git non initialisé. Initialisation..."
  git init
  git remote add origin git@github.com:VOTRE_UTILISATEUR/VOTRE_REPO.git
fi

git add .

if git diff-index --quiet HEAD --; then
  echo "✅ Aucun changement à committer."
else
  TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")
  if ! git commit -m "🚀 Sync Codex update - $TIMESTAMP"; then
    echo "❌ Échec du commit"
    exit 1
  fi
  echo "✅ Modifications commit."

  git branch -M main
  if ! git push -u origin main; then
    echo "❌ Échec du push vers GitHub"
    exit 1
  fi
  echo "📦 Pushed to GitHub ✅"
fi

if [ -f ".trigger-vercel.txt" ]; then
  touch .trigger-vercel.txt
  echo "🧪 Fichier trigger-vercel.txt mis à jour pour déclencher un déploiement Vercel."
fi

echo "🎉 Synchronisation terminée."

#!/bin/bash

BRANCHE="main"
REMOTE="origin"
MESSAGE_COMMIT="🔄 Push Codex vers GitHub $(date '+%Y-%m-%d %H:%M:%S')"

cd "$(dirname "$0")" || exit 1

echo "🚀 Préparation du push Codex → GitHub"

# Vérifie les modifications locales
if [[ -n $(git status --porcelain) ]]; then
  echo "⚠️ Changements détectés :"
  git status -s
  echo ""
  read -p "Souhaites-tu faire un commit automatique ? [y/n] : " auto_commit

  if [[ "$auto_commit" == "y" ]]; then
    git add .
    git commit -m "$MESSAGE_COMMIT"
    echo "✅ Commit automatique effectué."
  else
    echo "❌ Annulation du push. Aucun commit effectué."
    exit 0
  fi
else
  echo "✅ Aucun changement à commiter."
fi

# Pull avant push
echo "📥 Récupération des changements distants..."
git pull $REMOTE $BRANCHE --rebase

# Push final
echo "📤 Envoi vers GitHub..."
git push $REMOTE $BRANCHE

echo "✅ Push terminé avec succès !"


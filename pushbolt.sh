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
    if ! git commit -m "$MESSAGE_COMMIT"; then
      echo "❌ Échec du commit"
      exit 1
    fi
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
if ! git push $REMOTE $BRANCHE; then
  echo "❌ Échec du push vers GitHub"
  exit 1
fi

echo "✅ Push terminé avec succès !"


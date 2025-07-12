#!/bin/bash

BRANCHE="main"
REMOTE="origin"
MESSAGE_COMMIT="🔄 Sync Codex $(date '+%Y-%m-%d %H:%M:%S')"

cd "$(dirname "$0")" || exit 1

echo "📥 Pull avant push (avec rebase)..."
git pull $REMOTE $BRANCHE --rebase

echo "📂 Ajout des fichiers modifiés..."
git add .

echo "📝 Commit avec message : $MESSAGE_COMMIT"
if ! git commit -m "$MESSAGE_COMMIT"; then
  echo "❌ Échec du commit"
  exit 1
fi

echo "📤 Push vers GitHub..."
if ! git push $REMOTE $BRANCHE; then
  echo "❌ Échec du push vers GitHub"
  exit 1
fi

echo "✅ Codex/GitHub synchronisés avec succès !"


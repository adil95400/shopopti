#!/bin/bash

BRANCHE="main"
REMOTE="origin"
MESSAGE_COMMIT="🚀 Push depuis Codex $(date '+%Y-%m-%d %H:%M:%S')"

cd "$(dirname "$0")" || exit 1

echo "📦 Ajout des fichiers modifiés..."
git add .

echo "📝 Création du commit : $MESSAGE_COMMIT"
if ! git commit -m "$MESSAGE_COMMIT"; then
  echo "❌ Échec du commit"
  exit 1
fi

echo "📤 Push vers GitHub..."
if ! git push $REMOTE $BRANCHE; then
  echo "❌ Échec du push vers GitHub"
  exit 1
fi

echo "✅ Codex → GitHub synchronisé avec succès !"


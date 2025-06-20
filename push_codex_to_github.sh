#!/bin/bash

BRANCHE="main"
REMOTE="origin"
MESSAGE_COMMIT="🚀 Push depuis Codex $(date '+%Y-%m-%d %H:%M:%S')"

cd "$(dirname "$0")" || exit 1

echo "📦 Ajout des fichiers modifiés..."
git add .

echo "📝 Création du commit : $MESSAGE_COMMIT"
git commit -m "$MESSAGE_COMMIT"

echo "📤 Push vers GitHub..."
git push $REMOTE $BRANCHE

echo "✅ Codex → GitHub synchronisé avec succès !"


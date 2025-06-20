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
git commit -m "$MESSAGE_COMMIT"

echo "📤 Push vers GitHub..."
git push $REMOTE $BRANCHE

echo "✅ Codex/GitHub synchronisés avec succès !"


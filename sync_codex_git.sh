#!/bin/bash

BRANCHE="main"
REMOTE="origin"
MESSAGE_COMMIT="🔄 Sync Codex $(date '+%Y-%m-%d %H:%M:%S')"

cd "$(dirname "$0")" || exit 1

echo "📂 Préparation Git..."
git add .
git commit -m "$MESSAGE_COMMIT"
git push $REMOTE $BRANCHE

echo "✅ Synchronisation terminée avec succès !"


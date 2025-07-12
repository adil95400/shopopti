#!/bin/bash

# === CONFIGURATION ===
REPO_DIR="${REPO_DIR:-$(cd "$(dirname "$0")" && pwd)}"
LOG_FILE="$REPO_DIR/codex_sync.log"
BRANCH=$(git -C "$REPO_DIR" rev-parse --abbrev-ref HEAD)
DATE=$(date '+%Y-%m-%d %H:%M:%S')

log() {
  echo "[$DATE] $1" | tee -a "$LOG_FILE"
}

cd "$REPO_DIR" || {
  log "❌ Impossible d'accéder au dossier $REPO_DIR"
  exit 1
}

log "🔄 Début synchronisation Codex → GitHub (branche : $BRANCH)"

# === REBASE BLOQUÉ ?
if [ -d ".git/rebase-merge" ] || [ -d ".git/rebase-apply" ]; then
  log "⚠️ Rebase interrompu détecté — tentative d'abandon..."
  git rebase --abort
fi

# === CRÉATION AUTO DE BRANCHE CODEX SI SUR main ===
if [ "$BRANCH" == "main" ]; then
  NEW_BRANCH="codex/$(date +%Y%m%d-%H%M%S)"
  git checkout -b "$NEW_BRANCH"
  log "🌿 Nouvelle branche Codex créée : $NEW_BRANCH"
  BRANCH=$NEW_BRANCH
fi

# === COMMIT AUTOMATIQUE ===
git add .
if git diff --cached --quiet; then
  log "✅ Aucun changement local à valider"
else
  COMMIT_MSG="🔄 Sync Codex → GitHub [$DATE]"
  git commit -m "$COMMIT_MSG" && log "✅ Commit : $COMMIT_MSG" || {
    log "❌ Commit échoué"
    exit 1
  }
fi

# === PULL AVEC REBASE ===
log "📥 Tentative de pull avec rebase..."
if git pull origin main --rebase; then
  log "✅ Pull avec rebase réussi"
else
  log "⚠️ Conflit détecté. Tentative de résolution automatique..."

  # === FICHIERS À RÉSOUDRE AUTOMATIQUEMENT ===
  for FILE in README.md .env.example package.json package-lock.json; do
    if grep -q "<<<<<<<" "$FILE" 2>/dev/null; then
      log "⚠️ Conflit détecté dans $FILE — fusion auto"
      awk '
        BEGIN { conflict = 0 }
        /^<<<<<<< / { conflict = 1; next }
        /^=======/ { next }
        /^>>>>>>> / { conflict = 0; next }
        conflict == 0 { print }
      ' "$FILE" > "$FILE.tmp" && mv "$FILE.tmp" "$FILE"
      git add "$FILE"
      log "✅ Résolu automatiquement : $FILE"
    fi
  done

  if git rebase --continue; then
    log "✅ Rebase terminé après résolution automatique"
  else
    log "❌ Rebase bloqué — veuillez résoudre manuellement"
    exit 1
  fi
fi

# === PUSH FINAL ===
if git push origin "$BRANCH"; then
  log "🚀 Push réussi vers GitHub"
else
  log "❌ Push échoué — vérifier les droits ou conflits"
  exit 1
fi

# === CRÉATION DE PR AUTOMATIQUE (si gh installé) ===
if command -v gh >/dev/null 2>&1; then
  if gh pr create --title "🔄 Sync Codex [$(date +%Y-%m-%d)]" \
                  --body "Automated sync depuis Codex → GitHub" \
                  --base main --head "$BRANCH" --label codex-sync; then
    log "📬 Pull Request créée automatiquement depuis $BRANCH → main"
  else
    log "⚠️ Impossible de créer la PR automatiquement"
  fi
else
  log "ℹ️ GitHub CLI (gh) non trouvé — PR non créée"
fi

log "✅ Synchronisation complète terminée"
exit 0

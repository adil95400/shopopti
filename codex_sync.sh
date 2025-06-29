#!/bin/bash

# === CONFIGURATION ===
REPO_DIR="${REPO_DIR:-$(cd "$(dirname "$0")" && pwd)}"
LOG_FILE="$REPO_DIR/codex_sync.log"
BRANCH=$(git -C "$REPO_DIR" rev-parse --abbrev-ref HEAD)
DATE=$(date '+%Y-%m-%d %H:%M:%S')

# === LOGGING ===
log() {
  echo "[$DATE] $1" | tee -a "$LOG_FILE"
}

log "🔄 Début synchronisation Codex → GitHub (branche : $BRANCH)"

cd "$REPO_DIR" || {
  log "❌ Erreur : impossible d'accéder au répertoire $REPO_DIR"
  exit 1
}

# === AJOUT & COMMIT AUTOMATIQUE ===
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

# === MISE À JOUR AVEC REBASE ===
if git pull origin "$BRANCH" --rebase; then
  log "✅ Pull avec rebase réussi"
else
  log "⚠️ Conflits détectés, tentative de résolution automatique..."

  # === GESTION AUTOMATIQUE DES CONFLITS FRÉQUENTS ===
  for FILE in README.md .env.example package.json package-lock.json; do
    if grep -q "<<<<<<<" "$FILE" 2>/dev/null; then
      log "⚠️ Conflit détecté dans $FILE — fusion automatique..."
      
      # Conserver les deux blocs sans les lignes de conflit
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

  # Finaliser le rebase
  if git rebase --continue; then
    log "✅ Rebase terminé après résolution automatique"
  else
    log "❌ Rebase bloqué — intervention manuelle requise"
    exit 1
  fi
fi

# === PUSH FINAL ===
if git push origin "$BRANCH"; then
  log "🚀 Push réussi vers GitHub"
else
  log "❌ Push échoué — vérifier les droits ou les conflits"
  exit 1
fi

log "✅ Synchronisation complète terminée"
exit 0

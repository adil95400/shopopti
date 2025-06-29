#!/bin/bash

set -e  # Arrête le script en cas d'erreur

# === CONFIGURATION ===
REPO_DIR="${REPO_DIR:-$(cd "$(dirname "$0")" && pwd)}"
LOG_FILE="$REPO_DIR/codex_sync.log"
BRANCH=$(git -C "$REPO_DIR" rev-parse --abbrev-ref HEAD)
DATE=$(date '+%Y-%m-%d %H:%M:%S')

# === FONCTION LOG ===
log() {
  echo "[$DATE] $1" | tee -a "$LOG_FILE"
}

log "🔄 Début synchronisation Codex → GitHub (branche : $BRANCH)"

# === ACCÈS AU DOSSIER ===
cd "$REPO_DIR" || {
  log "❌ Erreur : impossible d'accéder à $REPO_DIR"
  exit 1
}

# === RÉINITIALISATION SI REBASE BLOQUÉ ===
if [ -d .git/rebase-merge ] || [ -d .git/rebase-apply ]; then
  log "⚠️ Rebase interrompu détecté — tentative d'abandon..."
  git rebase --abort || rm -rf .git/rebase-* || true
fi

# === AJOUT DES FICHIERS ===
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

# === PULL + REBASE ===
log "📥 Tentative de pull avec rebase..."
if ! git pull origin "$BRANCH" --rebase; then
  log "⚠️ Conflit détecté. Tentative de résolution automatique..."

  auto_resolve_conflicts() {
    CONFLICT_FILES=$(git diff --name-only --diff-filter=U)

    for FILE in $CONFLICT_FILES; do
      if grep -q "<<<<<<<" "$FILE"; then
        log "🔧 Résolution automatique : $FILE"
        awk '
          BEGIN { conflict = 0 }
          /^<<<<<<< / { conflict = 1; next }
          /^=======/ { next }
          /^>>>>>>> / { conflict = 0; next }
          conflict == 0 { print }
        ' "$FILE" > "$FILE.tmp" && mv "$FILE.tmp" "$FILE"
        git add "$FILE"
      fi
    done
  }

  auto_resolve_conflicts

  if git rebase --continue; then
    log "✅ Rebase terminé après résolution automatique"
  else
    log "❌ Rebase bloqué — veuillez résoudre manuellement puis relancer ce script"
    exit 1
  fi
else
  log "✅ Pull avec rebase réussi"
fi

# === PUSH FINAL ===
if git push origin "$BRANCH"; then
  log "🚀 Push réussi vers GitHub"
else
  log "❌ Push échoué — vérifier les conflits ou les droits d'accès"
  exit 1
fi

log "✅ Synchronisation complète terminée avec succès"
exit 0

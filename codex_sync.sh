#!/bin/bash

# === CONFIGURATION ===
REPO_DIR="/Users/admin/shopopti"
LOG_FILE="$REPO_DIR/codex_sync.log"
BRANCH=$(git -C "$REPO_DIR" rev-parse --abbrev-ref HEAD)
DATE=$(date '+%Y-%m-%d %H:%M:%S')

# === FONCTION DE LOG ===
log() {
  echo "[$DATE] $1" >> "$LOG_FILE"
}

log "🔄 Début de la synchronisation Codex → Local → GitHub sur la 
branche $BRANCH"

# === SÉCURITÉ : se placer dans le dossier du projet ===
cd "$REPO_DIR" || {
  log "❌ Échec : impossible d’accéder au dossier $REPO_DIR"
  exit 1
}

# === STAGE DES FICHIERS MODIFIÉS ===
git add .

# === SI RIEN À VALIDER ===
if git diff --cached --quiet; then
  log "✅ Aucun changement détecté — rien à commit."
else
  COMMIT_MSG="🔄 Sync automatique Codex → GitHub [$DATE]"
  git commit -m "$COMMIT_MSG"
  log "✅ Commit effectué : $COMMIT_MSG"
fi

# === PULL avec gestion de rebase ===
if git pull origin "$BRANCH" --rebase >> "$LOG_FILE" 2>&1; then
  log "✅ Pull avec rebase réussi sur $BRANCH"
else
  log "⚠️ Pull échoué : conflit probable, à résoudre manuellement"
  exit 1
fi

# === PUSH sécurisé ===
if git push origin "$BRANCH" >> "$LOG_FILE" 2>&1; then
  log "🚀 Push réussi sur GitHub"
else
  log "❌ Push échoué — vérifier les droits ou les conflits"
  exit 1
fi

log "✅ Synchronisation terminée avec succès"

exit 0


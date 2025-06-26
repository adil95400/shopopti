#!/bin/bash

# === CONFIGURATION ===
REPO_DIR="/Users/admin/shopopti"
LOG_FILE="$REPO_DIR/codex_sync.log"
TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")
COMMIT_MSG="🚀 Sync Codex → GitHub - $TIMESTAMP"

cd "$REPO_DIR" || exit

# Détection de la branche active
BRANCH=$(git rev-parse --abbrev-ref HEAD)

echo "[$TIMESTAMP] 🔄 Démarrage sync Codex → GitHub (branche : $BRANCH)" 
>> "$LOG_FILE"

# Étape 1 - Ajout des fichiers
git add . >> "$LOG_FILE" 2>&1

# Étape 2 - Commit intelligent
if git diff --cached --quiet; then
  echo "[$TIMESTAMP] 🟡 Rien à commit." >> "$LOG_FILE"
else
  git commit -m "$COMMIT_MSG" >> "$LOG_FILE" 2>&1
  echo "[$TIMESTAMP] ✅ Commit effectué : $COMMIT_MSG" >> "$LOG_FILE"
fi

# Étape 3 - Pull rebase
if git pull origin main --rebase >> "$LOG_FILE" 2>&1; then
  echo "[$TIMESTAMP] 🔃 Pull avec rebase réussi." >> "$LOG_FILE"
else
  echo "[$TIMESTAMP] ❌ Erreur durant git pull --rebase." >> "$LOG_FILE"
fi

# Étape 4 - Push sécurisé
if git push origin "$BRANCH" >> "$LOG_FILE" 2>&1; then
  echo "[$TIMESTAMP] ✅ Push réussi vers GitHub (branche $BRANCH)" >> 
"$LOG_FILE"
else
  echo "[$TIMESTAMP] ❌ Push échoué. Branche distante en avance ?" >> 
"$LOG_FILE"
fi

echo "[$TIMESTAMP] 🎯 Fin de la synchronisation Codex." >> "$LOG_FILE"


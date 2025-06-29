#!/bin/bash

# === CONFIGURATION GLOBALE ===
REPO_DIR="${REPO_DIR:-$(cd "$(dirname "$0")" && pwd)}"
LOG_FILE="$REPO_DIR/codex_sync.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')
BRANCH=$(git -C "$REPO_DIR" rev-parse --abbrev-ref HEAD)

# === LOG UTILE ===
log() {
  echo "[$DATE] $1" | tee -a "$LOG_FILE"
}

log "🔄 Début de la synchronisation Codex → Local → GitHub sur la branche $BRANCH"

# === CHECK RÉPERTOIRE ===
cd "$REPO_DIR" || {
  log "❌ Dossier $REPO_DIR introuvable"
  exit 1
}

# === STAGE AUTOMATIQUE ===
git add .

if git diff --cached --quiet; then
  log "✅ Aucun changement détecté — rien à commit."
else
  COMMIT_MSG="🔄 Sync automatique Codex → GitHub [$DATE]"
  if git commit -m "$COMMIT_MSG"; then
    log "✅ Commit local effectué"
  else
    log "❌ Erreur lors du commit"
    exit 1
  fi
fi

# === PULL + REBASE (sécurisé) ===
log "📥 Tentative de pull avec rebase..."
if git pull origin "$BRANCH" --rebase >> "$LOG_FILE" 2>&1; then
  log "✅ Pull réussi sur $BRANCH"
else
  log "⚠️ Conflit détecté. Tentative de résolution automatique..."

  # === FICHIERS CIBLÉS POUR CORRECTION AUTO ===
  FILES_TO_FIX=(".github/workflows/check.yml" "README.md")

  for file in "${FILES_TO_FIX[@]}"; do
    if grep -q "<<<<<<<" "$file"; then
      log "🛠️ Résolution automatique du conflit dans $file"

      # Correction spécifique pour check.yml
      if [[ "$file" == ".github/workflows/check.yml" ]]; then
        cat > "$file" <<EOF
name: ✅ Code Quality Checks

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test-lint-build:
    runs-on: ubuntu-latest

    steps:
      - name: 📥 Checkout code
        uses: actions/checkout@v3

      - name: 🟢 Use Node.js 20.x
        uses: actions/setup-node@v3
        with:
          node-version: 20

      - name: 📦 Install dependencies
        run: npm ci

      - name: 🔍 Lint code
        run: npm run lint

      - name: 🏗️ Build app
        run: npm run build

      - name: 🐍 Install Python dependencies
        run: |
          pip install -r requirements.txt
          pip install fastapi supabase httpx stripe

      - name: 📄 Generate OpenAPI schema
        run: python backend/generate_openapi.py

      - name: 📘 Generate API docs
        run: npm run docs:api
EOF
        git add "$file"
        git commit -m "✅ Résolution automatique de $file"
      else
        log "❌ Conflit détecté dans $file, à corriger manuellement"
      fi
    fi
  done
fi

# === PUSH FINAL ===
log "🚀 Push vers GitHub en cours..."
if git push origin "$BRANCH" >> "$LOG_FILE" 2>&1; then
  log "✅ Push réussi"
else
  log "❌ Push échoué — vérifier les droits ou conflits"
  exit 1
fi

log "✅ Synchronisation terminée avec succès"
exit 0

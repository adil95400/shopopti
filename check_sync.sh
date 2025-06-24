#!/bin/bash

echo "🔍 Vérification de la synchronisation locale ⇄ GitHub ⇄ Codex"

# Étape 1 – Vérifier si on est bien dans un dépôt git
if [ ! -d .git ]; then
  echo "❌ Ce dossier n'est pas un dépôt Git."
  exit 1
fi

# Étape 2 – Afficher l'état git
echo "📂 État du dépôt local :"
git status

# Étape 3 – Vérifier les différences avec GitHub
echo "⬇️  Vérification des différences avec GitHub..."
git fetch origin

LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse @{u})
BASE=$(git merge-base @ @{u})

if [ "$LOCAL" = "$REMOTE" ]; then
  echo "✅ Local et GitHub sont synchronisés."
elif [ "$LOCAL" = "$BASE" ]; then
  echo "⬇️ Des mises à jour sont disponibles sur GitHub (utilise git 
pull)."
elif [ "$REMOTE" = "$BASE" ]; then
  echo "⬆️ Tu as des modifications locales à pousser sur GitHub (utilise 
git push)."
else
  echo "⚠️ Ton dépôt local et GitHub ont divergé (utilise git pull 
--rebase ou merge)."
fi

# Étape 4 – Vérifier Codex (si CLI installée)
if command -v codex >/dev/null 2>&1; then
  echo "📡 Codex détecté. Listing des tâches (si connecté à un 
environnement)..."
  codex list-tasks --project shopopti-dev
else
  echo "❌ Codex CLI non installée ou non détectée."
fi


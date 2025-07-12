#!/bin/bash

BRANCHE="main"
REMOTE="origin"

echo "📥 Synchronisation depuis GitHub (Bolt)..."
cd "$(dirname "$0")" || exit 1

# Vérifie s'il y a des modifications non commitées
if [[ -n $(git status --porcelain) ]]; then
  echo "⚠️ Modifications locales détectées :"
  git status -s
  echo ""
  echo "❓ Que veux-tu faire ?"
  echo "1 - Stash les changements (temporairement)"
  echo "2 - Commit automatique des changements"
  echo "3 - Annuler la synchronisation"
  read -p "👉 Choix [1/2/3] : " choix

  if [[ "$choix" == "1" ]]; then
    git stash
    echo "📦 Changements stashed."
  elif [[ "$choix" == "2" ]]; then
    git add .
    git commit -m "🔧 Commit automatique avant pull"
    echo "✅ Changements commités."
  else
    echo "❌ Synchronisation annulée."
    exit 1
  fi
fi

# Pull avec rebase propre
echo "🔍 Passage à la branche $BRANCHE..."
git checkout $BRANCHE

echo "🔄 Pull avec rebase depuis $REMOTE/$BRANCHE..."
git pull $REMOTE $BRANCHE --rebase

echo "✅ Mise à jour locale depuis Bolt/GitHub terminée !"


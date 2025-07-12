#!/bin/bash

# 🔧 Script codex_merge_and_deploy.sh
# 📦 Fusionne toutes les branches Codex + Déploie Vercel automatiquement

echo "🚀 Lancement du script de fusion Codex + déploiement Vercel..."

# Étape 1 : Vérifie que gh est installé
if ! command -v gh &> /dev/null
then
    echo "❌ GitHub CLI (gh) est requis. Installe-le avec 'brew install gh'"
    exit 1
fi

# Étape 2 : Récupère toutes les PR avec 'codex/' dans le nom
echo "🔍 Recherche des Pull Requests Codex..."
pr_list=$(gh pr list --state open --json number,headRefName,title --jq '.[] | select(.headRefName | test("codex/")) | .number')

if [ -z "$pr_list" ]; then
    echo "✅ Aucune Pull Request Codex à fusionner."
else
    for pr_number in $pr_list
    do
        echo "🔄 Fusion de la PR #$pr_number..."
        gh pr merge "$pr_number" --squash --delete-branch || { echo "⚠️ Échec de fusion PR #$pr_number"; exit 1; }
    done
fi

# Étape 3 : Push sur main
echo "⬆️ Push des changements squashés vers main..."
git pull origin main
git push origin main

# Étape 4 : Déclenche un déploiement Vercel via hook
if [ -z "$VERCEL_DEPLOY_HOOK_URL" ]; then
    echo "⚠️ VERCEL_DEPLOY_HOOK_URL non défini. Skipping Vercel deploy."
else
    echo "🚀 Déclenchement du déploiement Vercel..."
    curl -X POST "$VERCEL_DEPLOY_HOOK_URL"
    echo "✅ Déploiement déclenché sur Vercel"
fi

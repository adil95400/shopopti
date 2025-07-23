#!/bin/bash

# Script : push-to-github.sh
# Description : Automatise le push complet du projet vers GitHub

echo "📦 Ajout des fichiers..."
git add .

echo "📝 Création du commit..."
git commit -m '🚀 Shopopti Final Pro 2.0 : version complète avec IA, mobile, CLI'

echo "🌍 Push vers GitHub..."
git push origin main

echo "✅ Push terminé avec succès !"

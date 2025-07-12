#!/bin/bash

echo "🔧 Installation des dépendances..."
npm install

echo "⚡️ Vérification des variables d'environnement..."
echo "🔑 SUPABASE_URL: $VITE_SUPABASE_URL"
echo "🔑 OPENAI_KEY: $VITE_OPENAI_API_KEY"

echo "🚀 Lancement de l'application..."
npm run dev


#!/bin/bash

echo "🔧 Lancement de la correction locale via Codex..."
npx tsx cli/shopopti.ts codex-fix

echo "📤 Synchronisation vers GitHub via Codex..."
npx tsx cli/shopopti.ts codex-sync

echo "🚀 Déploiement vers Vercel (production)..."
vercel --prod

echo "✅ Tout est terminé : Code local corrigé, push GitHub fait, déploiement Vercel lancé."

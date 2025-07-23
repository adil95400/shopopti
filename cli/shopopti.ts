#!/usr/bin/env tsx

import { execSync } from 'child_process';

const args = process.argv.slice(2);

if (args.includes("codex-sync")) {
  console.log("🚀 Lancement de la synchronisation Codex avec GitHub...");
  execSync("bash ./scripts/codex-sync.sh", { stdio: "inherit" });
} else {
  console.log("❓ Commande inconnue. Utilise :");
  console.log("   shopopti codex-sync   # pour lancer la sync IA");
}

#!/usr/bin/env tsx

import { execSync } from 'child_process';

const args = process.argv.slice(2);
const cmd = args[0];

switch (cmd) {
  case "codex-sync":
    console.log("🚀 Lancement de la synchronisation Codex avec GitHub...");
    execSync("bash ./scripts/codex-sync.sh", { stdio: "inherit" });
    break;

  case "codex-fix":
    console.log("🛠️  Lancement de la correction automatique avec Codex (fichiers & erreurs)...");
    execSync("codex sync -- --fix --create", { stdio: "inherit" });
    break;

  case "codex-fix-sync":
    console.log("🧠 Lancement total : correction automatique + commit Codex + PR GitHub...");
    execSync("codex sync -- --fix --create", { stdio: "inherit" });
    execSync("bash ./scripts/codex-sync.sh", { stdio: "inherit" });
    break;

  default:
    console.log("❓ Commande inconnue.");
    console.log("✨ Commandes disponibles :");
    console.log("   shopopti codex-sync       # pour synchroniser avec GitHub");
    console.log("   shopopti codex-fix        # pour corriger erreurs et fichiers manquants");
    console.log("   shopopti codex-fix-sync   # pour tout faire : fix + commit + PR");
}

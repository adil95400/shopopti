
# 🧠 Shopopti Final Pro – Version Intelligente 2.0

## ✅ Nouveautés majeures

- 🧱 Refactor complet de la structure avec composants modulaires
- 🤖 Coach IA intégré à toutes les pages
- 🛠️ Assistant CLI local `shopopti-fix.sh` (type Bolt) pour corriger automatiquement le projet
- 🎬 Onboarding animé avec Framer Motion
- 🌙 Dark mode toggle + UI accessible
- 📱 App mobile Flutter (`mobile_flutter/`)
- 📤 Intégration Shopify / AliExpress / Zapier / Stripe
- 🧠 Modules IA SEO, blog, produits gagnants, prix dynamiques
- 📈 Analytics avancé (Supabase, Recharts, Sentry monitoring)
- 🧪 Tests unitaires avec Vitest + script `codex-sync.sh`

---

## 📁 Structure du projet

```
shopopti/
├── src/
│   ├── pages/ (Home, CRM, SEO...)
│   ├── components/
│   ├── lib/ (openai.ts, integrations, monitoring.ts)
│   ├── cli/ (shopopti.ts, fixExports.ts, ...)
│   ├── styles/
│   └── App.tsx
├── backend/api/ (FastAPI : Stripe, Zapier, SEO)
├── mobile_flutter/
├── .bolt/prompts/ (fix-exports.bolt.json...)
├── .devcontainer/
├── .vscode/
├── shopopti-fix.sh
├── codex-sync.sh
├── README.md
├── .env.example
└── vitest.config.ts
```

---

## 🛠 Installation rapide

1. Installer les dépendances :

```bash
npm install
```

2. Lancer le frontend React :

```bash
npm run dev
```

3. Lancer le backend FastAPI :

```bash
cd backend
uvicorn main:app --reload
```

4. Lancer l’app mobile Flutter :

```bash
cd mobile_flutter
flutter pub get
flutter run
```

---

## 🔧 Assistant CLI IA (`shopopti-fix`)

```bash
chmod +x shopopti-fix.sh
./shopopti-fix.sh fix exports     # Corrige tous les exports manquants
./shopopti-fix.sh fix sidebar     # Refactorise automatiquement la sidebar
./shopopti-fix.sh fix lazyload    # Injecte React.lazy() + Suspense
```

---

## 📦 Déploiement Vercel

```bash
vercel --prod
```

---

## 🔐 Variables d'environnement `.env`

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_OPENAI_API_KEY=...
VITE_STRIPE_PUBLIC_KEY=...
ZAPIER_WEBHOOK_URL=...
VITE_CANVA_APP_ID=...
```

---

## 📘 Documentation IA

- 🧠 `docs/CREER_MODULE_IA.md` → comment créer un module IA (SEO, blog, etc.)
- 🤖 Coach IA → dans `CoachAIWidget.tsx`
- 📊 Monitoring → `monitoring.ts`, `sentry.config.ts`

---

## 🧪 Tests

```bash
npx vitest run
```

---

## 🚀 Prêt pour production : Vercel + GitHub + Mobile + IA ✅

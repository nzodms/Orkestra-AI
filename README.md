# Orkestra AI

**Le copilote multi-IA pour optimiser les boutiques Shopify.**

> Connectez votre boutique Shopify et vos IA. Orkestra analyse votre boutique,
> comprend votre niche, puis vous aide à générer des contenus SEO premium, des
> sections Shopify codées, des audits Merchant Center et des recommandations
> d'optimisation.

Plusieurs IA travaillent ensemble comme un orchestre pour produire la meilleure
réponse finale pour les e-commerçants.

---

## 🚀 Démarrage

```bash
npm install
cp .env.example .env        # renseigner ENCRYPTION_MASTER_KEY
npm run dev                 # http://localhost:3000
```

La V1 tourne en **mode mock** (`ORKESTRA_MOCK_MODE=true`) : toutes les
générations IA sont simulées de façon réaliste pour permettre une démo complète
sans consommer de crédits. L'architecture est prête à brancher les vrais
providers (voir `src/lib/ai/adapter.ts`).

---

## 🏗️ 1. Architecture

| Couche | Choix | Rôle |
|---|---|---|
| Framework | **Next.js 14 (App Router)** + TypeScript | Front + API routes |
| UI | **Tailwind CSS** + lucide-react | Design system premium |
| État client | **Zustand** (persist localStorage) | Connexions IA, mémoire boutique, historique |
| Sécurité | **AES-256-GCM** (`src/lib/crypto.ts`) | Chiffrement des clés BYOK |
| IA | Couche **adaptateur** modulaire | OpenAI / Claude / Gemini / OpenRouter / Mistral |
| Orchestration | **AI Council** | Fan-out vers les providers → synthèse |
| Persistance (cible) | **Prisma + PostgreSQL** (`prisma/schema.prisma`) | Prêt à brancher |

**Principe BYOK** : le client connecte ses propres clés. Elles sont chiffrées
côté serveur, jamais renvoyées en clair, jamais loggées. Chaque génération
consomme **les crédits du client**.

```
src/
├── app/
│   ├── page.tsx              # Landing premium
│   ├── onboarding/           # Wizard 4 étapes
│   ├── (app)/                # Pages avec sidebar (AppShell)
│   │   ├── dashboard/  memory/  seo/  sections/
│   │   ├── council/  merchant/  assistant/
│   │   ├── connect/  history/  settings/
│   └── api/
│       ├── keys/test/        # Test + chiffrement clé BYOK
│       └── generate/         # Routeur de génération (mock-ready)
├── components/               # Sidebar, Topbar, ProviderCard, ui/*
└── lib/
    ├── crypto.ts             # Chiffrement AES-256-GCM
    ├── providers.ts          # Métadonnées des 5 providers
    ├── store.ts              # Zustand
    ├── types.ts              # Types partagés
    ├── mock-data.ts          # Données de démo
    └── ai/
        ├── adapter.ts        # complete() mock/live par provider
        └── engine.ts         # Moteurs SEO / Section / Merchant / Council
```

## 🗺️ 2. Arborescence des pages

- `/` — Landing (promesse, features, CTA)
- `/onboarding` — Étapes : Boutique → Ton de marque → Connexion IA → Scan Shopify
- `/dashboard` — Scores, métriques, actions prioritaires, projets récents
- `/memory` — Mémoire boutique (identité, ton, catalogue, SEO, concurrents)
- `/seo` — Import Factory (transformation de catalogues CSV via OpenAI)
- `/sections` — Section Builder (12 types, Liquid/CSS/JS/schema)
- `/council` — AI Council (8 modes, réponse fusionnée + onglets par IA)
- `/merchant` — Merchant Shield (audit + correctifs)
- `/assistant` — Assistant Shopify (réponses pas à pas)
- `/connect` — Connecter mes IA (BYOK)
- `/history` — Historique des générations
- `/settings` — Profil, boutiques, clés, préférences IA, sécurité, abonnement

## 🗄️ 3. Schéma de base de données

Voir [`prisma/schema.prisma`](./prisma/schema.prisma) :
`User` · `Store` · `BrandMemory` · `ApiKey` (chiffré) · `Generation` ·
`MerchantAudit`. Les clés API sont stockées via `encIv/encTag/encData` + une
`maskedKey` d'affichage.

## 🧩 4. Composants UI principaux

`Button` · `Card`/`CardHeader` · `Badge` · `ScoreRing` · `Progress` ·
`EmptyState` · `PageHeader` · `Field` · `Sidebar` · `Topbar` · `ProviderCard`.

## 🔄 5. Workflows utilisateurs

1. **Onboarding** → infos boutique → ton de marque → connexion BYOK → scan.
2. **Transformer un catalogue** → Import Factory → import CSV → règles → OpenAI → CSV Shopify prêt à importer.
3. **Coder une section** → Section Builder → config → Liquid/CSS/JS/schema + install.
4. **Auditer** → Merchant Shield → score + problèmes priorisés + correctifs.
5. **Demander à l'orchestre** → AI Council → mode + question → réponse fusionnée.
6. Tout est sauvegardé dans **l'historique**.

## 🎨 6. Design system

- **Accent** : violet/indigo « brand » (orchestre).
- Cards arrondies (`rounded-2xl`), ombres douces, badges de score colorés.
- Thème **clair/sombre** (variables CSS + classe `dark`).
- Animations douces (`fade-in`, transitions), états vides travaillés.
- Inspirations : Linear, Vercel, Notion, Shopify admin moderne.

---

## ⚠️ Note Merchant Center

Orkestra détecte les **risques fréquents** et aide à améliorer la conformité
apparente. Aucun outil ne peut garantir qu'un compte Google Merchant Center ne
sera jamais suspendu — Google reste seul décisionnaire.

## 🔌 Brancher les vraies IA (V1.1)

Dans `src/lib/ai/adapter.ts`, implémenter `liveComplete()` par provider avec les
SDK officiels, en utilisant `req.apiKey` (déchiffrée côté serveur). Passer
`ORKESTRA_MOCK_MODE=false`.

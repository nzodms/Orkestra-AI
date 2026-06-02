import { NextResponse } from "next/server";
import { encryptSecret, maskApiKey, hasMasterKey } from "@/lib/crypto";
import { PROVIDERS } from "@/lib/providers";
import { isMockMode } from "@/lib/ai/adapter";
import { testOpenAIKey } from "@/lib/ai/openai";
import { saveKey, keyStoreBackend } from "@/lib/server/keyStore";
import type { AIProviderId } from "@/lib/types";

// ──────────────────────────────────────────────────────────────────────────
// POST /api/keys/test
//
// OpenAI : vrai ping (GET /models) → stockage chiffré → keyId opaque renvoyé.
// Les autres providers ne sont pas encore branchés (à venir) → réponse claire.
// AUCUNE clé en clair n'est jamais loggée ni renvoyée.
// ──────────────────────────────────────────────────────────────────────────

export const runtime = "nodejs";

// Providers réellement branchés en live dans cette version.
const AVAILABLE: AIProviderId[] = ["openai"];

export async function POST(req: Request) {
  let provider: AIProviderId | undefined;
  let apiKey: string | undefined;

  // 1) Parsing robuste du body.
  try {
    const body = await req.json();
    provider = body?.provider;
    apiKey = body?.apiKey;
  } catch {
    return NextResponse.json({ ok: false, error: "Corps de requête illisible (JSON attendu)." }, { status: 400 });
  }

  // 2) Logs serveur SÛRS (jamais la clé en clair).
  const keyLen = apiKey ? apiKey.trim().length : 0;
  const prefix = apiKey ? apiKey.trim().slice(0, 3) + "…" : "(absente)";
  console.log("[Orkestra] /api/keys/test", {
    provider: provider ?? "(absent)",
    hasApiKey: Boolean(apiKey),
    keyLength: keyLen,
    keyPrefix: prefix,
    env: process.env.VERCEL_ENV || process.env.NODE_ENV || "dev",
    mockMode: !isMockMode() ? false : true,
    keyStore: keyStoreBackend(),
  });

  // 3) Validations d'entrée → messages précis.
  if (!provider || !PROVIDERS[provider]) {
    return NextResponse.json({ ok: false, error: "Provider non supporté.", code: "bad_provider" }, { status: 400 });
  }
  const meta = PROVIDERS[provider];
  if (!apiKey || keyLen < 8) {
    return NextResponse.json({ ok: false, error: "Clé API absente ou trop courte.", code: "missing_key" }, { status: 400 });
  }

  // 4) Providers non encore branchés → message clair (pas d'erreur rouge).
  if (!AVAILABLE.includes(provider)) {
    return NextResponse.json({
      ok: false,
      error: `${meta.name} : bientôt disponible. Seul OpenAI est branché en live dans cette version.`,
      code: "not_available",
    });
  }

  const key = apiKey.trim();

  // 5) En production, exiger la clé de chiffrement.
  if (process.env.NODE_ENV === "production" && !hasMasterKey()) {
    return NextResponse.json({
      ok: false,
      error: "Configuration serveur incomplète : ENCRYPTION_MASTER_KEY manquante. Ajoutez-la dans Vercel pour stocker vos clés de façon sécurisée.",
      code: "missing_master_key",
    });
  }

  // 6) Vrai ping OpenAI (la validation principale, pas le préfixe).
  let model = meta.defaultModel;
  try {
    const test = await testOpenAIKey(key);
    if (!test.ok) {
      return NextResponse.json({ ok: false, error: test.message, code: test.code });
    }
    model = test.models.includes("gpt-4o") ? "gpt-4o" : test.models[0] || meta.defaultModel;
  } catch {
    return NextResponse.json({ ok: false, error: "Impossible de joindre OpenAI (réseau).", code: "network" });
  }

  // 7) Sauvegarde chiffrée — erreur distincte si elle échoue.
  try {
    const stored = await saveKey({
      provider,
      encrypted: encryptSecret(key),
      maskedKey: maskApiKey(key),
      model,
      status: "connected",
    });
    return NextResponse.json({ ok: true, keyId: stored.id, maskedKey: stored.maskedKey, model, live: true });
  } catch (e: any) {
    console.error("[Orkestra] Échec sauvegarde clé:", e?.code || e?.name || "unknown");
    return NextResponse.json({
      ok: false,
      error: "Connexion OpenAI validée, mais sauvegarde impossible : vérifiez la table Prisma (lancez `prisma db push`) ou DATABASE_URL.",
      code: "save_failed",
    });
  }
}

import { NextResponse } from "next/server";
import { encryptSecret, maskApiKey, hasMasterKey } from "@/lib/crypto";
import { PROVIDERS } from "@/lib/providers";
import { isMockMode } from "@/lib/ai/adapter";
import { testOpenAIKey } from "@/lib/ai/openai";
import { saveKey } from "@/lib/server/keyStore";
import type { AIProviderId } from "@/lib/types";

// ──────────────────────────────────────────────────────────────────────────
// POST /api/keys/test
//
// OpenAI : vrai ping (GET /models) pour valider la clé, puis stockage CHIFFRÉ
// côté serveur. Renvoie un `keyId` opaque + la version masquée — JAMAIS la clé
// en clair. Les autres providers : validation de préfixe + stockage (live à venir).
// ──────────────────────────────────────────────────────────────────────────

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { provider, apiKey } = (await req.json()) as { provider: AIProviderId; apiKey: string };

    const meta = PROVIDERS[provider];
    if (!meta) return NextResponse.json({ ok: false, error: "Provider inconnu." }, { status: 400 });
    if (!apiKey || apiKey.trim().length < 8) return NextResponse.json({ ok: false, error: "Clé trop courte." }, { status: 400 });

    const key = apiKey.trim();

    // En production, refuser de stocker une clé sans clé de chiffrement dédiée.
    if (process.env.NODE_ENV === "production" && !hasMasterKey()) {
      return NextResponse.json({
        ok: false,
        error:
          "Configuration serveur incomplète : ENCRYPTION_MASTER_KEY manquante. Définissez-la dans les variables d'environnement pour stocker vos clés API de façon sécurisée.",
        code: "missing_master_key",
      });
    }

    // ── OpenAI : vrai test de connexion ──
    if (provider === "openai") {
      const test = await testOpenAIKey(key);
      if (!test.ok) {
        return NextResponse.json({ ok: false, error: test.message, code: test.code });
      }
      const model = test.models.includes("gpt-4o") ? "gpt-4o" : test.models[0] || meta.defaultModel;
      const stored = await saveKey({
        provider,
        encrypted: encryptSecret(key),
        maskedKey: maskApiKey(key),
        model,
        status: "connected",
      });
      return NextResponse.json({ ok: true, keyId: stored.id, maskedKey: stored.maskedKey, model, live: true });
    }

    // ── Autres providers : validation légère + stockage (live à venir) ──
    const prefixOk = !meta.keyPrefix || key.startsWith(meta.keyPrefix);
    if (!prefixOk) {
      return NextResponse.json({
        ok: false,
        error: `Cette clé ne ressemble pas à une clé ${meta.name} (préfixe attendu : ${meta.keyPrefix}).`,
      });
    }
    const stored = await saveKey({
      provider,
      encrypted: encryptSecret(key),
      maskedKey: maskApiKey(key),
      model: meta.defaultModel,
      status: "connected",
    });
    return NextResponse.json({
      ok: true,
      keyId: stored.id,
      maskedKey: stored.maskedKey,
      model: meta.defaultModel,
      live: false,
      mocked: isMockMode(),
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Requête invalide." }, { status: 400 });
  }
}

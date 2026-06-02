import { NextResponse } from "next/server";
import { encryptSecret, maskApiKey } from "@/lib/crypto";
import { PROVIDERS } from "@/lib/providers";
import { isMockMode } from "@/lib/ai/adapter";
import type { AIProviderId } from "@/lib/types";

// ──────────────────────────────────────────────────────────────────────────
// POST /api/keys/test
//
// Reçoit { provider, apiKey }. Valide le format, (en mode live) ferait un
// ping minimal au provider, chiffre la clé (AES-256-GCM) et NE renvoie qu'une
// version masquée. La clé en clair ne quitte jamais le serveur.
//
// En V1 (mock), on valide le préfixe et on simule un succès. Le blob chiffré
// est prêt à être persisté en base (table api_keys) côté production.
// ──────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const { provider, apiKey } = (await req.json()) as {
      provider: AIProviderId;
      apiKey: string;
    };

    const meta = PROVIDERS[provider];
    if (!meta) {
      return NextResponse.json({ ok: false, error: "Provider inconnu." }, { status: 400 });
    }
    if (!apiKey || apiKey.trim().length < 8) {
      return NextResponse.json({ ok: false, error: "Clé trop courte." }, { status: 400 });
    }

    // Validation légère du préfixe (n'échoue pas dur pour rester tolérant).
    const prefixOk = !meta.keyPrefix || apiKey.trim().startsWith(meta.keyPrefix);

    // Chiffrement — prêt à persister. (Non loggé, non renvoyé.)
    const encrypted = encryptSecret(apiKey.trim());
    void encrypted; // TODO: persister en base via Prisma (table api_keys)

    if (!isMockMode()) {
      // TODO V1.1 : ping réel du provider pour valider la clé avant succès.
    }

    if (!prefixOk) {
      return NextResponse.json({
        ok: false,
        error: `Cette clé ne ressemble pas à une clé ${meta.name} (préfixe attendu : ${meta.keyPrefix}).`,
      });
    }

    return NextResponse.json({
      ok: true,
      maskedKey: maskApiKey(apiKey),
      model: meta.defaultModel,
      mocked: isMockMode(),
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Requête invalide." }, { status: 400 });
  }
}

import { NextResponse } from "next/server";
import { getEncrypted } from "@/lib/server/keyStore";
import { decryptSecret } from "@/lib/crypto";

// ──────────────────────────────────────────────────────────────────────────
// POST /api/voice/realtime/session — crée une session OpenAI Realtime et renvoie
// un TOKEN ÉPHÉMÈRE (client_secret) au navigateur. La vraie clé API n'est JAMAIS
// renvoyée ni loggée. Le front ouvre ensuite la session WebRTC avec ce token.
// ──────────────────────────────────────────────────────────────────────────

export const runtime = "nodejs";
export const maxDuration = 20;

const MODEL = (process.env.OPENAI_REALTIME_MODEL || "gpt-4o-realtime-preview").trim();
const VOICE = (process.env.OPENAI_REALTIME_VOICE || "alloy").trim();

async function resolveOpenAIKey(ref?: string | null): Promise<string | null> {
  if (ref) {
    const stored = await getEncrypted(ref);
    if (stored) { try { return decryptSecret(stored.encrypted); } catch { /* illisible */ } }
  }
  const env = (process.env.OPENAI_API_KEY || "").trim();
  return env || null;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const key = await resolveOpenAIKey(body?.keyRefs?.openai);
  if (!key) {
    console.log("[Voice]", { event: "realtime-session-create-error", reason: "no-key" });
    return NextResponse.json({ ok: false, reason: "no-key", error: "Connectez OpenAI dans « Connecter mes IA » pour activer la voix temps réel." });
  }
  console.log("[Voice]", { event: "realtime-session-create-start", model: MODEL });
  try {
    const res = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, voice: VOICE }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      const reason = res.status === 401 ? "invalid-key" : res.status === 403 || /must be verified|realtime/i.test(t) ? "no-access" : "http";
      console.log("[Voice]", { event: "realtime-session-create-error", status: res.status, reason });
      const msg = reason === "invalid-key" ? "Clé OpenAI invalide." : reason === "no-access" ? "Votre compte OpenAI n'a pas accès à l'API Realtime (vérification requise)." : `OpenAI Realtime indisponible (HTTP ${res.status}).`;
      return NextResponse.json({ ok: false, reason, error: msg });
    }
    const data = (await res.json()) as { client_secret?: { value?: string; expires_at?: number } };
    const clientSecret = data.client_secret?.value;
    if (!clientSecret) {
      console.log("[Voice]", { event: "realtime-session-create-error", reason: "no-secret" });
      return NextResponse.json({ ok: false, reason: "no-secret", error: "Token éphémère manquant." });
    }
    console.log("[Voice]", { event: "realtime-session-create-ok", model: MODEL });
    return NextResponse.json({ ok: true, clientSecret, model: MODEL, voice: VOICE, expiresAt: data.client_secret?.expires_at });
  } catch {
    console.log("[Voice]", { event: "realtime-session-create-error", reason: "network" });
    return NextResponse.json({ ok: false, reason: "network", error: "Impossible de joindre OpenAI (réseau)." });
  }
}

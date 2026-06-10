import { NextResponse } from "next/server";
import { getEncrypted } from "@/lib/server/keyStore";
import { decryptSecret } from "@/lib/crypto";

// ──────────────────────────────────────────────────────────────────────────
// POST /api/voice/gemini-live/session — crée un TOKEN ÉPHÉMÈRE Gemini Live.
// La vraie clé Gemini (BYOK /connect ou env) reste côté serveur. Le navigateur
// ouvre la session WebSocket Live avec ce token éphémère uniquement.
// ──────────────────────────────────────────────────────────────────────────

export const runtime = "nodejs";
export const maxDuration = 20;

// Modèle Live par défaut : « half-cascade » 2.5 (stable + function calling fiable,
// idéal pour nos outils Orkestra). gemini-2.0-flash-live-001 est arrêté (juin 2026).
// Surchargeable via GEMINI_LIVE_MODEL (ex. gemini-2.5-flash-native-audio-preview-12-2025
// pour la voix native, au prix d'un tool calling moins fiable).
const MODEL = (process.env.GEMINI_LIVE_MODEL || "gemini-live-2.5-flash-preview").trim();
const BASE = "https://generativelanguage.googleapis.com";

async function resolveGeminiKey(ref?: string | null): Promise<string | null> {
  if (ref) {
    const stored = await getEncrypted(ref);
    if (stored) { try { return decryptSecret(stored.encrypted); } catch { /* illisible */ } }
  }
  const env = (process.env.GEMINI_API_KEY || "").trim();
  return env || null;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const key = await resolveGeminiKey(body?.keyRefs?.gemini);
  if (!key) {
    console.log("[Voice]", { event: "gemini-live-session-error", reason: "no-key" });
    return NextResponse.json({ ok: false, reason: "no-key", error: "Connectez Gemini dans « Connecter mes IA » pour la voix temps réel." });
  }
  console.log("[Voice]", { event: "gemini-live-session-start", model: MODEL });
  try {
    const now = Date.now();
    const res = await fetch(`${BASE}/v1alpha/auth_tokens?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uses: 1,
        expireTime: new Date(now + 15 * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(now + 2 * 60 * 1000).toISOString(),
        liveConnectConstraints: { model: `models/${MODEL}` },
      }),
    });
    if (!res.ok) {
      console.log("[Voice]", { event: "gemini-live-session-error", status: res.status });
      return NextResponse.json({ ok: false, reason: res.status === 401 || res.status === 403 ? "invalid-key" : "no-access", error: "Gemini Live indisponible. Orkestra reste disponible en mode texte intelligent." });
    }
    const data = (await res.json()) as { name?: string };
    if (!data.name) {
      console.log("[Voice]", { event: "gemini-live-session-error", reason: "no-token" });
      return NextResponse.json({ ok: false, reason: "no-token", error: "Token Gemini Live manquant." });
    }
    console.log("[Voice]", { event: "gemini-live-session-ok", model: MODEL });
    return NextResponse.json({ ok: true, token: data.name, model: MODEL });
  } catch {
    console.log("[Voice]", { event: "gemini-live-session-error", reason: "network" });
    return NextResponse.json({ ok: false, reason: "network", error: "Impossible de joindre Gemini (réseau)." });
  }
}

import { NextResponse } from "next/server";
import { getEncrypted } from "@/lib/server/keyStore";
import { decryptSecret } from "@/lib/crypto";

// ──────────────────────────────────────────────────────────────────────────
// POST /api/voice/gemini-live/resolve-key — résolution BYOK pour le PROXY.
//
// Appelée UNIQUEMENT en serveur-à-serveur par le proxy WebSocket Orkestra
// (hébergé séparément, ex. Railway/Render/Fly), protégée par un secret partagé
// VOICE_PROXY_SECRET que le navigateur ne possède jamais. Renvoie la clé Gemini
// déchiffrée au seul proxy authentifié — jamais au navigateur, jamais loggée.
//
// Sans VOICE_PROXY_SECRET configuré → endpoint désactivé (401). Le proxy peut
// alors retomber sur sa propre variable GEMINI_API_KEY.
// ──────────────────────────────────────────────────────────────────────────

export const runtime = "nodejs";
export const maxDuration = 15;

export async function POST(req: Request) {
  const secret = (process.env.VOICE_PROXY_SECRET || "").trim();
  const provided = req.headers.get("x-orkestra-proxy-secret") || "";
  if (!secret || provided !== secret) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const keyId = typeof body?.keyId === "string" ? body.keyId : "";
  if (!keyId) return NextResponse.json({ ok: false, reason: "no-keyid" }, { status: 400 });

  const stored = await getEncrypted(keyId);
  if (!stored) return NextResponse.json({ ok: false, reason: "not-found" }, { status: 404 });
  try {
    const key = decryptSecret(stored.encrypted);
    // Clé renvoyée au proxy authentifié uniquement. Aucun console.log de la clé.
    return NextResponse.json({ ok: true, key });
  } catch {
    return NextResponse.json({ ok: false, reason: "decrypt" }, { status: 500 });
  }
}

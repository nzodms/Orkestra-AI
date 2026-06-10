// ──────────────────────────────────────────────────────────────────────────
// Orkestra Voice — Proxy WebSocket Gemini Live (serveur Node autonome).
//
// Navigateur → WS interne Orkestra (/voice) → Gemini Live (clé côté serveur).
// La vraie clé Gemini ne transite JAMAIS par le navigateur et n'est jamais loggée.
//
// POURQUOI un serveur séparé : Vercel (Serverless ET Edge) ne peut pas héberger
// de WebSocket serveur persistant. Déployez CE dossier sur Railway / Render /
// Fly.io / un petit serveur Node, puis pointez NEXT_PUBLIC_VOICE_PROXY_URL
// (côté app Next) vers wss://<host>/voice.
//
// Le proxy est un TUYAU transparent pour le protocole BidiGenerateContent :
//   - il injecte la clé à l'ouverture de la WS Google ;
//   - il relaie ensuite les trames texte (JSON) dans les deux sens à l'identique.
// Les appels d'outils (toolCall) sont relayés AU CLIENT, qui les exécute avec
// le contexte Orkestra (cards, session) puis renvoie la réponse — rien à
// dupliquer côté proxy, et l'UI riche reste intacte.
// ──────────────────────────────────────────────────────────────────────────

import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";

const PORT = Number(process.env.PORT || 8787);
const GOOGLE_WS =
  process.env.GEMINI_LIVE_WS_BASE ||
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";
const MODEL = (process.env.GEMINI_LIVE_MODEL || "gemini-live-2.5-flash-preview").trim();
const ENV_KEY = (process.env.GEMINI_API_KEY || "").trim();
const RESOLVE_URL = (process.env.ORKESTRA_RESOLVE_URL || "").trim(); // .../api/voice/gemini-live/resolve-key
const RESOLVE_SECRET = (process.env.VOICE_PROXY_SECRET || "").trim();
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",").map((s) => s.trim()).filter(Boolean);

function log(event, extra) {
  // N'écrit JAMAIS la clé. Diagnostic uniquement.
  try { console.log("[VoiceProxy]", JSON.stringify({ event, ...(extra || {}) })); }
  catch { console.log("[VoiceProxy]", event); }
}

/** Résout la clé Gemini : BYOK via Orkestra (préféré) sinon variable d'env. */
async function resolveKey(keyId) {
  if (keyId && RESOLVE_URL && RESOLVE_SECRET) {
    try {
      const r = await fetch(RESOLVE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-orkestra-proxy-secret": RESOLVE_SECRET },
        body: JSON.stringify({ keyId }),
      });
      if (r.ok) { const d = await r.json().catch(() => ({})); if (d && d.key) return d.key; }
    } catch { /* tombe sur la clé d'env */ }
  }
  return ENV_KEY || null;
}

const server = http.createServer((req, res) => {
  if (req.url === "/health" || req.url === "/") { res.writeHead(200, { "Content-Type": "text/plain" }); res.end("ok"); return; }
  res.writeHead(404); res.end();
});

const wss = new WebSocketServer({ server, path: "/voice" });

wss.on("connection", (client, req) => {
  const origin = req.headers.origin || "";
  if (ALLOWED_ORIGINS.length && !ALLOWED_ORIGINS.includes(origin)) {
    log("gemini-live-proxy-error", { reason: "origin-refused", origin });
    try { client.close(1008, "origin"); } catch { /* */ }
    return;
  }
  log("gemini-live-proxy-connected-client", { origin });

  let google = null;
  let firstUp = true, firstDown = true;
  const pending = []; // trames client reçues avant que Google soit prêt

  async function openGoogle(keyId) {
    const key = await resolveKey(keyId);
    if (!key) {
      log("gemini-live-proxy-error", { reason: "no-key" });
      try { client.send(JSON.stringify({ type: "orkestra-error", reason: "no-key", error: "Clé Gemini absente côté proxy." })); } catch { /* */ }
      try { client.close(1011, "no-key"); } catch { /* */ }
      return;
    }
    google = new WebSocket(`${GOOGLE_WS}?key=${encodeURIComponent(key)}`);

    google.on("open", () => {
      log("gemini-live-proxy-connected-google", {});
      try { client.send(JSON.stringify({ type: "orkestra-ready", model: MODEL })); } catch { /* */ }
      for (const m of pending) { try { google.send(m); } catch { /* */ } }
      pending.length = 0;
    });
    google.on("message", (data) => {
      const s = data.toString();
      if (firstDown) { firstDown = false; log("gemini-live-proxy-audio-google-to-client", {}); }
      if (s.length < 4000 && s.includes('"toolCall"')) log("gemini-live-proxy-tool-call", {});
      try { client.send(s); } catch { /* */ } // trame texte (JSON) à l'identique
    });
    google.on("close", (code, reason) => {
      log("gemini-live-proxy-close", { side: "google", code });
      try { client.close(code >= 3000 || code < 1000 ? 1011 : code, reason ? reason.toString() : ""); } catch { /* */ }
    });
    google.on("error", () => {
      log("gemini-live-proxy-error", { side: "google" });
      try { client.send(JSON.stringify({ type: "orkestra-error", reason: "google-ws", error: "Connexion Gemini impossible côté proxy." })); } catch { /* */ }
    });
  }

  client.on("message", async (data) => {
    const text = data.toString();
    // Message de CONTRÔLE init (résolution clé + ouverture Google).
    if (text.startsWith("{")) {
      let msg = null; try { msg = JSON.parse(text); } catch { /* trame opaque */ }
      if (msg && msg.type === "orkestra-init") { await openGoogle(msg.keyId || null); return; }
      if (msg && msg.toolResponse) log("gemini-live-proxy-tool-result", {});
    }
    if (firstUp) { firstUp = false; log("gemini-live-proxy-audio-client-to-google", {}); }
    if (google && google.readyState === WebSocket.OPEN) { try { google.send(text); } catch { /* */ } }
    else pending.push(text);
  });

  client.on("close", (code) => { log("gemini-live-proxy-close", { side: "client", code }); try { google && google.close(); } catch { /* */ } });
  client.on("error", () => { log("gemini-live-proxy-error", { side: "client" }); try { google && google.close(); } catch { /* */ } });
});

server.listen(PORT, () => log("gemini-live-proxy-start", { port: PORT, model: MODEL, byok: !!(RESOLVE_URL && RESOLVE_SECRET), envKey: !!ENV_KEY }));

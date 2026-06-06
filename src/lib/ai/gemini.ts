import type { ChatOk, OpenAIError } from "./openai";

// ──────────────────────────────────────────────────────────────────────────
// Client Google Gemini (Generative Language API) — fetch direct, côté serveur.
// Rôles Orkestra Lens : analyse image (multimodal) + recherche web via Google
// Search grounding (si disponible). BYOK, clé jamais loggée. Même forme de retour
// (ChatOk | OpenAIError) que les autres clients pour un routing homogène.
// ──────────────────────────────────────────────────────────────────────────

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const TIMEOUT = 30000;

export interface GeminiTestOk { ok: true; models: string[] }
export type GeminiTestResult = GeminiTestOk | OpenAIError;

/** Résultat de recherche web (grounding) : liens réels + requêtes utilisées. */
export interface GroundedSearchResult {
  ok: true;
  text: string;
  web: { url: string; title: string }[];
  queries: string[];
}

function mapStatus(status: number, body?: string): OpenAIError {
  if (status === 400 && /API key not valid|API_KEY_INVALID/i.test(body || "")) return { ok: false, code: "invalid_key", message: "Clé API Gemini invalide." };
  if (status === 401 || status === 403) return { ok: false, code: "invalid_key", message: "Clé API Gemini invalide ou non autorisée." };
  if (status === 429) return { ok: false, code: "rate_limit", message: "Limite de débit Gemini atteinte. Réessayez dans un instant." };
  if (status === 404) return { ok: false, code: "model", message: "Modèle Gemini inaccessible avec cette clé." };
  return { ok: false, code: "unknown", message: `Erreur Gemini (HTTP ${status}).` };
}
async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try { return await fn(ctrl.signal); } finally { clearTimeout(t); }
}

/** Vrai ping Gemini : valide la clé via GET /models. */
export async function testGeminiKey(apiKey: string): Promise<GeminiTestResult> {
  try {
    return await withTimeout(async (signal) => {
      const res = await fetch(`${GEMINI_BASE}/models?key=${encodeURIComponent(apiKey)}`, { signal });
      if (!res.ok) { const body = await res.text().catch(() => ""); return mapStatus(res.status, body); }
      const data = (await res.json()) as { models?: { name?: string; supportedGenerationMethods?: string[] }[] };
      const models = (data.models || [])
        .map((m) => (m.name || "").replace(/^models\//, ""))
        .filter((id) => /^gemini-/.test(id))
        .slice(0, 20);
      return { ok: true, models };
    });
  } catch {
    return { ok: false, code: "network", message: "Impossible de joindre Gemini (réseau)." };
  }
}

// Construit une partie inline_data (base64) depuis une data URL ou une URL http.
async function toInlineData(image: string, signal: AbortSignal): Promise<{ mime_type: string; data: string } | null> {
  if (image.startsWith("data:")) {
    const m = image.match(/^data:([^;]+);base64,(.*)$/);
    if (!m) return null;
    return { mime_type: m[1], data: m[2] };
  }
  if (/^https?:\/\//i.test(image)) {
    const res = await fetch(image, { signal });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = res.headers.get("content-type") || "image/jpeg";
    return { mime_type: mime.split(";")[0], data: buf.toString("base64") };
  }
  return null;
}

function extractText(data: unknown): string {
  const parts = (data as { candidates?: { content?: { parts?: { text?: string }[] } }[] })?.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text || "").join("").trim();
}

/** Analyse multimodale Gemini (image + texte) → JSON si demandé. */
export async function geminiVision(apiKey: string, model: string, system: string, prompt: string, image: string, json = true): Promise<ChatOk | OpenAIError> {
  try {
    return await withTimeout(async (signal) => {
      const inline = await toInlineData(image, signal);
      if (!inline) return { ok: false, code: "unknown", message: "Image illisible pour Gemini." };
      const res = await fetch(`${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: prompt }, { inline_data: inline }] }],
          generationConfig: { temperature: 0.3, ...(json ? { responseMimeType: "application/json" } : {}) },
        }),
      });
      if (!res.ok) { const body = await res.text().catch(() => ""); return mapStatus(res.status, body); }
      const data = await res.json();
      const text = extractText(data);
      if (!text) return { ok: false, code: "unknown", message: "Réponse Gemini vide." };
      return { ok: true, text, model, tokens: 0 };
    });
  } catch {
    return { ok: false, code: "network", message: "Impossible de joindre Gemini (réseau)." };
  }
}

/** Recherche web Gemini via Google Search grounding (si disponible). */
export async function geminiGroundedSearch(apiKey: string, model: string, query: string): Promise<GroundedSearchResult | OpenAIError> {
  const run = async (tool: Record<string, unknown>, signal: AbortSignal) => {
    const res = await fetch(`${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, signal,
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: query }] }],
        tools: [tool],
        generationConfig: { temperature: 0.2 },
      }),
    });
    return res;
  };
  try {
    return await withTimeout(async (signal) => {
      // Gemini 2.x : google_search ; repli 1.5 : google_search_retrieval.
      let res = await run({ google_search: {} }, signal);
      if (!res.ok && res.status === 400) res = await run({ google_search_retrieval: {} }, signal);
      if (!res.ok) { const body = await res.text().catch(() => ""); return mapStatus(res.status, body); }
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] }; groundingMetadata?: { groundingChunks?: { web?: { uri?: string; title?: string } }[]; webSearchQueries?: string[] } }[];
      };
      const gm = data.candidates?.[0]?.groundingMetadata;
      const web = (gm?.groundingChunks || [])
        .map((c) => ({ url: c.web?.uri || "", title: c.web?.title || "" }))
        .filter((w) => w.url);
      return { ok: true, text: extractText(data), web, queries: gm?.webSearchQueries || [] };
    });
  } catch {
    return { ok: false, code: "network", message: "Impossible de joindre Gemini (réseau)." };
  }
}

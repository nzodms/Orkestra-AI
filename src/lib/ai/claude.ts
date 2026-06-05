import type { ChatInput, ChatOk, OpenAIError } from "./openai";

// ──────────────────────────────────────────────────────────────────────────
// Client Claude (Anthropic Messages API) — fetch direct, sans SDK, côté serveur.
// Préparé pour la relecture éditoriale premium d'Import Factory. N'est appelé
// que si une clé Claude est connectée (BYOK). La clé n'est jamais loggée.
// Retourne la MÊME forme que le client OpenAI (ChatOk | OpenAIError) pour que
// le routing reste homogène.
// ──────────────────────────────────────────────────────────────────────────

const ANTHROPIC_BASE = "https://api.anthropic.com/v1";
const ANTHROPIC_VERSION = "2023-06-01";
const TIMEOUT = 45000;

function mapStatus(status: number, body?: string): OpenAIError {
  if (status === 401) return { ok: false, code: "invalid_key", message: "Clé API Claude invalide ou révoquée." };
  if (status === 429) {
    const quota = body && /quota|credit|billing|insufficient/i.test(body);
    return quota
      ? { ok: false, code: "quota", message: "Quota Claude dépassé (vérifiez votre facturation Anthropic)." }
      : { ok: false, code: "rate_limit", message: "Limite de débit Claude atteinte. Réessayez dans un instant." };
  }
  if (status === 404) return { ok: false, code: "model", message: "Modèle Claude inaccessible avec cette clé." };
  return { ok: false, code: "unknown", message: `Erreur Claude (HTTP ${status}).` };
}

async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try { return await fn(ctrl.signal); } finally { clearTimeout(t); }
}

/** Complétion Claude (Anthropic Messages). `json:true` demande une sortie JSON pure. */
export async function claudeComplete(input: ChatInput): Promise<ChatOk | OpenAIError> {
  try {
    return await withTimeout(async (signal) => {
      const system = input.json
        ? `${input.system}\nRéponds UNIQUEMENT par un objet JSON valide, sans texte autour, sans bloc Markdown.`
        : input.system;
      const res = await fetch(`${ANTHROPIC_BASE}/messages`, {
        method: "POST",
        headers: {
          "x-api-key": input.apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
          "Content-Type": "application/json",
        },
        signal,
        body: JSON.stringify({
          model: input.model,
          max_tokens: input.maxTokens ?? 4096,
          temperature: input.temperature ?? 0.5,
          system,
          messages: [{ role: "user", content: input.prompt }],
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return mapStatus(res.status, body);
      }
      const data = (await res.json()) as {
        content?: { type: string; text?: string }[];
        usage?: { input_tokens?: number; output_tokens?: number };
        model?: string;
      };
      let text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text || "").join("").trim();
      // Sécurité : retire un éventuel bloc ```json ... ``` si le modèle en ajoute un.
      if (input.json) text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      if (!text) return { ok: false, code: "unknown", message: "Réponse Claude vide." };
      const tokens = (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0);
      return { ok: true, text, model: data.model || input.model, tokens };
    });
  } catch {
    return { ok: false, code: "network", message: "Impossible de joindre Claude (réseau)." };
  }
}

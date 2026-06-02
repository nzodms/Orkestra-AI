// ──────────────────────────────────────────────────────────────────────────
// Client OpenAI réel (fetch direct, sans SDK pour rester léger).
// Utilisé uniquement côté serveur. La clé n'est jamais loggée.
// ──────────────────────────────────────────────────────────────────────────

const OPENAI_BASE = "https://api.openai.com/v1";
const TIMEOUT = 30000;

export interface OpenAIError {
  ok: false;
  code: "invalid_key" | "rate_limit" | "quota" | "model" | "network" | "unknown";
  message: string;
}
export interface OpenAITestOk {
  ok: true;
  models: string[];
}

export type OpenAITestResult = OpenAITestOk | OpenAIError;

function mapStatus(status: number, body?: string): OpenAIError {
  if (status === 401) return { ok: false, code: "invalid_key", message: "Clé API OpenAI invalide ou révoquée." };
  if (status === 429) {
    const quota = body && /quota|billing|insufficient/i.test(body);
    return quota
      ? { ok: false, code: "quota", message: "Quota OpenAI dépassé (vérifiez votre facturation)." }
      : { ok: false, code: "rate_limit", message: "Limite de débit OpenAI atteinte. Réessayez dans un instant." };
  }
  if (status === 404) return { ok: false, code: "model", message: "Modèle inaccessible avec cette clé." };
  return { ok: false, code: "unknown", message: `Erreur OpenAI (HTTP ${status}).` };
}

async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    return await fn(ctrl.signal);
  } finally {
    clearTimeout(t);
  }
}

/** Vrai ping OpenAI : valide la clé via GET /models. */
export async function testOpenAIKey(apiKey: string): Promise<OpenAITestResult> {
  try {
    return await withTimeout(async (signal) => {
      const res = await fetch(`${OPENAI_BASE}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return mapStatus(res.status, body);
      }
      const data = (await res.json()) as { data?: { id: string }[] };
      const models = (data.data || []).map((m) => m.id).filter((id) => /^gpt-/.test(id)).slice(0, 20);
      return { ok: true, models };
    });
  } catch {
    return { ok: false, code: "network", message: "Impossible de joindre OpenAI (réseau)." };
  }
}

export interface ChatInput {
  apiKey: string;
  model: string;
  system: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
}
export interface ChatOk {
  ok: true;
  text: string;
  model: string;
  tokens: number;
}

export async function chatComplete(input: ChatInput): Promise<ChatOk | OpenAIError> {
  try {
    return await withTimeout(async (signal) => {
      const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${input.apiKey}`, "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          model: input.model,
          temperature: input.temperature ?? 0.5,
          max_tokens: input.maxTokens ?? 1800,
          ...(input.json ? { response_format: { type: "json_object" } } : {}),
          messages: [
            { role: "system", content: input.system },
            { role: "user", content: input.prompt },
          ],
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return mapStatus(res.status, body);
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
        usage?: { total_tokens?: number };
        model?: string;
      };
      const text = data.choices?.[0]?.message?.content?.trim() || "";
      if (!text) return { ok: false, code: "unknown", message: "Réponse OpenAI vide." };
      return { ok: true, text, model: data.model || input.model, tokens: data.usage?.total_tokens ?? 0 };
    });
  } catch {
    return { ok: false, code: "network", message: "Impossible de joindre OpenAI (réseau)." };
  }
}

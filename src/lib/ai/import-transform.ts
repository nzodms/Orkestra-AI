import { liveEnabled } from "./generate";
import { chatComplete } from "./openai";
import { getEncrypted } from "../server/keyStore";
import { decryptSecret } from "../crypto";
import {
  buildTransformSystem,
  buildTransformPrompt,
  coerceTransformed,
  type ImportProductInput,
  type ImportRules,
  type ImportMemory,
  type ImportContext,
  type TransformedProduct,
} from "../import-factory";

// ──────────────────────────────────────────────────────────────────────────
// Import Factory — transformation LIVE via OpenAI (côté serveur uniquement).
// OpenAI est OBLIGATOIRE : aucun fallback mock ne prétend transformer un vrai
// catalogue. Si OpenAI n'est pas disponible/connecté → erreur explicite.
// ──────────────────────────────────────────────────────────────────────────

export interface ImportKeyRefs {
  openai?: string | null;
}

export interface ImportTransformResult {
  ok: boolean;
  live: boolean;
  results?: TransformedProduct[];
  error?: string;
  model?: string;
  tokens?: number;
}

async function resolveKey(refs?: ImportKeyRefs): Promise<{ apiKey: string; model: string } | null> {
  if (!refs?.openai) return null;
  const stored = await getEncrypted(refs.openai);
  if (!stored) return null;
  try {
    return { apiKey: decryptSecret(stored.encrypted), model: stored.meta.model || "gpt-4o" };
  } catch {
    return null;
  }
}

export async function runImportTransform(
  products: ImportProductInput[],
  rules: ImportRules,
  mem: ImportMemory,
  ctx: ImportContext,
  refs?: ImportKeyRefs
): Promise<ImportTransformResult> {
  if (!products.length) return { ok: false, live: false, error: "Aucun produit à transformer." };
  if (!liveEnabled()) return { ok: false, live: false, error: "OpenAI requis : la transformation de catalogue n'est pas disponible en mode démo." };
  const key = await resolveKey(refs);
  if (!key) return { ok: false, live: false, error: "Aucune clé OpenAI connectée. Connectez OpenAI pour transformer votre catalogue." };

  const system = buildTransformSystem(rules);
  const prompt = buildTransformPrompt(products, rules, mem, ctx);
  const r = await chatComplete({ apiKey: key.apiKey, model: key.model, system, prompt, temperature: 0.5, maxTokens: 4096, json: true });
  if (!r.ok) return { ok: false, live: true, error: r.message };

  try {
    const parsed = JSON.parse(r.text) as { products?: unknown[] };
    const list = Array.isArray(parsed.products) ? parsed.products : [];
    const byHandle = new Map<string, unknown>();
    for (const it of list) {
      const h = (it as { handle?: string })?.handle;
      if (typeof h === "string") byHandle.set(h, it);
    }
    const results = products.map((p, i) => coerceTransformed(byHandle.get(p.handle) ?? list[i] ?? {}, p));
    return { ok: true, live: true, results, model: r.model, tokens: r.tokens };
  } catch {
    return { ok: false, live: true, error: "Réponse OpenAI non exploitable (JSON invalide). Réessayez ou réduisez la taille du lot." };
  }
}

import { liveEnabled } from "./generate";
import { chatComplete } from "./openai";
import { getEncrypted } from "../server/keyStore";
import { decryptSecret } from "../crypto";
import { planImportModels } from "./import-models";
import { refineEditorialWithClaude } from "./import-editorial";
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
  claude?: string | null;
}

export interface ImportTransformResult {
  ok: boolean;
  live: boolean;
  results?: TransformedProduct[];
  error?: string;
  model?: string;
  tokens?: number;
  /** Badge UX : « OpenAI · QC déterministe » ou « OpenAI + Claude · QC déterministe ». */
  badge?: string;
  /** La relecture éditoriale Claude a-t-elle réellement tourné ? */
  editorial?: boolean;
}

async function resolveKey(ref?: string | null, fallbackModel = "gpt-4o"): Promise<{ apiKey: string; model: string } | null> {
  if (!ref) return null;
  const stored = await getEncrypted(ref);
  if (!stored) return null;
  try {
    return { apiKey: decryptSecret(stored.encrypted), model: stored.meta.model || fallbackModel };
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
  const key = await resolveKey(refs?.openai, "gpt-4o");
  if (!key) return { ok: false, live: false, error: "Aucune clé OpenAI connectée. Connectez OpenAI pour transformer votre catalogue." };

  // 1) Transformation structurée — OpenAI (obligatoire).
  const system = buildTransformSystem(rules);
  const prompt = buildTransformPrompt(products, rules, mem, ctx);
  const r = await chatComplete({ apiKey: key.apiKey, model: key.model, system, prompt, temperature: 0.5, maxTokens: 4096, json: true });
  if (!r.ok) return { ok: false, live: true, error: r.message };

  let results: TransformedProduct[];
  try {
    const parsed = JSON.parse(r.text) as { products?: unknown[] };
    const list = Array.isArray(parsed.products) ? parsed.products : [];
    const byHandle = new Map<string, unknown>();
    for (const it of list) {
      const h = (it as { handle?: string })?.handle;
      if (typeof h === "string") byHandle.set(h, it);
    }
    results = products.map((p, i) => coerceTransformed(byHandle.get(p.handle) ?? list[i] ?? {}, p));
  } catch {
    return { ok: false, live: true, error: "Réponse OpenAI non exploitable (JSON invalide). Réessayez ou réduisez la taille du lot." };
  }

  // 2) Relecture éditoriale premium — Claude (si dispo + mode avancé). Champs
  //    texte uniquement ; la structure CSV reste reconstruite par le builder.
  const claudeKey = await resolveKey(refs?.claude, "claude-sonnet-4-6");
  const plan = planImportModels(rules, { claudeAvailable: !!claudeKey });
  let editorial = false;
  let tokens = r.tokens;
  if (plan.editorial === "claude" && claudeKey) {
    try {
      const ref = await refineEditorialWithClaude(results, products, rules, ctx, claudeKey, mem);
      results = ref.results;
      editorial = ref.used;
      tokens += ref.tokens;
    } catch { /* dégradation gracieuse : on garde la sortie OpenAI */ }
  }

  // 3) Le QC déterministe (arbitre final) tourne ensuite côté appelant.
  return { ok: true, live: true, results, model: r.model, tokens, badge: plan.badge, editorial };
}

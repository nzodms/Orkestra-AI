import { claudeComplete } from "./claude";
import { stripHtml, type ImportProductInput, type ImportRules, type ImportContext, type TransformedProduct } from "../import-factory";

// ──────────────────────────────────────────────────────────────────────────
// Import Factory — relecture éditoriale PREMIUM via Claude (champs texte only).
// Claude ne reçoit qu'une REPRÉSENTATION PRODUIT structurée (jamais le CSV) et
// ne renvoie que des champs éditoriaux. La structure (prix, SKU, images,
// variantes, handles…) n'est jamais touchée : le builder déterministe
// reconstruit le CSV à partir du TransformedProduct fusionné.
// ──────────────────────────────────────────────────────────────────────────

/** Champs éditoriaux que Claude est autorisé à améliorer. */
export interface EditorialPatch {
  handle: string;
  title?: string;
  bodyHtml?: string;
  metaDescription?: string;
  tags?: string;
}

function targetChars(rules: ImportRules): string {
  if (rules.level === "ultra complet") return "3000 à 4000 caractères de texte (fiche premium longue)";
  if (rules.level === "poussé") return "1800 à 2800 caractères";
  return "800 à 1400 caractères";
}

export function buildEditorialSystem(rules: ImportRules): string {
  const fr = /fran[çc]ais/i.test(rules.language);
  return (
    "Tu es l'éditeur premium d'Orkestra Import Factory. Tu AMÉLIORES des fiches produit e-commerce déjà générées, " +
    "sans en casser la structure. Tu ne touches QU'AUX champs éditoriaux : title, bodyHtml, metaDescription, tags.\n" +
    `Langue : ${rules.language}. ` + (fr ? "Français naturel, premium, sans faute, sans mot anglais résiduel, accents corrects." : "") + "\n" +
    "RÈGLES ABSOLUES :\n" +
    `1) Body HTML : vise ${targetChars(rules)} si — et seulement si — les données fournies le permettent. Texte naturel, premium, utile au client (forme, rendu, dimensions, pièces, variantes, usage, aide au choix, comparaison de tailles, FAQ utile). PAS de blabla (« touche moderne et élégante », « ambiance chaleureuse »…).\n` +
    "2) N'INVENTE JAMAIS : garantie, délai de livraison, ampoules/manuel inclus, culot (E12/E27/GU10…), matériau précis (cristal K9, acier poli, fer doré, verre soufflé), LED intégrée, dimmable, certification, poids, puissance. Si l'info n'est pas dans les données fournies, ne l'écris pas.\n" +
    "3) AUCUN emoji. Conserve le suffixe meta EXACT s'il est présent (même ponctuation).\n" +
    "4) Ne change PAS le sens des variantes/tailles. N'ajoute pas de marque concurrente.\n" +
    "Réponds UNIQUEMENT par un JSON {\"products\":[{handle, title, bodyHtml, metaDescription, tags}, …]} dans le même ordre."
  );
}

export function buildEditorialPrompt(results: TransformedProduct[], sources: ImportProductInput[], rules: ImportRules, ctx: ImportContext): string {
  const srcByHandle = new Map(sources.map((s) => [s.handle, s]));
  const suffix = ctx.metaSuffix || rules.metaSuffix;
  const blocks = results.map((r, i) => {
    const s = srcByHandle.get(r.handle) || sources[i];
    const facts = s
      ? `Faits source (NE RIEN inventer au-delà) : titre « ${s.title} » | type ${s.type || "n/a"} | tags ${s.tags || "n/a"} | variantes ${s.variantOptions.join(", ") || "aucune"} | description source : ${s.bodyExcerpt || "(vide)"}`
      : "Faits source : (non fournis)";
    return (
      `--- Produit ${i + 1} (handle: ${r.handle}) ---\n` +
      `Title actuel : ${r.title}\n` +
      `product_type : ${r.productType} | Tags actuels : ${r.tags}\n` +
      `metaDescription actuelle : ${r.metaDescription}\n` +
      `${facts}\n` +
      `Body HTML actuel (${stripHtml(r.bodyHtml).length} car.) :\n${r.bodyHtml}`
    );
  }).join("\n\n");
  return (
    `=== Objectif ===\nAméliore l'éditorial (Body HTML surtout) au niveau d'une fiche optimisée à la main, sans rien inventer.${suffix ? ` Le suffixe meta « ${suffix} » doit rester EXACT en fin de metaDescription.` : ""}\n\n` +
    `=== ${results.length} fiche(s) à améliorer ===\n${blocks}\n\n` +
    `Renvoie le JSON {"products":[...]} avec handle d'origine en clé, dans le même ordre. Ne renvoie QUE title, bodyHtml, metaDescription, tags.`
  );
}

/** Fusionne les patchs éditoriaux dans les résultats OpenAI — champs texte UNIQUEMENT.
 *  Tout le reste (vendor, collections, imageAlts, newHandle, status…) est conservé. PURE. */
export function mergeEditorial(results: TransformedProduct[], patches: EditorialPatch[]): TransformedProduct[] {
  const byHandle = new Map(patches.filter((p) => p && typeof p.handle === "string").map((p) => [p.handle, p]));
  return results.map((r) => {
    const p = byHandle.get(r.handle);
    if (!p) return r;
    const out: TransformedProduct = { ...r };
    if (typeof p.title === "string" && p.title.trim()) out.title = p.title.trim();
    if (typeof p.bodyHtml === "string" && p.bodyHtml.trim().length >= stripHtml(r.bodyHtml).length / 2) out.bodyHtml = p.bodyHtml.trim();
    if (typeof p.metaDescription === "string" && p.metaDescription.trim()) out.metaDescription = p.metaDescription.trim();
    if (typeof p.tags === "string" && p.tags.split(",").filter((t) => t.trim()).length >= 3) out.tags = p.tags.trim();
    return out;
  });
}

/** Parse robuste de la réponse Claude en patchs éditoriaux. PURE. */
export function parseEditorial(text: string): EditorialPatch[] {
  try {
    const parsed = JSON.parse(text) as { products?: unknown[] };
    const list = Array.isArray(parsed.products) ? parsed.products : [];
    const str = (v: unknown) => (typeof v === "string" ? v : undefined);
    return list
      .map((it) => {
        const o = (it ?? {}) as Record<string, unknown>;
        const handle = str(o.handle);
        if (!handle) return null;
        return { handle, title: str(o.title), bodyHtml: str(o.bodyHtml), metaDescription: str(o.metaDescription), tags: str(o.tags) } as EditorialPatch;
      })
      .filter((p): p is EditorialPatch => p !== null);
  } catch {
    return [];
  }
}

/** Relecture éditoriale Claude (I/O). En cas d'échec → renvoie les résultats OpenAI inchangés. */
export async function refineEditorialWithClaude(
  results: TransformedProduct[],
  sources: ImportProductInput[],
  rules: ImportRules,
  ctx: ImportContext,
  key: { apiKey: string; model: string }
): Promise<{ results: TransformedProduct[]; used: boolean; tokens: number }> {
  const system = buildEditorialSystem(rules);
  const prompt = buildEditorialPrompt(results, sources, rules, ctx);
  const maxTokens = rules.level === "ultra complet" ? 4096 : 3000;
  const r = await claudeComplete({ apiKey: key.apiKey, model: key.model, system, prompt, temperature: 0.4, maxTokens, json: true });
  if (!r.ok) return { results, used: false, tokens: 0 };
  const patches = parseEditorial(r.text);
  if (!patches.length) return { results, used: false, tokens: r.tokens };
  return { results: mergeEditorial(results, patches), used: true, tokens: r.tokens };
}

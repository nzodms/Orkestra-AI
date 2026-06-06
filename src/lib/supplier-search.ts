// ──────────────────────────────────────────────────────────────────────────
// Orchestrateur de recherche fournisseurs (provider-agnostique).
// image/analyse → mots-clés → provider (réel ou simulé) → NORMALISATION →
// score Orkestra → réponse unique. Repli SIMULÉ propre si la source réelle
// échoue / est vide / n'est pas configurée. Le front ne dépend jamais du provider.
// ──────────────────────────────────────────────────────────────────────────

import type { LensAnalysis, SupplierResult, SupplierSearchProvider, SupplierSearchResponse } from "./lens-types";
import { scoreSupplier, riskFromScore } from "./supplier-score";
import { resolveProvider, withTimeout, type SupplierItem } from "./supplier-providers";

const PROVIDER_TIMEOUT = 16000;

function hash(s: string): number { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }

/** Mots-clés de recherche : priorité fournisseur → EN → FR → type produit. */
export function pickKeywords(a: LensAnalysis): string[] {
  const pool = [...a.keywordsSupplier, ...a.keywordsEn, ...a.keywordsFr, a.productType].map((s) => (s || "").trim()).filter(Boolean);
  return Array.from(new Set(pool)).slice(0, 6);
}

const STOP = new Set(["the", "a", "for", "with", "and", "of", "de", "la", "le", "pour", "set", "pro", "new", "premium", "2024"]);
function tokens(s: string): string[] {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w));
}
/** Similarité texte 0-100 entre le produit détecté (mots-clés + type) et un titre fournisseur. */
function titleSimilarity(keywords: string[], productType: string, title: string): number {
  const q = new Set([...keywords.flatMap(tokens), ...tokens(productType)]);
  const t = new Set(tokens(title));
  if (!q.size || !t.size) return 55;
  let inter = 0; for (const w of q) if (t.has(w)) inter++;
  const ratio = inter / Math.min(q.size, t.size);            // couverture du plus petit ensemble
  return Math.max(45, Math.min(96, Math.round(50 + ratio * 46)));
}

/** Item descriptif → SupplierResult complet (scoré, risqué, prêt pour le front). */
function finalize(item: SupplierItem, similarity: number, simulated: boolean): SupplierResult {
  const moqLow = !item.moq || /^(1|2|3|4|5)\b/.test(item.moq) || /1\s*(pi[èe]ce|pc|unit)/i.test(item.moq);
  const { score, reasons } = scoreSupplier({
    similarity,
    hasImage: !!item.imageUrl,
    rating: item.supplierRating,
    reviews: item.reviewCount,
    hasPrice: !!(item.price || item.minPrice),
    moqLow,
    variantsCount: item.variants?.length,
    fastShipping: /express|7-12|fast|rapide/i.test(item.shippingInfo || ""),
  });
  return {
    ...item,
    similarityScore: similarity,
    supplierScore: score,
    riskLevel: riskFromScore(score),
    reasons,
    simulated,
    hue: (hash(item.title + item.source) % 360),
  };
}

function rank(list: SupplierResult[]): SupplierResult[] {
  return [...list].sort((a, b) => b.supplierScore - a.supplierScore);
}

function buildSimulated(analysis: LensAnalysis, keywords: string[], maxItems: number, error?: string): Promise<SupplierSearchResponse> {
  return resolveProvider("simulated").provider.search({ keywords, productType: analysis.productType, niche: analysis.niche, maxItems })
    .then((items) => ({
      results: rank(items.map((it, i) => finalize(it, Math.max(45, 90 - i * 7), true))),
      method: "simulated" as const,
      provider: "simulated" as SupplierSearchProvider,
      real: false,
      keywords,
      error,
    }));
}

export interface SearchOptions { provider?: SupplierSearchProvider; maxItems?: number; }

/** Point d'entrée unique. Provider réel si configuré, sinon simulé — toujours une réponse. */
export async function searchSuppliers(analysis: LensAnalysis, options: SearchOptions = {}): Promise<SupplierSearchResponse> {
  const maxItems = options.maxItems ?? 8;
  const keywords = pickKeywords(analysis);
  const { provider, platform } = resolveProvider(options.provider);

  if (provider.id === "simulated") return buildSimulated(analysis, keywords, maxItems);

  try {
    const items = await withTimeout(
      provider.search({ keywords, productType: analysis.productType, niche: analysis.niche, maxItems, platform }),
      PROVIDER_TIMEOUT,
    );
    if (!items.length) return buildSimulated(analysis, keywords, maxItems, "Aucun fournisseur réel trouvé pour ces mots-clés — résultats simulés affichés.");
    const results = rank(items.map((it) => finalize(it, titleSimilarity(keywords, analysis.productType, it.title), false)));
    return { results, method: "structured", provider: provider.id, real: true, keywords };
  } catch {
    return buildSimulated(analysis, keywords, maxItems, "Impossible de récupérer les fournisseurs réels pour l'instant — résultats simulés affichés.");
  }
}

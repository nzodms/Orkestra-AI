import { NextResponse } from "next/server";
import { multiAiSearch, multiAiAvailable, type LensKeyRefs } from "@/lib/lens-search-ai";
import { buildSearchLinks } from "@/lib/lens-links";
import type { LensAnalysis, SupplierSearchResponse } from "@/lib/lens-types";

// ──────────────────────────────────────────────────────────────────────────
// POST /api/lens/search — V1 : UNIQUEMENT les IA connectées.
//   • Gemini (Google Search grounding) trouve des liens web réels ;
//   • Claude compare / score / écarte les liens hors sujet ;
//   • les LIENS DE RECHERCHE (Alibaba/AliExpress/1688/Google) sont TOUJOURS
//     renvoyés (utile même si l'IA ne trouve rien).
// Aucun provider structuré (Apify/RapidAPI/SerpAPI), aucun faux fournisseur.
// ──────────────────────────────────────────────────────────────────────────

export const runtime = "nodejs";
export const maxDuration = 45;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  let analysis = body.analysis as LensAnalysis | undefined;
  if (!analysis || !analysis.productType) {
    return NextResponse.json({ results: [], method: "assisted", provider: "simulated", real: false, keywords: [], searchLinks: [] } satisfies SupplierSearchResponse);
  }
  const overrides = Array.isArray(body.keywords) ? (body.keywords as string[]).map((s) => String(s).trim()).filter(Boolean) : [];
  if (overrides.length) analysis = { ...analysis, productName: overrides.join(" "), keywordsSupplier: overrides, keywordsEn: overrides };

  const name = (analysis.productName || analysis.keywordsEn?.[0] || analysis.productType || "").trim();
  const searchLinks = buildSearchLinks(name);
  const keyRefs = (body.keyRefs || {}) as LensKeyRefs;
  console.log("[Lens/search]", { event: "search-links-generated", name, multiAi: multiAiAvailable(keyRefs) });

  if (multiAiAvailable(keyRefs)) {
    const r = await multiAiSearch(analysis, keyRefs).catch(() => null);
    if (r && r.results.length) {
      return NextResponse.json({ results: r.results, method: "multi-ai-search", provider: "custom", real: true, keywords: r.queries, models: r.models, searchLinks } satisfies SupplierSearchResponse);
    }
    return NextResponse.json({ results: [], method: "assisted", provider: "simulated", real: false, keywords: [name], searchLinks, error: "Aucun résultat web pour l'instant — ouvrez les recherches prêtes ci-dessous." } satisfies SupplierSearchResponse);
  }
  return NextResponse.json({ results: [], method: "assisted", provider: "simulated", real: false, keywords: [name], searchLinks } satisfies SupplierSearchResponse);
}

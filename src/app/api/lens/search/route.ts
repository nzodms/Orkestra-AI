import { NextResponse } from "next/server";
import { searchSuppliers } from "@/lib/supplier-search";
import { availableRealProviders } from "@/lib/supplier-providers";
import { multiAiSearch, multiAiAvailable, buildAssistedQueries, type LensKeyRefs } from "@/lib/lens-search-ai";
import type { LensAnalysis, SupplierSearchMethod, SupplierSearchProvider, SupplierSearchResponse } from "@/lib/lens-types";

// ──────────────────────────────────────────────────────────────────────────
// POST /api/lens/search — recherche fournisseurs, MÉTHODE automatique :
//   1) provider structuré réel (Apify/custom) si configuré ;
//   2) recherche MULTI-IA (Gemini grounding + Claude web search) si IA capable ;
//   3) recherche ASSISTÉE (requêtes préremplies) + résultats simulés ;
//   4) simulé.
// Renvoie TOUJOURS une réponse normalisée avec un badge `method` honnête.
// ──────────────────────────────────────────────────────────────────────────

export const runtime = "nodejs";
export const maxDuration = 45;

async function assisted(analysis: LensAnalysis): Promise<SupplierSearchResponse> {
  const sim = await searchSuppliers(analysis, { provider: "simulated" });
  return { ...sim, method: "assisted", assistedQueries: buildAssistedQueries(analysis) };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  let analysis = body.analysis as LensAnalysis | undefined;
  if (!analysis || !analysis.productType) {
    return NextResponse.json({ results: [], method: "simulated", provider: "simulated", real: false, keywords: [], error: "Analyse manquante." } satisfies SupplierSearchResponse);
  }
  const overrides = Array.isArray(body.keywords) ? (body.keywords as string[]).map((s) => String(s).trim()).filter(Boolean) : [];
  if (overrides.length) analysis = { ...analysis, keywordsSupplier: overrides, keywordsEn: overrides };

  const keyRefs = (body.keyRefs || {}) as LensKeyRefs;
  const method = body.method as SupplierSearchMethod | undefined;
  const provider = body.provider as SupplierSearchProvider | undefined;

  // ── Demandes explicites ──
  if (method === "simulated" || provider === "simulated") {
    return NextResponse.json(await searchSuppliers(analysis, { provider: "simulated" }));
  }
  if (method === "assisted") return NextResponse.json(await assisted(analysis));
  if (method === "multi-ai-search") {
    const r = await multiAiSearch(analysis, keyRefs).catch(() => null);
    if (r && r.results.length) return NextResponse.json({ results: r.results, method: "multi-ai-search", provider: "custom", real: true, keywords: r.queries, models: r.models, assistedQueries: buildAssistedQueries(analysis) } satisfies SupplierSearchResponse);
    return NextResponse.json({ ...(await assisted(analysis)), error: "Recherche multi-IA indisponible — recherche assistée affichée." });
  }
  if (provider) {
    return NextResponse.json(await searchSuppliers(analysis, { provider }));
  }

  // ── AUTO : meilleure méthode disponible ──
  console.log("[Lens/search]", { event: "auto", structured: availableRealProviders(), multiAi: multiAiAvailable(keyRefs) });
  if (availableRealProviders().length) {
    return NextResponse.json(await searchSuppliers(analysis));
  }
  if (multiAiAvailable(keyRefs)) {
    const r = await multiAiSearch(analysis, keyRefs).catch(() => null);
    if (r && r.results.length) {
      return NextResponse.json({ results: r.results, method: "multi-ai-search", provider: "custom", real: true, keywords: r.queries, models: r.models, assistedQueries: buildAssistedQueries(analysis) } satisfies SupplierSearchResponse);
    }
    return NextResponse.json({ ...(await assisted(analysis)), error: "La recherche web IA n'a rien renvoyé — recherche assistée et résultats simulés affichés." });
  }
  return NextResponse.json(await assisted(analysis));
}

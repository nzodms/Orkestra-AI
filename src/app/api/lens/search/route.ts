import { NextResponse } from "next/server";
import { searchSuppliers } from "@/lib/supplier-search";
import type { LensAnalysis, SupplierSearchProvider } from "@/lib/lens-types";

// ──────────────────────────────────────────────────────────────────────────
// POST /api/lens/search — recherche fournisseurs (provider réel si configuré
// côté serveur, sinon simulé). Renvoie TOUJOURS une réponse normalisée.
// ──────────────────────────────────────────────────────────────────────────

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  let analysis = body.analysis as LensAnalysis | undefined;
  if (!analysis || !analysis.productType) return NextResponse.json({ results: [], provider: "simulated", real: false, keywords: [], error: "Analyse manquante." });
  const provider = body.provider as SupplierSearchProvider | undefined;
  const overrides = Array.isArray(body.keywords) ? (body.keywords as string[]).map((s) => String(s).trim()).filter(Boolean) : [];
  if (overrides.length) analysis = { ...analysis, keywordsSupplier: overrides, keywordsEn: overrides };
  const resp = await searchSuppliers(analysis, { provider });
  return NextResponse.json(resp);
}

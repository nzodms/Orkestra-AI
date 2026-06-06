import { NextResponse } from "next/server";
import { liveEnabled } from "@/lib/ai/generate";
import { getEncrypted } from "@/lib/server/keyStore";
import { decryptSecret } from "@/lib/crypto";
import { refineEditorialWithClaude, type EditorialFocus } from "@/lib/ai/import-editorial";
import type { ImportProductInput, ImportRules, ImportContext, ImportMemory, TransformedProduct } from "@/lib/import-factory";

// ──────────────────────────────────────────────────────────────────────────
// POST /api/import/refine — « Perfectionner avec Claude ».
// Relecture éditoriale premium (champs texte uniquement) d'un sous-ensemble de
// produits DÉJÀ transformés. Claude ne reçoit qu'une représentation produit
// structurée ; la structure CSV n'est jamais touchée (rebuild déterministe).
// Nécessite une clé Claude connectée (BYOK). Aucune clé en clair n'est loggée.
// ──────────────────────────────────────────────────────────────────────────

export const runtime = "nodejs";
export const maxDuration = 60;

async function resolveClaude(ref?: string | null): Promise<{ apiKey: string; model: string } | null> {
  if (!ref) return null;
  const stored = await getEncrypted(ref);
  if (!stored) return null;
  try { return { apiKey: decryptSecret(stored.encrypted), model: stored.meta.model || "claude-sonnet-4-6" }; }
  catch { return null; }
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!liveEnabled()) return NextResponse.json({ ok: false, error: "Relecture indisponible en mode démo." });
  const claudeKey = await resolveClaude(body?.keyRefs?.claude);
  if (!claudeKey) return NextResponse.json({ ok: false, error: "Connectez Claude pour la relecture premium." });

  const products = (body.products as TransformedProduct[]) || [];
  const sources = (body.sources as ImportProductInput[]) || [];
  const rules = body.rules as ImportRules;
  const ctx = (body.context as ImportContext) || {};
  const mem = (body.memory as ImportMemory) || { brandNames: [], anchors: [] };
  const focus = (body.focus as EditorialFocus) || "all";
  if (!products.length) return NextResponse.json({ ok: false, error: "Aucun produit à relire." });

  try {
    const ref = await refineEditorialWithClaude(products, sources, rules, ctx, claudeKey, mem, focus);
    return NextResponse.json({ ok: true, results: ref.results, used: ref.used, tokens: ref.tokens });
  } catch {
    return NextResponse.json({ ok: false, error: "La relecture Claude a échoué. Réessayez." });
  }
}

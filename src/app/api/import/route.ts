import { NextResponse } from "next/server";
import { runImportTransform, type ImportKeyRefs } from "@/lib/ai/import-transform";
import type { ImportProductInput, ImportRules, ImportMemory, ImportContext } from "@/lib/import-factory";

// ──────────────────────────────────────────────────────────────────────────
// POST /api/import — Import Factory : transformation d'un lot de produits via
// OpenAI (obligatoire). Pas de mock : si OpenAI indisponible → ok:false.
// ──────────────────────────────────────────────────────────────────────────

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await req.json();
  const keyRefs = (body.keyRefs as ImportKeyRefs) || {};
  const result = await runImportTransform(
    (body.products as ImportProductInput[]) || [],
    body.rules as ImportRules,
    (body.memory as ImportMemory) || { brandNames: [], anchors: [] },
    (body.context as ImportContext) || {},
    keyRefs
  );
  return NextResponse.json(result);
}

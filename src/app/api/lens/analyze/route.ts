import { NextResponse } from "next/server";
import { analyzeLens, type LensAnalyzeInput } from "@/lib/lens-analyze";

// ──────────────────────────────────────────────────────────────────────────
// POST /api/lens/analyze — Orkestra Lens : analyse produit d'une image / page.
// Image + clé OpenAI (BYOK) → analyse vision réelle. Sinon → analyse simulée.
// ──────────────────────────────────────────────────────────────────────────

export const runtime = "nodejs";
export const maxDuration = 45;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const input = (body.input as LensAnalyzeInput) || { kind: "upload" };
  const keyRefs = (body.keyRefs || {}) as { openai?: string | null; claude?: string | null; gemini?: string | null };
  const result = await analyzeLens(input, keyRefs);
  return NextResponse.json(result);
}

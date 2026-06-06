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
  const keyRef = (body.keyRefs?.openai as string | undefined) ?? null;
  const result = await analyzeLens(input, keyRef);
  return NextResponse.json(result);
}

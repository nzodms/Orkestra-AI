import { NextResponse } from "next/server";
import {
  generateSection,
  generateMerchantAudit,
  type ProductSeoInput,
  type SectionInput,
} from "@/lib/ai/engine";
import { runCouncil, runProductSeo, type KeyRefs } from "@/lib/ai/generate";
import type { AIProviderId, CouncilMode } from "@/lib/types";

// ──────────────────────────────────────────────────────────────────────────
// POST /api/generate
//
// Routeur unique de génération. Council & SEO produit passent par les
// orchestrateurs LIVE (OpenAI réel si clé connectée + mode live), avec
// fallback mock propre. Les autres restent mock (templates) en V1.
// ──────────────────────────────────────────────────────────────────────────

export const runtime = "nodejs";
export const maxDuration = 45;

export async function POST(req: Request) {
  const body = await req.json();
  const { kind } = body;
  const keyRefs = (body.keyRefs as KeyRefs) || {};

  switch (kind) {
    case "seo-product": {
      const { result, meta } = await runProductSeo(body.input as ProductSeoInput, body.context || {}, keyRefs);
      return NextResponse.json({ ok: true, result, meta });
    }

    case "section":
      await new Promise((r) => setTimeout(r, 400));
      return NextResponse.json({ ok: true, result: generateSection(body.input as SectionInput) });

    case "merchant-audit":
      return NextResponse.json({ ok: true, result: generateMerchantAudit(body.context || {}) });

    case "council": {
      const { result, meta } = await runCouncil(
        body.mode as CouncilMode,
        body.question as string,
        (body.providers as AIProviderId[]) || [],
        body.context || {},
        keyRefs
      );
      return NextResponse.json({ ok: true, result, meta });
    }

    default:
      return NextResponse.json({ ok: false, error: "Type de génération inconnu." }, { status: 400 });
  }
}

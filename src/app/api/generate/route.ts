import { NextResponse } from "next/server";
import {
  generateProductSeo,
  generateSection,
  generateMerchantAudit,
  generateCouncil,
  type ProductSeoInput,
  type SectionInput,
} from "@/lib/ai/engine";
import type { AIProviderId, CouncilMode } from "@/lib/types";

// ──────────────────────────────────────────────────────────────────────────
// POST /api/generate
//
// Routeur unique de génération. Le `kind` détermine le moteur appelé.
// En production, ces moteurs composeront un prompt et appelleront les
// providers connectés (clés déchiffrées côté serveur) puis parseront la
// réponse. La forme des résultats reste identique au mode mock.
// ──────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const body = await req.json();
  const { kind } = body;

  // Petite latence pour une UX réaliste (jobs longs simulés).
  await new Promise((r) => setTimeout(r, 600));

  switch (kind) {
    case "seo-product":
      return NextResponse.json({ ok: true, result: generateProductSeo(body.input as ProductSeoInput) });

    case "section":
      return NextResponse.json({ ok: true, result: generateSection(body.input as SectionInput) });

    case "merchant-audit":
      return NextResponse.json({ ok: true, result: generateMerchantAudit(body.context || {}) });

    case "council":
      return NextResponse.json({
        ok: true,
        result: generateCouncil(
          body.mode as CouncilMode,
          body.question as string,
          (body.providers as AIProviderId[]) || [],
          body.context || {}
        ),
      });

    default:
      return NextResponse.json({ ok: false, error: "Type de génération inconnu." }, { status: 400 });
  }
}

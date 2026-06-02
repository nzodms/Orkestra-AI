import { NextResponse } from "next/server";
import { crawlStore } from "@/lib/crawler";

// POST /api/scan — crawl public « vue visiteur » de l'URL fournie.
// Body : { url, niche?, brandName?, language?, positioning?, country? }
// Renvoie { ok, analysis, profile } ou { ok:false, error } (fallback géré côté client).

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const url = (body.url as string | undefined)?.trim();
    if (!url) {
      return NextResponse.json({ ok: false, error: "URL publique manquante." }, { status: 400 });
    }
    const result = await crawlStore(url, {
      niche: body.niche,
      brandName: body.brandName,
      language: body.language,
      positioning: body.positioning,
      country: body.country,
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { ok: false, error: "Le scan public a échoué (site inaccessible ou réponse invalide)." },
      { status: 200 }
    );
  }
}

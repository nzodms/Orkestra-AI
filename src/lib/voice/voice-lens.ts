// ──────────────────────────────────────────────────────────────────────────
// Orkestra Voice — exécution Lens DANS le panel (réutilise le moteur Lens).
// À partir d'une requête texte : construit une analyse minimale, appelle
// /api/lens/search (Gemini grounding + Claude compare si dispo) et renvoie des
// cards fournisseurs + recherches prêtes. Aucune donnée inventée.
// ──────────────────────────────────────────────────────────────────────────

import { detectNiche } from "../import-factory";
import { buildSearchLinks } from "../lens-links";
import type { LensAnalysis, SupplierResult } from "../lens-types";
import type { VoiceCard, VoiceResult } from "./voice-types";

export interface VoiceKeyRefs { openai?: string | null; claude?: string | null; gemini?: string | null }

function titleCase(s: string): string {
  return s.split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

/** Lance la recherche fournisseur Lens et renvoie un résultat riche pour le panel Voice. */
export async function runLensSearchInsideVoice(query: string, platform: string | undefined, keyRefs: VoiceKeyRefs): Promise<VoiceResult> {
  const q = query.trim();
  const niche = detectNiche(q);
  const analysis: LensAnalysis = {
    productType: titleCase(q), productName: q, niche,
    distinctive: [], variants: [], keywordsFr: [q], keywordsEn: [q], keywordsSupplier: [q], live: false,
  };
  let links = buildSearchLinks(q);
  if (platform) links = [...links.filter((l) => l.source === platform), ...links.filter((l) => l.source !== platform)];
  const linkCards: VoiceCard[] = links.map((l) => ({ kind: "search-link", title: l.source, subtitle: l.advantage, detail: l.limit, href: l.url, tone: "brand", badge: "Recherche prête" }));

  let webCards: VoiceCard[] = [];
  let models: string[] | undefined;
  try {
    const res = await fetch("/api/lens/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ analysis, keyRefs }) });
    const data = await res.json();
    models = data.models;
    const results: SupplierResult[] = Array.isArray(data.results) ? data.results : [];
    webCards = results.slice(0, 6).map((r) => ({
      kind: "supplier", title: r.title, subtitle: r.supplierName || r.snippet,
      meta: `${r.source} · score ${r.supplierScore}`, detail: r.snippet || r.reasons?.[0], href: r.productUrl,
      tone: "neutral", badge: r.source,
    }));
  } catch { /* repli : recherches prêtes uniquement */ }

  const cards = [...webCards, ...linkCards];
  const spoken = webCards.length
    ? `J'ai trouvé ${webCards.length} piste(s) web pour « ${q} »${models?.length ? ` (via ${models.join(" + ")})` : ""}. Les recherches Alibaba, AliExpress et 1688 sont aussi prêtes.`
    : `J'ai préparé une recherche fournisseur pour « ${q} ». Alibaba, AliExpress et 1688 sont prêts.`;
  return {
    intent: "lens.search", module: "lens", title: `Fournisseurs · ${q}`, spokenSummary: spoken, cards,
    actions: [{ label: "Comparer dans Lens", kind: "navigate", href: "/lens" }],
    moduleLink: { href: "/lens", label: "Ouvrir Orkestra Lens" }, confidence: 0.85,
  };
}

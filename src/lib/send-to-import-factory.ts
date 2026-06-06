// ──────────────────────────────────────────────────────────────────────────
// Pont Orkestra Lens → Import Factory.
// Lens ne génère PAS de fiche Shopify : il prépare un brouillon produit que
// Import Factory reprend (titre propre, nom brandé, description HTML, meta, tags,
// alt, product_type, CSV). On mappe sur les champs du « Produit manuel ».
// ──────────────────────────────────────────────────────────────────────────

import type { ImportDraft } from "./store";
import type { LensAnalysis, SupplierResult } from "./lens-store";

/** Première valeur numérique d'une fourchette de prix (« 4.20 – 9.90 $ » → « 4.20 »). */
function firstPrice(price?: string): string {
  const m = (price || "").match(/\d+(?:[.,]\d+)?/);
  return m ? m[0].replace(",", ".") : "";
}

/** Construit le brouillon Import Factory à partir de l'analyse + du fournisseur choisi. */
export function draftFromSupplier(analysis: LensAnalysis, s: SupplierResult): ImportDraft {
  const tags = Array.from(new Set([...analysis.keywordsFr, analysis.productType, analysis.niche]
    .map((t) => (t || "").trim()).filter(Boolean))).slice(0, 10).join(", ");
  const distinctive = analysis.distinctive?.length ? `Éléments distinctifs : ${analysis.distinctive.join(", ")}` : "";
  const description = [
    `${analysis.productType}${analysis.style ? `, style ${analysis.style}` : ""}${analysis.usage ? `, ${analysis.usage}` : ""}.`,
    distinctive,
  ].filter(Boolean).join("\n");
  return {
    title: s.title,
    description,
    features: analysis.distinctive?.join(", ") || "",
    dimensions: "",
    materials: analysis.material || "",
    colors: analysis.color || "",
    price: firstPrice(s.price),
    sku: "",
    images: s.image || "",
    sourceUrl: s.url,
    notes: `Importé via Orkestra Lens · ${s.source} · score ${s.score}/100 (${s.scoreReason})`,
    productType: analysis.productType,
    tags,
    source: `Orkestra Lens · ${s.source}`,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Pont Orkestra Lens → Import Factory.
// Lens ne génère PAS de fiche Shopify : il prépare un brouillon produit que
// Import Factory reprend (titre propre, nom brandé, description HTML, meta, tags,
// alt, product_type, CSV). On mappe sur les champs du « Produit manuel ».
// ──────────────────────────────────────────────────────────────────────────

import type { ImportDraft } from "./store";
import type { LensAnalysis, SupplierResult } from "./lens-types";

/** Prix de référence : minPrice si dispo, sinon 1ʳᵉ valeur de la fourchette affichée. */
function firstPrice(s: SupplierResult): string {
  if (typeof s.minPrice === "number") return String(s.minPrice);
  const m = (s.price || "").match(/\d+(?:[.,]\d+)?/);
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
    price: firstPrice(s),
    sku: "",
    images: s.imageUrl || "",
    sourceUrl: s.productUrl,
    notes: `Importé via Orkestra Lens · ${s.source}${s.simulated ? " (simulé)" : ""} · score ${s.supplierScore}/100 (${s.reasons.join(", ")})`,
    productType: analysis.productType,
    tags,
    source: `Orkestra Lens · ${s.source}`,
  };
}

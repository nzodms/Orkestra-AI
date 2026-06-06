// ──────────────────────────────────────────────────────────────────────────
// Score fournisseur Orkestra — note simple (0-100) combinant similarité, qualité
// vendeur, prix/MOQ, variantes et livraison. Pur, déterministe, sans réseau.
// ──────────────────────────────────────────────────────────────────────────

export interface ScoreParts {
  similarity: number;      // 0-100 (proximité visuelle / produit)
  rating?: number;         // 0-5 (note vendeur)
  reviews?: number;        // nb d'avis
  hasPrice?: boolean;
  moqLow?: boolean;        // MOQ raisonnable
  variantsCount?: number;
  fastShipping?: boolean;
}

/** Calcule le score fournisseur Orkestra + une phrase d'explication. */
export function scoreSupplier(p: ScoreParts): { score: number; reason: string } {
  let s = 0;
  s += Math.round(p.similarity * 0.45);                       // similarité = 45 %
  s += Math.round(((p.rating ?? 0) / 5) * 22);               // note vendeur = 22 %
  s += Math.min(10, Math.round((p.reviews ?? 0) / 50));      // volume d'avis = 10 %
  if (p.hasPrice) s += 6;                                     // prix affiché = 6 %
  if (p.moqLow) s += 7;                                       // MOQ raisonnable = 7 %
  s += Math.min(6, (p.variantsCount ?? 0) * 2);              // variantes = 6 %
  if (p.fastShipping) s += 4;                                 // livraison = 4 %
  const score = Math.max(0, Math.min(100, s));

  const bits: string[] = [];
  bits.push(p.similarity >= 80 ? "produit très similaire" : p.similarity >= 60 ? "produit similaire" : "similarité moyenne");
  if ((p.rating ?? 0) >= 4.5) bits.push("vendeur très bien noté");
  else if ((p.rating ?? 0) >= 4) bits.push("vendeur bien noté");
  if (p.moqLow) bits.push("MOQ raisonnable");
  if ((p.variantsCount ?? 0) >= 2) bits.push("variantes disponibles");
  return { score, reason: bits.slice(0, 3).join(", ") };
}

/** Niveau de risque lisible dérivé du score. */
export function riskLabel(score: number): { label: string; tone: "good" | "warn" | "bad" } {
  if (score >= 75) return { label: "Risque faible", tone: "good" };
  if (score >= 55) return { label: "À vérifier", tone: "warn" };
  return { label: "Risque élevé", tone: "bad" };
}

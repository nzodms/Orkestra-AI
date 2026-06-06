// ──────────────────────────────────────────────────────────────────────────
// Score fournisseur Orkestra — note 0-100 + raisons + niveau de risque.
// Identique pour les résultats simulés ET réels (le front lit le même format).
// Une donnée manquante ne pénalise pas inventé : elle ne rapporte simplement pas.
// ──────────────────────────────────────────────────────────────────────────

export interface ScoreParts {
  similarity: number;       // 0-100 (cohérence visuelle / titre ↔ produit détecté)
  hasImage?: boolean;
  rating?: number;          // 0-5 (note vendeur)
  reviews?: number;
  hasPrice?: boolean;
  moqLow?: boolean;         // MOQ raisonnable
  variantsCount?: number;
  fastShipping?: boolean;
}

/** Score fournisseur Orkestra + raisons lisibles. */
export function scoreSupplier(p: ScoreParts): { score: number; reasons: string[] } {
  let s = 0;
  s += Math.round(p.similarity * 0.42);                       // similarité = 42 %
  if (p.hasImage) s += 6;                                     // image présente = 6 %
  s += Math.round(((p.rating ?? 0) / 5) * 20);               // note vendeur = 20 %
  s += Math.min(10, Math.round((p.reviews ?? 0) / 50));      // volume d'avis = 10 %
  if (p.hasPrice) s += 6;                                     // prix disponible = 6 %
  if (p.moqLow) s += 6;                                       // MOQ raisonnable = 6 %
  s += Math.min(6, (p.variantsCount ?? 0) * 2);              // variantes = 6 %
  if (p.fastShipping) s += 4;                                 // livraison = 4 %
  const score = Math.max(0, Math.min(100, s));

  const reasons: string[] = [];
  reasons.push(p.similarity >= 80 ? "produit très similaire" : p.similarity >= 60 ? "produit similaire" : "similarité moyenne");
  if ((p.rating ?? 0) >= 4.5) reasons.push("vendeur très bien noté");
  else if ((p.rating ?? 0) >= 4) reasons.push("vendeur bien noté");
  if (p.moqLow) reasons.push("MOQ raisonnable");
  if ((p.variantsCount ?? 0) >= 2) reasons.push("variantes disponibles");
  if (!p.hasImage) reasons.push("image non disponible");
  return { score, reasons: reasons.slice(0, 4) };
}

export function riskFromScore(score: number): "low" | "medium" | "high" {
  return score >= 75 ? "low" : score >= 55 ? "medium" : "high";
}

/** Libellé + ton UI d'un niveau de risque. */
export function riskMeta(level: "low" | "medium" | "high"): { label: string; tone: "good" | "warn" | "bad" } {
  if (level === "low") return { label: "Risque faible", tone: "good" };
  if (level === "medium") return { label: "À vérifier", tone: "warn" };
  return { label: "Risque élevé", tone: "bad" };
}

// ──────────────────────────────────────────────────────────────────────────
// Recherche fournisseurs — V1 PRAGMATIQUE.
// Aucune source réelle n'est branchée pour l'instant : on génère des résultats
// SIMULÉS, propres et cohérents à partir des mots-clés de l'analyse, classés par
// similarité + score fournisseur Orkestra. Chaque résultat est explicitement
// étiqueté « simulé » dans l'UI. Brancher Alibaba/AliExpress = Phase 2 (il
// suffira de remplacer `searchSuppliers` par un vrai connecteur).
// ──────────────────────────────────────────────────────────────────────────

import type { LensAnalysis, SupplierResult } from "./lens-store";
import { scoreSupplier } from "./supplier-score";

const SOURCES = ["Alibaba", "AliExpress", "Alibaba", "AliExpress", "Alibaba", "AliExpress"];

// PRNG déterministe (mulberry32) → mêmes résultats pour une même analyse.
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(s: string): number {
  let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
function titleCase(s: string): string {
  return s.split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

/** Génère 6 résultats fournisseurs simulés, classés par score décroissant. */
export function searchSuppliers(analysis: LensAnalysis): SupplierResult[] {
  const enKw = analysis.keywordsEn.length ? analysis.keywordsEn : analysis.keywordsSupplier.length ? analysis.keywordsSupplier : [analysis.productType];
  const base = (enKw[0] || analysis.productType || "product").toLowerCase();
  const rnd = seeded(hash(base + analysis.niche));
  const variantWords = ["Pro", "Premium", "Deluxe", "Set", "2024", "Upgraded", "Factory", "OEM", "Wholesale", "New"];

  const out: SupplierResult[] = [];
  for (let i = 0; i < SOURCES.length; i++) {
    const kw = enKw[i % enKw.length] || base;
    const similarity = Math.round(92 - i * 6 - rnd() * 8);            // décroît proprement
    const rating = Math.round((3.9 + rnd() * 1.1) * 10) / 10;         // 3.9 – 5.0
    const reviews = Math.floor(20 + rnd() * 900);
    const lo = Math.round((4 + rnd() * 30) * 100) / 100;
    const hi = Math.round((lo + 3 + rnd() * 18) * 100) / 100;
    const moqUnits = [1, 1, 2, 5, 10, 10, 20][Math.floor(rnd() * 7)];
    const variantsCount = Math.floor(rnd() * 4);
    const fast = rnd() > 0.5;
    const { score, reason } = scoreSupplier({
      similarity, rating, reviews, hasPrice: true, moqLow: moqUnits <= 5, variantsCount, fastShipping: fast,
    });
    out.push({
      id: `sup_${i}_${hash(kw + i).toString(36)}`,
      title: titleCase(`${kw} ${variantWords[Math.floor(rnd() * variantWords.length)]}`).slice(0, 70),
      source: SOURCES[i],
      hue: (hash(kw) + i * 47) % 360,
      price: `${lo.toFixed(2)} – ${hi.toFixed(2)} $`,
      moq: moqUnits === 1 ? "1 pièce" : `${moqUnits} pièces`,
      vendor: `${titleCase(analysis.niche || "Global")} Supplier Co.`,
      rating,
      reviews,
      shipping: fast ? "Express 7-12 j" : "Standard 15-25 j",
      variantsCount,
      url: `https://www.${SOURCES[i].toLowerCase()}.com/wholesale/${encodeURIComponent(kw.replace(/\s+/g, "-"))}.html`,
      similarity: Math.max(40, similarity),
      score,
      scoreReason: reason,
      simulated: true,
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

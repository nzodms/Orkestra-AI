import type { BrandMemory, StoreAnalysis } from "./types";
import {
  getPreset,
  buildUnderstanding,
  buildScores,
  buildMetrics,
  buildReviewIssues,
  type NicheCtx,
} from "./niche";

// ──────────────────────────────────────────────────────────────────────────
// Construit le profil + l'analyse de la boutique à partir des informations
// réellement saisies par l'utilisateur. Aucune donnée fixe : tout est dérivé
// du nom, de la niche, du pays, de la langue et du positionnement.
//
// En mode mock, c'est une SIMULATION cohérente avec la boutique inscrite.
// Quand le scan Shopify réel sera branché, il remplira la même structure.
// ──────────────────────────────────────────────────────────────────────────

function ctxFromBrand(brand: BrandMemory): NicheCtx {
  return {
    brandName: brand.storeName,
    niche: brand.niche,
    url: `${brand.publicUrl} ${brand.adminUrl} ${brand.shopifyUrl}`.trim(),
    language: brand.language,
    positioning: brand.positioning,
    country: brand.country,
    collections: brand.collections,
    productTypes: brand.productTypes,
    primaryKeywords: brand.primaryKeywords,
  };
}

/** Génère les champs de mémoire boutique détectés (sans écraser les saisies). */
export function buildDetectedProfile(brand: BrandMemory): Partial<BrandMemory> {
  const ctx = ctxFromBrand(brand);
  const { preset } = getPreset(ctx);
  return {
    niche: brand.niche?.trim() || preset.label,
    collections: brand.collections.length ? brand.collections : preset.collections,
    productTypes: brand.productTypes.length ? brand.productTypes : preset.productTypes,
    primaryKeywords: brand.primaryKeywords.length ? brand.primaryKeywords : preset.primaryKeywords,
    secondaryKeywords: brand.secondaryKeywords.length ? brand.secondaryKeywords : preset.secondaryKeywords,
    competitors: brand.competitors.length ? brand.competitors : preset.competitors,
    writingStyle:
      brand.writingStyle || `${cap(brand.positioning)}, clair, orienté bénéfices`,
    seoRules: brand.seoRules.length
      ? brand.seoRules
      : [
          "Cibler des requêtes adaptées à la niche et à la langue du site.",
          "Une meta unique par collection et par fiche produit.",
          "Maillage interne blog → collections → produits.",
        ],
    styleRules: brand.styleRules.length
      ? brand.styleRules
      : ["Ton cohérent avec le positionnement.", "Mettre en avant les bénéfices concrets."],
    understanding: buildUnderstanding(ctx),
  };
}

/** Génère l'analyse (scores, métriques, problèmes) de la boutique active. */
export function buildAnalysis(brand: BrandMemory, source: StoreAnalysis["source"] = "simulation"): StoreAnalysis {
  const ctx = ctxFromBrand(brand);
  const { preset } = getPreset(ctx);
  return {
    scores: buildScores(ctx),
    metrics: buildMetrics(ctx),
    issues: buildReviewIssues(ctx),
    homepageOrder: preset.homepageOrder,
    productPageStructure: preset.productPageStructure,
    confidence:
      source === "scan"
        ? "élevée (API Shopify)"
        : source === "public"
        ? "vue publique (scan visiteur)"
        : "estimée (simulation IA)",
    lastScanAt: new Date().toISOString(),
    source,
  };
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

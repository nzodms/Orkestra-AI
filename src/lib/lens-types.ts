// ──────────────────────────────────────────────────────────────────────────
// Orkestra Lens — types partagés (PURS, sans "use client" : importables côté
// serveur ET client). Le front ne lit QUE le format normalisé `SupplierResult`,
// quelle que soit la source (simulée, Alibaba, AliExpress, Apify, custom…).
// ──────────────────────────────────────────────────────────────────────────

export type LensInputKind = "upload" | "image_url" | "product_url" | "clipper";

/** Sources fournisseurs branchables. Le reste de l'app n'en dépend pas. */
export type SupplierSearchProvider = "simulated" | "alibaba" | "aliexpress" | "apify" | "custom";

/** Analyse produit d'une image / page (vision OpenAI ou simulation). */
export interface LensAnalysis {
  productType: string;
  niche: string;
  form?: string;
  color?: string;
  material?: string;
  style?: string;
  usage?: string;
  distinctive: string[];
  variants: string[];
  keywordsFr: string[];
  keywordsEn: string[];
  keywordsSupplier: string[];
  summary?: string;
  /** Analyse réelle (vision) ou simulée (pas de clé / mode démo). */
  live: boolean;
  /** Aperçu de l'entrée (data URL image, URL ou marqueur). */
  preview?: string;
  sourceUrl?: string;
}

/** Format NORMALISÉ unique d'un résultat fournisseur — seul format lu par le front. */
export interface SupplierResult {
  id: string;
  source: "Alibaba" | "AliExpress" | "1688" | "Other";
  title: string;
  imageUrl?: string;
  productUrl: string;
  price?: string;            // affichage prêt (« 4.20 – 9.90 $ »)
  minPrice?: number;
  maxPrice?: number;
  currency?: string;
  moq?: string;
  supplierName?: string;
  supplierRating?: number;   // 0-5
  reviewCount?: number;
  shippingInfo?: string;
  location?: string;
  variants?: string[];
  raw?: unknown;             // payload source brut (debug / V2)
  similarityScore: number;   // 0-100
  supplierScore: number;     // 0-100 (Score Orkestra)
  riskLevel: "low" | "medium" | "high";
  reasons: string[];
  /** Résultat simulé (pas de source réelle) ? */
  simulated: boolean;
  /** Teinte du visuel placeholder quand aucune image n'est disponible. */
  hue: number;
}

/** Réponse de la couche de recherche (provider-agnostique). */
export interface SupplierSearchResponse {
  results: SupplierResult[];
  provider: SupplierSearchProvider;
  /** true = source réelle ; false = simulé (démo / repli). */
  real: boolean;
  keywords: string[];
  error?: string;
}

export interface LensSavedItem {
  id: string;
  date: string;
  analysis: LensAnalysis;
  supplier: SupplierResult;
}

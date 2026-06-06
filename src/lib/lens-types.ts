// ──────────────────────────────────────────────────────────────────────────
// Orkestra Lens — types partagés (PURS, sans "use client" : importables côté
// serveur ET client). Le front ne lit QUE le format normalisé `SupplierResult`,
// quelle que soit la source (simulée, Alibaba, AliExpress, Apify, custom…).
// ──────────────────────────────────────────────────────────────────────────

export type LensInputKind = "upload" | "image_url" | "product_url" | "clipper";

/** Sources fournisseurs branchables. Le reste de l'app n'en dépend pas. */
export type SupplierSearchProvider = "simulated" | "alibaba" | "aliexpress" | "apify" | "custom";

/** Méthode RÉELLEMENT utilisée pour produire les résultats (badge honnête). */
export type SupplierSearchMethod = "structured" | "multi-ai-search" | "assisted" | "simulated";

/** Lien de recherche fournisseur prêt à ouvrir (toujours disponible, même sans IA). */
export interface SearchLink {
  source: "Alibaba" | "AliExpress" | "1688" | "Google";
  url: string;
  advantage: string;
  limit: string;
}
/** Ancien alias conservé pour compatibilité de type. */
export type AssistedQuery = SearchLink;

/** Analyse produit d'une image / page (vision OpenAI ou simulation). */
export interface LensAnalysis {
  productType: string;
  /** Nom produit COURT en anglais (3-5 mots) pour la recherche fournisseur. */
  productName: string;
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
  /** Moteur d'analyse réellement utilisé (badge honnête). */
  engine?: "gemini" | "openai" | "simulated";
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
  /** Extrait / description courte (recherche multi-IA). */
  snippet?: string;
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
  /** Confiance du résultat (multi-IA : pertinence/cohérence estimée). */
  confidence?: number;
  riskLevel: "low" | "medium" | "high";
  reasons: string[];
  /** Résultat simulé (pas de source réelle) ? */
  simulated: boolean;
  /** Teinte du visuel placeholder quand aucune image n'est disponible. */
  hue: number;
}

/** Réponse de la couche de recherche (méthode-agnostique pour le front). */
export interface SupplierSearchResponse {
  results: SupplierResult[];
  /** Méthode réelle utilisée (badge honnête). */
  method: SupplierSearchMethod;
  provider: SupplierSearchProvider;
  /** true = données réelles (structuré ou web multi-IA) ; false = simulé. */
  real: boolean;
  keywords: string[];
  /** Liens de recherche fournisseur prêts (toujours présents). */
  searchLinks?: SearchLink[];
  /** IA utilisées pour la recherche multi-IA (ex. ["Gemini", "Claude"]). */
  models?: string[];
  error?: string;
}

export interface LensSavedItem {
  id: string;
  date: string;
  analysis: LensAnalysis;
  supplier: SupplierResult;
}

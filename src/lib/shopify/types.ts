// ──────────────────────────────────────────────────────────────────────────
// Types Shopify — Product Studio réel (V1).
// Représente un produit réel récupéré via l'API Admin Shopify, puis enrichi
// par l'analyse qualité Orkestra.
// ──────────────────────────────────────────────────────────────────────────

export interface ShopifyImage {
  src: string;
  alt: string | null;
}

export interface ShopifyVariant {
  id: string;
  sku: string | null;
  price: string;
  compareAtPrice: string | null;
  inventoryQty: number | null;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
  imageSrc?: string | null;
}

export interface ShopifyProduct {
  /** GID Shopify (ex: gid://shopify/Product/123). Jamais modifié. */
  id: string;
  handle: string;
  title: string;
  bodyHtml: string;
  vendor: string;
  productType: string;
  tags: string[];
  status: string; // ACTIVE | DRAFT | ARCHIVED
  images: ShopifyImage[];
  variants: ShopifyVariant[];
  options: { name: string; values: string[] }[];
  seoTitle: string | null;
  seoDescription: string | null;
  collections: string[];
  /** Champs réellement disponibles via l'API (transparence : pas de faux). */
  available: { seo: boolean; inventory: boolean; collections: boolean };
}

export type IssueArea = "seo" | "contenu" | "images" | "catalogue" | "conversion";
export type IssueSeverity = "haut" | "moyen" | "bas";

export interface ProductIssue {
  code: string;
  area: IssueArea;
  label: string;
  severity: IssueSeverity;
}

export interface ProductScores {
  seo: number;
  content: number;
  conversion: number;
  global: number;
}

export type ProductPriority = "haute" | "moyenne" | "basse";
export type ProductReviewStatus = "a_corriger" | "pret" | "ignore";

export interface AnalyzedProduct extends ShopifyProduct {
  scores: ProductScores;
  issues: ProductIssue[];
  priority: ProductPriority;
  effort: "rapide" | "moyen" | "long";
  impact: "haut" | "moyen" | "bas";
  reviewStatus: ProductReviewStatus;
}

/** Champs optimisés par l'IA, appliqués en surcouche pour l'export CSV. */
export interface ProductOverride {
  title?: string;
  bodyHtml?: string;
  seoTitle?: string;
  seoDescription?: string;
  tags?: string[];
  productType?: string;
  handle?: string; // uniquement si l'utilisateur choisit de le changer
  imageAlts?: (string | null)[]; // alt par image, dans l'ordre
}

export interface ShopAccount {
  shop: string; // ex: ma-boutique.myshopify.com
  name?: string;
  currency?: string;
  productCount?: number;
}

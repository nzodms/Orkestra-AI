// ──────────────────────────────────────────────────────────────────────────
// Chemins Shopify exacts + liens inter-modules (cohérence entre les outils).
// Partagé par Merchant Shield, Assistant Shopify, Import Factory et le Dashboard.
// ──────────────────────────────────────────────────────────────────────────

export const SHOPIFY_PATHS = {
  english: "Shopify → Paramètres → Langues → Modifier le contenu du thème",
  meta: "Shopify → Produit / Collection / Page → Aperçu du référencement naturel → Modifier",
  alt: "Shopify → Produit → Médias → Modifier le texte alternatif",
  product_type: "Shopify → Produit → Organisation du produit → Type de produit",
  tags: "Shopify → Produit → Organisation du produit → Tags",
  h1: "Shopify → Boutique en ligne → Thèmes → Personnaliser → Page concernée",
  collections: "Shopify → Produits → Collections → Collection concernée → Description",
  home: "Shopify → Boutique en ligne → Thèmes → Personnaliser → Page d'accueil",
  legal: "Shopify → Paramètres → Politiques (retour, livraison, confidentialité, CGV)",
  pages: "Shopify → Boutique en ligne → Pages → Ajouter une page",
  blog: "Shopify → Boutique en ligne → Articles de blog → Ajouter",
  code: "Shopify → Boutique en ligne → Thèmes → ⋯ → Modifier le code → Sections",
} as const;

export type ShopifyPathKey = keyof typeof SHOPIFY_PATHS;

/** Lien vers l'AI Council avec une question préremplie sur un mode donné. */
export function councilLink(mode: string, q: string): string {
  return `/council?mode=${mode}&q=${encodeURIComponent(q)}`;
}

/** Lien vers l'Assistant Shopify avec une question préremplie. */
export function assistantLink(q: string): string {
  return `/assistant?q=${encodeURIComponent(q)}`;
}

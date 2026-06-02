import type { BrandMemory } from "./types";

// ──────────────────────────────────────────────────────────────────────────
// Valeurs par défaut NEUTRES.
//
// Aucune donnée propre à une boutique précise n'est stockée ici. Les données
// boutique (collections, mots-clés, scores, etc.) sont générées dynamiquement
// à partir des informations saisies par l'utilisateur — voir src/lib/niche.ts
// et src/lib/store-profile.ts.
// ──────────────────────────────────────────────────────────────────────────

export const DEFAULT_BRAND_MEMORY: BrandMemory = {
  storeName: "",
  shopifyUrl: "",
  niche: "",
  country: "France",
  language: "Français",
  positioning: "premium",
  writingStyle: "",
  formality: "vouvoiement",
  wordsToAvoid: [],
  promises: [],
  guarantees: [],
  shippingDelay: "",
  returnPolicy: "",
  collections: [],
  productTypes: [],
  primaryKeywords: [],
  secondaryKeywords: [],
  competitors: [],
  internalLinks: [],
  seoRules: [],
  styleRules: [],
  understanding: "",
};

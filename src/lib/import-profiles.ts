import type { ImportRules, ProfileCollection } from "./import-factory";

// ──────────────────────────────────────────────────────────────────────────
// Import Factory — profils boutique configurables.
// Chaque profil pilote la transformation : marque, vendor, suffixe meta,
// collections (+ URLs pour le maillage), noms brandés, format de titre, niche,
// style rédactionnel, langue. Pur (aucune dépendance serveur).
// ──────────────────────────────────────────────────────────────────────────

export interface StoreProfile {
  id: string;
  label: string;
  brand: string;
  domain: string;
  niche: string;
  style: string;
  brandNames: boolean;
  brandNameStyle: string;
  titleFormat: "plain" | "brand_suffix";
  titleRules: string;
  metaSuffix: string;
  vendor: string;
  language: string;
  collections: ProfileCollection[];
  /** Anciens noms brandés / domaines à supprimer du contenu. */
  oldTerms: string[];
}

const LUMINAIRE_COLS = (base: string): ProfileCollection[] => [
  { name: "Lustres", url: `${base}/collections/nos-lustres` },
  { name: "Suspensions", url: `${base}/collections/nos-lampes-suspendues` },
  { name: "Plafonniers", url: `${base}/collections/nos-plafonniers` },
  { name: "Lampes de chevet", url: `${base}/collections/nos-lampes-de-chevet` },
];

export const PROFILES: StoreProfile[] = [
  {
    id: "lumio",
    label: "Lumio",
    brand: "Lumio",
    domain: "https://lumio-o.com",
    niche: "Luminaires",
    style: "Professionnel, clair, e-commerce, premium accessible, sans nom brandé.",
    brandNames: false,
    brandNameStyle: "neutre",
    titleFormat: "plain",
    titleRules: "3 à 8 mots selon le produit, titre SEO naturel, pas de titre générique, AUCUN nom brandé. Ne pas inventer LED, télécommande, 360°, matière, dimension ou fonctionnalité absente.",
    metaSuffix: "✓ Livraison gratuite.",
    vendor: "Lumio",
    language: "Français",
    collections: LUMINAIRE_COLS("https://lumio-o.com"),
    oldTerms: [],
  },
  {
    id: "lpl",
    label: "Le Petit Luminaire",
    brand: "Le Petit Luminaire",
    domain: "https://le-petit-luminaire.com",
    niche: "Luminaires",
    style: "Premium, travaillé, marque déco.",
    brandNames: true,
    brandNameStyle: "luxe discret",
    titleFormat: "brand_suffix",
    titleRules: "Format obligatoire « Nom Produit SEO | NomBrandé ». Nom produit avant le | : 3 à 6 mots. NomBrandé court, premium, ~2 syllabes, UNIQUE, sans doublon ni quasi-doublon (éviter même début, accents inclus). Le nom brandé ne compte pas dans la limite 3 à 6 mots. Ex : Suspension Verre Fumé | Velia.",
    metaSuffix: "✓ Livraison gratuite.",
    vendor: "Le Petit Luminaire",
    language: "Français",
    collections: LUMINAIRE_COLS("https://le-petit-luminaire.com"),
    oldTerms: [],
  },
  {
    id: "bebilo",
    label: "Bebilo",
    brand: "Bebilo",
    domain: "",
    niche: "Bébé, maternité, allaitement, sommeil bébé, repas bébé, sécurité bébé",
    style: "Rassurant, clair, orienté parents.",
    brandNames: false,
    brandNameStyle: "neutre",
    titleFormat: "plain",
    titleRules: "Titres naturels, SEO, clairs et rassurants, sans nom brandé. NE PAS inventer de promesse médicale ou de sécurité non prouvée. Ex : Lit Cododo Réglable Bébé.",
    metaSuffix: "✓ Livraison gratuite.",
    vendor: "Bebilo",
    language: "Français",
    collections: [],
    oldTerms: [],
  },
];

export const CUSTOM_PROFILE: StoreProfile = {
  id: "custom",
  label: "Profil personnalisé",
  brand: "",
  domain: "",
  niche: "",
  style: "",
  brandNames: false,
  brandNameStyle: "neutre",
  titleFormat: "plain",
  titleRules: "",
  metaSuffix: "",
  vendor: "",
  language: "Français",
  collections: [],
  oldTerms: [],
};

export function profileById(id: string): StoreProfile {
  return PROFILES.find((p) => p.id === id) ?? CUSTOM_PROFILE;
}

/** Overrides de règles dérivés d'un profil (fusionnés au preset courant). */
export function profileRuleOverrides(p: StoreProfile): Partial<ImportRules> {
  return {
    profileId: p.id,
    language: p.language || "Français",
    vendor: p.vendor,
    metaSuffix: p.metaSuffix,
    brandNames: p.brandNames,
    brandNameStyle: p.brandNameStyle,
    titleFormat: p.titleFormat,
    collections: p.collections.map((c) => c.name),
    collectionsUrls: p.collections,
    internalLinking: p.collections.length > 0,
  };
}

/** Contexte profil injecté dans le prompt (champs lus par buildTransformPrompt). */
export function profileContext(p: StoreProfile): {
  brandName?: string; niche?: string; style?: string; vendor?: string;
  metaSuffix?: string; titleFormat?: "plain" | "brand_suffix"; titleRules?: string;
  collectionsUrls?: ProfileCollection[]; oldTerms?: string[];
} {
  return {
    brandName: p.brand || undefined,
    niche: p.niche || undefined,
    style: p.style || undefined,
    vendor: p.vendor || undefined,
    metaSuffix: p.metaSuffix || undefined,
    titleFormat: p.titleFormat,
    titleRules: p.titleRules || undefined,
    collectionsUrls: p.collections,
    oldTerms: p.oldTerms.length ? p.oldTerms : undefined,
  };
}

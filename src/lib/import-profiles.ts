import type { ImportRules, ProfileCollection } from "./import-factory";

// ──────────────────────────────────────────────────────────────────────────
// Import Factory — profils boutique GÉNÉRIQUES (multi-boutiques).
// Aucune donnée réelle d'une boutique cliente n'est codée ici : marque, vendor,
// domaine, collections et suffixe meta sont VIDES par défaut et renseignés par
// l'utilisateur (stockés en local par profil). Les profils ne portent que des
// COMPORTEMENTS génériques (noms brandés on/off, format de titre, style, niche
// large) afin que le SaaS soit vendable à n'importe quel e-commerçant.
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
  /** Anciens noms / marques / domaines à supprimer du contenu. */
  oldTerms: string[];
}

/** Réglages privés saisis par l'utilisateur pour un profil (stockés en local). */
export interface ProfileConfig {
  brand?: string;
  metaSuffix?: string;
  collections?: ProfileCollection[];
  forbiddenTerms?: string[];
  forbiddenDomains?: string[];
}

// Profils visibles = comportements génériques, sans aucune donnée réelle.
export const PROFILES: StoreProfile[] = [
  {
    id: "deco", label: "Boutique Déco",
    brand: "", domain: "", niche: "décoration", style: "Premium, soigné, orienté style et ambiance.",
    brandNames: true, brandNameStyle: "luxe discret", titleFormat: "brand_suffix",
    titleRules: "Nom produit avant le « | » : 3 à 6 mots, descriptif. Nom brandé court, premium, ~2 syllabes, UNIQUE. Pas de superlatif, pas de caractéristique inventée.",
    metaSuffix: "", vendor: "", language: "Français", collections: [], oldTerms: [],
  },
  {
    id: "maison", label: "Boutique Maison",
    brand: "", domain: "", niche: "maison & équipement", style: "Clair, sobre, e-commerce, premium accessible.",
    brandNames: false, brandNameStyle: "neutre", titleFormat: "plain",
    titleRules: "Titres naturels et descriptifs (3 à 8 mots), sans nom de marque, sans superlatif, sans caractéristique inventée.",
    metaSuffix: "", vendor: "", language: "Français", collections: [], oldTerms: [],
  },
  {
    id: "bebe", label: "Boutique Bébé",
    brand: "", domain: "", niche: "bébé & puériculture", style: "Rassurant, clair, orienté parents.",
    brandNames: false, brandNameStyle: "neutre", titleFormat: "plain",
    titleRules: "Titres clairs et rassurants, sans nom de marque, SANS promesse médicale ou de sécurité non prouvée.",
    metaSuffix: "", vendor: "", language: "Français", collections: [], oldTerms: [],
  },
  {
    id: "mode", label: "Boutique Mode",
    brand: "", domain: "", niche: "mode & vêtements", style: "Naturel, désirable, orienté matière et coupe.",
    brandNames: false, brandNameStyle: "neutre", titleFormat: "plain",
    titleRules: "Titres naturels (type, matière, coupe, usage), sans nom de marque, sans superlatif.",
    metaSuffix: "", vendor: "", language: "Français", collections: [], oldTerms: [],
  },
];

export const CUSTOM_PROFILE: StoreProfile = {
  id: "custom", label: "Profil personnalisé",
  brand: "", domain: "", niche: "", style: "",
  brandNames: false, brandNameStyle: "neutre", titleFormat: "plain", titleRules: "",
  metaSuffix: "", vendor: "", language: "Français", collections: [], oldTerms: [],
};

export function profileById(id: string): StoreProfile {
  return PROFILES.find((p) => p.id === id) ?? CUSTOM_PROFILE;
}

/** Profil enrichi des réglages privés saisis par l'utilisateur (jamais codés en dur). */
export function effectiveProfile(p: StoreProfile, config?: ProfileConfig): StoreProfile {
  if (!config) return p;
  const forbidden = [...(config.forbiddenTerms ?? []), ...(config.forbiddenDomains ?? [])].filter(Boolean);
  return {
    ...p,
    brand: config.brand || p.brand,
    vendor: config.brand || p.vendor,
    metaSuffix: config.metaSuffix ?? p.metaSuffix,
    collections: config.collections && config.collections.length ? config.collections : p.collections,
    oldTerms: Array.from(new Set([...p.oldTerms, ...forbidden])),
  };
}

/** Overrides de règles dérivés d'un profil (effectif). */
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

/** Contexte profil injecté dans le prompt (uniquement des données effectives). */
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
    collectionsUrls: p.collections.length ? p.collections : undefined,
    oldTerms: p.oldTerms.length ? p.oldTerms : undefined,
  };
}

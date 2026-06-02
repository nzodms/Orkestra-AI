import type {
  StoreScores,
  DashboardMetrics,
  PriorityAction,
  GenerationRecord,
  BrandMemory,
} from "./types";

export const DEMO_SCORES: StoreScores = {
  seo: 64,
  merchant: 58,
  conversion: 71,
  content: 49,
};

export const DEMO_METRICS: DashboardMetrics = {
  productsToOptimize: 23,
  collectionsWithoutSeo: 4,
  englishTextsDetected: 12,
  missingMetaDescriptions: 31,
  imagesWithoutAlt: 47,
};

export const DEMO_ACTIONS: PriorityAction[] = [
  {
    id: "a1",
    title: "Corriger 12 textes en anglais",
    description: "Des libellés thème en anglais nuisent à la conformité Merchant Center.",
    impact: "haut",
    module: "merchant",
    done: false,
  },
  {
    id: "a2",
    title: "Optimiser 23 fiches produits",
    description: "Descriptions trop courtes et meta manquantes sur vos best-sellers.",
    impact: "haut",
    module: "seo",
    done: false,
  },
  {
    id: "a3",
    title: "Ajouter le contenu SEO de 4 collections",
    description: "Vos pages collections n'ont aucun texte optimisé.",
    impact: "moyen",
    module: "seo",
    done: false,
  },
  {
    id: "a4",
    title: "Ajouter une section réassurance premium",
    description: "Rassurez les visiteurs avec garanties, livraison et retours.",
    impact: "moyen",
    module: "sections",
    done: false,
  },
];

export const DEMO_HISTORY: GenerationRecord[] = [
  {
    id: "g1",
    type: "seo-product",
    title: "Fiche SEO — Sac à dos urbain imperméable",
    store: "Maison Lurel",
    createdAt: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
    models: ["openai", "anthropic"],
    status: "completed",
    score: 91,
    preview: "Titre, description longue HTML, FAQ, meta et 4 mots-clés longue traîne.",
  },
  {
    id: "g2",
    type: "section",
    title: "Section Hero premium animée",
    store: "Maison Lurel",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    models: ["anthropic"],
    status: "completed",
    score: 88,
    preview: "Liquid + CSS responsive + schema customizer Shopify 2.0.",
  },
  {
    id: "g3",
    type: "merchant-audit",
    title: "Audit Merchant Center complet",
    store: "Maison Lurel",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
    models: ["gemini", "openai"],
    status: "completed",
    score: 58,
    preview: "6 problèmes détectés dont 2 critiques (politique retour, langue).",
  },
  {
    id: "g4",
    type: "council",
    title: "AI Council — Stratégie d'acquisition Q3",
    store: "Maison Lurel",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 50).toISOString(),
    models: ["openai", "anthropic", "gemini"],
    status: "completed",
    score: 84,
    preview: "Réponse fusionnée de 3 IA + onglets individuels.",
  },
];

export const DEFAULT_BRAND_MEMORY: BrandMemory = {
  storeName: "",
  shopifyUrl: "",
  niche: "",
  country: "France",
  language: "Français",
  positioning: "premium",
  writingStyle: "Clair, inspirant, orienté bénéfices",
  formality: "vouvoiement",
  wordsToAvoid: [],
  promises: [],
  guarantees: [],
  shippingDelay: "2 à 4 jours ouvrés",
  returnPolicy: "Retours gratuits sous 14 jours",
  collections: [],
  productTypes: [],
  primaryKeywords: [],
  secondaryKeywords: [],
  competitors: [],
  internalLinks: [],
  seoRules: [],
  styleRules: [],
};

// Résultat simulé d'un scan de boutique (détection niche/collections/etc.)
export const DEMO_SCAN_RESULT: Partial<BrandMemory> = {
  niche: "Maroquinerie & accessoires urbains",
  collections: ["Sacs à dos", "Sacoches", "Portefeuilles", "Accessoires"],
  productTypes: ["Sac à dos", "Sacoche", "Portefeuille", "Trousse"],
  primaryKeywords: ["sac à dos urbain", "maroquinerie premium", "sacoche cuir"],
  secondaryKeywords: ["sac imperméable", "accessoire homme", "cadeau cuir"],
  competitors: ["Bellroy", "Cabaïa", "Faguo"],
};

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
    title: "Fiche SEO — Suspension salle à manger laiton",
    store: "Lumio",
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
    store: "Lumio",
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
    store: "Lumio",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
    models: ["gemini", "openai"],
    status: "completed",
    score: 58,
    preview: "6 problèmes détectés dont 2 critiques (politique retour, langue).",
  },
  {
    id: "g4",
    type: "council",
    title: "AI Council — Plan SEO collections luminaires",
    store: "Lumio",
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
  understanding: "",
};

// Promesses & garanties par défaut (appliquées au scan si l'utilisateur n'a rien saisi).
export const LUMIO_PROMISES = [
  "Design élégant",
  "Livraison gratuite",
  "Paiement sécurisé",
  "Qualité durable",
  "Ambiance chaleureuse",
];
export const LUMIO_GUARANTEES = ["Garantie 2 ans", "Retours gratuits sous 14 jours", "Paiement 100% sécurisé"];

// Résultat simulé d'un scan de boutique (détection niche/collections/etc.).
// Cohérent avec Lumio — boutique de luminaires & décoration intérieure.
export const DEMO_SCAN_RESULT: Partial<BrandMemory> = {
  niche: "Luminaires & décoration intérieure",
  collections: [
    "Lustres",
    "Suspensions",
    "Plafonniers",
    "Lampes de chevet",
    "Luminaires escalier",
    "Plafonniers ventilateurs",
  ],
  productTypes: [
    "Lustre salon",
    "Suspension salle à manger",
    "Plafonnier moderne",
    "Lampe de chevet design",
    "Luminaire escalier",
    "Plafonnier ventilateur",
  ],
  primaryKeywords: [
    "lustre salon",
    "suspension luminaire",
    "suspension salle à manger",
    "plafonnier moderne",
  ],
  secondaryKeywords: [
    "lampe de chevet design",
    "luminaire escalier",
    "lustre design",
    "plafonnier LED",
  ],
  competitors: ["Lustria", "Lumeers", "Maisons du Monde", "Leroy Merlin", "La Redoute Intérieurs"],
  writingStyle: "Premium, clair, inspirant, professionnel, orienté bénéfices",
  internalLinks: [
    { label: "Collection Suspensions", url: "/collections/suspensions" },
    { label: "Guide : choisir son lustre de salon", url: "/blogs/guides/choisir-lustre-salon" },
    { label: "FAQ livraison & retours", url: "/pages/faq" },
  ],
  seoRules: [
    "Cibler des requêtes françaises autour des luminaires (lustre, suspension, plafonnier).",
    "Une meta unique par collection et par fiche produit.",
    "Maillage interne blog → collections → produits.",
  ],
  styleRules: [
    "Ton élégant et rassurant, orienté ambiance et bénéfices.",
    "Mettre en avant le rendu lumineux et l'atmosphère créée.",
  ],
  understanding:
    "Lumio est une boutique française spécialisée dans les luminaires décoratifs et design : lustres, suspensions, plafonniers et lampes de chevet. Le positionnement semble premium, avec un besoin fort d'optimisation SEO sur les pages collections, les fiches produits, les meta descriptions, les FAQ et le maillage interne. Les contenus doivent rester élégants, rassurants, orientés bénéfices et adaptés aux recherches françaises autour des luminaires.",
};

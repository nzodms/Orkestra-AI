// ──────────────────────────────────────────────────────────────────────────
// Types partagés Orkestra AI
// ──────────────────────────────────────────────────────────────────────────

export type AIProviderId =
  | "openai"
  | "anthropic"
  | "gemini"
  | "openrouter"
  | "mistral";

export interface AIProviderMeta {
  id: AIProviderId;
  name: string;
  tagline: string;
  /** Couleur d'accent du provider */
  color: string;
  docsUrl: string;
  /** Où trouver sa clé (texte d'aide) */
  helpKey: string;
  /** Préfixe attendu de la clé (validation légère) */
  keyPrefix?: string;
  defaultModel: string;
  /** Cas d'usage idéal (affiché sur la page Connexion). */
  bestFor?: string;
  /** Provider recommandé pour démarrer. */
  recommended?: boolean;
}

export interface AIConnection {
  provider: AIProviderId;
  /** Identifiant opaque de la clé stockée côté serveur (jamais la clé réelle). */
  keyId?: string | null;
  /** Indique si ce provider est réellement appelé en live (OpenAI en V1). */
  live?: boolean;
  /** Clé masquée pour affichage, jamais la clé réelle */
  maskedKey: string | null;
  connected: boolean;
  model: string;
  lastTestedAt: string | null;
  status: "connected" | "error" | "untested" | "disconnected";
}

export type Positioning =
  | "premium"
  | "accessible"
  | "luxe"
  | "expert"
  | "familial"
  | "ecoresponsable";

export interface BrandMemory {
  storeName: string;
  shopifyUrl: string;
  /** Lien public de la boutique (vue client), ex: https://maboutique.com */
  publicUrl: string;
  /** Lien admin Shopify (identification seulement), ex: https://admin.shopify.com/store/xxx */
  adminUrl: string;
  niche: string;
  country: string;
  language: string;
  positioning: Positioning;
  // Ton de marque
  writingStyle: string;
  formality: "tutoiement" | "vouvoiement";
  wordsToAvoid: string[];
  promises: string[];
  guarantees: string[];
  shippingDelay: string;
  returnPolicy: string;
  // Détecté au scan
  collections: string[];
  productTypes: string[];
  primaryKeywords: string[];
  secondaryKeywords: string[];
  competitors: string[];
  internalLinks: { label: string; url: string }[];
  seoRules: string[];
  styleRules: string[];
  /** Synthèse « Ce qu'Orkestra a compris de votre boutique » (généré au scan). */
  understanding: string;
}

export interface StoreScores {
  seo: number;
  merchant: number;
  conversion: number;
  content: number;
  /** Score de confiance perçue (réassurance, légal, contact…). */
  trust: number;
}

export interface DashboardMetrics {
  productsToOptimize: number;
  collectionsWithoutSeo: number;
  englishTextsDetected: number;
  missingMetaDescriptions: number;
  imagesWithoutAlt: number;
}

export interface PriorityAction {
  id: string;
  title: string;
  description: string;
  impact: "haut" | "moyen" | "bas";
  module: ModuleId;
  done: boolean;
}

export type ModuleId =
  | "dashboard"
  | "seo"
  | "sections"
  | "council"
  | "merchant"
  | "assistant"
  | "memory"
  | "history"
  | "settings";

export type GenerationType =
  | "seo-product"
  | "seo-collection"
  | "seo-faq"
  | "seo-meta"
  | "seo-blog"
  | "section"
  | "merchant-audit"
  | "council"
  | "email"
  | "quote";

export interface GenerationRecord {
  id: string;
  type: GenerationType;
  title: string;
  store: string;
  createdAt: string;
  models: AIProviderId[];
  status: "completed" | "running" | "failed" | "draft";
  score?: number;
  preview: string;
}

export type SeoLevel = "standard" | "poussé" | "ultra";
export type OutputFormat = "text" | "html" | "csv";

export interface ProductSeoResult {
  optimizedTitle: string;
  h1: string;
  shortDescription: string;
  longDescriptionHtml: string;
  benefits: string[];
  features: string[];
  faq: { q: string; a: string }[];
  metaTitle: string;
  metaDescription: string;
  imageAltTexts: string[];
  handle: string;
  primaryKeywords: string[];
  longTailKeywords: string[];
  internalLinks: string[];
  seoScore: number;
  conversionScore: number;
  recommendations: string[];
  /** Tags produit recommandés (organisation Shopify). */
  tags?: string[];
  /** Type de produit recommandé (product_type). */
  productType?: string;
  /** Collection parente suggérée (pour le maillage). */
  parentCollection?: string;
  /** Recommandation Google Merchant (titre/type/description du flux). */
  merchantNote?: string;
}

export interface SectionResult {
  /** Résumé : objectif, emplacement, pourquoi, données utilisées. */
  summary?: string;
  liquid: string;
  css: string;
  js: string;
  schema: string;
  installSteps: string[];
  responsiveChecklist: { label: string; ok: boolean }[];
  /** Avertissements qualité (bloc manquant, schema suspect…). */
  warnings?: string[];
  /** Niveau de complexité produit. */
  complexity?: string;
}

export type MerchantSeverity = "critique" | "important" | "mineur";

export interface MerchantIssue {
  id: string;
  category: string;
  severity: MerchantSeverity;
  title: string;
  explanation: string;
  fix: string;
  priority: number;
  resolved: boolean;
}

export interface MerchantAudit {
  score: number;
  issues: MerchantIssue[];
}

export type CouncilMode =
  | "seo"
  | "code"
  | "merchant"
  | "email"
  | "quote"
  | "strategy"
  | "competitive"
  | "free";

export interface CouncilProviderAnswer {
  provider: AIProviderId;
  model: string;
  specialty: string;
  answer: string;
  qualityScore: number;
  strengths: string[];
  limits: string[];
}

export interface CouncilScores {
  quality: number;
  clarity: number;
  actionable: number;
  seo?: number;
}

export interface ReviewIssue {
  area: string;
  severity: MerchantSeverity;
  explanation: string;
  impact: string;
  fix: string;
  /** Module Orkestra vers lequel pointe le bouton « Corriger avec Orkestra ». */
  module: ModuleId;
}

export interface SiteReview {
  summary: string;
  homepageOrder: string[];
  productPageStructure: string[];
  issues: ReviewIssue[];
}

/** Un texte anglais repéré sur une boutique francophone. */
export interface EnglishHit {
  text: string;
  suggestion: string;
  source: string;
  impact: string;
}

/** Présence d'une page légale / élément de confiance. */
export interface LegalCheck {
  key: string;
  label: string;
  found: boolean;
  url?: string;
  essential: boolean;
}

/** Analyse d'une page individuelle crawlée. */
export interface PageAudit {
  url: string;
  type: "home" | "collection" | "product";
  title?: string;
  metaDescription?: string;
  h1?: string;
  wordCount?: number;
  hasFaq?: boolean;
  hasReviews?: boolean;
  hasShipping?: boolean;
  hasBenefits?: boolean;
  hasCta?: boolean;
  imagesWithoutAlt?: number;
  englishCount?: number;
  /** Nombre de H1 (0 = absent, >1 = multiple). */
  h1Count?: number;
  titleLength?: number;
  metaLength?: number;
}

/** Synthèse exécutive du scan. */
export interface ScanSynthesis {
  good: string[];
  blocking: string[];
  priorities: string[];
  quickWins: string[];
  plan7: string[];
  plan30: string[];
  modules: string[];
}

/** Statistiques catalogue calculées depuis /products.json. */
export interface CatalogStats {
  productsEnriched: number;
  shortDescriptions: number;
  noDescription: number;
  weakTitles: number;
  noType: number;
  fewTags: number;
  imagesNoAlt: number;
  tagsCoverage: number; // % de produits avec >= 2 tags
  topTypes: { type: string; count: number }[];
  vendors: string[];
  priceMin?: number;
  priceMax?: number;
  priceAvg?: number;
}

/** Produit prioritaire à optimiser (issu de l'analyse catalogue). */
export interface PriorityProduct {
  title: string;
  handle: string;
  url: string;
  reason: string;
  contentScore: number;
}

/** Résultat d'analyse de la boutique active — source de vérité du dashboard. */
export interface StoreAnalysis {
  scores: StoreScores;
  metrics: DashboardMetrics;
  issues: ReviewIssue[];
  homepageOrder: string[];
  productPageStructure: string[];
  confidence: string;
  lastScanAt: string;
  source: "manuel" | "scan" | "simulation" | "public";
  // ── Données issues du crawl public réel (optionnelles) ──
  pagesAnalyzed?: number;
  productsFound?: number;
  productsAnalyzed?: number;
  collectionsFound?: number;
  collectionsAnalyzed?: number;
  pagesFound?: number;
  /** Couverture du scan : faible / moyenne / élevée. */
  coverage?: "faible" | "moyenne" | "élevée";
  /** Source principale du catalogue : sitemap / products.json / crawl home / fallback. */
  catalogSource?: string;
  productTypesDetected?: string[];
  productsEnriched?: number;
  catalogStats?: CatalogStats;
  priorityProducts?: PriorityProduct[];
  englishTexts?: EnglishHit[];
  legalPages?: LegalCheck[];
  homepageSections?: string[];
  pages?: PageAudit[];
  synthesis?: ScanSynthesis;
  partial?: boolean;
  notes?: string[];
}

/** Métadonnées d'une génération : réelle (live) ou simulée (mock). */
export interface GenMeta {
  live: boolean;
  provider?: string;
  model?: string;
  tokens?: number;
  generatedAt: string;
  fallbackReason?: string;
  /** Section Builder : modèle idéal recommandé (peut différer de l'utilisé). */
  recommendedProvider?: string;
  /** Message de routing clair pour l'utilisateur. */
  routingNote?: string;
  /** Modèle de relecture appliqué (futur agent de code). */
  reviewer?: string;
  /** Synthèse multi-IA (OpenAI + Claude fusionnés). */
  fusion?: boolean;
  /** Liste lisible des modèles réellement utilisés (ex. « gpt-4o + claude-sonnet-4-6 »). */
  models?: string;
}

export interface CouncilResult {
  finalAnswer: string;
  qualityScore: number;
  scores: CouncilScores;
  timeSaved: string;
  modelsUsed: AIProviderId[];
  nextActions: string[];
  synthesisReasons: string[];
  providerAnswers: CouncilProviderAnswer[];
  /** Présent uniquement pour une demande de review/analyse de site. */
  review?: SiteReview;
}

/** Un tour de conversation dans l'AI Council (persisté). */
export interface CouncilTurn {
  id: string;
  role: "user" | "council";
  mode: CouncilMode;
  // role === "user"
  question?: string;
  // role === "council"
  result?: CouncilResult;
  meta?: GenMeta;
}

// ── Assistant Shopify (exécution pas-à-pas, persisté) ───────────────────────
export interface AssistantProc {
  title: string;
  /** Réponse courte d'introduction. */
  short?: string;
  steps: string[];
  note?: string;
  english?: { text: string; suggestion: string }[];
  products?: { title: string }[];
  missingLegal?: string[];
  council?: { label: string; href: string };
  seo?: boolean;
  /** Actions suivantes proposées (questions de suivi). */
  nextActions?: { label: string; q: string }[];
  /** Réponse OpenAI live (markdown) pour les demandes hors-template. */
  ai?: string;
}
export type AssistantTurn =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; proc: AssistantProc };


// ──────────────────────────────────────────────────────────────────────────
// Orkestra Voice — types partagés (PURS). Une couche vocale AU-DESSUS des
// modules existants : elle classe l'intention, appelle le bon outil et compose
// une réponse courte. Aucune refonte des modules.
// ──────────────────────────────────────────────────────────────────────────

import type { StoreAnalysis, BrandMemory } from "../types";

export type VoiceModule = "import" | "lens" | "merchant" | "assistant" | "dashboard" | "none";

export type VoiceIntentId =
  | "import.analyze" | "import.issues" | "import.ready" | "import.next"
  | "lens.search" | "lens.compare" | "lens.send" | "lens.open"
  | "merchant.status" | "merchant.risks" | "merchant.checklist" | "merchant.monitor"
  | "shopify.path"
  | "seo.review" | "store.english"
  | "dashboard.status" | "dashboard.priority" | "dashboard.metric"
  | "council.ask" | "connect.status"
  | "unknown";

export interface VoiceIntent {
  id: VoiceIntentId;
  module: VoiceModule;
  tool: string;
  params: { query?: string; action?: string; platform?: string; constraint?: string; metric?: string };
  confidence: number; // 0-1
}

/** Snapshot du store transmis aux tools (qui restent purs / testables). */
export interface VoiceContext {
  recentImports: {
    fileName: string; products: number; status: string;
    warnings: number; risks: number; failed: number;
    verdict?: string; riskReasons?: string[]; avgScore?: number;
  }[];
  analysis: StoreAnalysis | null;
  brand: BrandMemory;
  merchantResolved: string[];
  lensSavedCount: number;
  /** Dernier nom produit analysé dans Lens (si disponible). */
  lastProductName?: string;
  hasImportDraft: boolean;
  /** Nombre d'IA connectées (BYOK). */
  connectedCount: number;
}

export type VoiceCardKind =
  | "supplier" | "search-link" | "seo-issue" | "english-term"
  | "import-issue" | "merchant-risk" | "shopify-step" | "metric" | "info";

/** Une carte de résultat affichée DANS le panel Voice. */
export interface VoiceCard {
  kind: VoiceCardKind;
  title: string;
  subtitle?: string;
  meta?: string;        // ex. « Alibaba · score 87 » / « produit · thème »
  detail?: string;      // recommandation / emplacement / correction
  href?: string;        // ouvrir la source / l'emplacement
  tone?: "good" | "warn" | "bad" | "neutral" | "brand";
  badge?: string;
}
/** Action rapide sous le résultat. */
export interface VoiceAction {
  label: string;
  kind: "link" | "navigate" | "command";
  href?: string;        // link (externe) ou navigate (route interne)
  command?: string;     // relancer une commande vocale
  primary?: boolean;
}
/** Résultat structuré rendu directement dans Orkestra Voice (Voice = couche d'exécution). */
export interface VoiceResult {
  intent: string;
  module: VoiceModule;
  title: string;
  spokenSummary: string;   // réponse courte (et lue en TTS)
  cards: VoiceCard[];
  actions: VoiceAction[];
  moduleLink?: { href: string; label: string };
  confidence: number;
  /** Recherche en cours (résultats web Lens à venir) ? */
  pending?: boolean;
}

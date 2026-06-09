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

export interface VoiceLink { source: string; url: string }

/** Réponse vocale : texte COURT + module concerné + lien d'ouverture. */
export interface VoiceReply {
  text: string;
  module: VoiceModule;
  href?: string;
  label?: string;     // ex. « Ouvrir Import Factory »
  links?: VoiceLink[];
}

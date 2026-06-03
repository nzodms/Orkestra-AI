import type { AIProviderId } from "../types";

// ──────────────────────────────────────────────────────────────────────────
// Routing IA/code du Section Builder.
//
// Choisit automatiquement le meilleur moteur disponible selon : le type de
// section, la complexité et l'action demandée. Couche PURE (aucune dépendance
// serveur) → utilisable côté client (affichage) ET serveur (exécution).
//
// État V1 : seul OpenAI est « live-capable ». Claude (Anthropic), OpenRouter et
// un futur agent de code (Codex-style) sont PRÉPARÉS mais pas branchés. Dès que
// Claude sera connecté, il sera recommandé pour les sections longues/complexes.
// ──────────────────────────────────────────────────────────────────────────

/** Providers réellement appelables en live aujourd'hui. */
export const LIVE_CAPABLE: AIProviderId[] = ["openai"];

export type SectionMode = "generate" | "improve" | "review" | "fix" | "mobile" | "nojs" | "settings";
export type ComplexityTier = "simple" | "complex" | "ultra";

// Types de sections intrinsèquement complexes (Liquid/CSS/JS/schema longs).
const COMPLEX_TYPES = /hero|sticky|avant|comparat|collection|storytelling/i;
// Actions de type review/correction → orientées « relecture de code ».
const REVIEW_MODES: SectionMode[] = ["review", "fix", "mobile", "nojs", "settings"];

export interface SectionRouting {
  mode: SectionMode;
  tier: ComplexityTier;
  /** Modèle IDÉAL pour cette tâche (peut ne pas être connecté). */
  recommendedProvider: AIProviderId;
  /** Modèle réellement utilisé maintenant (live-capable + connecté), ou null → mock. */
  usedProvider: AIProviderId | null;
  /** Modèle de relecture/correction (futur Codex/agent), ou null. */
  reviewerProvider: AIProviderId | null;
  /** Provider de repli si le recommandé n'est pas dispo. */
  fallbackProvider: AIProviderId;
  /** Raison interne du choix. */
  reason: string;
  /** Message clair pour l'utilisateur. */
  note: string;
}

export interface RouteArgs {
  type: string;
  complexity?: string; // simple | avancé | ultra premium | standard
  /** Directive d'amélioration éventuelle (premium/mobile/nojs/fix/settings/simplify/niche/product/home). */
  action?: string | null;
  /** Providers connectés par l'utilisateur. */
  connected: AIProviderId[];
}

function tierOf(type: string, complexity?: string): ComplexityTier {
  if (/ultra/i.test(complexity || "")) return "ultra";
  if (COMPLEX_TYPES.test(type) || /avancé|avance/i.test(complexity || "")) return "complex";
  return "simple";
}

function actionToMode(action?: string | null): SectionMode {
  if (!action) return "generate";
  if (action === "fix") return "fix";
  if (action === "mobile") return "mobile";
  if (action === "nojs") return "nojs";
  if (action === "settings") return "settings";
  return "improve";
}

/** Premier provider de la liste à la fois live-capable ET connecté. */
function firstLive(prefs: AIProviderId[], connected: AIProviderId[]): AIProviderId | null {
  for (const p of prefs) if (LIVE_CAPABLE.includes(p) && connected.includes(p)) return p;
  return null;
}

export function routeSection(args: RouteArgs): SectionRouting {
  const mode = actionToMode(args.action);
  const tier = tierOf(args.type, args.complexity);
  const isReview = REVIEW_MODES.includes(mode);

  // Modèle idéal :
  //  - review/correction/mobile/nojs/settings → OpenAI (ou futur agent Codex).
  //  - génération complexe/ultra → Claude (sections longues Liquid/CSS/schema).
  //  - génération simple → OpenAI.
  const recommendedProvider: AIProviderId = isReview
    ? "openai"
    : tier === "simple"
    ? "openai"
    : "anthropic";

  // Ordre de préférence d'exécution réelle (selon ce qui est live + connecté).
  const prefs: AIProviderId[] = isReview
    ? ["openai", "anthropic", "openrouter"]
    : tier === "simple"
    ? ["openai", "anthropic", "openrouter"]
    : ["anthropic", "openrouter", "openai"]; // complexe : Claude d'abord, sinon OpenAI
  const usedProvider = firstLive(prefs, args.connected);
  const reviewerProvider = firstLive(["openai", "anthropic"], args.connected);

  const reason = isReview
    ? `Action « ${mode} » → relecture/correction de code (OpenAI ; futur agent Codex).`
    : tier === "simple"
    ? "Section simple → OpenAI suffit."
    : `Section ${tier} → Claude recommandé pour le code long ; repli OpenAI.`;

  // Message UX clair.
  let note: string;
  if (!usedProvider) {
    note = "Aucune IA connectée — section générée en mode démo. Connectez OpenAI pour le live.";
  } else if (recommendedProvider !== usedProvider && recommendedProvider === "anthropic") {
    note = `Modèle recommandé : Claude (sections complexes). Utilisé : ${PROVIDER_NAME[usedProvider]} live. Claude sera utilisé automatiquement dès qu'il sera connecté.`;
  } else {
    note = `Modèle utilisé : ${PROVIDER_NAME[usedProvider]} live.`;
  }

  return {
    mode,
    tier,
    recommendedProvider,
    usedProvider,
    reviewerProvider,
    fallbackProvider: "openai",
    reason,
    note,
  };
}

export const PROVIDER_NAME: Record<AIProviderId, string> = {
  openai: "OpenAI",
  anthropic: "Claude",
  gemini: "Gemini",
  openrouter: "OpenRouter",
  mistral: "Mistral",
};

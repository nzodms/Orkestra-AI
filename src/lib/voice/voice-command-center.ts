// ──────────────────────────────────────────────────────────────────────────
// Orkestra Voice — COMMAND CENTER (couche d'exécution centrale).
// Commande → bon moteur interne → VoiceResult riche affiché DANS le panel Voice.
// lens.search est exécuté en réel (async, /api/lens/search) ; les autres outils
// lisent les données du store (scan, import, Merchant, scores). Aucune invention.
// ──────────────────────────────────────────────────────────────────────────

import { classifyVoiceIntent } from "./voice-intents";
import { runVoiceTool } from "./voice-tools";
import { runLensSearchInsideVoice, type VoiceKeyRefs } from "./voice-lens";
import { vlog } from "./voice-orchestrator";
import type { VoiceContext, VoiceResult } from "./voice-types";

export type { VoiceKeyRefs };

/** Point d'entrée central : exécute la commande et renvoie le résultat à afficher. */
export async function runVoiceCommand(text: string, ctx: VoiceContext, keyRefs: VoiceKeyRefs): Promise<VoiceResult> {
  const intent = classifyVoiceIntent(text);
  vlog("voice-intent-detected", { id: intent.id, module: intent.module, query: intent.params.query });
  try {
    // Recherche fournisseur = exécution Lens réelle (Gemini/Claude si connectés).
    if (intent.id === "lens.search") {
      const q = (intent.params.query || ctx.lastProductName || "").trim();
      if (q) {
        vlog("voice-tool-called", { tool: "lens.search" });
        const r = await runLensSearchInsideVoice(q, intent.params.platform, keyRefs);
        r.intent = "lens.search";
        vlog("voice-reply-generated", { module: r.module, cards: r.cards.length });
        return r;
      }
    }
    vlog("voice-tool-called", { tool: intent.tool });
    const r = runVoiceTool(intent, ctx);
    vlog("voice-reply-generated", { module: r.module, cards: r.cards.length });
    return r;
  } catch {
    vlog("voice-tool-error", { tool: intent.tool });
    return {
      intent: intent.id, module: "none", title: "Erreur",
      spokenSummary: "Je n'ai pas pu exécuter cette action. Réessayez ou ouvrez le module concerné.",
      cards: [], actions: [], moduleLink: { href: "/dashboard", label: "Ouvrir Orkestra" }, confidence: 0.2,
    };
  }
}

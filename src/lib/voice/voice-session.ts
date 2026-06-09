// ──────────────────────────────────────────────────────────────────────────
// Orkestra Voice — CONTEXTE CONVERSATIONNEL + follow-ups.
// Garde le fil de la discussion (dernière recherche, derniers résultats, dernier
// module…) pour comprendre « garde seulement Alibaba », « compare les deux
// premiers », « comment je corrige ça ? », « c'est où dans Shopify ? » sans
// repartir de zéro. Réutilise les tools/cards déjà créés (pas de duplication).
// ──────────────────────────────────────────────────────────────────────────

import { voiceExplainShopifyPath, voiceMerchantChecklist } from "./voice-tools";
import type { VoiceContext, VoiceCard, VoiceModule, VoiceResult } from "./voice-types";

export interface VoiceSession {
  lastIntent?: string;
  lastModule?: VoiceModule;
  lastQuery?: string;        // dernière requête fournisseur
  lastCards: VoiceCard[];    // derniers résultats (pour filtrer / comparer / ouvrir)
  lastEnglishTerm?: string;  // dernier mot anglais discuté
  lastFixAction?: string;    // indice de chemin Shopify pour « comment corriger »
}
export const EMPTY_SESSION: VoiceSession = { lastCards: [] };

function norm(s: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/['’]/g, " ");
}
const MHREF: Record<VoiceModule, { href: string; label: string }> = {
  import: { href: "/seo", label: "Ouvrir Import Factory" }, lens: { href: "/lens", label: "Ouvrir Orkestra Lens" },
  merchant: { href: "/merchant", label: "Ouvrir Merchant Shield" }, assistant: { href: "/assistant", label: "Ouvrir l'Assistant Shopify" },
  dashboard: { href: "/dashboard", label: "Ouvrir le Dashboard" }, none: { href: "/dashboard", label: "Ouvrir Orkestra" },
};
function mk(module: VoiceModule, spokenSummary: string, opts: Partial<VoiceResult> = {}): VoiceResult {
  return { intent: opts.intent || "followup", module, title: opts.title || "", spokenSummary, cards: opts.cards || [], actions: opts.actions || [], moduleLink: opts.moduleLink ?? MHREF[module], confidence: opts.confidence ?? 0.78 };
}
const PLAT: Record<string, string> = { alibaba: "Alibaba", aliexpress: "AliExpress", "1688": "1688", google: "Google" };
function cardMatchesPlatform(c: VoiceCard, token: string): boolean {
  const hay = `${c.title} ${c.badge || ""} ${c.meta || ""} ${c.subtitle || ""}`.toLowerCase();
  return hay.includes(token);
}

/** Tente de résoudre une commande de SUIVI à partir du contexte. Null si ce n'en est pas une. */
export function resolveFollowUp(text: string, session: VoiceSession, ctx: VoiceContext): VoiceResult | null {
  const t = norm(text);
  const cards = session.lastCards || [];
  const supplierCtx = cards.some((c) => c.kind === "supplier" || c.kind === "search-link");

  // « garde seulement Alibaba » / « filtre AliExpress » / « juste 1688 »
  const platMatch = t.match(/\b(alibaba|aliexpress|1688|google)\b/);
  if (platMatch && supplierCtx && /\b(garde|gardez|filtre|filtrer|juste|seulement|uniquement|que)\b/.test(t)) {
    const token = platMatch[1];
    const kept = cards.filter((c) => cardMatchesPlatform(c, token));
    return mk("lens", `Je garde uniquement ${PLAT[token]}.`, {
      intent: "lens.filter", title: `Fournisseurs · ${PLAT[token]}`,
      cards: kept.length ? kept : cards, actions: [{ label: "Comparer", kind: "command", command: "compare les deux premiers" }],
    });
  }

  // « compare les deux premiers / les deux meilleurs »
  if (/\bcompare/.test(t) && supplierCtx) {
    const n = /trois|3/.test(t) ? 3 : 2;
    const top = cards.slice(0, n);
    if (top.length < 2) return mk("lens", `Il n'y a qu'un résultat (${top[0]?.title || ""}) après le filtre. Élargissez la recherche pour comparer plusieurs fournisseurs.`, { intent: "lens.compare", title: "Comparaison", cards: top });
    return mk("lens", `Voici la comparaison des ${top.length} premiers résultats. Ouvrez Orkestra Lens pour le détail (prix, MOQ).`, {
      intent: "lens.compare", title: "Comparaison", cards: top,
      actions: [{ label: "Comparer en détail", kind: "navigate", href: "/lens" }],
    });
  }

  // « ouvre le deuxième / le premier / le meilleur »
  const nth = t.match(/\b(ouvre|ouvrir|montre|affiche)\b.{0,14}(premier|1er|deuxieme|2eme|2e|second|troisieme|3eme|3e|meilleur)/);
  if (nth && cards.length) {
    const idx = /deuxieme|2eme|2e|second/.test(nth[2]) ? 1 : /troisieme|3eme|3e/.test(nth[2]) ? 2 : 0;
    const c = cards[Math.min(idx, cards.length - 1)];
    if (c?.href) return mk("lens", `J'ouvre « ${c.title} ».`, { intent: "lens.open", title: c.title, cards: [c], actions: [{ label: `Ouvrir ${c.title}`, kind: "link", href: c.href, primary: true }] });
  }

  // « envoie le meilleur vers Import Factory »
  if (/\b(envoie|envoyer|exporte|ajoute)\b.{0,24}(import|factory)/.test(t) && supplierCtx) {
    return mk("import", "Pour transférer ses infos, choisissez le fournisseur dans Orkestra Lens puis « Envoyer vers Import Factory ». J'ouvre la suite.", {
      intent: "lens.send", title: "Envoyer vers Import Factory",
      actions: [{ label: "Choisir dans Lens", kind: "navigate", href: "/lens", primary: true }, { label: "Ouvrir Import Factory", kind: "navigate", href: "/seo" }],
    });
  }

  // « comment je corrige ça ? » / « comment j'enlève Add to cart ? » / « c'est où dans Shopify ? »
  if (/\b(comment.{0,14}(je |j |on )?(corrige|corriger|repare|reparer|enleve|enlever|retire|retirer|traduis|traduire|change|modifie)|c est ou|ou.{0,10}(le |la |ca )?(modifier|corriger|changer|enlever|dans shopify))\b/.test(t)) {
    if (session.lastEnglishTerm || session.lastModule === "assistant") {
      const r = voiceExplainShopifyPath("liquid");
      r.spokenSummary = `${session.lastEnglishTerm ? `Pour « ${session.lastEnglishTerm} » : ` : ""}c'est dans le thème ou les traductions. ${r.spokenSummary}`;
      return r;
    }
    if (session.lastModule === "import") return mk("import", "Ouvrez Import Factory : réécrivez les meta et descriptions concernées, puis ré-exportez le CSV.", { title: "Comment corriger" });
    if (session.lastModule === "merchant") return voiceMerchantChecklist(ctx);
    if (session.lastFixAction) return voiceExplainShopifyPath(session.lastFixAction);
    return null;
  }

  return null;
}

/** Met à jour le contexte conversationnel après un résultat. */
export function nextSession(prev: VoiceSession, intentId: string, res: VoiceResult): VoiceSession {
  const next: VoiceSession = { ...prev, lastIntent: intentId, lastModule: res.module };
  if (res.cards.length) next.lastCards = res.cards;
  if (intentId === "lens.search" || intentId === "lens.filter") {
    const m = res.title.match(/·\s*(.+)$/); if (m) next.lastQuery = m[1].trim();
  }
  if (intentId === "store.english") {
    const term = res.cards.find((c) => c.kind === "english-term");
    if (term) next.lastEnglishTerm = term.title.replace(/[«»"]/g, "").trim();
    next.lastFixAction = "liquid";
  }
  if (intentId === "shopify.path") next.lastFixAction = undefined;
  return next;
}

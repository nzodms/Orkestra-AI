// ──────────────────────────────────────────────────────────────────────────
// Orkestra Voice — outils internes (PURS). Chaque outil lit le snapshot du store
// (VoiceContext) et renvoie une réponse COURTE + le module concerné. Réutilise
// les briques existantes (Merchant report, liens de recherche Lens, Assistant).
// ──────────────────────────────────────────────────────────────────────────

import { buildMerchantReport } from "../merchant";
import { buildSearchLinks } from "../lens-links";
import { assistantLink } from "../shopify";
import type { VoiceContext, VoiceIntent, VoiceModule, VoiceReply } from "./voice-types";

const MODULE_META: Record<VoiceModule, { href: string; label: string }> = {
  import: { href: "/seo", label: "Ouvrir Import Factory" },
  lens: { href: "/lens", label: "Ouvrir Orkestra Lens" },
  merchant: { href: "/merchant", label: "Ouvrir Merchant Shield" },
  assistant: { href: "/assistant", label: "Ouvrir l'Assistant Shopify" },
  dashboard: { href: "/dashboard", label: "Ouvrir le Dashboard" },
  none: { href: "/dashboard", label: "Ouvrir Orkestra" },
};
function reply(module: VoiceModule, text: string, extra: Partial<VoiceReply> = {}): VoiceReply {
  return { text, module, href: MODULE_META[module].href, label: MODULE_META[module].label, ...extra };
}

const VERDICT_FR: Record<string, string> = {
  ready: "prêt à publier", verify: "presque prêt, quelques vérifications",
  risky: "à corriger avant publication", partial: "partiellement traité",
};

// ── Import Factory ───────────────────────────────────────────────────────────
export function voiceAnalyzeLastImport(ctx: VoiceContext): VoiceReply {
  const ri = ctx.recentImports[0];
  if (!ri) return reply("import", "Vous n'avez pas encore d'import récent. Importez un CSV dans Import Factory pour commencer.");
  const verdict = (ri.verdict && VERDICT_FR[ri.verdict]) || "traité";
  const bits: string[] = [];
  if (ri.risks) bits.push(`${ri.risks} à corriger`);
  if (ri.warnings) bits.push(`${ri.warnings} à vérifier`);
  const tail = bits.length ? ` Il reste ${bits.join(" et ")}.` : " Rien à corriger.";
  return reply("import", `Votre dernier import (${ri.products} produit${ri.products > 1 ? "s" : ""}) est ${verdict}.${tail}`);
}
export function voiceSummarizeImportIssues(ctx: VoiceContext): VoiceReply {
  const ri = ctx.recentImports[0];
  if (!ri) return reply("import", "Aucun import à analyser pour l'instant. Importez d'abord un CSV dans Import Factory.");
  const reasons = (ri.riskReasons || []).filter(Boolean).slice(0, 2);
  if (!reasons.length) return reply("import", "Aucun point bloquant détecté sur votre dernier import. Vous pouvez publier.");
  return reply("import", `Principaux points à revoir : ${reasons.join(" ; ")}.`);
}

// ── Orkestra Lens ────────────────────────────────────────────────────────────
export function voiceSearchSuppliers(ctx: VoiceContext, query?: string): VoiceReply {
  const q = (query || ctx.lastProductName || "").trim();
  if (!q) return reply("lens", "Dites-moi quel produit chercher, ou importez une image dans Orkestra Lens.");
  const links = buildSearchLinks(q).map((l) => ({ source: l.source, url: l.url }));
  return reply("lens", `J'ai préparé la recherche fournisseur pour « ${q} ». Alibaba, AliExpress et Google sont prêts.`, { links: links.slice(0, 4) });
}
export function voiceCompareSuppliers(ctx: VoiceContext): VoiceReply {
  if (ctx.lensSavedCount > 0) return reply("lens", `Vous avez ${ctx.lensSavedCount} fournisseur${ctx.lensSavedCount > 1 ? "s" : ""} sauvegardé${ctx.lensSavedCount > 1 ? "s" : ""}. Ouvrez Orkestra Lens pour les comparer.`);
  return reply("lens", "Analysez un produit dans Orkestra Lens, puis je pourrai comparer les fournisseurs trouvés.");
}
export function voiceSendToImportFactory(ctx: VoiceContext): VoiceReply {
  if (ctx.hasImportDraft) return reply("import", "Un produit est prêt à transformer. Ouvrez Import Factory pour finaliser la fiche.");
  if (ctx.lensSavedCount > 0) return reply("lens", "Ouvrez Orkestra Lens et choisissez un fournisseur pour l'envoyer vers Import Factory.");
  return reply("lens", "Analysez d'abord un produit dans Orkestra Lens, puis envoyez-le vers Import Factory.");
}

// ── Merchant Shield ──────────────────────────────────────────────────────────
export function voiceRunMerchantShield(ctx: VoiceContext): VoiceReply {
  const r = buildMerchantReport(ctx.analysis, ctx.brand, ctx.merchantResolved);
  if (!r.scanned) return reply("dashboard", "Je n'ai pas encore d'analyse de votre boutique. Lancez un scan depuis le Dashboard, puis demandez-moi le statut Merchant.");
  const before = (r.submission?.before || []).slice(0, 2);
  const tail = before.length ? ` Avant Google : ${before.join(", ")}.` : " Vous pouvez soumettre.";
  return reply("merchant", `Merchant : ${r.gmcStatus.label} (${r.readiness}/100).${tail}`);
}

// ── Assistant Shopify (chemins) ──────────────────────────────────────────────
const SHOPIFY_HELP: Record<string, { text: string; q: string }> = {
  "import-csv": { text: "Dans Shopify : Produits → Importer, puis déposez votre CSV. Orkestra prépare le CSV propre dans Import Factory.", q: "Comment importer un CSV de produits dans Shopify, étape par étape ?" },
  "edit-meta": { text: "Pour une fiche : Produits → (le produit) → section Référencement. Pour l'accueil : Boutique en ligne → Préférences.", q: "Où modifier la meta description d'un produit et de l'accueil dans Shopify ?" },
  "edit-page": { text: "Boutique en ligne → Pages pour créer ou modifier une page (mentions, livraison, retours).", q: "Où créer et modifier une page (mentions légales, livraison) dans Shopify ?" },
  "fix-product": { text: "Produits → (le produit) pour corriger. Orkestra peut régénérer la fiche dans Import Factory.", q: "Où corriger une fiche produit dans Shopify ?" },
  general: { text: "Dites-moi quoi faire (importer un CSV, modifier une meta, une page…) et je vous donne le chemin Shopify exact.", q: "Guide-moi dans Shopify." },
};
export function voiceExplainShopifyPath(action?: string): VoiceReply {
  const h = SHOPIFY_HELP[action || "general"] || SHOPIFY_HELP.general;
  return reply("assistant", h.text, { href: assistantLink(h.q), label: "Demander à l'Assistant Shopify" });
}

// ── Dashboard ────────────────────────────────────────────────────────────────
export function voiceReadDashboardStatus(ctx: VoiceContext): VoiceReply {
  const a = ctx.analysis;
  if (!a) return reply("dashboard", "Je n'ai pas encore analysé votre boutique. Lancez un scan depuis le Dashboard pour un résumé.");
  const todo: string[] = [];
  if (a.metrics?.productsToOptimize) todo.push(`${a.metrics.productsToOptimize} produits à optimiser`);
  if (a.metrics?.englishTextsDetected) todo.push(`${a.metrics.englishTextsDetected} textes anglais`);
  if (a.metrics?.missingMetaDescriptions) todo.push(`${a.metrics.missingMetaDescriptions} meta manquantes`);
  const tail = todo.length ? ` À faire : ${todo.slice(0, 2).join(", ")}.` : " Rien d'urgent.";
  return reply("dashboard", `Boutique : SEO ${a.scores?.seo ?? 0}/100, confiance ${a.scores?.trust ?? 0}/100.${tail}`);
}

function voiceFallback(): VoiceReply {
  return reply("none", "Je peux analyser votre dernier import, chercher des fournisseurs, vérifier Merchant, résumer la boutique ou vous guider dans Shopify. Dites par exemple : « analyse mon dernier import ».");
}

/** Dispatcher : intention → outil → réponse courte. */
export function runVoiceTool(intent: VoiceIntent, ctx: VoiceContext): VoiceReply {
  switch (intent.id) {
    case "import.analyze": return voiceAnalyzeLastImport(ctx);
    case "import.issues": return voiceSummarizeImportIssues(ctx);
    case "lens.search": return voiceSearchSuppliers(ctx, intent.params.query);
    case "lens.compare": return voiceCompareSuppliers(ctx);
    case "lens.send": return voiceSendToImportFactory(ctx);
    case "merchant.status": return voiceRunMerchantShield(ctx);
    case "shopify.path": return voiceExplainShopifyPath(intent.params.action);
    case "dashboard.status": return voiceReadDashboardStatus(ctx);
    default: return voiceFallback();
  }
}

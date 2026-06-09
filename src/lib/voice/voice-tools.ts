// ──────────────────────────────────────────────────────────────────────────
// Orkestra Voice — outils internes (PURS). Chaque outil lit le snapshot du store
// (VoiceContext) et renvoie une réponse COURTE (constat → point principal →
// action) + le module concerné. Réutilise les briques existantes.
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
function noImport(): VoiceReply { return reply("import", "Vous n'avez pas encore d'import récent. Importez un CSV dans Import Factory pour commencer."); }

export function voiceAnalyzeLastImport(ctx: VoiceContext): VoiceReply {
  const ri = ctx.recentImports[0];
  if (!ri) return noImport();
  const verdict = (ri.verdict && VERDICT_FR[ri.verdict]) || "traité";
  const bits: string[] = [];
  if (ri.risks) bits.push(`${ri.risks} à corriger`);
  if (ri.warnings) bits.push(`${ri.warnings} à vérifier`);
  const principal = (ri.riskReasons || [])[0];
  const tail = bits.length ? ` Il reste ${bits.join(" et ")}.${principal ? ` Point principal : ${principal}.` : ""}` : " Rien à corriger, vous pouvez exporter.";
  return reply("import", `Votre dernier import (${ri.products} produit${ri.products > 1 ? "s" : ""}) est ${verdict}.${tail}`);
}
export function voiceSummarizeImportIssues(ctx: VoiceContext): VoiceReply {
  const ri = ctx.recentImports[0];
  if (!ri) return noImport();
  const reasons = (ri.riskReasons || []).filter(Boolean).slice(0, 3);
  if (!reasons.length) return reply("import", "Aucun point bloquant détecté sur votre dernier import. Vous pouvez publier.");
  return reply("import", `${reasons.length} point${reasons.length > 1 ? "s" : ""} à revoir : ${reasons.join(" ; ")}. Ouvrez Import Factory pour corriger.`);
}
export function voiceImportReadiness(ctx: VoiceContext): VoiceReply {
  const ri = ctx.recentImports[0];
  if (!ri) return noImport();
  const ready = Math.max(0, ri.products - ri.risks - ri.failed);
  const verdict = (ri.verdict && VERDICT_FR[ri.verdict]) || "en cours";
  const tail = ri.risks || ri.failed ? ` ${ri.risks + ri.failed} encore à corriger.` : " Tout est prêt à exporter.";
  return reply("import", `${ready} produit${ready > 1 ? "s" : ""} prêt${ready > 1 ? "s" : ""} sur ${ri.products}. Votre CSV est ${verdict}.${tail}`);
}
export function voiceImportNextAction(ctx: VoiceContext): VoiceReply {
  const ri = ctx.recentImports[0];
  if (!ri) return noImport();
  if (ri.risks || ri.failed) return reply("import", `Prochaine action : corrigez les ${ri.risks + ri.failed} produit${ri.risks + ri.failed > 1 ? "s" : ""} à risque (filtre « À corriger » dans Import Factory), puis exportez.`);
  if (ri.warnings) return reply("import", `Prochaine action : vérifiez les ${ri.warnings} point${ri.warnings > 1 ? "s" : ""} signalé${ri.warnings > 1 ? "s" : ""}, puis exportez le CSV Shopify.`);
  return reply("import", "Prochaine action : exportez le CSV Shopify, il est prêt.");
}

// ── Orkestra Lens ────────────────────────────────────────────────────────────
export function voiceSearchSuppliers(ctx: VoiceContext, query?: string, platform?: string, constraint?: string): VoiceReply {
  const q = (query || ctx.lastProductName || "").trim();
  if (!q) return reply("lens", "Dites-moi quel produit chercher (ex. « fournisseurs pour un Pilates Reformer »), ou importez une image dans Orkestra Lens.");
  let links = buildSearchLinks(q).map((l) => ({ source: l.source, url: l.url }));
  if (platform) links = [...links.filter((l) => l.source === platform), ...links.filter((l) => l.source !== platform)];
  const note = constraint === "moq" ? " Pour un MOQ faible, AliExpress est souvent le plus adapté."
    : constraint === "europe" ? " Pour l'Europe, filtrez la livraison directement sur la source."
    : constraint === "fast" ? " Pour une livraison rapide, vérifiez les délais sur chaque fiche."
    : "";
  const where = platform ? `sur ${platform} ` : "";
  return reply("lens", `Recherche fournisseur prête ${where}pour « ${q} ».${note} Ouvrez Orkestra Lens pour l'analyse complète.`, { links: links.slice(0, 4) });
}
export function voiceCompareSuppliers(ctx: VoiceContext): VoiceReply {
  if (ctx.lensSavedCount > 0) return reply("lens", `Vous avez ${ctx.lensSavedCount} fournisseur${ctx.lensSavedCount > 1 ? "s" : ""} sauvegardé${ctx.lensSavedCount > 1 ? "s" : ""}. Ouvrez Orkestra Lens et sélectionnez 2 à 4 résultats pour les comparer.`);
  return reply("lens", "Analysez un produit dans Orkestra Lens, puis je pourrai comparer les fournisseurs trouvés (prix, MOQ, score).");
}
export function voiceOpenBestSupplier(): VoiceReply {
  return reply("lens", "Ouvrez Orkestra Lens : le meilleur résultat (score Orkestra le plus élevé) est en tête de liste, prêt à envoyer vers Import Factory.");
}
export function voiceSendToImportFactory(ctx: VoiceContext): VoiceReply {
  if (ctx.hasImportDraft) return reply("import", "Un produit est prêt à transformer. Ouvrez Import Factory pour finaliser la fiche (titre, description, meta, CSV).");
  if (ctx.lensSavedCount > 0) return reply("lens", "Ouvrez Orkestra Lens et choisissez « Envoyer vers Import Factory » sur le meilleur fournisseur.");
  return reply("lens", "Analysez d'abord un produit dans Orkestra Lens, puis envoyez-le vers Import Factory.");
}

// ── Merchant Shield ──────────────────────────────────────────────────────────
function noScan(): VoiceReply { return reply("dashboard", "Je n'ai pas encore d'analyse de votre boutique. Lancez un scan depuis le Dashboard, puis demandez-moi le statut Merchant."); }

export function voiceRunMerchantShield(ctx: VoiceContext): VoiceReply {
  const r = buildMerchantReport(ctx.analysis, ctx.brand, ctx.merchantResolved);
  if (!r.scanned) return noScan();
  const before = (r.submission?.before || []).slice(0, 2);
  const tail = before.length ? ` Avant Google : ${before.join(", ")}.` : " Vous pouvez soumettre.";
  return reply("merchant", `Merchant : ${r.gmcStatus.label} (${r.readiness}/100).${tail}`);
}
export function voiceMerchantRisks(ctx: VoiceContext): VoiceReply {
  const r = buildMerchantReport(ctx.analysis, ctx.brand, ctx.merchantResolved);
  if (!r.scanned) return noScan();
  const labels = Array.from(new Set([
    ...(r.critical || []).map((i) => i.label),
    ...(r.blockers || []).filter((b) => b.status !== "ok").map((b) => b.label),
  ])).slice(0, 3);
  if (!labels.length) return reply("merchant", "Aucun risque critique détecté pour Merchant. Continuez à surveiller après vos imports.");
  return reply("merchant", `Risques principaux pour Google : ${labels.join(", ")}. À corriger en priorité avant de soumettre.`);
}
export function voiceMerchantChecklist(ctx: VoiceContext): VoiceReply {
  const r = buildMerchantReport(ctx.analysis, ctx.brand, ctx.merchantResolved);
  if (!r.scanned) return noScan();
  const items = (r.submission?.before?.length ? r.submission.before : (r.beforeShopping || []).map((b) => b.label)).slice(0, 3);
  if (!items.length) return reply("merchant", "Checklist Merchant OK : vous pouvez soumettre à Google Shopping.");
  return reply("merchant", `Avant Google Shopping, corrigez : ${items.join(", ")}. Ensuite vous pourrez soumettre.`);
}
export function voiceMerchantMonitor(ctx: VoiceContext): VoiceReply {
  return reply("merchant", "Boutique validée : après chaque import, surveillez les textes anglais, les marques fournisseur et les claims, gardez vos pages légales à jour, et relancez Merchant Shield après un gros lot.");
}

// ── Assistant Shopify (chemins) ──────────────────────────────────────────────
const SHOPIFY_HELP: Record<string, { text: string; q: string }> = {
  "import-csv": { text: "Produits → Importer, puis déposez votre CSV. Orkestra prépare le CSV propre dans Import Factory.", q: "Comment importer un CSV de produits dans Shopify, étape par étape ?" },
  "edit-meta-title": { text: "Pour une fiche : Produits → (produit) → Référencement → Titre. Pour l'accueil : Boutique en ligne → Préférences.", q: "Où modifier le meta title d'un produit et de l'accueil dans Shopify ?" },
  "edit-meta-desc": { text: "Produits → (produit) → Référencement → Description. Pour l'accueil : Boutique en ligne → Préférences.", q: "Où modifier la meta description dans Shopify ?" },
  "edit-alt": { text: "Produits → (produit) → cliquez l'image → champ « Texte alternatif ».", q: "Où modifier le texte alternatif (alt) d'une image produit dans Shopify ?" },
  "edit-desc": { text: "Produits → (produit) → zone Description. Orkestra peut régénérer la fiche dans Import Factory.", q: "Où modifier la description d'un produit dans Shopify ?" },
  "change-vendor": { text: "Produits → (produit) → champ « Fournisseur » (vendor) dans la colonne de droite.", q: "Où changer le fournisseur (vendor) d'un produit dans Shopify ?" },
  "edit-collection": { text: "Produits → Collections → (collection) pour modifier titre, conditions et SEO.", q: "Où créer et modifier une collection dans Shopify ?" },
  "redirect": { text: "Boutique en ligne → Navigation → Redirections d'URL → Créer une redirection.", q: "Comment créer une redirection d'URL (301) dans Shopify ?" },
  "edit-shipping": { text: "Paramètres → Expédition et livraison. La page publique : Boutique en ligne → Pages.", q: "Où modifier la politique et les tarifs de livraison dans Shopify ?" },
  "edit-contact": { text: "Boutique en ligne → Pages → Contact (ou créez-la). Le menu via Navigation.", q: "Où modifier ou créer la page contact dans Shopify ?" },
  "menu": { text: "Boutique en ligne → Navigation → (menu principal) pour ajouter ou réordonner les liens.", q: "Où modifier le menu de navigation dans Shopify ?" },
  "liquid": { text: "Boutique en ligne → Thèmes → ⋯ → Modifier le code, puis Sections / Templates. Pour générer une section : AI Council → Code Shopify.", q: "Où coller une section Liquid et accéder au code du thème Shopify ?" },
  "fix-product": { text: "Produits → (produit) pour corriger. Orkestra peut régénérer la fiche dans Import Factory.", q: "Où corriger une fiche produit dans Shopify ?" },
  general: { text: "Dites ce que vous voulez faire (importer un CSV, modifier une meta, une page, le menu…) et je donne le chemin Shopify exact.", q: "Guide-moi dans Shopify." },
};
export function voiceExplainShopifyPath(action?: string): VoiceReply {
  const h = SHOPIFY_HELP[action || "general"] || SHOPIFY_HELP.general;
  return reply("assistant", `Dans Shopify : ${h.text}`, { href: assistantLink(h.q), label: "Demander à l'Assistant Shopify" });
}

// ── Dashboard ────────────────────────────────────────────────────────────────
const METRIC_FR: Record<string, string> = { seo: "SEO", trust: "confiance", conversion: "conversion", merchant: "Merchant", content: "contenu" };
const METRIC_FIX: Record<string, string> = {
  seo: "Optimisez titres, meta et tags via Import Factory.",
  trust: "Ajoutez pages légales, contact et réassurance (Merchant Shield).",
  conversion: "Renforcez fiches produit et preuves sociales.",
  merchant: "Corrigez les points bloquants Merchant avant Google Shopping.",
  content: "Enrichissez les descriptions produit (Import Factory).",
};
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
export function voiceDashboardPriority(ctx: VoiceContext): VoiceReply {
  const a = ctx.analysis;
  if (!a) return reply("dashboard", "Lancez d'abord un scan depuis le Dashboard pour que je détermine votre priorité.");
  const scores = a.scores || ({} as Record<string, number>);
  const entries = (["trust", "merchant", "seo", "content", "conversion"] as const).map((k) => [k, scores[k] ?? 100] as const);
  const weakest = entries.reduce((a2, b) => (b[1] < a2[1] ? b : a2), entries[0]);
  const mod: VoiceModule = weakest[0] === "merchant" || weakest[0] === "trust" ? "merchant" : weakest[0] === "seo" || weakest[0] === "content" ? "import" : "dashboard";
  return reply(mod, `Le plus urgent : votre score ${METRIC_FR[weakest[0]]} (${weakest[1]}/100). ${METRIC_FIX[weakest[0]]}`);
}
export function voiceDashboardMetric(ctx: VoiceContext, metric?: string): VoiceReply {
  const a = ctx.analysis;
  if (!a) return reply("dashboard", "Lancez un scan depuis le Dashboard pour obtenir vos scores.");
  const m = metric && METRIC_FR[metric] ? metric : "seo";
  const val = (a.scores as unknown as Record<string, number>)?.[m] ?? 0;
  const tone = val >= 70 ? "bon" : val >= 50 ? "moyen, à consolider" : "faible, à renforcer";
  const mod: VoiceModule = m === "merchant" || m === "trust" ? "merchant" : "import";
  return reply(mod, `Votre score ${METRIC_FR[m]} est de ${val}/100 — ${tone}. ${METRIC_FIX[m]}`);
}

// ── AI Council / connecteurs ─────────────────────────────────────────────────
export function voiceCouncilAsk(): VoiceReply {
  return reply("none", "Pour un avis d'expert, ouvrez AI Council : OpenAI et Claude répondent et Orkestra fait la synthèse.", { href: "/council", label: "Ouvrir AI Council" });
}
export function voiceConnectStatus(ctx: VoiceContext): VoiceReply {
  if (ctx.connectedCount > 0) return reply("none", `Vous avez ${ctx.connectedCount} IA connectée${ctx.connectedCount > 1 ? "s" : ""}. Gérez vos clés dans Connecter mes IA.`, { href: "/connect", label: "Gérer mes IA" });
  return reply("none", "Aucune IA connectée pour l'instant. Connectez OpenAI, Claude ou Gemini pour activer toute la puissance d'Orkestra.", { href: "/connect", label: "Connecter mes IA" });
}

function voiceFallback(): VoiceReply {
  return reply("none", "Je peux analyser votre import, chercher des fournisseurs, vérifier Merchant, résumer la boutique ou vous guider dans Shopify. Dites par exemple : « est-ce que mon import est prêt ? ».");
}

/** Dispatcher : intention → outil → réponse courte. */
export function runVoiceTool(intent: VoiceIntent, ctx: VoiceContext): VoiceReply {
  switch (intent.id) {
    case "import.analyze": return voiceAnalyzeLastImport(ctx);
    case "import.issues": return voiceSummarizeImportIssues(ctx);
    case "import.ready": return voiceImportReadiness(ctx);
    case "import.next": return voiceImportNextAction(ctx);
    case "lens.search": return voiceSearchSuppliers(ctx, intent.params.query, intent.params.platform, intent.params.constraint);
    case "lens.compare": return voiceCompareSuppliers(ctx);
    case "lens.open": return voiceOpenBestSupplier();
    case "lens.send": return voiceSendToImportFactory(ctx);
    case "merchant.status": return voiceRunMerchantShield(ctx);
    case "merchant.risks": return voiceMerchantRisks(ctx);
    case "merchant.checklist": return voiceMerchantChecklist(ctx);
    case "merchant.monitor": return voiceMerchantMonitor(ctx);
    case "shopify.path": return voiceExplainShopifyPath(intent.params.action);
    case "dashboard.status": return voiceReadDashboardStatus(ctx);
    case "dashboard.priority": return voiceDashboardPriority(ctx);
    case "dashboard.metric": return voiceDashboardMetric(ctx, intent.params.metric);
    case "council.ask": return voiceCouncilAsk();
    case "connect.status": return voiceConnectStatus(ctx);
    default: return voiceFallback();
  }
}

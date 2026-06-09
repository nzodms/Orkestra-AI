// ──────────────────────────────────────────────────────────────────────────
// Orkestra Voice — outils internes (PURS). Voice = couche d'EXÉCUTION : chaque
// outil lit les données RÉELLES (scan boutique, Import Factory, Merchant Shield,
// scores) et renvoie un VoiceResult riche (résumé court + cards affichées DANS le
// panel + actions). Jamais d'invention : donnée absente → « non disponible » /
// « lancez un scan ». Les modules restent accessibles pour approfondir.
// ──────────────────────────────────────────────────────────────────────────

import { buildMerchantReport } from "../merchant";
import { buildSearchLinks } from "../lens-links";
import { assistantLink } from "../shopify";
import type { VoiceContext, VoiceIntent, VoiceModule, VoiceResult, VoiceCard, VoiceAction } from "./voice-types";

const MODULE_META: Record<VoiceModule, { href: string; label: string }> = {
  import: { href: "/seo", label: "Ouvrir Import Factory" },
  lens: { href: "/lens", label: "Ouvrir Orkestra Lens" },
  merchant: { href: "/merchant", label: "Ouvrir Merchant Shield" },
  assistant: { href: "/assistant", label: "Ouvrir l'Assistant Shopify" },
  dashboard: { href: "/dashboard", label: "Ouvrir le Dashboard" },
  none: { href: "/dashboard", label: "Ouvrir Orkestra" },
};
function mk(module: VoiceModule, spokenSummary: string, opts: { title?: string; cards?: VoiceCard[]; actions?: VoiceAction[]; moduleLink?: { href: string; label: string }; confidence?: number; pending?: boolean } = {}): VoiceResult {
  return {
    intent: "", module, title: opts.title || "", spokenSummary,
    cards: opts.cards || [], actions: opts.actions || [],
    moduleLink: opts.moduleLink ?? MODULE_META[module],
    confidence: opts.confidence ?? 0.82, pending: opts.pending,
  };
}
function sevTone(s: string): VoiceCard["tone"] {
  const v = (s || "").toLowerCase();
  if (/critiqu|critical|bloqu|blocker/.test(v)) return "bad";
  if (/import|majeur|major|warn|moyen/.test(v)) return "warn";
  return "neutral";
}
function scoreTone(v: number): VoiceCard["tone"] { return v >= 70 ? "good" : v >= 50 ? "warn" : "bad"; }
const VERDICT_FR: Record<string, string> = { ready: "prêt à publier", verify: "presque prêt", risky: "à corriger", partial: "partiel" };

const NO_SCAN = "Je n'ai pas encore assez de données. Lancez un scan boutique depuis le Dashboard pour que je puisse répondre précisément.";
function noScan(): VoiceResult { return mk("dashboard", NO_SCAN, { title: "Données insuffisantes" }); }
function noImport(): VoiceResult { return mk("import", "Vous n'avez pas encore d'import récent. Importez un CSV dans Import Factory pour commencer.", { title: "Aucun import" }); }

// ── Import Factory ───────────────────────────────────────────────────────────
export function voiceAnalyzeLastImport(ctx: VoiceContext): VoiceResult {
  const ri = ctx.recentImports[0];
  if (!ri) return noImport();
  const verdict = (ri.verdict && VERDICT_FR[ri.verdict]) || "traité";
  const ready = Math.max(0, ri.products - ri.risks - ri.failed);
  const cards: VoiceCard[] = [
    { kind: "metric", title: `${ready}/${ri.products} prêts`, subtitle: `Dernier import (${ri.fileName})`, meta: verdict, tone: ri.risks || ri.failed ? "warn" : "good" },
  ];
  if (ri.warnings) cards.push({ kind: "import-issue", title: `${ri.warnings} à vérifier`, tone: "warn" });
  if (ri.risks || ri.failed) cards.push({ kind: "import-issue", title: `${ri.risks + ri.failed} à corriger`, tone: "bad" });
  for (const r of (ri.riskReasons || []).slice(0, 3)) cards.push({ kind: "import-issue", title: r, detail: "À revoir dans Import Factory", tone: "warn" });
  const spoken = `Votre dernier import (${ri.products} produits) est ${verdict}. ${ready} prêts${ri.risks || ri.failed ? `, ${ri.risks + ri.failed} à corriger` : ""}.`;
  return mk("import", spoken, { title: "Dernier import", cards });
}
export function voiceSummarizeImportIssues(ctx: VoiceContext): VoiceResult {
  const ri = ctx.recentImports[0];
  if (!ri) return noImport();
  const reasons = (ri.riskReasons || []).filter(Boolean).slice(0, 4);
  if (!reasons.length) return mk("import", "Aucun point bloquant détecté sur votre dernier import. Vous pouvez publier.", { title: "Import propre" });
  return mk("import", `${reasons.length} point${reasons.length > 1 ? "s" : ""} à revoir, dont : ${reasons[0]}.`, {
    title: "Problèmes de l'import",
    cards: reasons.map((r) => ({ kind: "import-issue", title: r, tone: "warn" } as VoiceCard)),
  });
}
export function voiceImportReadiness(ctx: VoiceContext): VoiceResult {
  const ri = ctx.recentImports[0];
  if (!ri) return noImport();
  const ready = Math.max(0, ri.products - ri.risks - ri.failed);
  const verdict = (ri.verdict && VERDICT_FR[ri.verdict]) || "en cours";
  return mk("import", `${ready} produit${ready > 1 ? "s" : ""} prêt${ready > 1 ? "s" : ""} sur ${ri.products}. CSV ${verdict}.`, {
    title: "Prêt à publier ?",
    cards: [{ kind: "metric", title: `${ready}/${ri.products} prêts`, meta: verdict, tone: ri.risks + ri.failed ? "warn" : "good" }],
  });
}
export function voiceImportNextAction(ctx: VoiceContext): VoiceResult {
  const ri = ctx.recentImports[0];
  if (!ri) return noImport();
  if (ri.risks || ri.failed) return mk("import", `Prochaine action : corrigez les ${ri.risks + ri.failed} produit(s) à risque (filtre « À corriger »), puis exportez.`, { title: "Prochaine action" });
  if (ri.warnings) return mk("import", `Prochaine action : vérifiez les ${ri.warnings} point(s) signalé(s), puis exportez le CSV Shopify.`, { title: "Prochaine action" });
  return mk("import", "Prochaine action : exportez le CSV Shopify, il est prêt.", { title: "Prochaine action" });
}

// ── Orkestra Lens (synchrone : recherches prêtes ; l'enrichissement web est async) ──
export function voiceSearchSuppliers(ctx: VoiceContext, query?: string, platform?: string, constraint?: string): VoiceResult {
  const q = (query || ctx.lastProductName || "").trim();
  if (!q) return mk("lens", "Dites-moi quel produit chercher (ex. « fournisseurs pour un Pilates Reformer »).", { title: "Recherche fournisseur" });
  let links = buildSearchLinks(q);
  if (platform) links = [...links.filter((l) => l.source === platform), ...links.filter((l) => l.source !== platform)];
  const note = constraint === "moq" ? " Pour un MOQ faible, AliExpress est souvent le plus adapté." : constraint === "europe" ? " Pour l'Europe, filtrez la livraison sur la source." : "";
  const cards: VoiceCard[] = links.map((l) => ({ kind: "search-link", title: l.source, subtitle: l.advantage, detail: l.limit, href: l.url, tone: "brand", badge: "Recherche prête" }));
  return mk("lens", `J'ai préparé une recherche fournisseur pour « ${q} ». Alibaba, AliExpress et 1688 sont prêts.${note}`, {
    title: `Fournisseurs · ${q}`, cards,
    actions: [{ label: "Comparer", kind: "command", command: "compare les fournisseurs" }],
  });
}
export function voiceCompareSuppliers(ctx: VoiceContext): VoiceResult {
  if (ctx.lensSavedCount > 0) return mk("lens", `Vous avez ${ctx.lensSavedCount} fournisseur(s) sauvegardé(s). Ouvrez Orkestra Lens et sélectionnez-en 2 à 4 pour comparer.`, { title: "Comparer les fournisseurs" });
  return mk("lens", "Analysez un produit dans Orkestra Lens, puis je pourrai comparer les fournisseurs (prix, MOQ, score).", { title: "Comparer les fournisseurs" });
}
export function voiceOpenBestSupplier(): VoiceResult {
  return mk("lens", "Ouvrez Orkestra Lens : le meilleur résultat (score Orkestra) est en tête, prêt à envoyer vers Import Factory.", { title: "Meilleur fournisseur" });
}
export function voiceSendToImportFactory(ctx: VoiceContext): VoiceResult {
  if (ctx.hasImportDraft) return mk("import", "Un produit est prêt à transformer. Ouvrez Import Factory pour finaliser la fiche.", { title: "Envoyer vers Import Factory" });
  return mk("lens", "Choisissez « Envoyer vers Import Factory » sur le meilleur fournisseur dans Orkestra Lens.", { title: "Envoyer vers Import Factory" });
}

// ── Merchant Shield ──────────────────────────────────────────────────────────
export function voiceRunMerchantShield(ctx: VoiceContext): VoiceResult {
  const r = buildMerchantReport(ctx.analysis, ctx.brand, ctx.merchantResolved);
  if (!r.scanned) return noScan();
  const cards: VoiceCard[] = [{ kind: "metric", title: r.gmcStatus.label, meta: `${r.readiness}/100`, tone: r.gmcStatus.level === "ready" ? "good" : r.gmcStatus.level === "fix" ? "warn" : "bad" }];
  const risks = Array.from(new Set([...(r.critical || []).map((i) => i.label), ...(r.blockers || []).filter((b) => b.status !== "ok").map((b) => b.label)])).slice(0, 3);
  for (const l of risks) cards.push({ kind: "merchant-risk", title: l, tone: "bad" });
  for (const b of (r.submission?.before || []).slice(0, 3)) cards.push({ kind: "shopify-step", title: b, detail: "Avant Google Shopping", tone: "warn" });
  const tail = risks.length ? ` Risques : ${risks.slice(0, 2).join(", ")}.` : (r.submission?.before?.length ? "" : " Vous pouvez soumettre.");
  return mk("merchant", `Merchant : ${r.gmcStatus.label} (${r.readiness}/100).${tail}`, { title: "Statut Merchant", cards });
}
export function voiceMerchantRisks(ctx: VoiceContext): VoiceResult {
  const r = buildMerchantReport(ctx.analysis, ctx.brand, ctx.merchantResolved);
  if (!r.scanned) return noScan();
  const labels = Array.from(new Set([...(r.critical || []).map((i) => i.label), ...(r.blockers || []).filter((b) => b.status !== "ok").map((b) => b.label)])).slice(0, 4);
  if (!labels.length) return mk("merchant", "Aucun risque critique détecté pour Merchant.", { title: "Risques Merchant" });
  return mk("merchant", `Risques principaux : ${labels.slice(0, 2).join(", ")}. À corriger avant de soumettre.`, {
    title: "Risques Merchant", cards: labels.map((l) => ({ kind: "merchant-risk", title: l, tone: "bad" } as VoiceCard)),
  });
}
export function voiceMerchantChecklist(ctx: VoiceContext): VoiceResult {
  const r = buildMerchantReport(ctx.analysis, ctx.brand, ctx.merchantResolved);
  if (!r.scanned) return noScan();
  const items = (r.submission?.before?.length ? r.submission.before : (r.beforeShopping || []).map((b) => b.label)).slice(0, 4);
  if (!items.length) return mk("merchant", "Checklist Merchant OK : vous pouvez soumettre à Google Shopping.", { title: "Checklist Merchant" });
  return mk("merchant", `Avant Google Shopping : ${items.slice(0, 2).join(", ")}.`, {
    title: "Avant Google Shopping", cards: items.map((l) => ({ kind: "shopify-step", title: l, tone: "warn" } as VoiceCard)),
  });
}
export function voiceMerchantMonitor(): VoiceResult {
  return mk("merchant", "Boutique validée : surveillez après chaque import (textes anglais, marques fournisseur, claims), gardez vos pages légales à jour, relancez Merchant Shield après un gros lot.", { title: "Surveillance Merchant" });
}

// ── Analyse boutique : SEO ───────────────────────────────────────────────────
export function voiceSeoReview(ctx: VoiceContext): VoiceResult {
  const a = ctx.analysis;
  if (!a) return noScan();
  const seo = a.scores?.seo ?? 0;
  const cards: VoiceCard[] = [{ kind: "metric", title: `SEO ${seo}/100`, subtitle: seo >= 70 ? "Correct" : seo >= 50 ? "Perfectible" : "À renforcer", tone: scoreTone(seo) }];
  const issues = (a.issues || []).filter((i) => /seo|meta|titre|description|contenu|alt/i.test(i.area + i.explanation)).slice(0, 3);
  for (const i of issues) cards.push({ kind: "seo-issue", title: i.explanation || i.area, subtitle: i.impact, detail: i.fix, tone: sevTone(i.severity) });
  if (!issues.length) {
    if (a.metrics?.missingMetaDescriptions) cards.push({ kind: "seo-issue", title: `${a.metrics.missingMetaDescriptions} meta descriptions manquantes`, detail: "À compléter via Import Factory.", tone: "warn" });
    if (a.metrics?.productsToOptimize) cards.push({ kind: "seo-issue", title: `${a.metrics.productsToOptimize} produits à optimiser`, detail: "Titres, tags et descriptions.", tone: "warn" });
    if (a.metrics?.imagesWithoutAlt) cards.push({ kind: "seo-issue", title: `${a.metrics.imagesWithoutAlt} images sans texte alternatif`, detail: "Ajoutez le alt (Import Factory / thème).", tone: "warn" });
  }
  for (const p of (a.priorityProducts || []).slice(0, 2)) cards.push({ kind: "info", title: p.title, subtitle: p.reason, meta: `score ${p.contentScore}`, href: p.url, tone: "neutral" });
  const top = cards.filter((c) => c.kind === "seo-issue").slice(0, 2).map((c) => c.title);
  const spoken = `Votre SEO est à ${seo}/100${seo >= 70 ? ", correct mais perfectible" : seo >= 50 ? ", à consolider" : ", à renforcer"}.${top.length ? ` Priorités : ${top.join(", ")}.` : ""}`;
  return mk("import", spoken, { title: "Avis SEO", cards, moduleLink: MODULE_META.import });
}

// ── Analyse boutique : mots anglais ──────────────────────────────────────────
const EN_LOCATION = (src: string): string => {
  const s = (src || "").toLowerCase();
  if (/theme|bouton|button|cart|panier/.test(s)) return "thème / traduction";
  if (/menu|nav/.test(s)) return "menu";
  if (/footer|pied/.test(s)) return "pied de page";
  if (/checkout|paiement/.test(s)) return "checkout";
  if (/page/.test(s)) return "page";
  if (/produit|product|fiche|variante/.test(s)) return "fiche produit";
  return src || "boutique";
};
export function voiceStoreEnglish(ctx: VoiceContext): VoiceResult {
  const a = ctx.analysis;
  if (!a) return noScan();
  const hits = a.englishTexts || [];
  if (!hits.length) {
    if (a.metrics?.englishTextsDetected) return mk("import", `J'ai détecté ${a.metrics.englishTextsDetected} texte(s) anglais mais pas le détail. Relancez un scan complet pour la liste.`, { title: "Mots anglais" });
    return mk("dashboard", "Aucun texte anglais détecté dans le scan actuel — ou pas encore de scan. Lancez un scan pour vérifier.", { title: "Mots anglais" });
  }
  const cards: VoiceCard[] = hits.slice(0, 6).map((h) => ({
    kind: "english-term", title: `« ${h.text} »`, subtitle: h.suggestion ? `→ ${h.suggestion}` : undefined,
    meta: EN_LOCATION(h.source), detail: h.impact || "À traduire en français.", tone: "warn",
  }));
  const top = hits[0];
  return mk("assistant", `J'ai trouvé ${hits.length} terme(s) anglais visibles. Le plus important : « ${top.text} » (${EN_LOCATION(top.source)}).`, {
    title: "Mots anglais détectés", cards,
    actions: [{ label: "Où corriger dans Shopify", kind: "command", command: "où modifier le contenu du thème" }],
    moduleLink: { href: assistantLink("Comment retirer les textes anglais (Add to cart, Free shipping…) dans Shopify : thème, traductions, produits ?"), label: "Demander à l'Assistant" },
  });
}

// ── Assistant Shopify (chemins) ──────────────────────────────────────────────
const SHOPIFY_HELP: Record<string, { text: string; q: string }> = {
  "import-csv": { text: "Produits → Importer, puis déposez votre CSV.", q: "Comment importer un CSV de produits dans Shopify ?" },
  "edit-meta-title": { text: "Produits → (produit) → Référencement → Titre. Accueil : Boutique en ligne → Préférences.", q: "Où modifier le meta title dans Shopify ?" },
  "edit-meta-desc": { text: "Produits → (produit) → Référencement → Description. Accueil : Boutique en ligne → Préférences.", q: "Où modifier la meta description dans Shopify ?" },
  "edit-alt": { text: "Produits → (produit) → cliquez l'image → « Texte alternatif ».", q: "Où modifier le alt d'une image produit dans Shopify ?" },
  "edit-desc": { text: "Produits → (produit) → zone Description.", q: "Où modifier la description d'un produit dans Shopify ?" },
  "change-vendor": { text: "Produits → (produit) → champ « Fournisseur » (vendor).", q: "Où changer le vendor d'un produit dans Shopify ?" },
  "edit-collection": { text: "Produits → Collections → (collection).", q: "Où modifier une collection dans Shopify ?" },
  redirect: { text: "Boutique en ligne → Navigation → Redirections d'URL → Créer.", q: "Comment créer une redirection 301 dans Shopify ?" },
  "edit-shipping": { text: "Paramètres → Expédition et livraison. Page publique : Boutique en ligne → Pages.", q: "Où modifier la livraison dans Shopify ?" },
  "edit-contact": { text: "Boutique en ligne → Pages → Contact.", q: "Où modifier la page contact dans Shopify ?" },
  menu: { text: "Boutique en ligne → Navigation → (menu principal).", q: "Où modifier le menu dans Shopify ?" },
  liquid: { text: "Boutique en ligne → Thèmes → ⋯ → Modifier le code → Sections / Templates.", q: "Où coller une section Liquid dans Shopify ?" },
  "fix-product": { text: "Produits → (produit) pour corriger.", q: "Où corriger une fiche produit dans Shopify ?" },
  general: { text: "Dites ce que vous voulez faire et je donne le chemin Shopify exact.", q: "Guide-moi dans Shopify." },
};
export function voiceExplainShopifyPath(action?: string): VoiceResult {
  const h = SHOPIFY_HELP[action || "general"] || SHOPIFY_HELP.general;
  return mk("assistant", `Dans Shopify : ${h.text}`, {
    title: "Chemin Shopify",
    cards: [{ kind: "shopify-step", title: h.text, tone: "brand", href: assistantLink(h.q) }],
    moduleLink: { href: assistantLink(h.q), label: "Demander à l'Assistant Shopify" },
  });
}

// ── Dashboard ────────────────────────────────────────────────────────────────
const METRIC_FR: Record<string, string> = { seo: "SEO", trust: "confiance", conversion: "conversion", merchant: "Merchant", content: "contenu" };
const METRIC_FIX: Record<string, string> = {
  seo: "Optimisez titres, meta et tags via Import Factory.",
  trust: "Ajoutez pages légales, contact et réassurance (Merchant Shield).",
  conversion: "Renforcez fiches produit et preuves sociales.",
  merchant: "Corrigez les points bloquants avant Google Shopping.",
  content: "Enrichissez les descriptions produit (Import Factory).",
};
export function voiceReadDashboardStatus(ctx: VoiceContext): VoiceResult {
  const a = ctx.analysis;
  if (!a) return noScan();
  const cards: VoiceCard[] = [
    { kind: "metric", title: `SEO ${a.scores?.seo ?? 0}/100`, tone: scoreTone(a.scores?.seo ?? 0) },
    { kind: "metric", title: `Confiance ${a.scores?.trust ?? 0}/100`, tone: scoreTone(a.scores?.trust ?? 0) },
    { kind: "metric", title: `Merchant ${a.scores?.merchant ?? 0}/100`, tone: scoreTone(a.scores?.merchant ?? 0) },
  ];
  const todo: string[] = [];
  if (a.metrics?.productsToOptimize) todo.push(`${a.metrics.productsToOptimize} produits à optimiser`);
  if (a.metrics?.englishTextsDetected) todo.push(`${a.metrics.englishTextsDetected} textes anglais`);
  for (const t of todo.slice(0, 2)) cards.push({ kind: "info", title: t, tone: "warn" });
  return mk("dashboard", `Boutique : SEO ${a.scores?.seo ?? 0}/100, confiance ${a.scores?.trust ?? 0}/100.${todo.length ? ` À faire : ${todo[0]}.` : ""}`, { title: "Résumé boutique", cards });
}
export function voiceDashboardPriority(ctx: VoiceContext): VoiceResult {
  const a = ctx.analysis;
  if (!a) return noScan();
  const scores = a.scores;
  const entries = (["trust", "merchant", "seo", "content", "conversion"] as const).map((k) => [k, (scores?.[k] ?? 100)] as const);
  const weakest = entries.reduce((acc, b) => (b[1] < acc[1] ? b : acc), entries[0]);
  const mod: VoiceModule = weakest[0] === "merchant" || weakest[0] === "trust" ? "merchant" : weakest[0] === "seo" || weakest[0] === "content" ? "import" : "dashboard";
  return mk(mod, `Le plus urgent : votre score ${METRIC_FR[weakest[0]]} (${weakest[1]}/100). ${METRIC_FIX[weakest[0]]}`, {
    title: "Priorité du jour",
    cards: [{ kind: "metric", title: `${METRIC_FR[weakest[0]]} ${weakest[1]}/100`, subtitle: "Le plus faible", detail: METRIC_FIX[weakest[0]], tone: scoreTone(weakest[1]) }],
  });
}
export function voiceDashboardMetric(ctx: VoiceContext, metric?: string): VoiceResult {
  const a = ctx.analysis;
  if (!a) return noScan();
  const m = metric && METRIC_FR[metric] ? metric : "trust";
  const val = (a.scores as unknown as Record<string, number>)?.[m] ?? 0;
  const tone = val >= 70 ? "bon" : val >= 50 ? "moyen, à consolider" : "faible, à renforcer";
  const mod: VoiceModule = m === "merchant" || m === "trust" ? "merchant" : "import";
  const cards: VoiceCard[] = [{ kind: "metric", title: `${METRIC_FR[m]} ${val}/100`, subtitle: tone, detail: METRIC_FIX[m], tone: scoreTone(val) }];
  if (m === "trust") for (const lp of (a.legalPages || []).filter((p) => p.essential && !p.found).slice(0, 3)) cards.push({ kind: "merchant-risk", title: `${lp.label} manquante`, tone: "warn" });
  return mk(mod, `Votre score ${METRIC_FR[m]} est de ${val}/100 — ${tone}. ${METRIC_FIX[m]}`, { title: `Score ${METRIC_FR[m]}`, cards });
}

// ── AI Council / connecteurs ─────────────────────────────────────────────────
export function voiceCouncilAsk(): VoiceResult {
  return mk("none", "Pour un avis d'expert, ouvrez AI Council : OpenAI et Claude répondent, Orkestra fait la synthèse.", { title: "AI Council", moduleLink: { href: "/council", label: "Ouvrir AI Council" } });
}
export function voiceConnectStatus(ctx: VoiceContext): VoiceResult {
  if (ctx.connectedCount > 0) return mk("none", `Vous avez ${ctx.connectedCount} IA connectée(s). Gérez vos clés dans Connecter mes IA.`, { title: "IA connectées", moduleLink: { href: "/connect", label: "Gérer mes IA" } });
  return mk("none", "Aucune IA connectée. Connectez OpenAI, Claude ou Gemini pour activer toute la puissance d'Orkestra.", { title: "IA connectées", moduleLink: { href: "/connect", label: "Connecter mes IA" } });
}
function voiceFallback(): VoiceResult {
  return mk("none", "Je peux analyser votre import, chercher des fournisseurs, vérifier Merchant, donner un avis SEO, lister les mots anglais ou vous guider dans Shopify. Dites par exemple : « tu penses quoi de mon SEO ? ».", { title: "Orkestra Voice" });
}

/** Dispatcher synchrone : intention → outil → VoiceResult. (lens.search enrichi en async par le command center.) */
export function runVoiceTool(intent: VoiceIntent, ctx: VoiceContext): VoiceResult {
  let r: VoiceResult;
  switch (intent.id) {
    case "import.analyze": r = voiceAnalyzeLastImport(ctx); break;
    case "import.issues": r = voiceSummarizeImportIssues(ctx); break;
    case "import.ready": r = voiceImportReadiness(ctx); break;
    case "import.next": r = voiceImportNextAction(ctx); break;
    case "lens.search": r = voiceSearchSuppliers(ctx, intent.params.query, intent.params.platform, intent.params.constraint); break;
    case "lens.compare": r = voiceCompareSuppliers(ctx); break;
    case "lens.open": r = voiceOpenBestSupplier(); break;
    case "lens.send": r = voiceSendToImportFactory(ctx); break;
    case "merchant.status": r = voiceRunMerchantShield(ctx); break;
    case "merchant.risks": r = voiceMerchantRisks(ctx); break;
    case "merchant.checklist": r = voiceMerchantChecklist(ctx); break;
    case "merchant.monitor": r = voiceMerchantMonitor(); break;
    case "shopify.path": r = voiceExplainShopifyPath(intent.params.action); break;
    case "seo.review": r = voiceSeoReview(ctx); break;
    case "store.english": r = voiceStoreEnglish(ctx); break;
    case "dashboard.status": r = voiceReadDashboardStatus(ctx); break;
    case "dashboard.priority": r = voiceDashboardPriority(ctx); break;
    case "dashboard.metric": r = voiceDashboardMetric(ctx, intent.params.metric); break;
    case "council.ask": r = voiceCouncilAsk(); break;
    case "connect.status": r = voiceConnectStatus(ctx); break;
    default: r = voiceFallback();
  }
  r.intent = intent.id;
  return r;
}

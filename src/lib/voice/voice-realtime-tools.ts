// ──────────────────────────────────────────────────────────────────────────
// Orkestra Voice — pont TOOLS pour OpenAI Realtime.
// Définit les fonctions exposées au modèle vocal + exécute les outils Orkestra
// DÉJÀ existants (mêmes cards, même contexte). Aucune logique dupliquée.
// ──────────────────────────────────────────────────────────────────────────

import {
  voiceSeoReview, voiceStoreEnglish, voiceAnalyzeLastImport, voiceRunMerchantShield,
  voiceExplainShopifyPath, voiceReadDashboardStatus, voiceSearchSuppliers,
} from "./voice-tools";
import { runLensSearchInsideVoice, type VoiceKeyRefs } from "./voice-lens";
import { nextSession, type VoiceSession } from "./voice-session";
import type { VoiceContext, VoiceResult, VoiceCard } from "./voice-types";

/** Cadrage de l'assistant vocal Orkestra (§9). */
export const REALTIME_INSTRUCTIONS =
  "Vous êtes Orkestra Voice, un copilote e-commerce vocal. Vous aidez l'utilisateur à analyser sa boutique Shopify, " +
  "trouver des fournisseurs, corriger son SEO, préparer Google Merchant, comprendre Shopify et gérer ses imports. " +
  "Répondez COURT à l'oral, en français, de façon naturelle et orientée action — jamais de longs paragraphes. " +
  "Utilisez les outils (functions) dès qu'il faut des données réelles de la boutique. N'inventez JAMAIS de prix, MOQ, " +
  "fournisseurs, scores ou problèmes. Si les données manquent, dites qu'il faut lancer un scan boutique ou connecter les IA. " +
  "Gardez le contexte : « garde seulement Alibaba », « compare les deux premiers », « comment je corrige ça » se réfèrent au dernier résultat.";

/** Définitions de fonctions au format OpenAI Realtime. */
export const REALTIME_TOOLS = [
  { type: "function", name: "voice_search_suppliers", description: "Cherche des fournisseurs pour un produit (Alibaba/AliExpress/1688/Google).", parameters: { type: "object", properties: { query: { type: "string", description: "produit à sourcer en anglais court" }, platform: { type: "string", enum: ["Alibaba", "AliExpress", "1688", "Google"] } }, required: ["query"] } },
  { type: "function", name: "voice_filter_suppliers", description: "Filtre les derniers résultats fournisseurs sur une plateforme.", parameters: { type: "object", properties: { platform: { type: "string", enum: ["Alibaba", "AliExpress", "1688", "Google"] } }, required: ["platform"] } },
  { type: "function", name: "voice_compare_suppliers", description: "Compare les N premiers résultats fournisseurs.", parameters: { type: "object", properties: { count: { type: "number" } } } },
  { type: "function", name: "voice_send_to_import_factory", description: "Prépare l'envoi du meilleur fournisseur vers Import Factory.", parameters: { type: "object", properties: {} } },
  { type: "function", name: "voice_analyze_store_seo", description: "Donne un avis SEO de la boutique (score + priorités).", parameters: { type: "object", properties: {} } },
  { type: "function", name: "voice_detect_english_texts", description: "Liste les textes anglais détectés et leur emplacement.", parameters: { type: "object", properties: {} } },
  { type: "function", name: "voice_explain_english_text_fix", description: "Explique où corriger un texte anglais dans Shopify.", parameters: { type: "object", properties: { term: { type: "string" } } } },
  { type: "function", name: "voice_analyze_last_import", description: "Résume le dernier import (prêts / à corriger).", parameters: { type: "object", properties: {} } },
  { type: "function", name: "voice_run_merchant_summary", description: "Statut Merchant / Google Shopping + risques.", parameters: { type: "object", properties: {} } },
  { type: "function", name: "voice_explain_shopify_path", description: "Donne le chemin Shopify exact pour une action.", parameters: { type: "object", properties: { topic: { type: "string", description: "ex: import-csv, edit-meta-desc, edit-alt, redirect, menu, liquid" } } } },
  { type: "function", name: "voice_read_dashboard_status", description: "Résume la boutique (scores + à faire).", parameters: { type: "object", properties: {} } },
];

function res(module: VoiceResult["module"], spokenSummary: string, cards: VoiceCard[] = [], extra: Partial<VoiceResult> = {}): VoiceResult {
  const href: Record<string, { href: string; label: string }> = {
    import: { href: "/seo", label: "Ouvrir Import Factory" }, lens: { href: "/lens", label: "Ouvrir Orkestra Lens" },
    merchant: { href: "/merchant", label: "Ouvrir Merchant Shield" }, assistant: { href: "/assistant", label: "Ouvrir l'Assistant" },
    dashboard: { href: "/dashboard", label: "Ouvrir le Dashboard" }, none: { href: "/dashboard", label: "Ouvrir Orkestra" },
  };
  return { intent: extra.intent || "realtime", module, title: extra.title || "", spokenSummary, cards, actions: extra.actions || [], moduleLink: extra.moduleLink ?? href[module], confidence: 0.85 };
}

export interface RealtimeToolOutput { result: VoiceResult; session: VoiceSession; text: string }

/** Exécute un tool Realtime → cards (UI) + texte court (pour la voix) + contexte mis à jour. */
export async function executeRealtimeTool(name: string, args: Record<string, unknown>, ctx: VoiceContext, session: VoiceSession, keyRefs: VoiceKeyRefs): Promise<RealtimeToolOutput> {
  let r: VoiceResult;
  let intentId = name;
  switch (name) {
    case "voice_search_suppliers": {
      const q = String(args.query || session.lastQuery || ctx.lastProductName || "").trim();
      const platform = typeof args.platform === "string" ? args.platform : undefined;
      r = q ? await runLensSearchInsideVoice(q, platform, keyRefs) : voiceSearchSuppliers(ctx);
      intentId = "lens.search"; break;
    }
    case "voice_filter_suppliers": {
      const p = String(args.platform || "").toLowerCase();
      const kept = (session.lastCards || []).filter((c) => `${c.title} ${c.badge || ""} ${c.meta || ""}`.toLowerCase().includes(p));
      const label = p ? p[0].toUpperCase() + p.slice(1) : "";
      r = res("lens", `Je garde uniquement ${label}.`, kept.length ? kept : session.lastCards || [], { intent: "lens.filter", title: `Fournisseurs · ${label}` });
      intentId = "lens.filter"; break;
    }
    case "voice_compare_suppliers": {
      const n = Math.max(2, Math.min(4, Number(args.count) || 2));
      const top = (session.lastCards || []).slice(0, n);
      r = res("lens", top.length >= 2 ? `Voici la comparaison des ${top.length} premiers résultats.` : "Pas assez de résultats à comparer — élargissez la recherche.", top, { intent: "lens.compare", title: "Comparaison" });
      intentId = "lens.compare"; break;
    }
    case "voice_send_to_import_factory":
      r = res("import", "Choisissez le fournisseur dans Orkestra Lens puis « Envoyer vers Import Factory ».", [], { intent: "lens.send", title: "Envoyer vers Import Factory", actions: [{ label: "Choisir dans Lens", kind: "navigate", href: "/lens", primary: true }] });
      intentId = "lens.send"; break;
    case "voice_analyze_store_seo": r = voiceSeoReview(ctx); intentId = "seo.review"; break;
    case "voice_detect_english_texts": r = voiceStoreEnglish(ctx); intentId = "store.english"; break;
    case "voice_explain_english_text_fix": {
      r = voiceExplainShopifyPath("liquid");
      const term = String(args.term || session.lastEnglishTerm || "").trim();
      if (term) r.spokenSummary = `Pour « ${term} » : ${r.spokenSummary}`;
      intentId = "shopify.path"; break;
    }
    case "voice_analyze_last_import": r = voiceAnalyzeLastImport(ctx); intentId = "import.analyze"; break;
    case "voice_run_merchant_summary": r = voiceRunMerchantShield(ctx); intentId = "merchant.status"; break;
    case "voice_explain_shopify_path": r = voiceExplainShopifyPath(typeof args.topic === "string" ? args.topic : undefined); intentId = "shopify.path"; break;
    case "voice_read_dashboard_status": r = voiceReadDashboardStatus(ctx); intentId = "dashboard.status"; break;
    default: r = res("none", "Demande non reconnue.", []); break;
  }
  r.intent = intentId;
  return { result: r, session: nextSession(session, intentId, r), text: r.spokenSummary };
}

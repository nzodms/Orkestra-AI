import type { StoreAnalysis, BrandMemory, MerchantSeverity, ModuleId } from "./types";
import { SHOPIFY_PATHS } from "./shopify";

// ──────────────────────────────────────────────────────────────────────────
// Rapport Merchant Shield ACTIONNABLE à partir des données réelles du scan
// public (pages légales, textes anglais, catalogue, scores, promesses).
// Logique d'aide à la préparation Google Merchant Center / Shopping / PMax.
// Pas de garantie d'approbation — Google décide. On n'invente rien : si une
// donnée n'est pas accessible publiquement, l'item est « à vérifier ».
// ──────────────────────────────────────────────────────────────────────────

export type MCStatus = "ok" | "fix" | "check";

export interface MCItem {
  key: string;
  label: string;
  status: MCStatus;
  severity: MerchantSeverity;
  impact: string;
  fix: string;
  where: string;
  module: ModuleId;
  count?: number;
  examples?: string[];
  /** Question contextuelle pour le bouton « Résoudre ». */
  resolveQ?: string;
}

export interface BeforeShoppingItem {
  key: string;
  label: string;
  status: MCStatus;
  impact: string;
  action: string;
}

export interface MerchantReport {
  scanned: boolean;
  score: number;
  trust: number;
  trustFound: number;
  trustTotal: number;
  englishCount: number;
  weakDataCount: number;
  checklist: MCItem[];
  critical: MCItem[];
  important: MCItem[];
  optimizations: MCItem[];
  resolvedItems: MCItem[];
  totalActions: number;
  actionsRemaining: number;
  readiness: number;
  gmcStatus: { level: "ready" | "fix" | "risk"; label: string };
  promotions: MCItem;
  beforeShopping: BeforeShoppingItem[];
  interpretation: string[];
}

const ESSENTIAL = ["contact", "mentions", "return", "shipping", "cgv", "privacy"];

const LEGAL_META: Record<string, { label: string; impact: string; fix: string; module: ModuleId; where: string }> = {
  contact: { label: "Page contact", impact: "Page contact absente = signal de confiance manquant, cause fréquente de refus Merchant.", fix: "Créer une page Contact (email + formulaire + délai de réponse annoncé).", module: "council", where: SHOPIFY_PATHS.pages },
  mentions: { label: "Mentions légales", impact: "Google veut identifier clairement l'entreprise derrière la boutique.", fix: "Compléter les mentions légales (raison sociale, adresse, contact).", module: "council", where: SHOPIFY_PATHS.legal },
  return: { label: "Politique de retour", impact: "Absence de politique de retour = cause fréquente de suspension Merchant Center.", fix: "Publier une politique de retour claire (délai, conditions, frais).", module: "council", where: SHOPIFY_PATHS.legal },
  shipping: { label: "Politique de livraison", impact: "Google et l'acheteur attendent les délais, zones et frais de livraison.", fix: "Publier une politique de livraison (délais, zones, frais).", module: "council", where: SHOPIFY_PATHS.legal },
  cgv: { label: "Conditions générales (CGV)", impact: "Cadre de vente non défini : moins de confiance et de conformité.", fix: "Ajouter des conditions générales de vente.", module: "council", where: SHOPIFY_PATHS.legal },
  privacy: { label: "Politique de confidentialité", impact: "Requise pour les données personnelles (RGPD) et la conformité Google.", fix: "Publier une politique de confidentialité.", module: "council", where: SHOPIFY_PATHS.legal },
  faq: { label: "FAQ", impact: "Une FAQ lève les objections et rassure (utile, non bloquant Merchant).", fix: "Ajouter une FAQ (livraison, retours, produit) — section via AI Council → Code Shopify.", module: "council", where: SHOPIFY_PATHS.pages },
  warranty: { label: "Garantie", impact: "Garantie non affichée : un signal de confiance en moins (recommandation).", fix: "Afficher la garantie si vous en proposez une.", module: "assistant", where: SHOPIFY_PATHS.pages },
};

const LEGAL_RESOLVE_Q = "Quelles pages légales dois-je compléter avant de soumettre Google Merchant Center, et comment les rédiger ?";

// Formulations qui peuvent être vues comme des claims non prouvés (misrepresentation).
const CLAIM_RE = /\b(meilleur|n[°o]\s?1|num[ée]ro 1|imbattable|exceptionnel|miracle|professionnel|premium|qualit[ée] sup[ée]rieure|r[ée]sultat garanti|garanti[e]?\s+(?:r[ée]sultat|satisfaction))\b/i;

function scoreTone(v: number): string {
  return v >= 70 ? "plutôt rassurant" : v >= 50 ? "moyen, à consolider" : "fragile, à renforcer";
}

export function buildMerchantReport(analysis: StoreAnalysis | null, brand: BrandMemory, resolved: string[] = []): MerchantReport {
  const scanned = !!analysis;
  const cs = analysis?.catalogStats;
  const englishCount = analysis?.englishTexts?.length ?? analysis?.metrics?.englishTextsDetected ?? 0;
  const missingMeta = analysis?.metrics?.missingMetaDescriptions ?? 0;
  const imagesNoAlt = cs?.imagesNoAlt ?? analysis?.metrics?.imagesWithoutAlt ?? 0;
  const noType = cs?.noType ?? 0;
  const weakDesc = cs ? cs.noDescription + cs.shortDescriptions : 0;
  const tagsCoverage = cs?.tagsCoverage;

  const checklist: MCItem[] = [];

  // 1. Pages de confiance (légal)
  const byKey = new Map((analysis?.legalPages ?? []).map((l) => [l.key, l]));
  let trustFound = 0;
  let trustTotal = 0;
  for (const key of ["contact", "mentions", "return", "shipping", "cgv", "privacy", "faq", "warranty"]) {
    const meta = LEGAL_META[key];
    const lp = byKey.get(key);
    const essential = lp?.essential ?? ESSENTIAL.includes(key);
    if (essential) trustTotal++;
    if (lp?.found) {
      if (essential) trustFound++;
      checklist.push({ key, label: lp.label, status: "ok", severity: "mineur", impact: meta.impact, fix: "Déjà en place — ne pas y toucher.", where: meta.where, module: meta.module });
    } else {
      checklist.push({ key, label: meta.label, status: essential ? "fix" : "check", severity: essential ? "critique" : "mineur", impact: meta.impact, fix: meta.fix, where: meta.where, module: meta.module, resolveQ: LEGAL_RESOLVE_Q });
    }
  }

  // 2. Langue & cohérence
  if (englishCount > 0) checklist.push({ key: "english", label: `Textes en anglais détectés (${englishCount})`, status: "fix", severity: "important", impact: "Donne une impression de boutique incomplète et réduit la confiance utilisateur (signal négatif Merchant).", fix: "Traduire les libellés du thème en français.", where: SHOPIFY_PATHS.english, module: "assistant", count: englishCount, resolveQ: "Quels textes anglais ont été détectés et comment les corriger dans Shopify pour réduire le risque Merchant Center ?" });
  else if (scanned) checklist.push({ key: "english", label: "Cohérence de langue", status: "ok", severity: "mineur", impact: "Boutique cohérente linguistiquement.", fix: "Déjà cohérent — ne pas y toucher.", where: SHOPIFY_PATHS.english, module: "assistant" });
  checklist.push({ key: "currency", label: "Cohérence langue / devise", status: "check", severity: "mineur", impact: "La devise doit correspondre au pays cible (Paramètres → Marchés).", fix: `Vérifier que la devise correspond à « ${brand.country || "votre pays cible"} ».`, where: "Shopify → Paramètres → Marchés", module: "assistant" });

  // 3. Données produit
  if (noType > 0) checklist.push({ key: "product_type", label: `Product types manquants (${noType})`, status: "fix", severity: "important", impact: "Sans product_type, la catégorisation et le flux Google Shopping sont moins fiables.", fix: "Renseigner le type de produit sur les fiches concernées.", where: SHOPIFY_PATHS.product_type, module: "assistant", count: noType, resolveQ: "Quels product_type dois-je ajouter à mes produits et où les modifier dans Shopify ?" });
  if (weakDesc > 0) checklist.push({ key: "desc", label: `Descriptions produit faibles (${weakDesc})`, status: "fix", severity: "important", impact: "Descriptions trop courtes = qualité catalogue faible (SEO + confiance Merchant).", fix: "Générer des descriptions complètes (200+ mots) dans le SEO Studio.", where: "SEO Studio → Fiche produit SEO", module: "seo", count: weakDesc });
  if (missingMeta > 0) checklist.push({ key: "meta", label: `Meta descriptions manquantes (${missingMeta})`, status: "fix", severity: "important", impact: "Meta absentes = taux de clic plus faible dans Google.", fix: "Générer les meta dans le SEO Studio (≤ 60 / ≤ 155 car.).", where: SHOPIFY_PATHS.meta, module: "seo", count: missingMeta });
  if (imagesNoAlt > 0) checklist.push({ key: "alt", label: `Images sans alt text (${imagesNoAlt})`, status: "fix", severity: "mineur", impact: "Mineur pour Merchant, utile pour le SEO et l'accessibilité.", fix: "Ajouter des alt text descriptifs (SEO Studio → Alt text).", where: SHOPIFY_PATHS.alt, module: "seo", count: imagesNoAlt });
  if (tagsCoverage != null && tagsCoverage < 60) checklist.push({ key: "tags", label: `Tags faibles (couverture ${tagsCoverage}%)`, status: "check", severity: "mineur", impact: "Des tags cohérents améliorent navigation et flux catalogue.", fix: "Compléter les tags (style, usage, matériau).", where: SHOPIFY_PATHS.tags, module: "assistant" });
  else if (tagsCoverage != null && tagsCoverage >= 80) checklist.push({ key: "tags", label: `Tags (couverture ${tagsCoverage}%)`, status: "ok", severity: "mineur", impact: "Bonne couverture de tags.", fix: "Déjà bon — ne pas y toucher.", where: SHOPIFY_PATHS.tags, module: "assistant" });

  // 4. Promesses / claims (misrepresentation) — détecté dans promesses, garanties, titres prioritaires
  const claimSources = [...(brand.promises ?? []), ...(brand.guarantees ?? []), ...(analysis?.priorityProducts?.map((p) => p.title) ?? [])];
  const claims = Array.from(new Set(claimSources.filter((t) => t && CLAIM_RE.test(t)))).slice(0, 5);
  if (claims.length) checklist.push({ key: "claims", label: `Promesses / claims à vérifier (${claims.length})`, status: "check", severity: "important", impact: "Des formulations comme « meilleur », « professionnel », « garanti » peuvent être vues comme des claims non prouvés (risque misrepresentation).", fix: "Réécrire de façon factuelle (caractéristiques, matériaux, usages) plutôt que par des superlatifs.", where: "Produits / Pages concernés", module: "council", examples: claims, resolveQ: "Quels textes de ma boutique peuvent sembler trop marketing ou risqués pour Google Merchant Center, et comment les réécrire de façon plus factuelle ?" });

  // 5. Promotions / réductions — non confirmable via scan public → à vérifier
  const promotions: MCItem = {
    key: "promotions",
    label: "Promotions / réductions",
    status: "check",
    severity: "mineur",
    impact: "Des réductions agressives, permanentes ou floues (prix barrés, « -50% », urgence) peuvent créer une incohérence prix/offre vue par Google.",
    fix: "Avant la demande GMC, évitez les bandeaux d'urgence permanents, clarifiez les conditions, et vérifiez que le prix affiché correspond au prix envoyé au feed.",
    where: "Shopify → Réductions / bandeaux du thème",
    module: "council",
    resolveQ: "J'ai des réductions visibles sur ma boutique. Comment les rendre plus propres et cohérentes avant une demande Google Merchant Center ?",
  };
  checklist.push(promotions);

  // ── Partition open / résolu ──
  const openAll = checklist.filter((i) => i.status !== "ok");
  const resolvedItems = openAll.filter((i) => resolved.includes(i.key));
  const open = openAll.filter((i) => !resolved.includes(i.key));
  const critical = open.filter((i) => i.severity === "critique");
  const important = open.filter((i) => i.severity === "important");
  const optimizations = open.filter((i) => i.severity === "mineur");

  const totalActions = openAll.length;
  const actionsRemaining = open.length;
  const penalty = open.reduce((a, i) => a + (i.severity === "critique" ? 14 : i.severity === "important" ? 7 : 2), 0);
  const readiness = Math.max(0, Math.min(100, 100 - penalty));

  const gmcStatus: MerchantReport["gmcStatus"] =
    critical.length >= 3 ? { level: "risk", label: "Risque élevé" } :
    critical.length + important.length > 0 ? { level: "fix", label: "À corriger avant soumission" } :
    { level: "ready", label: "Prêt pour soumission" };

  const score = analysis?.scores.merchant ?? 0;
  const trust = analysis?.scores.trust ?? 0;
  const weakDataCount = (noType > 0 ? 1 : 0) + (weakDesc > 0 ? 1 : 0) + (missingMeta > 0 ? 1 : 0) + (imagesNoAlt > 0 ? 1 : 0);

  // ── Checklist « Avant Shopping / PMax » ──
  const st = (b: boolean): MCStatus => (b ? "ok" : "fix");
  const beforeShopping: BeforeShoppingItem[] = [
    { key: "legal", label: "Pages légales essentielles", status: st(trustFound >= trustTotal), impact: "Bloquant fréquent GMC.", action: "Compléter contact, retours, livraison, mentions, confidentialité." },
    { key: "english", label: "Textes anglais corrigés", status: st(englishCount === 0), impact: "Confiance & cohérence.", action: "Traduire les libellés du thème." },
    { key: "product_type", label: "product_type complétés", status: st(noType === 0), impact: "Catégorisation + flux Shopping.", action: "Renseigner le type de produit." },
    { key: "desc", label: "Descriptions produits solides", status: st(weakDesc === 0), impact: "Qualité catalogue.", action: "Étoffer via SEO Studio." },
    { key: "meta", label: "Meta présentes", status: st(missingMeta === 0), impact: "Taux de clic Google.", action: "Générer les meta (SEO Studio)." },
    { key: "alt", label: "Alt text images", status: imagesNoAlt === 0 ? "ok" : "check", impact: "SEO / accessibilité (mineur GMC).", action: "Ajouter des alt descriptifs." },
    { key: "prices", label: "Prix cohérents site / feed", status: "check", impact: "Incohérence prix = risque.", action: "Vérifier que le prix affiché = prix du feed." },
    { key: "stock", label: "Stock / disponibilité cohérents", status: "check", impact: "Disponibilité incohérente = risque.", action: "Vérifier la dispo affichée vs feed." },
    { key: "promotions", label: "Promotions propres", status: "check", impact: "Promo floue/permanente = risque.", action: "Clarifier les conditions, éviter l'urgence permanente." },
    { key: "titles", label: "Titres produits naturels", status: claims.length ? "check" : "ok", impact: "Titres trop marketing = risque.", action: "Titres descriptifs, sans superlatif." },
    { key: "rescan", label: "Scan Orkestra relancé après corrections", status: "check", impact: "Valider l'état réel après corrections.", action: "Relancer l'audit Merchant." },
  ];

  const interpretation: string[] = [];
  interpretation.push(`Score Merchant apparent ${score}/100 — profil ${scoreTone(score)}.`);
  if (critical.length) interpretation.push(`${critical.length} risque(s) critique(s) à régler AVANT toute soumission : ${critical.slice(0, 3).map((c) => c.label.replace(/\s*\(.*\)/, "")).join(", ")}.`);
  else if (scanned) interpretation.push("Aucun risque critique bloquant détecté sur la vue publique — bon socle de confiance.");
  if (englishCount > 0) interpretation.push(`Cohérence de langue : ${englishCount} libellé(s) anglais à traduire.`);
  if (claims.length) interpretation.push("Des formulations marketing pourraient être vues comme des claims non prouvés — préférez des textes factuels.");
  interpretation.push("Promotions : à vérifier — évitez l'urgence permanente et l'incohérence prix avant la demande GMC.");
  interpretation.push("Avant Google Shopping / Performance Max : prioriser les pages de confiance, la cohérence de langue et des données produit solides.");

  return {
    scanned, score, trust, trustFound, trustTotal, englishCount, weakDataCount,
    checklist, critical, important, optimizations, resolvedItems,
    totalActions, actionsRemaining, readiness, gmcStatus, promotions, beforeShopping, interpretation,
  };
}

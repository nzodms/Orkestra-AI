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
  /** Temps estimé de correction. */
  eta?: string;
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

/** Catégorie « Ce qui peut bloquer Google » (vue synthétique). */
export interface Blocker {
  key: string;
  label: string;
  status: MCStatus;
  example: string;
  why: string;
}

export interface MerchantReport {
  scanned: boolean;
  score: number;
  trust: number;
  trustFound: number;
  trustTotal: number;
  englishCount: number;
  weakDataCount: number;
  claimsCount: number;
  checklist: MCItem[];
  critical: MCItem[];
  important: MCItem[];
  optimizations: MCItem[];
  actionPlan: MCItem[];
  resolvedItems: MCItem[];
  totalActions: number;
  actionsRemaining: number;
  readiness: number;
  gmcStatus: { level: "ready" | "fix" | "risk"; label: string };
  submission: { level: "go" | "soon" | "wait"; label: string; reason: string; before: string[] };
  promotions: MCItem;
  blockers: Blocker[];
  beforeShopping: BeforeShoppingItem[];
  interpretation: string[];
}

/** Temps estimé de correction par type d'item. */
function etaFor(key: string): string {
  if (["contact", "mentions", "return", "shipping", "cgv", "privacy", "faq", "warranty"].includes(key)) return "≈ 15–30 min / page";
  if (key === "english") return "≈ 5–15 min";
  if (key === "product_type") return "≈ 1–2 min / produit";
  if (key === "desc") return "≈ 10 min / fiche";
  if (key === "meta") return "≈ 3 min / page";
  if (key === "alt") return "≈ 1 min / image";
  if (key === "tags") return "≈ 2 min / produit";
  if (key === "claims") return "≈ 10 min";
  if (key === "promotions") return "≈ 10 min";
  return "≈ 10 min";
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

const LEGAL_RESOLVE_Q = "Contexte : Merchant Shield a détecté des pages légales manquantes. Réponds uniquement sur ce sujet : quelles pages compléter avant Google Merchant Center, pourquoi (impact Merchant), comment les créer et le chemin Shopify exact.";

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
  if (englishCount > 0) checklist.push({ key: "english", label: `Textes en anglais détectés (${englishCount})`, status: "fix", severity: "important", impact: "Donne une impression de boutique incomplète et réduit la confiance utilisateur (signal négatif Merchant).", fix: "Traduire les libellés du thème en français.", where: SHOPIFY_PATHS.english, module: "assistant", count: englishCount, resolveQ: `Contexte : Merchant Shield a détecté ${englishCount} texte(s) anglais visible(s) sur la boutique. Réponds uniquement à ce problème : liste les textes détectés, leur correction française, l'impact Merchant Center, le chemin Shopify pour les corriger et la priorité.` });
  else if (scanned) checklist.push({ key: "english", label: "Cohérence de langue", status: "ok", severity: "mineur", impact: "Boutique cohérente linguistiquement.", fix: "Déjà cohérent — ne pas y toucher.", where: SHOPIFY_PATHS.english, module: "assistant" });
  checklist.push({ key: "currency", label: "Cohérence langue / devise", status: "check", severity: "mineur", impact: "La devise doit correspondre au pays cible (Paramètres → Marchés).", fix: `Vérifier que la devise correspond à « ${brand.country || "votre pays cible"} ».`, where: "Shopify → Paramètres → Marchés", module: "assistant" });

  // 3. Données produit
  if (noType > 0) checklist.push({ key: "product_type", label: `Product types manquants (${noType})`, status: "fix", severity: "important", impact: "Sans product_type, la catégorisation et le flux Google Shopping sont moins fiables.", fix: "Renseigner le type de produit sur les fiches concernées.", where: SHOPIFY_PATHS.product_type, module: "assistant", count: noType, resolveQ: `Contexte : Merchant Shield a détecté ${noType} product_type manquant(s). Réponds uniquement à ce problème : liste les produits concernés si disponibles, propose les product_type à ajouter et donne le chemin Shopify exact.` });
  if (weakDesc > 0) checklist.push({ key: "desc", label: `Descriptions produit faibles (${weakDesc})`, status: "fix", severity: "important", impact: "Descriptions trop courtes = qualité catalogue faible (SEO + confiance Merchant).", fix: "Réécrire les descriptions en lot via Import Factory (export du CSV produits → transformer → réimporter).", where: "Import Factory (transformer le catalogue)", module: "seo", count: weakDesc });
  if (missingMeta > 0) checklist.push({ key: "meta", label: `Meta descriptions manquantes (${missingMeta})`, status: "fix", severity: "important", impact: "Meta absentes = taux de clic plus faible dans Google.", fix: "Générer les meta en lot via Import Factory (≤ 60 / ≤ 155 car.), ou pièce par pièce dans Shopify.", where: SHOPIFY_PATHS.meta, module: "seo", count: missingMeta });
  if (imagesNoAlt > 0) checklist.push({ key: "alt", label: `Images sans alt text (${imagesNoAlt})`, status: "fix", severity: "mineur", impact: "Mineur pour Merchant, utile pour le SEO et l'accessibilité.", fix: "Générer les alt text en lot via Import Factory (CSV produits).", where: SHOPIFY_PATHS.alt, module: "seo", count: imagesNoAlt });
  if (tagsCoverage != null && tagsCoverage < 60) checklist.push({ key: "tags", label: `Tags faibles (couverture ${tagsCoverage}%)`, status: "check", severity: "mineur", impact: "Des tags cohérents améliorent navigation et flux catalogue.", fix: "Compléter les tags (style, usage, matériau).", where: SHOPIFY_PATHS.tags, module: "assistant" });
  else if (tagsCoverage != null && tagsCoverage >= 80) checklist.push({ key: "tags", label: `Tags (couverture ${tagsCoverage}%)`, status: "ok", severity: "mineur", impact: "Bonne couverture de tags.", fix: "Déjà bon — ne pas y toucher.", where: SHOPIFY_PATHS.tags, module: "assistant" });

  // 4. Promesses / claims (misrepresentation) — détecté dans promesses, garanties, titres prioritaires
  const claimSources = [...(brand.promises ?? []), ...(brand.guarantees ?? []), ...(analysis?.priorityProducts?.map((p) => p.title) ?? [])];
  const claims = Array.from(new Set(claimSources.filter((t) => t && CLAIM_RE.test(t)))).slice(0, 5);
  if (claims.length) checklist.push({ key: "claims", label: `Promesses / claims à vérifier (${claims.length})`, status: "check", severity: "important", impact: "Des formulations comme « meilleur », « professionnel », « garanti » peuvent être vues comme des claims non prouvés (risque misrepresentation).", fix: "Réécrire de façon factuelle (caractéristiques, matériaux, usages) plutôt que par des superlatifs.", where: "Produits / Pages concernés", module: "council", examples: claims, resolveQ: "Contexte : Merchant Shield a détecté des formulations marketing potentiellement risquées (claims non prouvés) pour Google Merchant Center. Réponds uniquement sur ce sujet : quels textes réécrire de façon factuelle, pourquoi c'est un risque Merchant, et donne des exemples de réécriture sobre." });

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
    resolveQ: "Contexte : Merchant Shield signale des promotions/réductions à vérifier avant une demande Google Merchant Center. Réponds uniquement sur ce sujet : explique les risques des prix barrés, codes promo, bandeaux d'urgence et réductions permanentes, puis donne les actions à faire avant soumission GMC.",
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

  // Temps estimé + plan d'action (priorité décroissante).
  checklist.forEach((i) => { i.eta = etaFor(i.key); });
  const actionPlan = [...critical, ...important, ...optimizations];

  // « Ce qui peut bloquer Google » — 6 catégories synthétiques.
  const contactFound = !!byKey.get("contact")?.found;
  const allEssentialFound = trustFound >= trustTotal;
  const blockers: Blocker[] = [
    { key: "trust", label: "Confiance boutique", status: contactFound && trust >= 60 ? "ok" : contactFound ? "check" : "fix", example: contactFound ? "Identité entreprise / réassurance à renforcer." : "Page contact ou identité entreprise absente.", why: "Google veut identifier un vendeur fiable et joignable." },
    { key: "policies", label: "Politiques", status: allEssentialFound ? "ok" : "fix", example: allEssentialFound ? "Politiques essentielles présentes." : "Retours / livraison / confidentialité incomplètes.", why: "Des politiques claires sont une exigence fréquente de Merchant Center." },
    { key: "lang", label: "Langue & cohérence", status: englishCount === 0 ? (scanned ? "ok" : "check") : "fix", example: englishCount ? `${englishCount} libellé(s) anglais (« Add to cart »…).` : "Boutique cohérente linguistiquement.", why: "Une incohérence linguistique est un signal négatif de confiance." },
    { key: "product", label: "Données produit", status: weakDataCount === 0 ? (scanned ? "ok" : "check") : "check", example: weakDataCount ? "product_type / descriptions / meta incomplets." : "Catalogue propre.", why: "Un catalogue faible fragilise le flux Google Shopping." },
    { key: "promotions", label: "Promotions / prix barrés", status: "check", example: "Bandeaux d'urgence, prix barrés permanents, codes promo.", why: "Une offre incohérente avec le feed = risque de misrepresentation." },
    { key: "claims", label: "Promesses commerciales", status: claims.length ? "check" : scanned ? "ok" : "check", example: claims.length ? `« ${claims[0]} »…` : "Pas de claim non prouvé détecté.", why: "Les claims non prouvés (« meilleur », « garanti ») sont vus comme un risque." },
  ];

  // ── Checklist « Avant Shopping / PMax » ──
  const st = (b: boolean): MCStatus => (b ? "ok" : "fix");
  const beforeShopping: BeforeShoppingItem[] = [
    { key: "legal", label: "Pages légales essentielles", status: st(trustFound >= trustTotal), impact: "Bloquant fréquent GMC.", action: "Compléter contact, retours, livraison, mentions, confidentialité." },
    { key: "english", label: "Textes anglais corrigés", status: st(englishCount === 0), impact: "Confiance & cohérence.", action: "Traduire les libellés du thème." },
    { key: "product_type", label: "product_type complétés", status: st(noType === 0), impact: "Catégorisation + flux Shopping.", action: "Renseigner le type de produit." },
    { key: "desc", label: "Descriptions produits solides", status: st(weakDesc === 0), impact: "Qualité catalogue.", action: "Étoffer via Import Factory." },
    { key: "meta", label: "Meta présentes", status: st(missingMeta === 0), impact: "Taux de clic Google.", action: "Générer les meta (Import Factory)." },
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

  // Conclusion de soumission GMC.
  const topBefore = [...critical, ...important].slice(0, 3).map((i) => i.label.replace(/\s*\(.*\)/, ""));
  const submission: MerchantReport["submission"] =
    critical.length > 0
      ? { level: "wait", label: "Soumission déconseillée pour l'instant", reason: "Des risques critiques peuvent entraîner un refus Merchant Center.", before: topBefore }
      : important.length > 0
      ? { level: "soon", label: "Soumission possible après correction", reason: "Le socle de confiance est bon, mais quelques points peuvent fragiliser la validation.", before: topBefore }
      : { level: "go", label: "Soumission recommandée", reason: scanned ? "Aucun risque bloquant ni important détecté sur la vue publique." : "Lancez l'audit pour une conclusion fiable.", before: [] };

  return {
    scanned, score, trust, trustFound, trustTotal, englishCount, weakDataCount, claimsCount: claims.length,
    checklist, critical, important, optimizations, actionPlan, resolvedItems,
    totalActions, actionsRemaining, readiness, gmcStatus, submission, promotions, blockers, beforeShopping, interpretation,
  };
}

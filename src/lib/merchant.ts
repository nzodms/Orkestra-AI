import type { StoreAnalysis, BrandMemory, MerchantSeverity, ModuleId } from "./types";
import { SHOPIFY_PATHS } from "./shopify";

// ──────────────────────────────────────────────────────────────────────────
// Construit un rapport Merchant Shield ACTIONNABLE à partir des données réelles
// du scan public (pages légales, textes anglais, catalogue, scores). Pur,
// utilisable côté client. Pas de garantie d'approbation — Google décide.
// ──────────────────────────────────────────────────────────────────────────

export type MCStatus = "ok" | "fix" | "check";

export interface MCItem {
  key: string;
  label: string;
  status: MCStatus;
  severity: MerchantSeverity;
  impact: string;
  fix: string;
  /** Chemin Shopify ou action concrète. */
  where: string;
  /** Module Orkestra conseillé pour corriger. */
  module: ModuleId;
  /** Nombre d'éléments concernés (ex. 6 textes anglais). */
  count?: number;
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

function scoreTone(v: number): string {
  return v >= 70 ? "plutôt rassurant" : v >= 50 ? "moyen, à consolider" : "fragile, à renforcer";
}

export function buildMerchantReport(analysis: StoreAnalysis | null, brand: BrandMemory): MerchantReport {
  const scanned = !!analysis;
  const cs = analysis?.catalogStats;
  const englishCount = analysis?.englishTexts?.length ?? analysis?.metrics?.englishTextsDetected ?? 0;
  const missingMeta = analysis?.metrics?.missingMetaDescriptions ?? 0;
  const imagesNoAlt = cs?.imagesNoAlt ?? analysis?.metrics?.imagesWithoutAlt ?? 0;
  const noType = cs?.noType ?? 0;
  const weakDesc = cs ? cs.noDescription + cs.shortDescriptions : 0;
  const tagsCoverage = cs?.tagsCoverage;

  const checklist: MCItem[] = [];

  // 1. Pages de confiance (légal) — ordre canonique
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
      checklist.push({ key, label: meta.label, status: essential ? "fix" : "check", severity: essential ? "critique" : "mineur", impact: meta.impact, fix: meta.fix, where: meta.where, module: meta.module });
    }
  }

  // 2. Langue & cohérence
  if (englishCount > 0) {
    checklist.push({ key: "english", label: `Textes en anglais détectés (${englishCount})`, status: "fix", severity: "important", impact: "Donne une impression de boutique incomplète et réduit la confiance utilisateur (signal négatif Merchant).", fix: "Traduire les libellés du thème en français.", where: SHOPIFY_PATHS.english, module: "assistant", count: englishCount });
  } else if (scanned) {
    checklist.push({ key: "english", label: "Cohérence de langue", status: "ok", severity: "mineur", impact: "Boutique cohérente linguistiquement.", fix: "Déjà cohérent — ne pas y toucher.", where: SHOPIFY_PATHS.english, module: "assistant" });
  }
  checklist.push({ key: "currency", label: "Cohérence langue / devise", status: "check", severity: "mineur", impact: "La devise doit correspondre au pays cible (paramètres Marchés).", fix: `Vérifier que la devise correspond à « ${brand.country || "votre pays cible"} ».`, where: "Shopify → Paramètres → Marchés", module: "assistant" });

  // 3. Données produit
  if (noType > 0) checklist.push({ key: "product_type", label: `Product types manquants (${noType})`, status: "fix", severity: "important", impact: "Sans product_type, la catégorisation et le flux Google Shopping sont moins fiables.", fix: "Renseigner le type de produit sur les fiches concernées.", where: SHOPIFY_PATHS.product_type, module: "assistant", count: noType });
  if (weakDesc > 0) checklist.push({ key: "desc", label: `Descriptions produit faibles (${weakDesc})`, status: "fix", severity: "important", impact: "Descriptions trop courtes = qualité catalogue faible (SEO + confiance Merchant).", fix: "Générer des descriptions complètes (200+ mots) dans le SEO Studio.", where: "SEO Studio → Fiche produit SEO", module: "seo", count: weakDesc });
  if (missingMeta > 0) checklist.push({ key: "meta", label: `Meta descriptions manquantes (${missingMeta})`, status: "fix", severity: "important", impact: "Meta absentes = taux de clic plus faible dans Google.", fix: "Générer les meta dans le SEO Studio (≤ 60 / ≤ 155 car.).", where: SHOPIFY_PATHS.meta, module: "seo", count: missingMeta });
  if (imagesNoAlt > 0) checklist.push({ key: "alt", label: `Images sans alt text (${imagesNoAlt})`, status: "fix", severity: "mineur", impact: "Mineur pour Merchant, utile pour le SEO et l'accessibilité.", fix: "Ajouter des alt text descriptifs (SEO Studio → Alt text).", where: SHOPIFY_PATHS.alt, module: "seo", count: imagesNoAlt });
  if (tagsCoverage != null && tagsCoverage < 60) checklist.push({ key: "tags", label: `Tags faibles (couverture ${tagsCoverage}%)`, status: "check", severity: "mineur", impact: "Des tags cohérents améliorent navigation et flux catalogue.", fix: "Compléter les tags (style, usage, matériau).", where: SHOPIFY_PATHS.tags, module: "assistant" });
  else if (tagsCoverage != null && tagsCoverage >= 80) checklist.push({ key: "tags", label: `Tags (couverture ${tagsCoverage}%)`, status: "ok", severity: "mineur", impact: "Bonne couverture de tags.", fix: "Déjà bon — ne pas y toucher.", where: SHOPIFY_PATHS.tags, module: "assistant" });

  const open = checklist.filter((i) => i.status !== "ok");
  const critical = open.filter((i) => i.severity === "critique");
  const important = open.filter((i) => i.severity === "important");
  const optimizations = open.filter((i) => i.severity === "mineur");

  const score = analysis?.scores.merchant ?? 0;
  const trust = analysis?.scores.trust ?? 0;
  const weakDataCount = (noType > 0 ? 1 : 0) + (weakDesc > 0 ? 1 : 0) + (missingMeta > 0 ? 1 : 0) + (imagesNoAlt > 0 ? 1 : 0);

  const interpretation: string[] = [];
  interpretation.push(`Score Merchant apparent ${score}/100 — profil ${scoreTone(score)}.`);
  if (critical.length) interpretation.push(`${critical.length} risque(s) critique(s) à régler AVANT toute soumission : ${critical.slice(0, 3).map((c) => c.label.replace(/\s*\(.*\)/, "")).join(", ")}.`);
  else if (scanned) interpretation.push("Aucun risque critique bloquant détecté sur la vue publique — bon socle de confiance.");
  if (englishCount > 0) interpretation.push(`Cohérence de langue : ${englishCount} libellé(s) anglais à traduire pour renforcer la confiance.`);
  if (weakDataCount > 0) interpretation.push("Données catalogue à renforcer (types, descriptions, meta) avant un flux Shopping fiable.");
  interpretation.push("Avant Google Shopping / Performance Max : prioriser les pages de confiance (contact, retours, livraison) et la cohérence de langue.");

  return { scanned, score, trust, trustFound, trustTotal, englishCount, weakDataCount, checklist, critical, important, optimizations, interpretation };
}

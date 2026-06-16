// ──────────────────────────────────────────────────────────────────────────
// Analyse qualité d'un produit Shopify réel — pur, testable, sans réseau.
// Détecte les problèmes SEO / contenu / images / catalogue / conversion,
// calcule des scores et une priorité. AUCUNE donnée inventée : on ne juge que
// ce qui est réellement présent sur le produit.
// ──────────────────────────────────────────────────────────────────────────

import type {
  ShopifyProduct,
  AnalyzedProduct,
  ProductIssue,
  ProductScores,
  ProductPriority,
} from "./types";

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();
}

function wordCount(s: string): number {
  return s ? s.split(/\s+/).filter(Boolean).length : 0;
}

// Heuristique légère « texte anglais » : présence de mots anglais fréquents
// sans équivalent accentué français, et absence de marqueurs FR.
const EN_WORDS = /\b(the|and|for|with|your|our|this|best|premium|quality|free|shipping|buy|now|new|features?|material|size|color)\b/gi;
const FR_MARKERS = /\b(le|la|les|de|des|une?|votre|vos|pour|avec|qualité|livraison|gratuit|taille|couleur|matière|caractéristiques?)\b/i;

function looksEnglish(text: string): boolean {
  const en = (text.match(EN_WORDS) || []).length;
  if (en < 3) return false;
  return !FR_MARKERS.test(text);
}

const GENERIC_TITLE = /^(produit|product|test|sans titre|untitled|default title|article|item)\b/i;
const REASSURANCE = /(livraison|retour|garantie|satisfait|rembours|sécuris|securis|paiement|sav|service client|jours?)/i;

export function analyzeProduct(p: ShopifyProduct): AnalyzedProduct {
  const issues: ProductIssue[] = [];
  const add = (code: string, area: ProductIssue["area"], label: string, severity: ProductIssue["severity"]) =>
    issues.push({ code, area, label, severity });

  // ── SEO ──
  const title = p.title?.trim() ?? "";
  if (title.length === 0) add("title_missing", "seo", "Titre manquant", "haut");
  else {
    if (title.length < 15) add("title_short", "seo", "Titre trop court", "moyen");
    if (title.length > 70) add("title_long", "seo", "Titre trop long (> 70 car.)", "bas");
    if (GENERIC_TITLE.test(title) || wordCount(title) < 2) add("title_generic", "seo", "Titre trop générique", "haut");
  }
  if (p.available.seo) {
    if (!p.seoTitle?.trim()) add("meta_title_missing", "seo", "Meta title manquante", "moyen");
    else if (p.seoTitle.length > 60) add("meta_title_long", "seo", "Meta title trop longue (> 60 car.)", "bas");
    if (!p.seoDescription?.trim()) add("meta_desc_missing", "seo", "Meta description manquante", "haut");
    else if (p.seoDescription.length > 160) add("meta_desc_long", "seo", "Meta description trop longue (> 160 car.)", "bas");
  }
  const handle = p.handle ?? "";
  if (handle.length > 60) add("handle_long", "seo", "Handle (URL) trop long", "bas");
  if (/(\b|-)(copy|copie|untitled|\d{6,})(\b|-)/i.test(handle) || /[^a-z0-9-]/.test(handle))
    add("handle_dirty", "seo", "Handle peu lisible (caractères ou suffixe parasites)", "moyen");

  // ── Contenu ──
  const text = stripHtml(p.bodyHtml || "");
  const words = wordCount(text);
  if (words === 0) add("desc_missing", "contenu", "Description manquante", "haut");
  else {
    if (words < 30) add("desc_short", "contenu", "Description trop courte (< 30 mots)", "haut");
    if (looksEnglish(text)) add("desc_english", "contenu", "Description en anglais détectée", "moyen");
    if (words > 40 && !/<(p|ul|ol|li|br|h[2-4])\b/i.test(p.bodyHtml)) add("desc_nostructure", "contenu", "Description sans structure (pas de paragraphes/listes)", "moyen");
    if (!/<(ul|li)\b/i.test(p.bodyHtml)) add("no_benefits", "contenu", "Aucune liste de bénéfices", "moyen");
    if (!/\?/.test(text)) add("no_faq", "contenu", "Pas de FAQ produit", "bas");
  }

  // ── Images ──
  if (p.images.length === 0) add("no_images", "images", "Aucune image produit", "haut");
  const noAlt = p.images.filter((i) => !i.alt || !i.alt.trim()).length;
  if (noAlt > 0) add("alt_missing", "images", `${noAlt} image${noAlt > 1 ? "s" : ""} sans texte alternatif`, "moyen");
  const genericAlt = p.images.filter((i) => i.alt && (i.alt.trim().toLowerCase() === handle || /^(image|img|photo|product|dsc|untitled)[\s_\-0-9]*$/i.test(i.alt.trim()))).length;
  if (genericAlt > 0) add("alt_generic", "images", `${genericAlt} alt trop générique${genericAlt > 1 ? "s" : ""}`, "bas");

  // ── Catalogue ──
  if (!p.productType?.trim()) add("type_missing", "catalogue", "Type de produit manquant", "moyen");
  if (!p.vendor?.trim()) add("vendor_missing", "catalogue", "Vendor manquant", "bas");
  if (p.tags.length < 2) add("tags_weak", "catalogue", "Tags insuffisants (< 2)", "moyen");

  // ── Conversion ──
  if (words > 0 && !REASSURANCE.test(text)) add("no_reassurance", "conversion", "Aucune réassurance (livraison, retour, garantie)", "moyen");
  if (words > 0 && words < 60) add("low_info", "conversion", "Informations produit insuffisantes", "moyen");
  if (!/<(ul|li)\b/i.test(p.bodyHtml) && words > 0) add("weak_benefits", "conversion", "Bénéfices peu clairs pour l'acheteur", "bas");

  const scores = computeScores(issues);
  const priority = priorityFromScore(scores.global, issues);
  const hauts = issues.filter((i) => i.severity === "haut").length;

  return {
    ...p,
    issues,
    scores,
    priority,
    effort: issues.length <= 2 ? "rapide" : issues.length <= 5 ? "moyen" : "long",
    impact: scores.global < 50 ? "haut" : scores.global < 72 ? "moyen" : "bas",
    reviewStatus: scores.global >= 80 && hauts === 0 ? "pret" : "a_corriger",
  };
}

const WEIGHT: Record<ProductIssue["severity"], number> = { haut: 22, moyen: 12, bas: 5 };

function computeScores(issues: ProductIssue[]): ProductScores {
  const penalty = (area: ProductIssue["area"][]) =>
    issues.filter((i) => area.includes(i.area)).reduce((s, i) => s + WEIGHT[i.severity], 0);
  const seo = clamp(100 - penalty(["seo"]));
  const content = clamp(100 - penalty(["contenu"]));
  const conversion = clamp(100 - penalty(["conversion", "catalogue"]) * 0.9);
  const global = clamp(Math.round(seo * 0.4 + content * 0.35 + conversion * 0.25));
  return { seo, content, conversion, global };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function priorityFromScore(global: number, issues: ProductIssue[]): ProductPriority {
  const hauts = issues.filter((i) => i.severity === "haut").length;
  if (global < 50 || hauts >= 2) return "haute";
  if (global < 72 || hauts === 1) return "moyenne";
  return "basse";
}

/** Statistiques catalogue agrégées pour Product Studio & Command Center. */
export function catalogSummary(products: AnalyzedProduct[]) {
  const weak = products.filter((p) => p.priority !== "basse").length;
  const has = (code: string) => products.filter((p) => p.issues.some((i) => i.code === code)).length;
  const avg = (sel: (p: AnalyzedProduct) => number) =>
    products.length ? Math.round(products.reduce((s, p) => s + sel(p), 0) / products.length) : 0;
  return {
    total: products.length,
    weak,
    metaMissing: has("meta_desc_missing") + has("meta_title_missing"),
    altMissing: products.reduce((s, p) => s + (p.issues.find((i) => i.code === "alt_missing") ? 1 : 0), 0),
    englishTexts: has("desc_english"),
    typeMissing: has("type_missing"),
    avgSeo: avg((p) => p.scores.seo),
    avgContent: avg((p) => p.scores.content),
    avgConversion: avg((p) => p.scores.conversion),
    avgGlobal: avg((p) => p.scores.global),
    high: products.filter((p) => p.priority === "haute").length,
  };
}

export type CatalogSummary = ReturnType<typeof catalogSummary>;

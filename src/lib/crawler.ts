import * as cheerio from "cheerio";
import type {
  BrandMemory,
  StoreAnalysis,
  StoreScores,
  DashboardMetrics,
  EnglishHit,
  LegalCheck,
  PageAudit,
  ReviewIssue,
} from "./types";
import { detectNiche, NICHES, type NicheKey } from "./niche";

// ──────────────────────────────────────────────────────────────────────────
// Crawler public « vue visiteur ».
//
// À partir de l'URL publique, on fetch le HTML réellement servi et on analyse
// uniquement ce qu'un client / Google voit. Aucune API Shopify n'est utilisée.
// Robuste : timeouts, fallback, jamais de crash (toute erreur est capturée).
// ──────────────────────────────────────────────────────────────────────────

const UA = "Mozilla/5.0 (compatible; OrkestraBot/1.0; +https://orkestra.ai/bot)";
const FETCH_TIMEOUT = 9000;
const MAX_COLLECTIONS = 2;
const MAX_PRODUCTS = 2;

// Termes anglais fréquents sur une boutique FR + correction + impact.
const ENGLISH_TERMS: { re: RegExp; fr: string; impact: string }[] = [
  { re: /\badd to cart\b/i, fr: "Ajouter au panier", impact: "conversion" },
  { re: /\bbuy it now\b/i, fr: "Acheter maintenant", impact: "conversion" },
  { re: /\bcheckout\b/i, fr: "Commander / Paiement", impact: "conversion" },
  { re: /\bcontinue shopping\b/i, fr: "Continuer mes achats", impact: "conversion" },
  { re: /\bshipping calculated at checkout\b/i, fr: "Frais de livraison calculés à la commande", impact: "confiance" },
  { re: /\bfree shipping\b/i, fr: "Livraison gratuite", impact: "confiance" },
  { re: /\bsize guide\b/i, fr: "Guide des tailles", impact: "conversion" },
  { re: /\breturn policy\b/i, fr: "Politique de retour", impact: "Merchant Center" },
  { re: /\bshipping policy\b/i, fr: "Politique de livraison", impact: "Merchant Center" },
  { re: /\bfeatured collection\b/i, fr: "Collection en vedette", impact: "cohérence" },
  { re: /\bfeatured products?\b/i, fr: "Produits en vedette", impact: "cohérence" },
  { re: /\bview all\b/i, fr: "Voir tout", impact: "cohérence" },
  { re: /\bsold out\b/i, fr: "Épuisé", impact: "conversion" },
  { re: /\bon sale\b/i, fr: "En promotion", impact: "cohérence" },
  { re: /\bspecifications?\b/i, fr: "Caractéristiques", impact: "cohérence" },
  { re: /\bdefault title\b/i, fr: "Titre par défaut (variante Shopify non traduite)", impact: "Merchant Center" },
  { re: /\bquick view\b/i, fr: "Aperçu rapide", impact: "cohérence" },
  { re: /\badd to wishlist\b/i, fr: "Ajouter à la liste d'envies", impact: "conversion" },
  { re: /\byour cart is empty\b/i, fr: "Votre panier est vide", impact: "cohérence" },
  { re: /\bsubscribe\b/i, fr: "S'inscrire", impact: "conversion" },
  { re: /\bsearch\b/i, fr: "Rechercher", impact: "cohérence" },
  { re: /\bhome\b/i, fr: "Accueil", impact: "cohérence" },
];

// Pages légales / éléments de confiance recherchés (href + libellé).
const LEGAL_TARGETS: { key: string; label: string; matchers: RegExp; essential: boolean }[] = [
  { key: "contact", label: "Page contact", matchers: /contact/i, essential: true },
  { key: "mentions", label: "Mentions légales", matchers: /mentions-?legales|mentions|legal-notice/i, essential: true },
  { key: "cgv", label: "Conditions générales (CGV)", matchers: /cgv|conditions|terms/i, essential: true },
  { key: "privacy", label: "Politique de confidentialité", matchers: /confidentialite|privacy|donnees-personnelles/i, essential: true },
  { key: "return", label: "Politique de retour", matchers: /retour|remboursement|return|refund/i, essential: true },
  { key: "shipping", label: "Politique de livraison", matchers: /livraison|expedition|shipping|delivery/i, essential: true },
  { key: "faq", label: "FAQ", matchers: /faq|questions|aide|help/i, essential: false },
  { key: "tracking", label: "Suivi de commande", matchers: /suivi|tracking|track/i, essential: false },
  { key: "warranty", label: "Garantie", matchers: /garantie|warranty/i, essential: false },
];

export interface CrawlInputs {
  niche?: string;
  brandName?: string;
  language?: string;
  positioning?: string;
  country?: string;
}

// ── Utilitaires réseau ──────────────────────────────────────────────────────

function normalizeUrl(raw: string): string {
  let u = raw.trim();
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  return u.replace(/\/+$/, "");
}

async function fetchHtml(url: string): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("html")) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// ── Détection texte anglais ─────────────────────────────────────────────────

function detectEnglish(text: string, source: string, seen: Set<string>): EnglishHit[] {
  const hits: EnglishHit[] = [];
  for (const t of ENGLISH_TERMS) {
    const m = text.match(t.re);
    if (m && !seen.has(t.fr)) {
      seen.add(t.fr);
      hits.push({ text: m[0], suggestion: t.fr, source, impact: t.impact });
    }
  }
  return hits;
}

// ── Analyse d'une page ──────────────────────────────────────────────────────

type Doc = cheerio.CheerioAPI;

function visibleText($: Doc): string {
  const clone = cheerio.load($.html());
  clone("script, style, noscript, svg").remove();
  return clone("body").text().replace(/\s+/g, " ").trim();
}

function analyzePage($: Doc, url: string, type: PageAudit["type"], seen: Set<string>): { audit: PageAudit; english: EnglishHit[] } {
  const text = visibleText($);
  const lc = text.toLowerCase();
  const title = ($("title").first().text() || $('meta[property="og:title"]').attr("content") || "").trim();
  const metaDescription = ($('meta[name="description"]').attr("content") || "").trim();
  const h1 = $("h1").first().text().replace(/\s+/g, " ").trim();

  const imagesWithoutAlt = $("img").filter((_, el) => {
    const alt = $(el).attr("alt");
    return !alt || alt.trim() === "";
  }).length;

  const descScope = $(".product__description, .product-description, [class*='description'], .rte, main").first();
  const wordCount = (descScope.text() || text).replace(/\s+/g, " ").trim().split(" ").filter(Boolean).length;

  const english = detectEnglish(text, sourceLabel(url, type), seen);

  return {
    audit: {
      url,
      type,
      title,
      metaDescription,
      h1,
      wordCount,
      hasFaq: /faq|questions fréquentes|foire aux questions/i.test(lc) || $("[class*='accordion'],[class*='faq']").length > 0,
      hasReviews: /avis|témoignage|note des clients|⭐|★/i.test(lc) || $("[class*='review'],[class*='rating'],[class*='testimonial']").length > 0,
      hasShipping: /livraison|expédition|retour|délai/i.test(lc),
      hasBenefits: $("li").length >= 4 || /avantages|bénéfices|pourquoi (nous|choisir)/i.test(lc),
      hasCta: /ajouter au panier|add to cart|acheter|commander/i.test(lc) || $("button, [name='add'], [type='submit']").length > 0,
      imagesWithoutAlt,
      englishCount: english.length,
    },
    english,
  };
}

function sourceLabel(url: string, type: PageAudit["type"]): string {
  if (type === "home") return "Page d'accueil";
  if (type === "collection") return "Collection : " + shortPath(url);
  return "Produit : " + shortPath(url);
}
function shortPath(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).pop() || url);
  } catch {
    return url;
  }
}

// ── Détection de l'ordre des sections de la home ────────────────────────────

function detectHomepageSections($: Doc): string[] {
  const order: string[] = [];
  const push = (label: string) => { if (!order.includes(label)) order.push(label); };

  $(".shopify-section, section, [class*='section']").each((_, el) => {
    const node = $(el);
    const cls = (node.attr("class") || "").toLowerCase();
    const txt = node.text().replace(/\s+/g, " ").trim().toLowerCase().slice(0, 600);
    if (!txt && !cls) return;
    if (/hero|banner|slideshow|image-banner|slider/.test(cls) && !order.length) push("Hero");
    if (/livraison gratuite|paiement sécur|retours? (gratuit|offert)|satisfait|garantie/.test(txt) || /reassurance|trust|icon-?row|guarantee/.test(cls)) push("Réassurance");
    if (/collection-list|featured-collection|list-collections/.test(cls) || /nos collections|catégories|collections/.test(txt)) push("Collections");
    if (/meilleures ventes|best[\s-]?sellers?|coups? de c(?:œur|oeur)|populaires?|tendance/.test(txt)) push("Best-sellers");
    if (/featured-product|product-recommend|product-list/.test(cls) || /nos produits|nouveautés/.test(txt)) push("Produits");
    if (/avis|témoignage|⭐|★|note des clients/.test(txt) || /review|testimonial|rating/.test(cls)) push("Preuve sociale (avis)");
    if (/à propos|notre histoire|qui sommes-?nous|notre marque/.test(txt) || /about|rich-text|story/.test(cls)) push("Storytelling");
    if (/faq|questions fréquentes|foire aux questions/.test(txt) || /faq|accordion/.test(cls)) push("FAQ");
    if (/newsletter|inscrivez-?vous|abonnez-?vous|-?\s?10\s?%/.test(txt) || /newsletter/.test(cls) || node.find("input[type='email']").length) push("Newsletter");
  });
  if ($("footer").length) push("Footer");
  return order;
}

// ── Découverte des liens ────────────────────────────────────────────────────

interface Links {
  collections: { url: string; text: string }[];
  products: { url: string; text: string }[];
  legal: LegalCheck[];
}

function discoverLinks($: Doc, base: string): Links {
  const host = new URL(base).host;
  const collections = new Map<string, string>();
  const products = new Map<string, string>();
  const legalFound = new Map<string, LegalCheck>();

  $("a[href]").each((_, el) => {
    const raw = $(el).attr("href") || "";
    const text = $(el).text().replace(/\s+/g, " ").trim();
    let abs: URL;
    try {
      abs = new URL(raw, base);
    } catch {
      return;
    }
    if (abs.host !== host) return;
    const path = abs.pathname;
    const clean = `${abs.origin}${path}`;

    if (/\/products\//.test(path)) {
      if (!products.has(path)) products.set(path, clean);
    } else if (/\/collections\/[^/]+/.test(path) && !/\/collections\/all\/?$/.test(path)) {
      if (!collections.has(path)) collections.set(path, clean);
    }

    for (const tgt of LEGAL_TARGETS) {
      if (tgt.matchers.test(path) || tgt.matchers.test(text)) {
        if (!legalFound.has(tgt.key)) legalFound.set(tgt.key, { key: tgt.key, label: tgt.label, found: true, url: clean, essential: tgt.essential });
      }
    }
  });

  const collArr = [...collections.entries()].map(([path, url]) => ({ url, text: collTitle(path) }));
  const prodArr = [...products.entries()].map(([path, url]) => ({ url, text: collTitle(path) }));

  const legal: LegalCheck[] = LEGAL_TARGETS.map(
    (t) => legalFound.get(t.key) || { key: t.key, label: t.label, found: false, essential: t.essential }
  );

  return { collections: collArr, products: prodArr, legal };
}

function collTitle(path: string): string {
  const slug = path.split("/").filter(Boolean).pop() || "";
  return decodeURIComponent(slug).replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Crawl principal ─────────────────────────────────────────────────────────

export async function crawlStore(
  rawUrl: string,
  inputs: CrawlInputs = {}
): Promise<{ ok: boolean; error?: string; analysis?: StoreAnalysis; profile?: Partial<BrandMemory> }> {
  const base = normalizeUrl(rawUrl);
  const homeHtml = await fetchHtml(base);
  if (!homeHtml) {
    return { ok: false, error: "Impossible d'accéder à la page d'accueil (site bloqué, anti-bot, ou erreur réseau)." };
  }

  const seen = new Set<string>();
  const notes: string[] = [];
  let partial = false;

  const $home = cheerio.load(homeHtml);
  const homeText = visibleText($home);
  const { audit: homeAudit, english: homeEnglish } = analyzePage($home, base, "home", seen);
  const sections = detectHomepageSections($home);
  const links = discoverLinks($home, base);

  const pages: PageAudit[] = [homeAudit];
  const englishTexts: EnglishHit[] = [...homeEnglish];

  // Échantillon de collections
  for (const c of links.collections.slice(0, MAX_COLLECTIONS)) {
    const html = await fetchHtml(c.url);
    if (!html) { partial = true; notes.push(`Collection non analysée : ${c.text}`); continue; }
    const $c = cheerio.load(html);
    const { audit, english } = analyzePage($c, c.url, "collection", seen);
    pages.push(audit);
    englishTexts.push(...english);
  }

  // Échantillon de produits
  for (const p of links.products.slice(0, MAX_PRODUCTS)) {
    const html = await fetchHtml(p.url);
    if (!html) { partial = true; notes.push(`Produit non analysé : ${p.text}`); continue; }
    const $p = cheerio.load(html);
    const { audit, english } = analyzePage($p, p.url, "product", seen);
    pages.push(audit);
    englishTexts.push(...english);
  }

  if (links.collections.length === 0) notes.push("Aucune collection publique détectée.");
  if (links.products.length === 0) notes.push("Aucune page produit publique détectée.");

  const niche = detectNiche(`${inputs.niche ?? ""} ${inputs.brandName ?? ""} ${homeAudit.title ?? ""} ${homeText.slice(0, 400)} ${base}`);
  const analysis = assembleAnalysis({
    base, niche, inputs, pages, englishTexts, legal: links.legal, sections,
    collectionsFound: links.collections.length, productsFound: links.products.length,
    partial, notes, homeText,
  });
  const profile = assembleProfile({ niche, inputs, links, analysis });

  return { ok: true, analysis, profile };
}

// ── Construction de l'analyse à partir des données crawlées ─────────────────

function clamp(n: number, min = 20, max = 97): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

interface AssembleArgs {
  base: string;
  niche: NicheKey;
  inputs: CrawlInputs;
  pages: PageAudit[];
  englishTexts: EnglishHit[];
  legal: LegalCheck[];
  sections: string[];
  collectionsFound: number;
  productsFound: number;
  partial: boolean;
  notes: string[];
  homeText: string;
}

function assembleAnalysis(a: AssembleArgs): StoreAnalysis {
  const preset = NICHES[a.niche];
  const products = a.pages.filter((p) => p.type === "product");
  const collections = a.pages.filter((p) => p.type === "collection");
  const lang = a.inputs.language || "français";

  const essentialLegal = a.legal.filter((l) => l.essential);
  const legalFoundRatio = essentialLegal.length ? essentialLegal.filter((l) => l.found).length / essentialLegal.length : 0;
  const contactFound = a.legal.find((l) => l.key === "contact")?.found ?? false;
  const missingEssential = essentialLegal.filter((l) => !l.found);
  const englishCount = a.englishTexts.length;

  const metaPresent = a.pages.filter((p) => p.metaDescription && p.metaDescription.length > 10).length;
  const metaRatio = a.pages.length ? metaPresent / a.pages.length : 0;
  const h1Ratio = a.pages.length ? a.pages.filter((p) => p.h1).length / a.pages.length : 0;
  const avgProductWords = products.length ? products.reduce((s, p) => s + (p.wordCount || 0), 0) / products.length : 0;
  const convSignals = products.length
    ? products.reduce((s, p) => s + (p.hasShipping ? 1 : 0) + (p.hasReviews ? 1 : 0) + (p.hasBenefits ? 1 : 0) + (p.hasCta ? 1 : 0), 0) / (products.length * 4)
    : 0.4;
  const homeHasReassurance = a.sections.includes("Réassurance");
  const collectionsWithSeo = collections.filter((c) => (c.wordCount || 0) > 120).length;

  const scores: StoreScores = {
    seo: clamp(45 + metaRatio * 30 + h1Ratio * 15 - Math.min(10, englishCount)),
    trust: clamp(35 + legalFoundRatio * 55 + (contactFound ? 8 : 0) - (englishCount > 5 ? 10 : 0)),
    conversion: clamp(45 + convSignals * 45 + (homeHasReassurance ? 10 : -5)),
    merchant: clamp(100 - missingEssential.length * 12 - Math.min(30, englishCount * 3)),
    content: clamp(45 + (avgProductWords >= 150 ? 25 : avgProductWords >= 80 ? 12 : 0) + (collectionsWithSeo ? 12 : -5)),
  };

  const imagesWithoutAlt = a.pages.reduce((s, p) => s + (p.imagesWithoutAlt || 0), 0);
  const metaMissing = a.pages.filter((p) => !p.metaDescription || p.metaDescription.length <= 10).length;
  const collectionsWithoutSeo = collections.filter((c) => (c.wordCount || 0) <= 120).length;

  const metrics: DashboardMetrics = {
    productsToOptimize: a.productsFound || products.length,
    collectionsWithoutSeo: collectionsWithoutSeo || (a.collectionsFound && collections.length === 0 ? a.collectionsFound : 0),
    englishTextsDetected: englishCount,
    missingMetaDescriptions: metaMissing,
    imagesWithoutAlt,
  };

  const issues = buildIssues(a, { missingEssential, englishCount, collectionsWithoutSeo, products, homeHasReassurance, metaMissing });

  return {
    scores,
    metrics,
    issues,
    homepageOrder: preset.homepageOrder,
    productPageStructure: preset.productPageStructure,
    confidence: a.partial
      ? "vue publique partielle"
      : `vue publique réelle (${a.pages.length} page${a.pages.length > 1 ? "s" : ""})`,
    lastScanAt: new Date().toISOString(),
    source: "public",
    pagesAnalyzed: a.pages.length,
    productsFound: a.productsFound,
    collectionsFound: a.collectionsFound,
    englishTexts: a.englishTexts,
    legalPages: a.legal,
    homepageSections: a.sections,
    pages: a.pages,
    partial: a.partial,
    notes: a.notes,
  };
}

function buildIssues(
  a: AssembleArgs,
  d: { missingEssential: LegalCheck[]; englishCount: number; collectionsWithoutSeo: number; products: PageAudit[]; homeHasReassurance: boolean; metaMissing: number }
): ReviewIssue[] {
  const issues: ReviewIssue[] = [];

  if (d.englishCount > 0) {
    const terms = a.englishTexts.slice(0, 4).map((e) => `« ${e.text} » → ${e.suggestion}`).join(" ; ");
    issues.push({
      area: `Textes en anglais détectés (${d.englishCount})`,
      severity: d.englishCount >= 3 ? "critique" : "important",
      explanation: `Des libellés en anglais apparaissent sur une boutique en ${a.inputs.language || "français"} : ${terms}.`,
      impact: "Confiance dégradée, conversion réduite et risque de signal négatif Merchant Center.",
      fix: "Traduire ces libellés via l'éditeur de langue Shopify (Paramètres → Langues → Modifier).",
      module: "merchant",
    });
  }

  for (const l of d.missingEssential) {
    issues.push({
      area: `Manquant : ${l.label}`,
      severity: ["return", "shipping", "mentions"].includes(l.key) ? "critique" : "important",
      explanation: `Aucun lien vers « ${l.label} » n'a été détecté publiquement.`,
      impact: "Frein à l'achat et cause fréquente de refus/suspension Merchant Center.",
      fix: `Créer la page « ${l.label} » et la lier dans le menu et le footer.`,
      module: "merchant",
    });
  }

  if (d.collectionsWithoutSeo > 0) {
    issues.push({
      area: "Pages collections sans texte SEO",
      severity: "important",
      explanation: `${d.collectionsWithoutSeo} collection(s) analysée(s) ont peu ou pas de contenu SEO.`,
      impact: "Faible visibilité sur des requêtes commerciales à fort volume.",
      fix: "Générer 150–300 mots + FAQ par collection dans le SEO Studio.",
      module: "seo",
    });
  }

  const weakProducts = d.products.filter((p) => !p.hasFaq || !p.hasReviews || (p.wordCount || 0) < 120);
  if (weakProducts.length > 0 || d.products.length === 0) {
    issues.push({
      area: "Fiches produits à renforcer",
      severity: "important",
      explanation: "Descriptions courtes, FAQ ou avis souvent absents sur les fiches analysées.",
      impact: "Conversion et longue traîne sous-exploitées.",
      fix: "Générer des fiches SEO complètes (200+ mots, bénéfices, FAQ, alt text) dans le SEO Studio.",
      module: "seo",
    });
  }

  if (d.metaMissing > 0) {
    issues.push({
      area: "Meta descriptions manquantes",
      severity: "important",
      explanation: `${d.metaMissing} page(s) analysée(s) n'ont pas de meta description.`,
      impact: "Taux de clic (CTR) réduit dans les résultats Google.",
      fix: "Générer une meta unique par page (≤ 155 car.) avec un CTA dans le SEO Studio.",
      module: "seo",
    });
  }

  if (!d.homeHasReassurance) {
    issues.push({
      area: "Réassurance absente de la page d'accueil",
      severity: "important",
      explanation: "Aucun bloc de réassurance (livraison, paiement, retours) n'a été détecté en page d'accueil.",
      impact: "Conversion plus faible, surtout sur mobile.",
      fix: "Ajouter un bandeau de réassurance via le Section Builder et le remonter haut dans la home.",
      module: "sections",
    });
  }

  const order = { critique: 0, important: 1, mineur: 2 } as const;
  return issues.sort((x, y) => order[x.severity] - order[y.severity]).slice(0, 9);
}

function assembleProfile(p: { niche: NicheKey; inputs: CrawlInputs; links: Links; analysis: StoreAnalysis }): Partial<BrandMemory> {
  const preset = NICHES[p.niche];
  const realCollections = p.links.collections.map((c) => c.text).filter(Boolean).slice(0, 8);
  const name = p.inputs.brandName?.trim() || "Cette boutique";
  const foundLegal = (p.analysis.legalPages || []).filter((l) => l.found).map((l) => l.label);

  const understanding =
    `${name} : scan public réel de ${p.analysis.pagesAnalyzed} page(s). ` +
    `${p.analysis.collectionsFound ?? 0} collection(s) et ${p.analysis.productsFound ?? 0} produit(s) visibles détectés. ` +
    `${p.analysis.englishTexts?.length ?? 0} texte(s) anglais repéré(s). ` +
    `Pages de confiance trouvées : ${foundLegal.length ? foundLegal.join(", ") : "aucune détectée"}. ` +
    `Niche estimée : ${p.inputs.niche?.trim() || preset.label}. Opportunités prioritaires : SEO collections/fiches, meta, FAQ, maillage interne et réassurance.`;

  return {
    niche: p.inputs.niche?.trim() || preset.label,
    collections: realCollections.length ? realCollections : preset.collections,
    productTypes: preset.productTypes,
    primaryKeywords: preset.primaryKeywords,
    secondaryKeywords: preset.secondaryKeywords,
    competitors: preset.competitors,
    writingStyle: `${cap(p.inputs.positioning || "premium")}, clair, orienté bénéfices`,
    seoRules: [
      "Cibler des requêtes adaptées à la niche et à la langue du site.",
      "Une meta unique par collection et par fiche produit.",
      "Traduire tous les libellés anglais résiduels.",
    ],
    styleRules: ["Ton cohérent avec le positionnement.", "Mettre en avant les bénéfices concrets."],
    understanding,
  };
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

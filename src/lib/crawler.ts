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
// Échantillon analysé EN DÉTAIL (fetch de page). La découverte du catalogue
// total se fait via sitemap/products.json (comptage sans tout télécharger).
const DETAIL_PRODUCTS = 10;
const DETAIL_COLLECTIONS = 6;
const MAX_SITEMAP_CHILDREN = 8;
const MAX_PRODUCTS_JSON_PAGES = 4; // 4 × 250 = 1000 max

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

/** Fetch générique (XML / JSON / texte). */
async function fetchText(url: string, accept = "*/*"): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: accept },
      redirect: "follow",
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// ── Découverte du catalogue (sitemap + products.json) ───────────────────────

export interface CatalogData {
  products: string[];
  collections: string[];
  pages: string[];
  productTypes: string[];
  source: string;
}

function extractLocs(xml: string): string[] {
  const locs: string[] = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) locs.push(m[1].trim());
  return locs;
}

/** Découverte via le sitemap Shopify (index + sitemaps enfants). */
async function discoverViaSitemap(base: string): Promise<{ products: string[]; collections: string[]; pages: string[] } | null> {
  const root = await fetchText(`${base}/sitemap.xml`, "application/xml,text/xml");
  if (!root) return null;
  const locs = extractLocs(root);
  if (!locs.length) return null;

  const products = new Set<string>();
  const collections = new Set<string>();
  const pages = new Set<string>();

  // Si le sitemap racine pointe vers des sitemaps enfants (.xml), on les suit.
  const childSitemaps = locs.filter((l) => /\.xml(\?|$)/i.test(l));
  const classify = (url: string) => {
    if (/\/products\//.test(url)) products.add(url);
    else if (/\/collections\//.test(url) && !/\/collections\/all\/?$/.test(url)) collections.add(url);
    else if (/\/pages\//.test(url)) pages.add(url);
  };

  if (childSitemaps.length) {
    const relevant = childSitemaps.filter((l) => /product|collection|page/i.test(l)).slice(0, MAX_SITEMAP_CHILDREN);
    for (const child of relevant) {
      const xml = await fetchText(child, "application/xml,text/xml");
      if (!xml) continue;
      for (const u of extractLocs(xml)) classify(u);
    }
  } else {
    for (const u of locs) classify(u);
  }

  if (!products.size && !collections.size) return null;
  return { products: [...products], collections: [...collections], pages: [...pages] };
}

interface ProductJson {
  title?: string;
  handle?: string;
  product_type?: string;
  vendor?: string;
  tags?: string[] | string;
  body_html?: string;
}

/** Découverte via /products.json (fallback / enrichissement). */
async function discoverViaProductsJson(base: string): Promise<{ urls: string[]; types: string[] } | null> {
  const all: ProductJson[] = [];
  for (let page = 1; page <= MAX_PRODUCTS_JSON_PAGES; page++) {
    const txt = await fetchText(`${base}/products.json?limit=250&page=${page}`, "application/json");
    if (!txt) break;
    try {
      const data = JSON.parse(txt) as { products?: ProductJson[] };
      const batch = data.products || [];
      if (!batch.length) break;
      all.push(...batch);
      if (batch.length < 250) break;
    } catch {
      break;
    }
  }
  if (!all.length) return null;
  const urls = all.filter((p) => p.handle).map((p) => `${base}/products/${p.handle}`);
  const types = [...new Set(all.map((p) => (p.product_type || "").trim()).filter(Boolean))].slice(0, 8);
  return { urls, types };
}

async function discoverCatalog(
  base: string,
  homeProducts: string[],
  homeCollections: string[]
): Promise<CatalogData> {
  const products = new Set<string>(homeProducts);
  const collections = new Set<string>(homeCollections);
  const pages = new Set<string>();
  let productTypes: string[] = [];
  const sources: string[] = [];

  const sm = await discoverViaSitemap(base);
  if (sm) {
    sm.products.forEach((u) => products.add(u));
    sm.collections.forEach((u) => collections.add(u));
    sm.pages.forEach((u) => pages.add(u));
    if (sm.products.length) sources.push("sitemap");
  }

  const pj = await discoverViaProductsJson(base);
  if (pj) {
    pj.urls.forEach((u) => products.add(u));
    productTypes = pj.types;
    sources.push("products.json");
  }

  let source = sources.length ? sources.join(" + ") : "crawl home";
  if (!sm && !pj && products.size <= homeProducts.length) source = "crawl home (partiel)";

  return {
    products: [...products],
    collections: [...collections],
    pages: [...pages],
    productTypes,
    source,
  };
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
  const h1Count = $("h1").length;
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
      h1Count,
      titleLength: title.length,
      metaLength: metaDescription.length,
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

  // ── Découverte du catalogue complet (sitemap + products.json + liens home) ──
  const catalog = await discoverCatalog(
    base,
    links.products.map((p) => p.url),
    links.collections.map((c) => c.url)
  );

  // Détection des pages légales aussi via les URLs du sitemap.
  const legal = mergeLegal(links.legal, catalog.pages);

  const productsFound = catalog.products.length;
  const collectionsFound = catalog.collections.length;
  const pagesFound = catalog.pages.length;

  const pages: PageAudit[] = [homeAudit];
  const englishTexts: EnglishHit[] = [...homeEnglish];

  // Échantillon de collections analysées EN DÉTAIL.
  let collectionsAnalyzed = 0;
  for (const url of catalog.collections.slice(0, DETAIL_COLLECTIONS)) {
    const html = await fetchHtml(url);
    if (!html) { partial = true; continue; }
    const $c = cheerio.load(html);
    const { audit, english } = analyzePage($c, url, "collection", seen);
    pages.push(audit);
    englishTexts.push(...english);
    collectionsAnalyzed++;
  }

  // Échantillon de produits analysés EN DÉTAIL.
  let productsAnalyzed = 0;
  for (const url of catalog.products.slice(0, DETAIL_PRODUCTS)) {
    const html = await fetchHtml(url);
    if (!html) { partial = true; continue; }
    const $p = cheerio.load(html);
    const { audit, english } = analyzePage($p, url, "product", seen);
    pages.push(audit);
    englishTexts.push(...english);
    productsAnalyzed++;
  }

  if (collectionsFound === 0) notes.push("Aucune collection publique détectée (sitemap/products.json indisponibles).");
  if (productsFound === 0) notes.push("Aucun produit public détecté (sitemap/products.json indisponibles).");
  if (productsFound > 0 && productsAnalyzed < Math.min(DETAIL_PRODUCTS, productsFound)) partial = true;

  const niche = detectNiche(
    `${inputs.niche ?? ""} ${inputs.brandName ?? ""} ${homeAudit.title ?? ""} ${catalog.productTypes.join(" ")} ${homeText.slice(0, 400)} ${base}`
  );
  const analysis = assembleAnalysis({
    base, niche, inputs, pages, englishTexts, legal, sections,
    productsFound, productsAnalyzed, collectionsFound, collectionsAnalyzed, pagesFound,
    catalogSource: catalog.source, productTypes: catalog.productTypes,
    partial, notes, homeText,
  });
  const profile = assembleProfile({ niche, inputs, catalog, analysis });

  return { ok: true, analysis, profile };
}

/** Marque les pages légales trouvées via le sitemap en plus des liens home. */
function mergeLegal(homeLegal: LegalCheck[], sitemapPages: string[]): LegalCheck[] {
  return homeLegal.map((l) => {
    if (l.found) return l;
    const tgt = LEGAL_TARGETS.find((t) => t.key === l.key);
    if (!tgt) return l;
    const hit = sitemapPages.find((u) => tgt.matchers.test(u));
    return hit ? { ...l, found: true, url: hit } : l;
  });
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
  productsFound: number;
  productsAnalyzed: number;
  collectionsFound: number;
  collectionsAnalyzed: number;
  pagesFound: number;
  catalogSource: string;
  productTypes: string[];
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

  // Métriques : on extrapole les signaux de l'échantillon au catalogue trouvé.
  const collWeakRatio = collections.length ? collectionsWithoutSeo / collections.length : 1;
  const metrics: DashboardMetrics = {
    productsToOptimize: a.productsFound || products.length,
    collectionsWithoutSeo: a.collectionsFound ? Math.round(a.collectionsFound * collWeakRatio) : collectionsWithoutSeo,
    englishTextsDetected: englishCount,
    missingMetaDescriptions: metaMissing,
    imagesWithoutAlt,
  };

  // Couverture du scan = part du catalogue analysée en détail.
  const coverageRatio = a.productsFound ? a.productsAnalyzed / a.productsFound : 1;
  const coverage: StoreAnalysis["coverage"] = coverageRatio >= 0.25 ? "élevée" : coverageRatio >= 0.05 ? "moyenne" : "faible";

  const issues = buildIssues(a, { missingEssential, englishCount, collectionsWithoutSeo, products, homeHasReassurance, metaMissing });
  const synthesis = buildSynthesis(a, scores, issues, { englishCount, coverage });

  const confidence =
    `${coverage === "élevée" ? "élevée" : coverage === "moyenne" ? "moyenne" : "faible"} · ` +
    `${a.productsAnalyzed}/${a.productsFound} produits analysés · source ${a.catalogSource}`;

  return {
    scores,
    metrics,
    issues,
    homepageOrder: preset.homepageOrder,
    productPageStructure: preset.productPageStructure,
    confidence,
    lastScanAt: new Date().toISOString(),
    source: "public",
    pagesAnalyzed: a.pages.length,
    productsFound: a.productsFound,
    productsAnalyzed: a.productsAnalyzed,
    collectionsFound: a.collectionsFound,
    collectionsAnalyzed: a.collectionsAnalyzed,
    pagesFound: a.pagesFound,
    coverage,
    catalogSource: a.catalogSource,
    productTypesDetected: a.productTypes,
    englishTexts: a.englishTexts,
    legalPages: a.legal,
    homepageSections: a.sections,
    pages: a.pages,
    synthesis,
    partial: a.partial,
    notes: a.notes,
  };
}

// ── Synthèse exécutive ──────────────────────────────────────────────────────

function buildSynthesis(
  a: AssembleArgs,
  scores: StoreScores,
  issues: ReviewIssue[],
  d: { englishCount: number; coverage: string }
): import("./types").ScanSynthesis {
  const preset = NICHES[a.niche];
  const good: string[] = [];
  if (scores.seo >= 65) good.push("Base SEO correcte sur les pages analysées.");
  if (scores.trust >= 65) good.push("Bons signaux de confiance (pages légales présentes).");
  if (scores.conversion >= 65) good.push("Parcours d'achat plutôt clair (CTA / réassurance).");
  if (a.productsFound > 50) good.push(`Catalogue riche : ${a.productsFound} produits exposés publiquement.`);
  if (!good.length) good.push("Boutique en ligne et explorable publiquement — bonne base de départ.");

  const blocking = issues.filter((i) => i.severity === "critique").map((i) => i.area);
  if (!blocking.length) blocking.push("Aucun blocage critique détecté, surtout des optimisations.");

  const priorities = issues.slice(0, 5).map((i) => `${i.area} — ${i.fix}`);

  const quickWins: string[] = [];
  if (d.englishCount > 0) quickWins.push(`Traduire ${d.englishCount} libellé(s) anglais (éditeur de langue Shopify).`);
  quickWins.push("Réécrire les meta titles/descriptions manquantes ou faibles.");
  quickWins.push(`Ajouter 150–300 mots de texte SEO sur les collections principales (${preset.collections.slice(0, 2).join(", ")}).`);
  if (!a.sections.includes("Réassurance")) quickWins.push("Ajouter un bandeau de réassurance en haut de la home.");

  const plan7 = [
    "J1–2 : corriger les textes anglais et les pages légales manquantes.",
    "J3–4 : réécrire les meta des collections principales + home.",
    "J5–7 : enrichir 5 fiches produits best-sellers (bénéfices, FAQ, alt text).",
  ];
  const plan30 = [
    "Semaine 1 : quick wins (langue, légal, meta).",
    `Semaine 2 : contenu SEO + FAQ sur les collections (${preset.collections.slice(0, 3).join(", ")}).`,
    "Semaine 3 : optimiser 15–20 fiches produits prioritaires.",
    "Semaine 4 : maillage interne + cluster blog (guides d'achat) + suivi des positions.",
  ];

  const modules = [...new Set(issues.map((i) => moduleLabel(i.module)))];

  return { good, blocking, priorities, quickWins, plan7, plan30, modules };
}

function moduleLabel(m: ReviewIssue["module"]): string {
  const map: Record<string, string> = { seo: "SEO Studio", merchant: "Merchant Shield", sections: "Section Builder", council: "AI Council", memory: "Mémoire boutique" };
  return map[m] || "AI Council";
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

  // ── SEO technique on-page (title, meta length, H1) ──
  const home = a.pages.find((p) => p.type === "home");
  if (home) {
    if (!home.title || (home.titleLength ?? 0) < 15 || (home.titleLength ?? 0) > 65) {
      issues.push({
        area: "Title de la page d'accueil",
        severity: "important",
        explanation: !home.title ? "Aucun <title> détecté." : `Le title fait ${home.titleLength} caractères (idéal 30–60).`,
        impact: "Mauvais affichage dans Google et CTR réduit.",
        fix: "Rédiger un title de 50–60 caractères avec le mot-clé principal + la marque.",
        module: "seo",
      });
    }
    if ((home.metaLength ?? 0) > 0 && ((home.metaLength ?? 0) < 70 || (home.metaLength ?? 0) > 160)) {
      issues.push({
        area: "Meta description de la home",
        severity: "mineur",
        explanation: `La meta description fait ${home.metaLength} caractères (idéal 120–155).`,
        impact: "Extrait Google tronqué ou peu incitatif.",
        fix: "Réécrire une meta de 120–155 caractères avec un bénéfice + un CTA.",
        module: "seo",
      });
    }
    if ((home.h1Count ?? 0) === 0) {
      issues.push({
        area: "H1 absent en page d'accueil",
        severity: "important",
        explanation: "Aucune balise H1 détectée sur la home.",
        impact: "Structure sémantique faible pour le SEO.",
        fix: "Ajouter un H1 unique et descriptif (promesse + niche).",
        module: "seo",
      });
    } else if ((home.h1Count ?? 0) > 1) {
      issues.push({
        area: "H1 multiples en page d'accueil",
        severity: "mineur",
        explanation: `${home.h1Count} balises H1 détectées (une seule recommandée).`,
        impact: "Dilution sémantique du titre principal.",
        fix: "Conserver un seul H1 et passer les autres en H2.",
        module: "seo",
      });
    }
  }

  // Maillage / contenu informationnel (longue traîne)
  if (a.productsFound > 20) {
    issues.push({
      area: "Contenu informationnel / blog",
      severity: "mineur",
      explanation: "Peu de contenu éditorial (guides d'achat) pour soutenir la longue traîne.",
      impact: "Opportunités de trafic informationnel non captées.",
      fix: "Créer un cluster blog (« comment choisir », « guide ») relié aux collections via le SEO Studio.",
      module: "seo",
    });
  }

  const order = { critique: 0, important: 1, mineur: 2 } as const;
  return issues.sort((x, y) => order[x.severity] - order[y.severity]).slice(0, 12);
}

function assembleProfile(p: { niche: NicheKey; inputs: CrawlInputs; catalog: CatalogData; analysis: StoreAnalysis }): Partial<BrandMemory> {
  const preset = NICHES[p.niche];
  const realCollections = [...new Set(p.catalog.collections.map((u) => collTitle(new URL(u).pathname)))].filter(Boolean).slice(0, 10);
  const realTypes = p.catalog.productTypes.filter(Boolean).slice(0, 8);
  const name = p.inputs.brandName?.trim() || "Cette boutique";
  const foundLegal = (p.analysis.legalPages || []).filter((l) => l.found).map((l) => l.label);

  const understanding =
    `${name} : scan public réel (source ${p.analysis.catalogSource}). ` +
    `${p.analysis.productsFound ?? 0} produit(s) trouvés (${p.analysis.productsAnalyzed ?? 0} analysés en détail), ` +
    `${p.analysis.collectionsFound ?? 0} collection(s) trouvées (${p.analysis.collectionsAnalyzed ?? 0} analysées). ` +
    `Couverture : ${p.analysis.coverage}. ${p.analysis.englishTexts?.length ?? 0} texte(s) anglais repéré(s). ` +
    `Pages de confiance trouvées : ${foundLegal.length ? foundLegal.join(", ") : "aucune détectée"}. ` +
    `Niche estimée : ${p.inputs.niche?.trim() || preset.label}. Opportunités prioritaires : SEO collections/fiches, meta, FAQ, maillage interne et réassurance.`;

  return {
    niche: p.inputs.niche?.trim() || preset.label,
    collections: realCollections.length ? realCollections : preset.collections,
    productTypes: realTypes.length ? realTypes : preset.productTypes,
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

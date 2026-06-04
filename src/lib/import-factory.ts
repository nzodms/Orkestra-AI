// ──────────────────────────────────────────────────────────────────────────
// Import Factory — transformation de catalogues produits (CSV) via OpenAI.
//
// Module PUR (aucune dépendance serveur) : parsing/sérialisation CSV, détection
// des colonnes Shopify, regroupement par produit (variantes + images), presets,
// règles de transformation et construction des prompts OpenAI.
// La transformation réelle est faite côté serveur (api/import) — JAMAIS de mock
// qui prétendrait transformer un vrai catalogue.
// ──────────────────────────────────────────────────────────────────────────

// ── CSV : parse / serialize ─────────────────────────────────────────────────

/** Détecte le séparateur le plus probable (`,` ou `;`). */
export function detectDelimiter(text: string): "," | ";" {
  const firstLine = text.slice(0, text.indexOf("\n") >= 0 ? text.indexOf("\n") : text.length);
  const commas = (firstLine.match(/,/g) || []).length;
  const semis = (firstLine.match(/;/g) || []).length;
  return semis > commas ? ";" : ",";
}

/** Parse un CSV (RFC4180 : guillemets, virgules et retours dans les champs). */
export function parseCsv(input: string, delimiter?: string): string[][] {
  let text = input;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // BOM
  const delim = delimiter || detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === delim) { row.push(field); field = ""; i++; continue; }
    if (c === "\r") { i++; continue; }
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
    field += c; i++;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0].trim() !== ""));
}

/** Sérialise des lignes en CSV Shopify (séparateur virgule, échappement standard). */
export function serializeCsv(headers: string[], rows: string[][]): string {
  const esc = (v: string) => {
    const s = v ?? "";
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(esc).join(",")];
  for (const r of rows) lines.push(r.map(esc).join(","));
  return lines.join("\r\n");
}

// ── Détection des colonnes Shopify ──────────────────────────────────────────

export type ShopifyField =
  | "Handle" | "Title" | "Body" | "Vendor" | "Category" | "Type" | "Tags" | "Published" | "Collection"
  | "Option1Name" | "Option1Value" | "Option2Name" | "Option2Value" | "Option3Name" | "Option3Value"
  | "VariantSKU" | "VariantPrice" | "VariantCompareAtPrice" | "VariantInventoryQty"
  | "ImageSrc" | "ImagePosition" | "ImageAlt" | "VariantImage" | "SeoTitle" | "SeoDescription" | "Status";

const HEADER_MAP: Record<string, ShopifyField> = {
  "handle": "Handle", "title": "Title", "body (html)": "Body", "body html": "Body", "body": "Body",
  "vendor": "Vendor", "product category": "Category", "type": "Type", "product type": "Type",
  "tags": "Tags", "published": "Published",
  "option1 name": "Option1Name", "option1 value": "Option1Value",
  "option2 name": "Option2Name", "option2 value": "Option2Value",
  "option3 name": "Option3Name", "option3 value": "Option3Value",
  "variant sku": "VariantSKU", "variant price": "VariantPrice",
  "variant compare at price": "VariantCompareAtPrice", "variant inventory qty": "VariantInventoryQty",
  "image src": "ImageSrc", "image position": "ImagePosition", "image alt text": "ImageAlt",
  "variant image": "VariantImage",
  "seo title": "SeoTitle", "seo description": "SeoDescription", "status": "Status",
};

// Ordre canonique des colonnes d'un CSV produit Shopify (export propre).
const SHOPIFY_ORDER: { field: ShopifyField; header: string }[] = [
  { field: "Handle", header: "Handle" },
  { field: "Title", header: "Title" },
  { field: "Body", header: "Body (HTML)" },
  { field: "Vendor", header: "Vendor" },
  { field: "Category", header: "Product Category" },
  { field: "Type", header: "Type" },
  { field: "Tags", header: "Tags" },
  { field: "Published", header: "Published" },
  { field: "Option1Name", header: "Option1 Name" },
  { field: "Option1Value", header: "Option1 Value" },
  { field: "Option2Name", header: "Option2 Name" },
  { field: "Option2Value", header: "Option2 Value" },
  { field: "Option3Name", header: "Option3 Name" },
  { field: "Option3Value", header: "Option3 Value" },
  { field: "VariantSKU", header: "Variant SKU" },
  { field: "VariantInventoryQty", header: "Variant Inventory Qty" },
  { field: "VariantPrice", header: "Variant Price" },
  { field: "VariantCompareAtPrice", header: "Variant Compare At Price" },
  { field: "ImageSrc", header: "Image Src" },
  { field: "ImagePosition", header: "Image Position" },
  { field: "ImageAlt", header: "Image Alt Text" },
  { field: "VariantImage", header: "Variant Image" },
  { field: "SeoTitle", header: "SEO Title" },
  { field: "SeoDescription", header: "SEO Description" },
  { field: "Status", header: "Status" },
];
const HEADER_OF = Object.fromEntries(SHOPIFY_ORDER.map((o) => [o.field, o.header])) as Record<ShopifyField, string>;
const ALL_FIELDS: ShopifyField[] = SHOPIFY_ORDER.map((o) => o.field);

/** Une catégorie Shopify n'est fiable que si elle ressemble à la taxonomie officielle. */
function isValidShopifyCategory(s: string): boolean {
  const v = (s || "").trim();
  return v.includes(">") || /^gid:\/\//.test(v) || /^[a-z]{2}-\d/i.test(v);
}

export interface DetectedColumns {
  isShopify: boolean;
  map: Partial<Record<ShopifyField, number>>;
  unknown: string[];
  recognized: number;
}

const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ");

export function detectColumns(headers: string[]): DetectedColumns {
  const map: Partial<Record<ShopifyField, number>> = {};
  const unknown: string[] = [];
  headers.forEach((h, i) => {
    const f = HEADER_MAP[norm(h)];
    if (f && map[f] === undefined) map[f] = i;
    else if (!f) unknown.push(h);
  });
  const recognized = Object.keys(map).length;
  const isShopify = map.Handle !== undefined && map.Title !== undefined && recognized >= 4;
  return { map, unknown, recognized, isShopify };
}

// ── Mapping manuel (CSV fournisseur / concurrent / non-Shopify) ──────────────

/** Cible de mapping affichée à l'utilisateur (ordre + libellé). */
export const MAP_TARGETS: { field: ShopifyField; label: string; required?: boolean }[] = [
  { field: "Title", label: "Titre produit", required: true },
  { field: "Body", label: "Description" },
  { field: "ImageSrc", label: "Image (URL)" },
  { field: "ImageAlt", label: "Alt text image" },
  { field: "VariantPrice", label: "Prix" },
  { field: "VariantSKU", label: "SKU / référence" },
  { field: "Handle", label: "Handle (identifiant / URL)" },
  { field: "Vendor", label: "Vendor / marque" },
  { field: "Type", label: "Type produit" },
  { field: "Tags", label: "Tags" },
  { field: "Collection", label: "Collection (source)" },
  { field: "Option1Name", label: "Option 1 — nom" },
  { field: "Option1Value", label: "Option 1 / Taille / Variante" },
  { field: "Option2Name", label: "Option 2 — nom" },
  { field: "Option2Value", label: "Option 2 / Couleur" },
  { field: "SeoTitle", label: "Meta title" },
  { field: "SeoDescription", label: "Meta description" },
];

const normKey = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ").normalize("NFD").replace(/[̀-ͯ]/g, "");

// Synonymes (accent-insensibles) pour la détection automatique du mapping.
const SYNONYMS: Record<string, ShopifyField> = {
  title: "Title", name: "Title", "product name": "Title", "product_name": "Title", nom: "Title", titre: "Title", "product title": "Title", libelle: "Title", designation: "Title",
  "body (html)": "Body", "body html": "Body", body: "Body", description: "Body", desc: "Body", details: "Body", "long description": "Body", "product description": "Body", descriptif: "Body",
  "image src": "ImageSrc", image: "ImageSrc", "image url": "ImageSrc", "image link": "ImageSrc", img: "ImageSrc", photo: "ImageSrc", picture: "ImageSrc", images: "ImageSrc", "main image": "ImageSrc", "image 1": "ImageSrc",
  "image alt text": "ImageAlt", alt: "ImageAlt", "alt text": "ImageAlt", "image alt": "ImageAlt",
  "variant price": "VariantPrice", price: "VariantPrice", prix: "VariantPrice", "sale price": "VariantPrice", "unit price": "VariantPrice", tarif: "VariantPrice",
  "variant sku": "VariantSKU", sku: "VariantSKU", reference: "VariantSKU", ref: "VariantSKU", code: "VariantSKU", ean: "VariantSKU", barcode: "VariantSKU", "code produit": "VariantSKU",
  handle: "Handle", slug: "Handle", "url handle": "Handle", permalink: "Handle",
  vendor: "Vendor", brand: "Vendor", marque: "Vendor", manufacturer: "Vendor", fournisseur: "Vendor", supplier: "Vendor",
  type: "Type", "product type": "Type", "product_type": "Type", "type produit": "Type",
  tags: "Tags", tag: "Tags", keywords: "Tags", "mots cles": "Tags",
  collection: "Collection", collections: "Collection", category: "Collection", categorie: "Collection", "product category": "Collection", rayon: "Collection", famille: "Collection",
  "option1 name": "Option1Name", "option1 value": "Option1Value", size: "Option1Value", taille: "Option1Value", variant: "Option1Value", variante: "Option1Value", dimension: "Option1Value",
  "option2 name": "Option2Name", "option2 value": "Option2Value", color: "Option2Value", colour: "Option2Value", couleur: "Option2Value",
  "seo title": "SeoTitle", "meta title": "SeoTitle", "page title": "SeoTitle",
  "seo description": "SeoDescription", "meta description": "SeoDescription",
};

/** Détection automatique « best guess » du mapping (point de départ, corrigeable). */
export function autoMapColumns(headers: string[]): Partial<Record<ShopifyField, number>> {
  const map: Partial<Record<ShopifyField, number>> = {};
  headers.forEach((h, i) => {
    const f = SYNONYMS[normKey(h)];
    if (f && map[f] === undefined) map[f] = i;
  });
  return map;
}

/** Le CSV a-t-il une structure multi-lignes (variantes/images par Handle) ? */
export function isMultiRow(rows: string[][], map: Partial<Record<ShopifyField, number>>): boolean {
  if (map.Handle === undefined) return false;
  const seen = new Set<string>();
  for (const r of rows) {
    const h = cell(r, map.Handle);
    if (h) { if (seen.has(h)) return true; seen.add(h); }
  }
  return false;
}

// ── Regroupement par produit (variantes + images) ───────────────────────────

export interface ProductImage { src: string; alt: string; rowIndex: number }
export interface ProductVariant { option1: string; sku: string; price: string; rowIndex: number }

export interface ProductGroup {
  handle: string;
  defRow: number;       // ligne qui définit le produit (Title rempli)
  rowIndices: number[];
  title: string;
  body: string;
  vendor: string;
  type: string;
  tags: string;
  seoTitle: string;
  seoDescription: string;
  collection: string;   // collection source (CSV fournisseur)
  images: ProductImage[];
  variants: ProductVariant[];
}

function cell(row: string[], idx?: number): string { return idx === undefined ? "" : (row[idx] ?? "").trim(); }

function emptyGroup(handle: string, i: number): ProductGroup {
  return { handle, defRow: i, rowIndices: [], title: "", body: "", vendor: "", type: "", tags: "", seoTitle: "", seoDescription: "", collection: "", images: [], variants: [] };
}

/** Regroupe les lignes en produits : multi-lignes (Shopify) ou plat (1 ligne = 1 produit). */
export function groupProducts(rows: string[][], map: Partial<Record<ShopifyField, number>>): ProductGroup[] {
  if (map.Title === undefined) return [];
  return isMultiRow(rows, map) ? groupMultiRow(rows, map) : groupFlat(rows, map);
}

function groupMultiRow(rows: string[][], map: Partial<Record<ShopifyField, number>>): ProductGroup[] {
  const groups = new Map<string, ProductGroup>();
  rows.forEach((row, i) => {
    const handle = cell(row, map.Handle) || `row-${i}`;
    let g = groups.get(handle);
    if (!g) { g = emptyGroup(handle, i); groups.set(handle, g); }
    g.rowIndices.push(i);
    const title = cell(row, map.Title);
    if (title && !g.title) {
      g.title = title; g.defRow = i; g.body = cell(row, map.Body); g.vendor = cell(row, map.Vendor);
      g.type = cell(row, map.Type); g.tags = cell(row, map.Tags); g.seoTitle = cell(row, map.SeoTitle);
      g.seoDescription = cell(row, map.SeoDescription); g.collection = cell(row, map.Collection);
    }
    const src = cell(row, map.ImageSrc);
    if (src) g.images.push({ src, alt: cell(row, map.ImageAlt), rowIndex: i });
    const opt1 = cell(row, map.Option1Value);
    const sku = cell(row, map.VariantSKU);
    if (opt1 || sku) g.variants.push({ option1: opt1, sku, price: cell(row, map.VariantPrice), rowIndex: i });
  });
  return [...groups.values()];
}

function groupFlat(rows: string[][], map: Partial<Record<ShopifyField, number>>): ProductGroup[] {
  return rows.map((row, i) => {
    const title = cell(row, map.Title) || cell(row, map.Handle) || `Produit ${i + 1}`;
    const handle = cell(row, map.Handle) || `row-${i}`;
    const g = emptyGroup(handle, i);
    g.rowIndices = [i];
    g.title = title;
    g.body = cell(row, map.Body);
    g.vendor = cell(row, map.Vendor);
    g.type = cell(row, map.Type);
    g.tags = cell(row, map.Tags);
    g.seoTitle = cell(row, map.SeoTitle);
    g.seoDescription = cell(row, map.SeoDescription);
    g.collection = cell(row, map.Collection);
    const src = cell(row, map.ImageSrc);
    if (src) g.images.push({ src, alt: cell(row, map.ImageAlt), rowIndex: i });
    const opt1 = cell(row, map.Option1Value) || cell(row, map.Option2Value);
    const sku = cell(row, map.VariantSKU);
    const price = cell(row, map.VariantPrice);
    if (opt1 || sku || price) g.variants.push({ option1: opt1, sku, price, rowIndex: i });
    return g;
  });
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();
}

// ── Règles de transformation (questionnaire) ────────────────────────────────

export type TransformMode = "translate" | "clean_translate" | "rename_optimize" | "recreate" | "migration" | "supplier_to_brand";
export type TitleStyle = "keep" | "rewrite_seo" | "short" | "descriptive_long";
export type DescriptionLevel = "short" | "standard" | "long" | "html_rich";
export type HandleMode = "keep" | "clean" | "fr" | "short";
export type Level = "léger" | "standard" | "poussé" | "ultra complet";

export interface ProfileCollection { name: string; url: string }

export interface ImportRules {
  language: string;
  country: string;
  tone: string;
  transform: TransformMode;
  titleStyle: TitleStyle;
  brandNames: boolean;
  brandNameStyle: string;
  description: DescriptionLevel;
  descriptionParts: string[];   // h2h3 | faq | benefits | features | usage | reassurance
  collections: string[];
  internalLinking: boolean;
  meta: boolean;
  altText: boolean;
  tagsType: boolean;
  handleMode: HandleMode;
  convertUnits: boolean;
  level: Level;
  // ── Profil boutique ──
  profileId: string;
  vendor: string;
  metaSuffix: string;           // ex « ✓ Livraison gratuite. »
  titleFormat: "plain" | "brand_suffix";
  collectionsUrls: ProfileCollection[];
}

export const BASE_RULES: ImportRules = {
  language: "Français", country: "France", tone: "naturel",
  transform: "clean_translate", titleStyle: "rewrite_seo",
  brandNames: false, brandNameStyle: "neutre",
  description: "html_rich", descriptionParts: ["h2h3", "benefits", "features", "faq"],
  collections: [], internalLinking: false, meta: true, altText: true, tagsType: true,
  handleMode: "clean", convertUnits: true, level: "standard",
  profileId: "custom", vendor: "", metaSuffix: "", titleFormat: "plain", collectionsUrls: [],
};

export interface Preset { id: string; label: string; desc: string; rules: Partial<ImportRules> }

export const PRESETS: Preset[] = [
  { id: "translate", label: "Traduction propre", desc: "Traduit et corrige les textes, conserve noms et structure.", rules: { transform: "translate", titleStyle: "keep", brandNames: false, description: "standard", descriptionParts: [], internalLinking: false, meta: false, tagsType: false, handleMode: "keep", level: "léger" } },
  { id: "migration", label: "Migration Shopify propre", desc: "Nettoie titres, meta et handles, conserve les données importantes.", rules: { transform: "migration", titleStyle: "rewrite_seo", brandNames: false, description: "standard", handleMode: "clean", meta: true, altText: true, tagsType: true, level: "standard" } },
  { id: "brand", label: "Marque premium", desc: "Réécrit titres, descriptions HTML, noms brandés uniques, maillage, meta et alt.", rules: { transform: "rename_optimize", titleStyle: "rewrite_seo", brandNames: true, brandNameStyle: "luxe discret", description: "html_rich", descriptionParts: ["h2h3", "benefits", "features", "faq", "usage", "reassurance"], internalLinking: true, meta: true, altText: true, tagsType: true, level: "ultra complet" } },
  { id: "merchant", label: "Catalogue Merchant-friendly", desc: "Titres sobres, descriptions factuelles, product_type, meta propres, sans claims risqués.", rules: { transform: "rename_optimize", titleStyle: "rewrite_seo", brandNames: false, description: "standard", descriptionParts: ["features", "usage"], internalLinking: false, meta: true, altText: true, tagsType: true, level: "standard" } },
  { id: "supplier", label: "Fournisseur → marque", desc: "Transforme les titres fournisseur, réécrit, adapte la langue, génère tags / type / alt.", rules: { transform: "supplier_to_brand", titleStyle: "rewrite_seo", brandNames: true, brandNameStyle: "neutre", description: "html_rich", descriptionParts: ["h2h3", "benefits", "features", "faq"], internalLinking: true, meta: true, altText: true, tagsType: true, level: "poussé" } },
];

export function presetRules(id: string): ImportRules {
  const p = PRESETS.find((x) => x.id === id);
  return { ...BASE_RULES, ...(p?.rules ?? {}) };
}

// ── Entrée / sortie de transformation (partagé client ↔ serveur) ────────────

export interface ImportProductInput {
  handle: string;
  title: string;
  bodyExcerpt: string;
  type: string;
  tags: string;
  vendor: string;
  sourceCollection: string;
  imageCount: number;
  existingAlts: string[];
  variantOptions: string[];
  variantCount: number;
  priceSample: string;
}

export interface TransformedProduct {
  handle: string;
  title: string;
  brandName?: string;
  vendor?: string;
  keyword?: string;
  bodyHtml: string;
  newHandle?: string;
  metaTitle: string;
  metaDescription: string;
  tags: string;
  productType: string;
  collections: string[];
  imageAlts: string[];
  status: "ok" | "review";
  notes?: string[];
}

export interface ImportContext {
  brandName?: string;
  niche?: string;
  positioning?: string;
  style?: string;
  vendor?: string;
  metaSuffix?: string;
  titleFormat?: "plain" | "brand_suffix";
  titleRules?: string;
  collectionsUrls?: ProfileCollection[];
  oldTerms?: string[];
}

export interface ImportMemory {
  brandNames: string[];
  anchors: string[];
}

export function toProductInput(g: ProductGroup): ImportProductInput {
  const options = Array.from(new Set(g.variants.map((v) => v.option1).filter(Boolean))).slice(0, 12);
  return {
    handle: g.handle,
    title: g.title || g.handle,
    bodyExcerpt: stripHtml(g.body).slice(0, 600),
    type: g.type,
    tags: g.tags,
    vendor: g.vendor,
    sourceCollection: g.collection,
    imageCount: Math.max(1, g.images.length),
    existingAlts: g.images.map((i) => i.alt).slice(0, 8),
    variantOptions: options,
    variantCount: g.variants.length || 1,
    priceSample: g.variants[0]?.price || "",
  };
}

// ── Prompts OpenAI ──────────────────────────────────────────────────────────

const TRANSFORM_LABEL: Record<TransformMode, string> = {
  translate: "Traduire uniquement (corriger la langue, conserver noms et structure)",
  clean_translate: "Nettoyer + traduire (corriger textes, unités, descriptions)",
  rename_optimize: "Renommer + optimiser (titres, descriptions, meta, alt, tags)",
  recreate: "Recréer complètement le contenu produit (à partir des données réelles)",
  migration: "Migration Shopify propre (nettoyer titres, meta, handles, conserver les données)",
  supplier_to_brand: "Import fournisseur → boutique de marque (transformer le contenu fournisseur)",
};
const TITLE_LABEL: Record<TitleStyle, string> = {
  keep: "Garder les titres existants (corrigés/traduits)",
  rewrite_seo: "Réécrire des titres naturels pour Google (descriptif + attribut concret)",
  short: "Titres courts (3 à 6 mots)",
  descriptive_long: "Titres descriptifs plus longs",
};

/** Termes internes interdits dans le texte public (anti-jargon). Réutilisé par le QC. */
export const FORBIDDEN_JARGON = [
  "seo", "référencement", "referencement", "mot-clé", "mot clé", "mots-clés", "maillage interne",
  "intention de recherche", "champ lexical", "optimisé pour google", "optimise pour google",
  "stratégie seo", "strategie seo", "contenu optimisé", "cette page travaille",
];

const VARIANT_TRANSLATIONS =
  "Size→Taille, Color→Couleur, Style→Style, Emitting Color→Couleur d'éclairage, Lampshade Color→Couleur de l'abat-jour, " +
  "Plug Type→Type de prise, Single→Unité, Set of 2→Lot de 2, Set of 3→Lot de 3, Small/S→S, Medium/M→M, Large/L→L, XL→XL";

const UNIT_EXAMPLES = "10\"→25 cm, 11.8\"→30 cm, 15.7\"→40 cm, 23.6\"→60 cm, 31.5\"→80 cm, 39.4\"→100 cm (1 inch = 2,54 cm, arrondi propre)";

const DESC_SKELETON = `<h2>[Titre produit, sans nom brandé]</h2>
<p>[Introduction naturelle : produit, style, usage, ambiance]</p>
<p>[Rendu visuel, matière SI connue, forme, couleur, intérêt déco/pratique]</p>
<h3>Pourquoi choisir ce produit ?</h3>
<ul><li><strong>[Point fort]</strong> [bénéfice client]</li><li><strong>[Point fort]</strong> [bénéfice]</li><li><strong>[Point fort]</strong> [bénéfice]</li></ul>
<h3>Où installer ce produit ?</h3>
<p>[Pièces adaptées, usages, situations]</p>
<h3>Détails du produit</h3>
<ul><li>Type : …</li><li>Style : …</li><li>Couleur : …</li><li>Matériaux : UNIQUEMENT si connu</li><li>Usage conseillé : …</li><li>Dimensions : UNIQUEMENT si disponibles</li></ul>
<h3>Conseils pour bien le choisir</h3>
<p>[Aide au choix : taille, style, pièce, installation]</p>
<h3>Questions fréquentes</h3>
<h4>[Question utile ?]</h4><p>[Réponse courte]</p><h4>[Question utile ?]</h4><p>[Réponse courte]</p>
<p>[Conclusion naturelle, vendeuse et rassurante]</p>`;

export function buildTransformSystem(rules: ImportRules): string {
  return (
    "Tu es Orkestra Import Factory, expert en catalogues e-commerce Shopify. Tu transformes des produits importés " +
    "(fournisseur, ancienne boutique, concurrent, export Shopify) en fiches PROPRES, traduites, RÉÉCRITES ENTIÈREMENT et optimisées, prêtes à réimporter dans Shopify.\n" +
    `Langue : ${rules.language}. Pays : ${rules.country}. Ton : ${rules.tone}.\n` +
    "Réponds UNIQUEMENT par un JSON valide {\"products\":[ ... ]}. Chaque produit a EXACTEMENT ces clés : " +
    "handle (string, handle d'origine reçu, clé inchangée), title (string), brandName (string, vide si non demandé), vendor (string), " +
    "keyword (string, mot-clé principal = requête d'achat naturelle), bodyHtml (string, HTML Shopify), newHandle (string slug ou vide), " +
    "metaTitle (string), metaDescription (string), tags (string, virgules), productType (string), collections (string[], 1 à 3), " +
    "imageAlts (string[], un alt par image dans l'ordre), status ('ok'|'review'), notes (string[], points 'à vérifier').\n" +
    "GARDE-FOUS STRICTS :\n" +
    "1) N'invente JAMAIS : dimensions, matériaux, compatibilités, certifications, garanties, origine, délais, prix, stock, fonctionnalités (LED, télécommande, 360°…). Absent → ne pas l'écrire, le noter dans notes et mettre status 'review'.\n" +
    "2) RÉÉCRIS ENTIÈREMENT : ne recopie aucune phrase entière de la source ; supprime toute marque concurrente, tout ancien domaine, toute promesse non vérifiée.\n" +
    "3) PRÉSERVE le sens des variantes/tailles ; ne mélange pas options/couleurs/images.\n" +
    "4) INTERDITS dans le texte public (bodyHtml/meta/title) : « SEO », « référencement », « mot-clé », « maillage interne », « intention de recherche », « champ lexical », « optimisé pour Google », « stratégie SEO ». Pas de « premium/professionnel/meilleur » sans preuve, pas de « Achetez maintenant »."
  );
}

export function buildTransformPrompt(products: ImportProductInput[], rules: ImportRules, mem: ImportMemory, ctx: ImportContext): string {
  const brand = ctx.brandName || rules.vendor || "la boutique";
  const vendor = ctx.vendor || rules.vendor || brand;
  const suffix = ctx.metaSuffix || rules.metaSuffix;
  const cols = ctx.collectionsUrls && ctx.collectionsUrls.length ? ctx.collectionsUrls : rules.collectionsUrls;

  // Bloc « boutique cible ».
  const profileLines: string[] = [`Marque : ${brand} · Vendor : ${vendor}`];
  if (ctx.niche) profileLines.push(`Niche : ${ctx.niche}`);
  if (ctx.style) profileLines.push(`Style rédactionnel : ${ctx.style}`);
  if (cols.length) profileLines.push(`Collections (nom → URL) :\n${cols.slice(0, 12).map((c) => `  - ${c.name} → ${c.url}`).join("\n")}`);
  else if (rules.collections.length) profileLines.push(`Collections : ${rules.collections.slice(0, 20).join(", ")}`);
  if (ctx.oldTerms?.length) profileLines.push(`À SUPPRIMER partout (anciens noms/domaines) : ${ctx.oldTerms.join(", ")}`);

  // Directives par responsabilité (agents).
  const directives: string[] = [];
  directives.push(`Mode : ${TRANSFORM_LABEL[rules.transform]}.`);
  directives.push("Analyse produit : déduis type, usage, pièce adaptée, style, couleur/matière SEULEMENT si présents. Ce qui est inconnu reste non mentionné (jamais inventé).");
  directives.push("Mot-clé : déduis 1 mot-clé principal d'achat par produit + des termes naturels (usage, pièce, style) ; intègre-les sans bourrage.");
  // Titres (profil).
  if (ctx.titleFormat === "brand_suffix" || (rules.titleFormat === "brand_suffix" && !ctx.titleFormat)) {
    directives.push(`Titres : format OBLIGATOIRE « Nom Produit SEO | NomBrandé ». Le nom produit avant le « | » fait 3 à 6 mots (le nom brandé ne compte pas). NomBrandé court, premium, mémorisable (~2 syllabes), UNIQUE, sans doublon ni quasi-doublon (éviter même début, accents inclus). Déjà pris : ${mem.brandNames.slice(0, 80).join(", ") || "(aucun)"}.`);
  } else {
    directives.push(`Titres : ${TITLE_LABEL[rules.titleStyle]}, SANS nom brandé. ${ctx.titleRules || "3 à 8 mots, naturel, descriptif, pas générique."} Ne finis jamais par « et/ou/en/de/- ».`);
  }
  // Description.
  const richDesc = rules.description === "html_rich" || rules.level === "poussé" || rules.level === "ultra complet";
  if (richDesc) directives.push(`Description : HTML riche${rules.level === "ultra complet" || rules.level === "poussé" ? ", VISE 500 à 900 mots si les données le permettent" : ""}, naturelle, premium, orientée client, SANS blabla. Suis CETTE structure exacte :\n${DESC_SKELETON}`);
  else directives.push("Description : claire et naturelle, exploitable, sans blabla ni invention.");
  // Meta (profil).
  if (rules.meta) directives.push(`Meta : metaTitle « ${"{mot-clé}"} | ${brand} » (50–70 car.). metaDescription ≤ 160 car., inclut le mot-clé, donne envie, NATURELLE${suffix ? `, et FINIT EXACTEMENT par « ${suffix} »` : ""}.`);
  // Maillage.
  if (rules.internalLinking && cols.length) directives.push(`Maillage : ajoute dans un paragraphe de bodyHtml UN lien naturel vers la collection la plus pertinente, au format EXACT <strong><u><a href="URL">ancre</a></u></strong>. Varie les ancres (déjà utilisées : ${mem.anchors.slice(0, 40).join(", ") || "(aucune)"}). N'écris jamais « maillage interne ».`);
  // Alt.
  if (rules.altText) directives.push("Alt text : un par image (imageAlts), MÊME nom produit dans chaque, différencié par la vue (face, en situation, détail, dimensions, variante). Jamais « Image de… ».");
  // Tags / type.
  if (rules.tagsType) directives.push("Tags / product_type : product_type clair ; tags pertinents (niche, usage, pièce), supprime les tags fournisseur inutiles, pas de surcharge.");
  // Variantes / unités.
  directives.push(`Variantes : conserve-les ; traduis les options (${VARIANT_TRANSLATIONS}).`);
  if (rules.convertUnits) directives.push(`Unités : convertis pouces/ft/lbs en cm/m/kg dans le texte si pertinent (${UNIT_EXAMPLES}). Ne touche pas aux dimensions de variantes, n'en invente pas.`);
  const handleLabel: Record<HandleMode, string> = { keep: "garder les handles d'origine (newHandle vide)", clean: "nettoyer (minuscules, sans accents, tirets, court)", fr: "générer en français propre", short: "générer courts" };
  directives.push(`Handles : ${handleLabel[rules.handleMode]} ; basé sur le titre, sans marque concurrente ni ancien nom brandé.`);
  directives.push(`Niveau d'intervention : ${rules.level}.`);

  const list = products.map((p, i) => (
    `--- Produit ${i + 1} (handle: ${p.handle}) ---\n` +
    `Titre source : ${p.title}\n` +
    `Type : ${p.type || "(n/a)"} | Tags : ${p.tags || "(aucun)"} | Vendor source : ${p.vendor || "(aucun)"}${p.sourceCollection ? ` | Collection source : ${p.sourceCollection}` : ""}\n` +
    `Variantes (${p.variantCount}) : ${p.variantOptions.join(", ") || "(aucune option)"} | Prix exemple : ${p.priceSample || "(n/a)"}\n` +
    `Images : ${p.imageCount}${p.existingAlts.filter(Boolean).length ? ` | alts actuels : ${p.existingAlts.filter(Boolean).join(" / ")}` : ""}\n` +
    `Description source : ${p.bodyExcerpt || "(vide)"}`
  )).join("\n\n");

  return (
    `=== Boutique cible ===\n${profileLines.join("\n")}\n\n` +
    `=== Règles de transformation ===\n- ${directives.join("\n- ")}\n\n` +
    `=== ${products.length} produit(s) à transformer ===\n${list}\n\n` +
    `Renvoie le JSON {"products":[...]} dans le MÊME ordre, handle d'origine en clé. vendor = « ${vendor} » pour tous.`
  );
}

/** Coerce un objet JSON OpenAI → TransformedProduct (robuste). */
export function coerceTransformed(p: unknown, fallback: ImportProductInput): TransformedProduct {
  const o = (p ?? {}) as Record<string, unknown>;
  const str = (v: unknown, fb = "") => (typeof v === "string" ? v : fb);
  const arr = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
  const alts = arr(o.imageAlts);
  while (alts.length < fallback.imageCount) alts.push(str(o.title, fallback.title));
  return {
    handle: str(o.handle, fallback.handle),
    title: str(o.title, fallback.title),
    brandName: str(o.brandName) || undefined,
    vendor: str(o.vendor) || undefined,
    keyword: str(o.keyword) || undefined,
    bodyHtml: str(o.bodyHtml),
    newHandle: str(o.newHandle) || undefined,
    metaTitle: str(o.metaTitle).slice(0, 70),
    metaDescription: str(o.metaDescription).slice(0, 200),
    tags: str(o.tags, fallback.tags),
    productType: str(o.productType, fallback.type),
    collections: arr(o.collections).slice(0, 3),
    imageAlts: alts.slice(0, fallback.imageCount),
    status: o.status === "review" ? "review" : "ok",
    notes: arr(o.notes),
  };
}

// ── Reconstruction du CSV Shopify final ─────────────────────────────────────

function ensureColumn(headers: string[], rows: string[][], map: Partial<Record<ShopifyField, number>>, field: ShopifyField, headerName: string): number {
  if (map[field] !== undefined) return map[field]!;
  const idx = headers.length;
  headers.push(headerName);
  rows.forEach((r) => { while (r.length < idx) r.push(""); r.push(""); });
  map[field] = idx;
  return idx;
}

export type ExportStatus = "ok" | "warning" | "risk" | "failed";
export interface ExportCheck { label: string; status: ExportStatus; detail?: string }
export interface ExportStats { products: number; variants: number; images: number; added: string[]; preserved: string[]; cleared: string[] }
export interface ApplyResult { headers: string[]; rows: string[][]; status: ExportStatus; checks: ExportCheck[]; stats: ExportStats }

const SEV_ORDER: Record<ExportStatus, number> = { ok: 0, warning: 1, risk: 2, failed: 3 };

/** Construit le CSV Shopify final : colonnes complètes, données sensibles
 *  préservées, lignes variantes/images intactes, + contrôle qualité export. */
export function applyTransform(
  origHeaders: string[],
  origRows: string[][],
  srcMap: Partial<Record<ShopifyField, number>>,
  groups: ProductGroup[],
  results: TransformedProduct[],
  rules: ImportRules
): ApplyResult {
  const headers = [...origHeaders];
  const rows = origRows.map((r) => [...r]);
  const map = { ...srcMap };
  const handleExisted = map.Handle !== undefined;

  // Option 2 seule → la traiter comme Option 1 (Shopify exige Option 1 d'abord).
  if (map.Option1Value === undefined && map.Option2Value !== undefined) {
    map.Option1Value = map.Option2Value; delete map.Option2Value;
    if (map.Option1Name === undefined && map.Option2Name !== undefined) { map.Option1Name = map.Option2Name; delete map.Option2Name; }
  }
  const optName = map.Option1Value !== undefined ? guessOptionName(origHeaders[map.Option1Value]) : "Titre";

  // Colonnes canoniques déjà présentes (préservées) vs à ajouter.
  const preExisting = new Set<ShopifyField>(ALL_FIELDS.filter((f) => map[f] !== undefined));
  const idx = {} as Record<ShopifyField, number>;
  for (const o of SHOPIFY_ORDER) idx[o.field] = ensureColumn(headers, rows, map, o.field, o.header);

  const added = ALL_FIELDS.filter((f) => !preExisting.has(f)).map((f) => HEADER_OF[f]);
  const preserved = ALL_FIELDS.filter((f) => preExisting.has(f)).map((f) => HEADER_OF[f]);
  const cleared: string[] = [];

  let falseProdFixed = 0;
  const byHandle = new Map(results.map((r) => [r.handle, r]));
  for (const g of groups) {
    const t = byHandle.get(g.handle);
    if (!t) continue;
    // Sécurité : Title/Body uniquement sur la ligne produit → pas de faux produit.
    if (g.rowIndices.length > 1) {
      for (const ri of g.rowIndices) {
        if (ri === g.defRow) continue;
        if (cell(rows[ri], idx.Title)) { rows[ri][idx.Title] = ""; falseProdFixed++; }
        if (cell(rows[ri], idx.Body)) rows[ri][idx.Body] = "";
      }
    }
    const def = rows[g.defRow];
    if (def) {
      def[idx.Title] = t.title;
      if (t.bodyHtml) def[idx.Body] = t.bodyHtml;             // jamais blanchir une valeur source
      if (rules.tagsType) { def[idx.Type] = t.productType; def[idx.Tags] = t.tags; }
      if (rules.meta) { def[idx.SeoTitle] = t.metaTitle; def[idx.SeoDescription] = t.metaDescription; }
      def[idx.Vendor] = t.vendor || rules.vendor || def[idx.Vendor] || "";
      if (!preExisting.has("Published") && !cell(def, idx.Published)) def[idx.Published] = "TRUE";
      if (!preExisting.has("Status") && !cell(def, idx.Status)) def[idx.Status] = "active";
    }
    // Handle garanti et cohérent sur TOUTES les lignes du produit.
    const finalHandle = rules.handleMode !== "keep" && t.newHandle ? t.newHandle : handleExisted && g.handle ? g.handle : slugify(t.title) || g.handle;
    for (const ri of g.rowIndices) rows[ri][idx.Handle] = finalHandle;
    // Option1 Name sur les lignes variantes ayant une valeur (sans écraser un nom source).
    for (const v of g.variants) {
      if (cell(rows[v.rowIndex], map.Option1Value) && !cell(rows[v.rowIndex], idx.Option1Name)) rows[v.rowIndex][idx.Option1Name] = optName;
    }
    // Image Position séquentielle si la colonne a été ajoutée.
    if (!preExisting.has("ImagePosition")) g.images.forEach((img, k) => { rows[img.rowIndex][idx.ImagePosition] = String(k + 1); });
    // Alt text uniquement sur les lignes AVEC image.
    if (rules.altText) g.images.forEach((img, k) => { rows[img.rowIndex][idx.ImageAlt] = t.imageAlts[k] || t.title; });
  }

  // ── Nettoyages de sécurité déterministes ──
  let altCleared = 0, catCleared = 0;
  for (const r of rows) {
    if (!cell(r, idx.ImageSrc) && cell(r, idx.ImageAlt)) { r[idx.ImageAlt] = ""; altCleared++; }
    const cat = cell(r, idx.Category);
    if (cat && !isValidShopifyCategory(cat)) { r[idx.Category] = ""; catCleared++; }
  }
  if (altCleared) cleared.push("Image Alt Text (sans Image Src)");
  if (catCleared) cleared.push("Product Category (non fiable)");

  // ── Contrôle qualité export ──
  let status: ExportStatus = "ok";
  const checks: ExportCheck[] = [];
  const flag = (s: ExportStatus, label: string, detail?: string) => { checks.push({ label, status: s, detail }); if (SEV_ORDER[s] > SEV_ORDER[status]) status = s; };

  const noHandle = rows.filter((r) => !cell(r, idx.Handle)).length;
  if (noHandle) flag("failed", "Handle manquant sur des lignes", `${noHandle} ligne(s)`);

  if (falseProdFixed) flag("warning", "Titres de lignes variantes/images nettoyés (faux produits évités)", `${falseProdFixed} ligne(s)`);

  // handle partagé entre produits différents
  const handleByGroup = groups.map((g) => cell(rows[g.defRow], idx.Handle) || cell(rows[g.rowIndices[0]], idx.Handle));
  const dupHandle = Array.from(new Set(handleByGroup.filter((h, i) => h && handleByGroup.indexOf(h) !== i)));
  if (dupHandle.length) flag("risk", "Handle partagé entre produits différents", dupHandle.slice(0, 5).join(", "));

  if (altCleared) flag("warning", "Alt text vidé sur lignes sans image", `${altCleared}`);
  if (catCleared) flag("warning", "Product Category vidée (non fiable)", `${catCleared}`);

  let noPrice = 0;
  for (const g of groups) for (const v of g.variants) if (!cell(rows[v.rowIndex], idx.VariantPrice)) noPrice++;
  if (noPrice) flag("warning", "Prix manquant sur des variantes", `${noPrice}`);

  let optNoName = 0;
  for (const g of groups) {
    for (const [valF, nameF] of [["Option1Value", "Option1Name"], ["Option2Value", "Option2Name"], ["Option3Value", "Option3Name"]] as [ShopifyField, ShopifyField][]) {
      for (const ri of g.rowIndices) if (cell(rows[ri], idx[valF]) && !cell(rows[g.defRow], idx[nameF]) && !cell(rows[ri], idx[nameF])) optNoName++;
    }
  }
  if (optNoName) flag("warning", "Valeur d'option sans nom d'option", `${optNoName}`);

  const skus = rows.map((r) => cell(r, idx.VariantSKU)).filter(Boolean);
  const dupSku = Array.from(new Set(skus.filter((s, i) => skus.indexOf(s) !== i)));
  if (dupSku.length) flag("warning", "SKU dupliqué", dupSku.slice(0, 5).join(", "));

  let viNoSrc = 0;
  for (const g of groups) {
    const srcs = new Set(g.rowIndices.map((ri) => cell(rows[ri], idx.ImageSrc)).filter(Boolean));
    for (const ri of g.rowIndices) { const vi = cell(rows[ri], idx.VariantImage); if (vi && !srcs.has(vi)) viNoSrc++; }
  }
  if (viNoSrc) flag("warning", "Variant Image sans Image Src correspondante", `${viNoSrc}`);

  if (checks.length === 0) checks.push({ label: "Structure Shopify conforme", status: "ok" });

  // ── Réordonner vers l'ordre canonique Shopify (extras conservés ensuite) ──
  const used = new Set<number>();
  const sources: number[] = [];
  const newHeaders: string[] = [];
  for (const o of SHOPIFY_ORDER) { newHeaders.push(o.header); sources.push(idx[o.field]); used.add(idx[o.field]); }
  for (let i = 0; i < headers.length; i++) if (!used.has(i)) { newHeaders.push(headers[i]); sources.push(i); }
  const newRows = rows.map((r) => sources.map((s) => r[s] ?? ""));

  const stats: ExportStats = {
    products: groups.length,
    variants: groups.reduce((a, g) => a + g.variants.length, 0),
    images: groups.reduce((a, g) => a + g.images.length, 0),
    added, preserved, cleared,
  };
  return { headers: newHeaders, rows: newRows, status, checks, stats };
}

function guessOptionName(header: string): string {
  const k = (header || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (/(taille|size|dimension)/.test(k)) return "Taille";
  if (/(couleur|color|colour)/.test(k)) return "Couleur";
  if (/(materiau|material|matiere)/.test(k)) return "Matériau";
  return "Modèle";
}

function slugify(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// ── Aperçu après mapping (stats + avertissements) ───────────────────────────

export interface MappingStats {
  products: number;
  variants: number;
  images: number;
  multiRow: boolean;
  used: { field: ShopifyField; label: string; header: string }[];
  ignored: string[];
  warnings: string[];
  hasTitle: boolean;
}

export function mappingStats(headers: string[], rows: string[][], map: Partial<Record<ShopifyField, number>>, groups: ProductGroup[]): MappingStats {
  const usedIdx = new Set(Object.values(map).filter((v) => v !== undefined) as number[]);
  const used = MAP_TARGETS.filter((t) => map[t.field] !== undefined).map((t) => ({ field: t.field, label: t.label, header: headers[map[t.field]!] }));
  const ignored = headers.filter((_, i) => !usedIdx.has(i));
  const multi = isMultiRow(rows, map);
  const warnings: string[] = [];
  const hasTitle = map.Title !== undefined;
  if (!hasTitle) warnings.push("Aucune colonne « titre produit » : indispensable pour transformer le catalogue.");
  if (map.ImageSrc === undefined) warnings.push("Aucune colonne image détectée — les alt text ne seront pas générés.");
  if (map.VariantPrice === undefined) warnings.push("Aucune colonne prix détectée — vérifiez les prix avant l'import Shopify.");
  if (map.VariantSKU === undefined) warnings.push("Aucune colonne SKU / référence détectée.");
  const descLike = headers.filter((h) => SYNONYMS[normKey(h)] === "Body").length;
  if (descLike > 1) warnings.push("Plusieurs colonnes ressemblent à des descriptions — vérifiez la colonne choisie.");
  if (multi && map.Option1Value === undefined) warnings.push("Variantes détectées (handles répétés) mais aucune colonne d'option (taille / couleur) identifiée.");
  return { products: groups.length, variants: groups.reduce((a, g) => a + g.variants.length, 0), images: groups.reduce((a, g) => a + g.images.length, 0), multiRow: multi, used, ignored, warnings, hasTitle };
}

/** Rapport de modifications (CSV léger : avant → après). */
export function buildReportCsv(groups: ProductGroup[], results: TransformedProduct[]): string {
  const byHandle = new Map(results.map((r) => [r.handle, r]));
  const headers = ["Handle", "Ancien titre", "Nouveau titre", "Meta title", "product_type", "Collections recommandées", "Statut"];
  const rows: string[][] = [];
  for (const g of groups) {
    const t = byHandle.get(g.handle);
    if (!t) continue;
    rows.push([g.handle, g.title, t.title, t.metaTitle, t.productType, t.collections.join(" | "), t.status === "review" ? "À vérifier" : "Validé"]);
  }
  return serializeCsv(headers, rows);
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Normalisation pour comparer des noms brandés (accent-insensible). */
export function normName(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "");
}

/** Déclenche le téléchargement d'un fichier texte (CSV) côté navigateur. */
export function downloadCsv(filename: string, content: string) {
  const blob = new Blob(["﻿" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

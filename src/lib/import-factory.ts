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

// Emojis / pictogrammes interdits dans un CSV Shopify final. On PRÉSERVE les
// marqueurs utiles (✓ ✔ • · –, ×, Ø) servant aux suffixes meta et aux dimensions.
const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{2712}\u{2715}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{2049}\u{203C}]/gu;
/** Vrai si le texte contient un emoji/pictogramme (hors marqueurs ✓ ✔ • ·). */
export function hasEmoji(s: string): boolean { if (!s) return false; EMOJI_RE.lastIndex = 0; return EMOJI_RE.test(s); }
/** Retire les emojis/pictogrammes d'un champ Shopify, sans toucher ✓ ✔ • · ni × Ø. */
export function stripEmoji(s: string): string {
  if (!s) return s;
  return s.replace(EMOJI_RE, "").replace(/[ \t]{2,}/g, " ").replace(/ +([,.;:!?])/g, "$1").replace(/^[ \t]+|[ \t]+$/g, "");
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
  { id: "rapide", label: "Import rapide", desc: "Nettoyage rapide : variantes traduites, unités converties, meta et descriptions courtes.", rules: { transform: "clean_translate", titleStyle: "rewrite_seo", brandNames: false, description: "short", descriptionParts: [], internalLinking: false, meta: true, altText: true, tagsType: true, handleMode: "clean", convertUnits: true, level: "léger" } },
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
  /** Handles / titres déjà utilisés (anti-doublon, relecture Claude). */
  handles?: string[];
  titles?: string[];
}

export function toProductInput(g: ProductGroup): ImportProductInput {
  const options = Array.from(new Set(g.variants.map((v) => v.option1).filter(Boolean))).slice(0, 12);
  return {
    handle: g.handle,
    title: g.title || g.handle,
    bodyExcerpt: stripHtml(g.body).slice(0, 1200),
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
  translate: "Traduire uniquement : traduire les textes visibles sans réécrire les fiches ; pas de réécriture marketing, ne pas changer la structure produit, conserver le style source.",
  clean_translate: "Nettoyer le CSV : corriger fautes, accents, anglais résiduel, titres bruts, handles sales, tags fournisseur, vendor, product_type ; garder les infos existantes, supprimer le bruit fournisseur, PAS de grosse réécriture.",
  rename_optimize: "Optimiser les fiches : améliorer titres, descriptions HTML, meta, alt, tags, product_type et collections — fiches prêtes à publier, vendeuses mais sobres, Merchant-friendly.",
  recreate: "Recréer les contenus : réécrire ENTIÈREMENT à partir des données fiables, contrôle qualité strict, contenu original, zéro copie, sans inventer de donnée technique.",
  migration: "Migration Shopify : mode PRUDENT — nettoyer descriptions/meta/alt/tags/product_type, CONSERVER au maximum handles, variantes, images, SKU, prix et collections existantes ; signaler tout handle modifié.",
  supplier_to_brand: "Fournisseur → marque : supprimer l'aspect fournisseur (noms, anciens domaines, tags inutiles), recréer un catalogue cohérent avec la marque et son ton, textes originaux, garde-fous anti-copie.",
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
  "fiche produit", "description produit", "optimisé", "optimisée", "optimise",
];

const VARIANT_TRANSLATIONS =
  "Size→Taille, Color→Couleur, Style→Style, Emitting Color→Couleur d'éclairage, Lampshade Color→Couleur de l'abat-jour, " +
  "Plug Type→Type de prise, Single→Unité, Set of 2→Lot de 2, Set of 3→Lot de 3, Small/S→S, Medium/M→M, Large/L→L, XL→XL";

const UNIT_EXAMPLES = "10\"→25 cm, 11.8\"→30 cm, 15.7\"→40 cm, 23.6\"→60 cm, 31.5\"→80 cm, 39.4\"→100 cm (1 inch = 2,54 cm, arrondi propre)";

// Structure HTML OBLIGATOIRE de toute fiche premium (même structure en Standard /
// Poussé / Ultra ; seule la LONGUEUR varie). « [type de produit] » est remplacé par
// le vrai type. La section Dimensions disparaît (ou devient « Format et utilisation »)
// si aucune taille n'est sourcée.
const DESC_SKELETON = `<h2>[Nom produit final] : [bénéfice / usage / style court adapté au produit]</h2>
<p>[Introduction naturelle : le produit, son type, son style, son usage principal et les pièces/contextes où il s'intègre. Mets le mot-clé principal en <strong>. N'invente aucune information absente de la source.]</p>
<p>[Rendu, usage, matière SI sourcée, forme, finition, ambiance ou bénéfice concret selon la niche. Français, premium, e-commerce, JAMAIS fournisseur.]</p>
<h3>Pourquoi choisir ce [type de produit] ?</h3>
<ul>
<li><strong>Bénéfice 1 :</strong> explication concrète et utile.</li>
<li><strong>Bénéfice 2 :</strong> explication concrète et utile.</li>
<li><strong>Bénéfice 3 :</strong> explication concrète et utile.</li>
<li><strong>Bénéfice 4 :</strong> explication concrète et utile.</li>
</ul>
<h3>Dimensions disponibles</h3>
<p>[SI des tailles / dimensions / formats existent dans la source : présente-les clairement, en français et en CENTIMÈTRES (convertis les pouces). SINON supprime entièrement cette section ou remplace ce titre par « Format et utilisation ».]</p>
<ul><li>[Format 1 en cm]</li><li>[Format 2 en cm]</li></ul>
<p>[Court conseil pour choisir la bonne taille selon l'usage, la pièce, l'espace ou le besoin de la niche.]</p>
<h3>Où utiliser ce [type de produit] ?</h3>
<p>[Usages et contextes adaptés selon la niche.]</p>
<h3>Détails du produit</h3>
<ul>
<li><strong>Type :</strong> type produit réel</li>
<li><strong>Style :</strong> style fiable si pertinent</li>
<li><strong>Couleur :</strong> couleur si sourcée</li>
<li><strong>Matériaux :</strong> UNIQUEMENT si sourcés</li>
<li><strong>Usage :</strong> usages adaptés</li>
</ul>
<h3>Questions fréquentes</h3>
<h4>[Question utile 1 ?]</h4><p>[Réponse prudente, naturelle, sans invention.]</p>
<h4>[Question utile 2 ?]</h4><p>[Réponse prudente, naturelle, sans invention.]</p>
<h4>[Question utile 3 ?]</h4><p>[Réponse prudente, naturelle, sans invention.]</p>
<p>[Conclusion courte qui résume le bénéfice principal et l'usage du produit.]</p>`;

export function buildTransformSystem(rules: ImportRules): string {
  return (
    "Tu es Orkestra Import Factory, expert en catalogues e-commerce Shopify. Tu transformes des produits importés " +
    "(fournisseur, ancienne boutique, concurrent, export Shopify) en fiches PROPRES, traduites, RÉÉCRITES ENTIÈREMENT et optimisées, prêtes à réimporter dans Shopify.\n" +
    `Langue : ${rules.language}. Pays : ${rules.country}. Ton : ${rules.tone}.\n` +
    "Réponds UNIQUEMENT par un JSON valide {\"products\":[ ... ]}. Chaque produit a EXACTEMENT ces clés : " +
    "handle (string, handle d'origine reçu, clé inchangée), title (string, propre et sans faute), " +
    "brandName (string : UNIQUEMENT un nom de gamme court placé après le « | », SEULEMENT si demandé — ce n'est JAMAIS le vendor / la marque de la boutique ; chaîne vide sinon), " +
    "vendor (string, la marque fournie avec sa CASSE EXACTE, ex : « Lumio », jamais « lumio »), " +
    "keyword (string, mot-clé principal = requête d'achat naturelle), bodyHtml (string, HTML Shopify), newHandle (string slug ou vide), " +
    "metaTitle (string), metaDescription (string), tags (string, virgules), productType (string), collections (string[], 1 à 3), " +
    "imageAlts (string[], un alt par image dans l'ordre), status ('ok'|'review'), notes (string[], points 'à vérifier').\n" +
    "GARDE-FOUS STRICTS :\n" +
    "1) N'INVENTE JAMAIS d'information non présente dans la source : garantie (durée), délai/temps de livraison, dimmable / non dimmable, LED intégrées, ampoules incluses/compatibles, matériau exact, certification (CE, IP…), poids, puissance (W), voltage, durée de vie, âge conseillé, sécurité, manuel/notice inclus, origine, stock. Si l'info est ABSENTE de la source : ne l'écris PAS ; au besoin formule une phrase prudente SANS affirmation technique (ex. « Vérifiez les informations de montage fournies avec le produit. ») et mets status 'review' avec une note. JAMAIS de phrase du type « Livré avec une garantie de 2 ans » ou « Un manuel d'installation est inclus » si ce n'est pas écrit dans la source.\n" +
    "2) RÉÉCRIS ENTIÈREMENT : ne recopie aucune phrase entière de la source ; supprime toute marque concurrente, tout ancien domaine, toute promesse non vérifiée.\n" +
    "3) PRÉSERVE le sens des variantes/tailles ; ne mélange pas options/couleurs/images.\n" +
    "4) INTERDITS dans le texte public (bodyHtml/meta/title) : « SEO », « référencement », « mot-clé », « maillage interne », « intention de recherche », « champ lexical », « optimisé pour Google », « stratégie SEO ». Pas de « premium/professionnel/meilleur » sans preuve, pas de « Achetez maintenant ».\n" +
    "5) AUCUN emoji ni pictogramme (🔥, ⭐, ✨, 💡…) nulle part : title, bodyHtml, tags, meta, options/variantes, alt, collections, product_type. Texte propre uniquement (le seul symbole autorisé est « ✓ » s'il fait partie du suffixe meta demandé).\n" +
    `6) LANGUE = ${rules.language}. ` + (/fran[çc]ais/i.test(rules.language)
      ? "FRANÇAIS PROPRE OBLIGATOIRE : accents corrects (doré, carrée, élégant, intérieur…), ZÉRO mot anglais résiduel — traduis tout (Round→Rond, Square→Carré, Rectangular→Rectangulaire, Gold→Doré, Black→Noir, White→Blanc, Modern→Moderne, Contemporary→Contemporain, Ceiling Light→Plafonnier, Pendant→Suspension, Chandelier→Lustre, Glass→Verre, Crystal→Cristal, Raindrop→goutte d'eau…), AUCUNE faute (« Rond » pas « Ronf », « Carrée », « doré », « craquelé »), pas de mots collés. JAMAIS le mot « foyer » au sens de pièce (c'est un anglicisme) : utilise « entrée », « hall d'entrée », « escalier » ou « pièce à haut plafond » selon le contexte. La marque garde sa casse exacte."
      : "Écris uniquement dans cette langue, sans résidu d'une autre langue.")
  );
}

// ── Niche : détection + playbook de génération (Import Factory multi-niches) ──
export type NicheKey = "luminaire" | "bebe" | "beaute" | "mode" | "sport" | "maison" | "cuisine" | "mobilier" | "electronique" | "animaux" | "generaliste";
const NICHE_KEYWORDS: { key: NicheKey; re: RegExp }[] = [
  { key: "luminaire", re: /luminaire|lustre|suspension|plafonnier|applique|lampe|lampadaire|ampoule|abat-jour|[ée]clairage/i },
  { key: "bebe", re: /b[ée]b[ée]|pu[ée]riculture|biberon|allaitement|pouss?ette|lange|nourrisson|enfant|t[ée]tine|barri[èe]re de s[ée]curit[ée]/i },
  { key: "beaute", re: /beaut[ée]|cosm[ée]tique|s[ée]rum|cr[èe]me|soin|maquillage|nettoyant|peau|cheveux|parfum|masque visage/i },
  { key: "mode", re: /mode|v[êe]tement|robe|veste|pantalon|chemise|jupe|manteau|chaussure|sac à main|accessoire mode|pull/i },
  { key: "sport", re: /sport|fitness|musculation|yoga|pilates|tapis|halt[èe]re|v[ée]lo|running|entra[îi]nement|reformer/i },
  { key: "cuisine", re: /cuisine|ustensile|po[êe]le|casserole|couteau|vaisselle|robot culinaire|électroménager cuisine/i },
  { key: "mobilier", re: /mobilier|meuble|canap[ée]|table|chaise|fauteuil|[ée]tag[èe]re|armoire|bureau|lit\b/i },
  { key: "electronique", re: /[ée]lectronique|casque|[ée]couteur|chargeur|c[âa]ble|enceinte|montre connect[ée]e|gadget|accessoire t[ée]l[ée]phone/i },
  { key: "animaux", re: /animal|animaux|chien|chat|gamelle|laisse|niche|jouet pour|aquarium|rongeur/i },
  { key: "maison", re: /maison|d[ée]coration|d[ée]co|tapis|coussin|rideau|vase|miroir|cadre|bougie/i },
];
/** Détecte la niche depuis la niche configurée + titres/types/tags du catalogue. */
export function detectNiche(text: string): NicheKey {
  const t = (text || "").toLowerCase();
  for (const { key, re } of NICHE_KEYWORDS) if (re.test(t)) return key;
  return "generaliste";
}
const NICHE_GUIDE: Record<NicheKey, string> = {
  luminaire: "NICHE = LUMINAIRE. Titre : type + matière/forme/style (ex. « Suspension Verre Craquelé »). Description : style, pièce, ambiance, rendu, dimensions ; culot/LED/dimmable/puissance/température/matériau UNIQUEMENT si présents dans la source. Meta : bénéfice déco, pas technique. Tags : type + matière + pièce + style (suspension, luminaire cuisine, éclairage intérieur).",
  bebe: "NICHE = BÉBÉ / PUÉRICULTURE. Titre : produit + usage + bénéfice parent (ex. « Chauffe-Biberon Nomade »). Description : praticité, confort, entretien, usage parent ; JAMAIS de promesse médicale, de sécurité ou de sommeil non prouvée. N'invente JAMAIS : âge conseillé, norme (EN 71/CE), certification, matériau, sans BPA, poids supporté. FAQ : usage quotidien, nettoyage, à vérifier avant usage. Tags : bébé, repas bébé, sécurité bébé, accessoire bébé.",
  beaute: "NICHE = BEAUTÉ / COSMÉTIQUE. Titre : type de soin + usage (ex. « Sérum Hydratant Visage »). Description : routine, sensation, utilisation, précautions ; texture/type de peau/ingrédient UNIQUEMENT si sourcés. N'invente JAMAIS : ingrédients actifs, résultats, anti-âge/anti-acné, test dermatologique, hypoallergénique, bio. FAQ : intégration dans la routine, fréquence, type de peau (si source). Tags : soin visage, hydratation, routine beauté.",
  mode: "NICHE = MODE / VÊTEMENTS. Titre : type + coupe + style (ex. « Robe Longue Fluide »). Description : coupe, style, occasions, associations, confort ; matière/lavage/origine UNIQUEMENT si sourcés. N'invente JAMAIS : matière, coupe exacte, taille, origine, imperméable, respirant. FAQ : comment porter, quelle taille, entretien (si source). Tags : robe, mode femme, tenue élégante.",
  sport: "NICHE = SPORT / FITNESS / PILATES / YOGA. Titre : équipement + usage, en FRANÇAIS — franciser le vocabulaire courant (« Spine Corrector » → « Correcteur de Posture », « Chair » → « Chaise ») mais GARDER les noms d'appareils Pilates (« Reformer », « Cadillac », « Wunda »). Le nom brandé n'est JAMAIS un type/modèle d'appareil (Reformer, Cadillac, Wunda, Chair, Spine, Corrector, Barrel, Ladder). Description : usage, entraînement, confort, stabilité, rangement, dimensions — vocabulaire BIEN-ÊTRE / remise en forme. INTERDIT même si présent dans la source : promesse médicale ou thérapeutique, rééducation, traitement de douleurs/pathologies, mobilité vertébrale, supervision d'un professionnel, guérison — reformule en bien-être (« travail postural », « renforcement musculaire »). JAMAIS de performance/charge max/usage pro non sourcés. Meta : commerciale et motivante (bénéfice forme/bien-être), ni technique ni médicale. Tags : 8 à 12, appareil + usage + niveau + lieu (« reformer pilates, appareil pilates, renforcement musculaire, gainage, fitness maison, studio pilates, yoga, remise en forme »).",
  cuisine: "NICHE = CUISINE. Titre : ustensile + matière/usage (ex. « Poêle Antiadhésive »). Description : usage, praticité, entretien, compatibilité (induction…) SI sourcée ; JAMAIS de matériau/compatibilité/certification non sourcés. Tags : cuisine, ustensile, accessoire cuisine.",
  mobilier: "NICHE = MOBILIER. Titre : meuble + matière/style (ex. « Table Basse Bois »). Description : style, pièce, dimensions, usage ; matériau/charge UNIQUEMENT si sourcés. Tags : meuble, salon, mobilier moderne.",
  electronique: "NICHE = ÉLECTRONIQUE / ACCESSOIRES. Titre : produit + usage (ex. « Chargeur Sans Fil »). Description : usage, compatibilité SI sourcée, praticité ; JAMAIS de spec technique (puissance, autonomie, compatibilité) non sourcée. Tags : accessoire, high-tech, recharge.",
  animaux: "NICHE = ANIMAUX. Titre : produit + animal + usage (ex. « Gamelle Antidérapante Chien »). Description : usage, confort animal, entretien ; JAMAIS de promesse santé/taille/âge non sourcée. Tags : chien, chat, accessoire animal.",
  maison: "NICHE = MAISON / DÉCO. Titre : produit + matière/style (ex. « Vase Céramique Mat »). Description : style, pièce, ambiance, rendu, dimensions ; matériau UNIQUEMENT si sourcé. Tags : décoration, maison, salon.",
  generaliste: "NICHE = GÉNÉRALISTE. Titre : produit + attribut concret. Description : usage, bénéfice, style ; aucune donnée technique inventée. Tags : pertinents au produit.",
};

// ── Moteur de NAMING UNIVERSEL (toutes niches, sans patch manuel) ───────────
// Principe : le titre final doit rester FIDÈLE au vrai produit et conserver le
// mot-clé que le client chercherait. On ne devine pas le type depuis un mot
// d'usage de la description (« posture » ne transforme pas un Reformer en
// « Correcteur de posture »). Logique générale, pilotée par :
//   1) le mot-clé marché fourni par l'IA (champ `keyword`) ;
//   2) à défaut, le mot-clé extrait du titre source ;
//   3) un lexique EN→FR de langue (pas de règle métier par niche) pour traduire
//      proprement quand l'IA a dérivé vers un terme vague.
// Le QC est CONSERVATEUR : il garde les bons titres, ne corrige que les faibles.

// Lexique EN→FR de NOMS PRODUITS et attributs courants (langue, transverse niches).
// Sert à (a) reconnaître qu'un titre FR traduit conserve bien le mot-clé source,
// (b) reconstruire un titre propre quand l'IA a remplacé le produit par du vague.
const EN_FR_LEX: Record<string, string> = {
  // Luminaire (phrases avant mots simples).
  "ceiling light": "plafonnier", "ceiling lamp": "plafonnier", "pendant light": "suspension",
  "pendant lamp": "suspension", "wall light": "applique murale", "wall lamp": "applique murale",
  "table lamp": "lampe à poser", "floor lamp": "lampadaire", "bedside lamp": "lampe de chevet",
  "pendant": "suspension", "chandelier": "lustre",
  // Mode.
  "maxi dress": "robe longue", "dress": "robe", "jacket": "veste", "sweater": "pull", "hoodie": "sweat",
  "pants": "pantalon", "trousers": "pantalon", "shirt": "chemise", "skirt": "jupe", "coat": "manteau",
  "shoes": "chaussures", "handbag": "sac à main", "bag": "sac", "scarf": "écharpe",
  // Beauté.
  "face serum": "sérum visage", "serum": "sérum", "face cream": "crème visage", "moisturizer": "crème hydratante",
  "cream": "crème", "cleanser": "nettoyant", "face mask": "masque visage", "mask": "masque",
  "hair oil": "huile capillaire", "oil": "huile", "brush": "brosse", "vitamin": "vitamine",
  // Bébé.
  "bottle warmer": "chauffe-biberon", "breast pump": "tire-lait", "baby carrier": "porte-bébé",
  "high chair": "chaise haute", "stroller": "poussette", "baby monitor": "babyphone",
  "sterilizer": "stérilisateur", "nursing pillow": "coussin d'allaitement",
  // Sport (génériques ; Reformer/Pilates/Cadillac/Wunda restent intacts, absents du lexique).
  "yoga mat": "tapis de yoga", "mat": "tapis", "resistance band": "élastique", "foam roller": "rouleau",
  "jump rope": "corde à sauter", "chair": "chaise", "ring": "anneau",
  // Cuisine / maison / électronique.
  "cutting board": "planche à découper", "knife": "couteau", "frying pan": "poêle", "pan": "poêle",
  "pot": "casserole", "charger": "chargeur", "headphones": "casque", "earbuds": "écouteurs",
  "speaker": "enceinte", "cable": "câble",
  // Matières / couleurs / formats (adjectifs).
  "stainless steel": "acier inoxydable", "glass": "verre", "wooden": "bois", "wood": "bois", "steel": "acier",
  "leather": "cuir", "cotton": "coton", "linen": "lin", "silk": "soie", "satin": "satin", "velvet": "velours",
  "marble": "marbre", "ceramic": "céramique", "black": "noir", "white": "blanc", "gold": "doré", "golden": "doré",
  "silver": "argenté", "grey": "gris", "gray": "gris", "blue": "bleu", "green": "vert", "red": "rouge",
  "pink": "rose", "beige": "beige", "brown": "marron", "long": "longue", "short": "courte", "large": "grand",
  "small": "petit", "portable": "portable", "foldable": "pliable", "adjustable": "réglable",
  "wireless": "sans fil", "waterproof": "imperméable",
};
const LEX_KEYS = Object.keys(EN_FR_LEX).sort((a, b) => b.length - a.length); // phrases d'abord
function matchCase(orig: string, repl: string): string {
  if (orig && orig[0] === orig[0].toUpperCase()) return repl.charAt(0).toUpperCase() + repl.slice(1);
  return repl;
}
/** Traduit EN→FR les noms produits / attributs connus (mots entiers, phrases d'abord). */
function applyEnFr(text: string): string {
  let out = text || "";
  for (const k of LEX_KEYS) {
    const re = new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    out = out.replace(re, (m) => matchCase(m, EN_FR_LEX[k]));
  }
  return out;
}

// Attributs utiles à CONSERVER dans un titre (matière / couleur / format) — jamais l'usage.
const TITLE_ATTRS = new Set<string>([
  "bois", "metal", "acier", "aluminium", "verre", "bambou", "mousse", "cuir", "plastique", "inox",
  "laiton", "rotin", "marbre", "ceramique", "tissu", "cristal", "beton", "pierre", "lin", "coton",
  "soie", "velours", "satin", "satinee", "satine",
  "noir", "blanc", "gris", "beige", "dore", "argent", "argente", "bleu", "vert", "rouge", "rose",
  "marron", "taupe", "naturel", "creme", "ivoire", "camel", "kaki", "cuivre",
  "pliable", "pliant", "portable", "compact", "mural", "reglable", "nomade", "demontable", "rond",
  "carre", "ovale", "rectangulaire", "double", "triple", "mini", "xl", "large", "long", "longue",
  "court", "courte", "fluide", "oversize", "haute", "antiderapant", "antiderapante", "electrique",
  "sans", "fil", "impermeable",
].map(normName));
// Mots PUREMENT génériques : un titre ne peut pas s'y résumer (aucun vrai produit).
const PURE_GENERIC = new Set<string>([
  "equipement", "accessoire", "support", "dispositif", "materiel", "article", "produit", "produits",
  "ensemble", "appareil", "gamme", "kit", "set", "objet", "solution", "luminaire", "eclairage",
  "mobilier", "vetement", "outil", "systeme", "collection", "piece", "tenue", "soin",
].map(normName));
// Mots vides (stop) FR + EN pour l'extraction de mots-clés.
const NAMING_STOP = new Set<string>([
  "de", "du", "des", "la", "le", "les", "au", "aux", "en", "et", "ou", "pour", "avec", "sur", "sans",
  "dans", "a", "d", "l", "un", "une", "votre", "notre", "nouveau", "nouvelle",
  "the", "a", "an", "of", "for", "with", "and", "or", "to", "in", "on", "by", "your", "our", "new",
].map(normName));
// Usages / bénéfices / marketing : vont dans la DESCRIPTION, jamais nommer le produit.
const NAMING_USAGE = new Set<string>([
  "posture", "posturale", "mobilite", "renforcement", "confort", "soutien", "maintien", "detente",
  "relaxation", "bienetre", "eclat", "hydratation", "nutrition", "minceur", "tonus", "energie",
  "ambiance", "elegance", "elegant", "elegante", "raffinement", "charme", "tendance", "chic",
  "moderne", "contemporain", "design", "premium", "luxe", "luxueux", "qualite", "professionnel",
  "performance", "ideal", "ideale", "parfait", "essentiel", "incontournable", "stylé", "style",
].map(normName));

function nzTokens(text: string): string[] {
  return (text || "").replace(/<[^>]+>/g, " ").split(/[^A-Za-zÀ-ÿ]+/).filter(Boolean);
}
function titleCaseWord(w: string): string { return w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w; }

export interface MarketKeyword { tokens: string[]; phrase: string; strong: boolean }
/** Mots-clés « propres » d'un texte : sans stop / usage / SKU, garde l'ordre. */
function keywordTokens(text: string): string[] {
  const out: string[] = [];
  for (const w of nzTokens(text)) {
    const n = normName(w);
    if (!n || n.length < 2 || /\d/.test(w)) continue;
    if (NAMING_STOP.has(n) || NAMING_USAGE.has(n) || PURE_GENERIC.has(n)) continue;
    out.push(w);
  }
  return out;
}
function toKeyword(text: string): MarketKeyword {
  const tokens = keywordTokens(text).slice(0, 6);
  const strong = tokens.some((w) => !TITLE_ATTRS.has(normName(w)));
  return { tokens, phrase: tokens.join(" "), strong };
}
/** Mot-clé marché extrait de la SOURCE (titre → type → tags). */
export function extractSourceKeyword(src?: { title?: string; type?: string; tags?: string; body?: string; options?: string }): MarketKeyword {
  for (const f of [src?.title, src?.type, src?.tags]) {
    const kw = toKeyword(f || "");
    if (kw.strong) return kw;
  }
  return toKeyword(src?.title || src?.type || "");
}
/** Tête du mot-clé = token nom le plus distinctif (le plus long ; à égalité, le nom
 *  propre / non traduisible l'emporte). C'est lui qui DOIT rester dans le titre. */
function pickHead(tokens: string[]): string {
  const nouns = tokens.filter((w) => !TITLE_ATTRS.has(normName(w)));
  const pool = nouns.length ? nouns : tokens;
  let head = "";
  for (const w of pool) {
    if (!head) { head = w; continue; }
    const a = normName(w), b = normName(head);
    if (a.length > b.length) head = w;
    else if (a.length === b.length && !EN_FR_LEX[w.toLowerCase()] && EN_FR_LEX[head.toLowerCase()]) head = w; // nom propre prioritaire
  }
  return head;
}
/** Le titre conserve-t-il la tête du mot-clé (en clair ou via sa traduction FR) ? */
function titleHasHead(product: string, head: string): boolean {
  if (!head) return true;
  const toks = new Set(nzTokens(product).map(normName));
  const n = normName(head);
  if (toks.has(n)) return true;
  const tr = EN_FR_LEX[head.toLowerCase()];
  if (tr) for (const w of nzTokens(tr)) if (toks.has(normName(w))) return true;
  for (const a of toks) if (a.length >= 4 && n.length >= 4 && a.slice(0, 4) === n.slice(0, 4)) return true; // variante proche
  return false;
}
function isPureGeneric(text: string): boolean {
  const words = nzTokens(text).map(normName).filter((w) => w && !NAMING_STOP.has(w));
  return words.length > 0 && words.every((w) => PURE_GENERIC.has(w) || NAMING_USAGE.has(w));
}
function salvageAttributes(text: string): string[] {
  const out: string[] = []; const seen = new Set<string>();
  for (const w of nzTokens(text)) {
    const n = normName(w);
    if (!n || seen.has(n) || !TITLE_ATTRS.has(n)) continue;
    seen.add(n); out.push(titleCaseWord(w));
    if (out.length >= 2) break;
  }
  return out;
}
/** Reconstruit un titre propre depuis le mot-clé (traduit FR si besoin) + attributs salvables :
 *  noms d'abord, attributs (matière/couleur/format) ensuite. */
function buildFromKeyword(phrase: string, aiProduct: string, fr: boolean): string {
  const base = fr ? applyEnFr(phrase) : phrase;
  const toks = base.split(/\s+/).filter((w) => { const n = normName(w); return n && !NAMING_STOP.has(n) && !NAMING_USAGE.has(n) && !/\d/.test(w); });
  const nouns = toks.filter((w) => !TITLE_ATTRS.has(normName(w)));
  const attrs = toks.filter((w) => TITLE_ATTRS.has(normName(w)));
  const seen = new Set<string>(); const words: string[] = [];
  for (const w of [...nouns, ...attrs, ...salvageAttributes(aiProduct)]) {
    const n = normName(w); if (!n || seen.has(n)) continue; seen.add(n); words.push(titleCaseWord(w));
    if (words.length >= 6) break;
  }
  return words.join(" ");
}
/** Choisit le meilleur nom produit, de manière UNIVERSELLE et conservatrice :
 *  garde le titre de l'IA s'il conserve le mot-clé marché ; sinon recadre dessus. */
export function enforceMarketName(aiProduct: string, aiKeyword: string | undefined, src: { title?: string; type?: string; tags?: string; body?: string; options?: string } | undefined, fr: boolean): { product: string; recadred: boolean; generic: boolean } {
  const p = (aiProduct || "").trim();
  const srcKw = extractSourceKeyword(src);
  const aiKw = toKeyword(aiKeyword || "");
  // Ancre = mot-clé IA s'il est fort ET fidèle à la source ; sinon mot-clé source.
  const aiFaithful = aiKw.strong && srcKw.strong && aiKw.tokens.some((w) => srcKw.tokens.some((s) => normName(s) === normName(w)));
  const anchor = aiFaithful ? aiKw : (srcKw.strong ? srcKw : (aiKw.strong ? aiKw : null));
  if (!anchor) return { product: p, recadred: false, generic: isPureGeneric(p) };
  if (titleHasHead(p, pickHead(anchor.tokens))) return { product: p, recadred: false, generic: false }; // bon titre → on garde
  const rebuilt = buildFromKeyword(anchor.phrase, p, fr);
  if (!rebuilt || normName(rebuilt) === normName(p)) return { product: p, recadred: false, generic: false };
  return { product: rebuilt, recadred: true, generic: false };
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
  // Adaptation à la niche : titres, description, meta, tags, infos sensibles.
  const niche = detectNiche(`${ctx.niche || ""} ${products.slice(0, 8).map((p) => `${p.title} ${p.type} ${p.tags}`).join(" ")}`);
  directives.push(NICHE_GUIDE[niche]);
  directives.push("Analyse produit : déduis type, usage, pièce adaptée, style, couleur/matière SEULEMENT si présents. Ce qui est inconnu reste non mentionné (jamais inventé).");
  directives.push("NAMING (raisonne comme un spécialiste SEO e-commerce, AVANT d'écrire le titre) — universel, toutes niches :\n" +
    "1) Identifie le VRAI produit à partir du titre source, du product_type et des tags — JAMAIS d'un mot d'usage de la description.\n" +
    "2) Détermine : primaryProductType (le produit réel), primarySearchKeyword (« comment un client chercherait ce produit sur Google/Shopify dans cette niche »), secondaryAttributes (matière/couleur/format SI sourcés), usageTerms (posture, mobilité, confort, éclat… → vont en DESCRIPTION), forbiddenTitleTerms (un usage qui n'est pas le produit).\n" +
    "3) Imagine 3 à 5 titres candidats : (a) fidèle à la source nettoyé, (b) basé sur le mot-clé marché, (c) commercial court premium, (d) avec un attribut utile sourcé. Choisis le meilleur (fidélité produit + potentiel SEO + naturel + clarté + zéro invention + longueur courte + cohérence niche).\n" +
    "4) Le titre final DOIT contenir le primarySearchKeyword (ou une variante très proche). Ne remplace JAMAIS un produit précis par une catégorie ou un usage vague.\n" +
    "5) NE SUR-TRADUIS PAS : si le terme anglais est le mot-clé du marché cible, garde-le (ex. « Pilates Reformer », « Reformer Pilates », « Wunda Chair », « Cadillac Reformer », « Spine Corrector »). Traduis seulement quand il existe un équivalent FR courant qui ne fait pas perdre le mot-clé (« ceiling light » → « Plafonnier », « long satin dress » → « Robe Longue Satinée »).\n" +
    "Exemples (BON vs MAUVAIS) : « Pilates Reformer » → « Reformer Pilates » (pas « Correcteur de posture » ni « Équipement Pilates ») ; « portable bottle warmer » → « Chauffe-Biberon Portable » (pas « Accessoire Repas Bébé ») ; « vitamin C face serum » → « Sérum Vitamine C Visage » (pas « Soin Beauté Éclat ») ; « glass pendant light » → « Suspension Verre » (pas « Éclairage Intérieur Design »).");
  directives.push("Mot-clé : le champ `keyword` = primarySearchKeyword (la requête d'achat que taperait un client pour CE produit dans cette niche). Le titre doit le contenir. Ajoute des termes naturels (usage, pièce, style) dans la description, sans bourrage.");
  // Titres (profil).
  const titleNat = "Le titre doit ressembler à celui d'un e-commerçant premium : COURT (3 à 6 mots), naturel, commercial, propre. INTERDIT : clause après un tiret (« – Éclairage LED Contemporain », « – Cadre Doré »), accumulation de caractéristiques, jargon technique dans le titre (« soufflé à la main », « éclairage LED contemporain », « finition chromée », « hauteur ajustable », « base ronde », « linéaire ») — ces détails vont dans la description SI sourcés. PAS de traduction mot-à-mot, PAS de titre fournisseur, PAS d'info inventée, PAS d'anglais. Ex BONS : « Suspension Verre Craquelé Doré », « Lustre Bulles de Verre », « Lustre Spirale Cristal », « Lustre Rond Aluminium ». Ex MAUVAIS : « Lustre à Sphères en Verre Bullé Soufflé à la Main », « Lustre Rond Linéaire en Aluminium – Éclairage LED Contemporain ». Capitalisation FRANÇAISE (minuscule aux connecteurs et après apostrophe : « Goutte d'eau »).";
  if (ctx.titleFormat === "brand_suffix" || (rules.titleFormat === "brand_suffix" && !ctx.titleFormat)) {
    directives.push(`Titres : format OBLIGATOIRE « Nom Produit | NomBrandé ». Le nom produit avant le « | » fait 3 à 6 mots. ${titleNat}\nNOM BRANDÉ (qualité essentielle) — style « ${rules.brandNameStyle || "premium discret"} ». Il doit être : court (1 mot, ~2-3 syllabes), PREMIUM, mémorisable, PRONONÇABLE, crédible commercialement, sans faute. INTERDIT : sonner cheap, ressembler à un code/modèle fournisseur, être un mot anglais technique, finir tous par le même suffixe, être une variation pauvre d'un autre (Velia/Vélia, Luma/Lumia = doublons). JAMAIS un type, un modèle, une catégorie produit ni un mot déjà présent dans le titre/type source (ex. à proscrire : Cadillac, Wunda, Reformer, Pilates, Chair, Spine, Corrector, Barrel, Ladder, Studio, Fitness) — invente un vrai nom de marque. UNIQUE : différent de tous ceux déjà pris (début, son et orthographe), accents inclus. Ce N'EST JAMAIS le vendor « ${vendor} » ni la marque. Noms brandés déjà pris (à ÉVITER, même approchant) : ${mem.brandNames.slice(0, 80).join(", ") || "(aucun)"}.`);
  } else {
    directives.push(`Titres : ${TITLE_LABEL[rules.titleStyle]}, SANS nom brandé (le vendor « ${vendor} » ne va PAS dans le titre). ${ctx.titleRules || "3 à 8 mots, descriptif, pas générique."} ${titleNat} Ne finis jamais par « et/ou/en/de/- ».`);
  }
  // Description.
  const richDesc = rules.description === "html_rich" || rules.level === "poussé" || rules.level === "ultra complet";
  const ultra = rules.level === "ultra complet";
  const lengthGoal = ultra
    ? " LONGUEUR CIBLE : fiche premium complète d'environ 2700 à 3200 caractères de texte si la source le permet. Développe chaque section (2 à 4 phrases par paragraphe). Si — et seulement si — la source est trop pauvre pour atteindre cette longueur SANS inventer, reste plus court mais GARDE la structure complète et mets status 'review'. N'invente JAMAIS pour rallonger."
    : rules.level === "poussé"
    ? " LONGUEUR CIBLE : environ 2000 à 2700 caractères de texte si la source le permet (structure complète)."
    : " LONGUEUR CIBLE : environ 1200 à 1800 caractères si la source le permet — structure complète mais plus courte.";
  const antiFiller = " Évite les formules passe-partout (« apporte une touche moderne et élégante », « ambiance chaleureuse », « style contemporain », « idéal pour votre intérieur ») : appuie-toi plutôt sur la FORME, le rendu visuel, les DIMENSIONS, les pièces adaptées, les variantes, la matière SI fiable, l'usage, l'aide au choix et la comparaison entre tailles. Le texte doit réellement aider le client à choisir.";
  if (richDesc) directives.push(`Description : HTML, naturelle, française, premium, e-commerce, publiable telle quelle.${lengthGoal}${antiFiller} STRUCTURE OBLIGATOIRE (même structure quel que soit le niveau ; remplace « [type de produit] » par le VRAI type, « [Nom produit final] » par le nom produit ; mets le mot-clé principal en <strong> dans l'intro). FAQ : ${ultra ? "3 à 5" : "3"} questions UTILES avec réponses PRUDENTES (jamais d'invention : ni garantie, délai, manuel inclus, compatibilité, matériau précis, dimmable, certification). Suis CETTE structure EXACTE :\n${DESC_SKELETON}`);
  else directives.push("Description : claire, naturelle, française, exploitable, sans blabla ni invention.");
  // Dimensions / tailles : ne JAMAIS les perdre (règle critique).
  directives.push("DIMENSIONS : si la source contient des tailles, dimensions, mesures ou variantes de taille, CONSERVE-les TOUTES. Traduis en français, convertis les pouces en centimètres (ex. « W 20.1 inch x H 14.2 inch » → « L 51 cm × H 36 cm » ; « 90 x 50 x 30 cm » reste « 90 × 50 × 30 cm » ; « S / M / L » → garde les formats). N'invente AUCUNE dimension absente ; si aucune n'est fournie, n'écris pas « dimensions non communiquées » et utilise « Format et utilisation » à la place.");
  // Anti-fournisseur / concurrent (toutes niches) : la fiche s'adresse au client final.
  directives.push(`NEUTRALISE toute identité fournisseur / concurrent dans la fiche (body, meta, SEO title, tags, alt, FAQ, H2/H3/H4, product_type, collections) : aucun nom de fournisseur ou de marque source, aucun nom de domaine, aucun email/téléphone, aucune remise/tarif grossiste, aucun « contactez notre équipe ». Ne parle JAMAIS de la marque source : « ... de <Fournisseur> » → retire « de <Fournisseur> » ; « modèle <Marque source> » → « ce modèle ». La seule marque autorisée est « ${vendor} » (le vendor final).`);
  // Vocabulaire INTERDIT dans une fiche générée.
  directives.push("N'écris JAMAIS dans une fiche : « stock », « en stock », « stock limité », « produit physique », « produit réel », « expédition depuis », « inventaire », « disponibilité », « quantité disponible » ; ni le jargon « mot-clé », « SEO », « référencement », « maillage interne », « optimisé », « fiche produit », « description produit ». Texte 100 % orienté client.");
  // Meta (profil).
  if (rules.meta) directives.push(`Meta : metaTitle au format « Mot-clé principal | ${brand} » (50–70 car.), première lettre en MAJUSCULE, marque « ${brand} » avec sa casse EXACTE (jamais en minuscule). metaDescription ≤ 160 car. : une PHRASE COMPLÈTE et naturelle qui se termine proprement (ponctuation) AVANT le suffixe — ne JAMAIS finir par « ou », « et », « à », « pour », « avec », « salle », « salon », « cuisine », « idéale », « compatible », « disponible », ni couper une énumération au milieu. Inclut le mot-clé, formulation NATURELLE et VARIÉE d'un produit à l'autre — appuie-toi sur un angle DIFFÉRENT à chaque fois (forme, matière, pièce, effet visuel, usage, style). N'utilise PAS les formules passe-partout (« élégance moderne », « Découvrez notre… », « ambiance chaleureuse », « apportera une touche », « intérieur élégant »). Pas de promesse agressive${suffix ? `, et TERMINE par EXACTEMENT « ${suffix} » — copie-le caractère pour caractère (même ponctuation finale, même casse, même espace), une SEULE fois, jamais tronqué, jamais en double` : ""}. Ex variés : « Suspension en verre craquelé au style lumineux, idéale pour une cuisine ou une salle à manger.${suffix ? " " + suffix : ""} » / « Lustre rond en aluminium pour éclairer une pièce de vie avec une silhouette sobre.${suffix ? " " + suffix : ""} ».`);
  // Maillage.
  if (rules.internalLinking && cols.length) directives.push(`Maillage : ajoute dans un paragraphe de bodyHtml UN lien naturel vers la collection la plus pertinente, au format EXACT <strong><u><a href="URL">ancre</a></u></strong>. Varie les ancres (déjà utilisées : ${mem.anchors.slice(0, 40).join(", ") || "(aucune)"}). N'écris jamais « maillage interne ».`);
  // Alt.
  if (rules.altText) directives.push("Alt text : un par image (imageAlts), MÊME nom produit dans chaque, différencié par la vue (face, en situation, détail, dimensions, variante). Jamais « Image de… ».");
  // Tags / type.
  if (rules.tagsType) directives.push("Tags / product_type : product_type clair en français ; 8 à 12 tags pertinents et adaptés à la NICHE, dont des tags de LONGUE TRAÎNE (2-3 mots) combinant type + pièce/matière/usage/niveau. Ex. « lustre, lustre cristal, luminaire salon, éclairage intérieur, luminaire moderne » — PAS uniquement des mots génériques isolés (« salon », « moderne »). Inclure matière/couleur/usage si connus. Supprime les tags fournisseur inutiles.");
  // Collections.
  if (cols.length || rules.collections.length) directives.push("Collections : recommande 1 à 3 collections en français naturel, cohérentes avec le produit ; privilégie les collections fournies ci-dessus ; n'invente pas de nouvelles collections si une liste est donnée ; pas de nom de collection en anglais.");
  // Variantes / unités.
  directives.push(`Variantes : conserve-les ; traduis les options (${VARIANT_TRANSLATIONS}).`);
  if (rules.convertUnits) directives.push(`Unités : convertis pouces/ft/lbs en cm/m/kg dans le texte si pertinent (${UNIT_EXAMPLES}). Ne touche pas aux dimensions de variantes, n'en invente pas.`);
  const handleLabel: Record<HandleMode, string> = { keep: "garder les handles d'origine (newHandle vide)", clean: "nettoyer (minuscules, sans accents, tirets, court)", fr: "générer en français propre", short: "générer courts" };
  directives.push(`Handles : ${handleLabel[rules.handleMode]} ; basé sur le titre, sans marque concurrente ni ancien nom brandé.`);
  directives.push(`Niveau d'intervention : ${rules.level}.`);
  directives.push(`PUBLIABLE : relis chaque titre, meta title, meta description, tag et nom de collection comme s'ils allaient être publiés IMMÉDIATEMENT sur Shopify, en ${rules.language} naturel et propre. ${/fran[çc]ais/i.test(rules.language) ? "Aucun mot anglais ne doit rester (sauf nom propre, marque ou terme technique nécessaire), accents corrects, zéro faute. " : ""}Respecte EXACTEMENT la casse de la marque « ${brand} » (ex : « ${brand} », jamais en minuscules).`);

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

  // ── Sécurité emojis : aucun pictogramme dans un champ texte Shopify final ──
  let emojiFixed = 0;
  {
    const textFields: ShopifyField[] = ["Title", "Body", "Tags", "Type", "SeoTitle", "SeoDescription", "ImageAlt", "Option1Name", "Option1Value", "Option2Name", "Option2Value", "Option3Name", "Option3Value", "Handle", "Vendor"];
    const textCols = textFields.map((f) => idx[f]).filter((i): i is number => i !== undefined);
    for (const r of rows) for (const ci of textCols) { const v = r[ci]; if (v && hasEmoji(v)) { r[ci] = stripEmoji(v); emojiFixed++; } }
  }

  // ── Options / variantes : français + pouces → cm (libellés ; emojis déjà retirés) ──
  const french = /fran[çc]ais/i.test(rules.language);
  {
    const nameCols = (["Option1Name", "Option2Name", "Option3Name"] as ShopifyField[]).map((f) => map[f]).filter((i): i is number => i !== undefined);
    const valCols = (["Option1Value", "Option2Value", "Option3Value"] as ShopifyField[]).map((f) => map[f]).filter((i): i is number => i !== undefined);
    for (const r of rows) {
      for (const ci of nameCols) { const v = cell(r, ci); if (v) r[ci] = cleanOptionName(v, french); }
      for (const ci of valCols) { const v = cell(r, ci); if (v) r[ci] = cleanOptionValue(v, french, rules.convertUnits); }
    }
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

  // Emojis : signalés s'ils ont été retirés, RISK s'il en reste après nettoyage.
  if (emojiFixed) flag("warning", "Emoji retiré d'un champ Shopify", `${emojiFixed} cellule(s)`);
  {
    const textFieldsQc: ShopifyField[] = ["Title", "Body", "Tags", "Type", "SeoTitle", "SeoDescription", "ImageAlt", "Option1Name", "Option1Value", "Option2Name", "Option2Value", "Option3Name", "Option3Value"];
    const cols = textFieldsQc.map((f) => idx[f]).filter((i): i is number => i !== undefined);
    let left = 0;
    for (const r of rows) for (const ci of cols) if (hasEmoji(r[ci] ?? "")) left++;
    if (left) flag("risk", "Emoji encore présent dans un champ Shopify", `${left} cellule(s)`);
  }

  // Options/variantes : anglais résiduel ou pouces non convertis (langue française).
  if (french) {
    const nameColsQc = (["Option1Name", "Option2Name", "Option3Name"] as ShopifyField[]).map((f) => map[f]).filter((i): i is number => i !== undefined);
    const valColsQc = (["Option1Value", "Option2Value", "Option3Value"] as ShopifyField[]).map((f) => map[f]).filter((i): i is number => i !== undefined);
    let enOpt = 0, inchOpt = 0;
    for (const r of rows) {
      for (const ci of nameColsQc) if (ENGLISH_OPTION_RE.test(cell(r, ci))) enOpt++;
      for (const ci of valColsQc) { const v = cell(r, ci); if (/["”]|\binch(es)?\b|\bpouces?\b/i.test(v)) inchOpt++; else if (ENGLISH_OPTION_RE.test(v)) enOpt++; }
    }
    if (enOpt) flag("risk", "Options/variantes encore en anglais", `${enOpt} valeur(s)`);
    if (rules.convertUnits && inchOpt) flag("risk", "Dimensions de variantes encore en pouces", `${inchOpt} valeur(s)`);
  }

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

// ── Options / variantes : traduction FR + conversion pouces → cm (libellés) ──
const OPTION_NAME_FR: Record<string, string> = {
  size: "Taille", color: "Couleur", colour: "Couleur", style: "Style", combination: "Configuration",
  "plug type": "Type de prise", "emitting color": "Couleur d'éclairage", "emitting colour": "Couleur d'éclairage",
  "lampshade color": "Couleur de l'abat-jour", "body color": "Couleur du corps", finish: "Finition",
  material: "Matériau", diameter: "Diamètre", height: "Hauteur", width: "Largeur", length: "Longueur",
  wattage: "Puissance", power: "Puissance", quantity: "Quantité", pack: "Lot", voltage: "Voltage", shape: "Forme", model: "Modèle",
};
const OPTION_VALUE_FR: Record<string, string> = {
  single: "Unité", "set of 2": "Lot de 2", "set of 3": "Lot de 3", "set of 4": "Lot de 4",
  "set (2 pcs)": "Lot de 2", "set (3 pcs)": "Lot de 3", "2 pcs": "Lot de 2", "3 pcs": "Lot de 3",
  "warm white": "Blanc chaud", "cold white": "Blanc froid", "cool white": "Blanc froid", "neutral white": "Blanc neutre",
  dimmable: "Intensité variable", "remote control": "Télécommande", "with remote": "Avec télécommande", "without remote": "Sans télécommande",
  gold: "Doré", black: "Noir", white: "Blanc", silver: "Argenté", chrome: "Chromé", "rose gold": "Doré rose",
  round: "Rond", square: "Carré", small: "Petit", medium: "Moyen", large: "Grand",
};
const ENGLISH_OPTION_RE = /\b(size|color|colour|style|combination|plug|emitting|lampshade|finish|material|diameter|height|width|length|single|set of|pcs|warm white|cold white|cool white|neutral white|dimmable|remote|gold|black|white|silver|round|square|small|medium|large)\b/i;
function escapeReg(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function convertInchesToCm(s: string): string {
  return s.replace(/(\d+(?:[.,]\d+)?)\s*(?:["”'']|inches?|inch|in\b|pouces?|po\b)/gi, (_m, num: string) => {
    const v = parseFloat(num.replace(",", "."));
    if (!isFinite(v)) return _m;
    const cm = v * 2.54;
    // Arrondi à l'entier pour les tailles produit usuelles (6.2"→16, 11.8"→30…) ;
    // une décimale seulement pour les très petites dimensions.
    const r = cm < 2 ? cm.toFixed(1).replace(".", ",") : String(Math.round(cm));
    return `${r} cm`;
  });
}
function frenchifyDimAbbrev(s: string): string {
  return s.replace(/\bW\b/g, "L").replace(/\bD\b/g, "P").replace(/\bDia\.?/gi, "Diam.");
}
function cleanOptionName(name: string, french: boolean): string {
  if (!name) return name;
  const out = stripEmoji(name);          // jamais d'emoji dans un libellé d'option
  if (!french) return out;
  return OPTION_NAME_FR[out.toLowerCase().trim()] || out;
}
function cleanOptionValue(value: string, french: boolean, convert: boolean): string {
  if (!value) return value;
  let out = stripEmoji(value);           // « 🔥 L 51 cm » → « L 51 cm »
  if (convert) out = convertInchesToCm(out);
  if (french) {
    out = frenchifyDimAbbrev(out);
    const exact = OPTION_VALUE_FR[out.toLowerCase().trim()];
    if (exact) out = exact;
    else for (const [bad, good] of Object.entries(OPTION_VALUE_FR)) out = out.replace(new RegExp(`\\b${escapeReg(bad)}\\b`, "gi"), good);
  }
  return out;
}

export function slugify(s: string): string {
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

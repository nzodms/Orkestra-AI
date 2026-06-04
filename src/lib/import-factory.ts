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
  | "Handle" | "Title" | "Body" | "Vendor" | "Category" | "Type" | "Tags" | "Published"
  | "Option1Name" | "Option1Value" | "Option2Name" | "Option2Value" | "Option3Name" | "Option3Value"
  | "VariantSKU" | "VariantPrice" | "ImageSrc" | "ImageAlt" | "SeoTitle" | "SeoDescription" | "Status";

const HEADER_MAP: Record<string, ShopifyField> = {
  "handle": "Handle", "title": "Title", "body (html)": "Body", "body html": "Body", "body": "Body",
  "vendor": "Vendor", "product category": "Category", "type": "Type", "product type": "Type",
  "tags": "Tags", "published": "Published",
  "option1 name": "Option1Name", "option1 value": "Option1Value",
  "option2 name": "Option2Name", "option2 value": "Option2Value",
  "option3 name": "Option3Name", "option3 value": "Option3Value",
  "variant sku": "VariantSKU", "variant price": "VariantPrice",
  "image src": "ImageSrc", "image alt text": "ImageAlt",
  "seo title": "SeoTitle", "seo description": "SeoDescription", "status": "Status",
};

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
  images: ProductImage[];
  variants: ProductVariant[];
}

function cell(row: string[], idx?: number): string { return idx === undefined ? "" : (row[idx] ?? "").trim(); }

/** Regroupe les lignes Shopify par Handle (1 produit = N lignes variantes/images). */
export function groupProducts(rows: string[][], map: DetectedColumns["map"]): ProductGroup[] {
  const groups = new Map<string, ProductGroup>();
  rows.forEach((row, i) => {
    const handle = cell(row, map.Handle) || `row-${i}`;
    let g = groups.get(handle);
    if (!g) {
      g = { handle, defRow: i, rowIndices: [], title: "", body: "", vendor: "", type: "", tags: "", seoTitle: "", seoDescription: "", images: [], variants: [] };
      groups.set(handle, g);
    }
    g.rowIndices.push(i);
    const title = cell(row, map.Title);
    if (title && !g.title) { g.title = title; g.defRow = i; g.body = cell(row, map.Body); g.vendor = cell(row, map.Vendor); g.type = cell(row, map.Type); g.tags = cell(row, map.Tags); g.seoTitle = cell(row, map.SeoTitle); g.seoDescription = cell(row, map.SeoDescription); }
    const src = cell(row, map.ImageSrc);
    if (src) g.images.push({ src, alt: cell(row, map.ImageAlt), rowIndex: i });
    const opt1 = cell(row, map.Option1Value);
    const sku = cell(row, map.VariantSKU);
    if (opt1 || sku) g.variants.push({ option1: opt1, sku, price: cell(row, map.VariantPrice), rowIndex: i });
  });
  return [...groups.values()];
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
}

export const BASE_RULES: ImportRules = {
  language: "Français", country: "France", tone: "naturel",
  transform: "clean_translate", titleStyle: "rewrite_seo",
  brandNames: false, brandNameStyle: "neutre",
  description: "html_rich", descriptionParts: ["h2h3", "benefits", "features", "faq"],
  collections: [], internalLinking: false, meta: true, altText: true, tagsType: true,
  handleMode: "clean", convertUnits: true, level: "standard",
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

export function buildTransformSystem(rules: ImportRules): string {
  return (
    "Tu es Orkestra Import Factory, expert en catalogues e-commerce Shopify. Tu transformes des produits importés " +
    "(fournisseur, ancienne boutique, concurrent, export Shopify) en fiches PROPRES, traduites et optimisées, prêtes à réimporter dans Shopify.\n" +
    `Langue cible : ${rules.language}. Pays cible : ${rules.country}. Ton : ${rules.tone}.\n` +
    "Réponds UNIQUEMENT par un objet JSON valide de la forme {\"products\":[ ... ]}. Chaque produit a EXACTEMENT ces clés : " +
    "handle (string, le handle d'origine reçu, inchangé, sert de clé), title (string), brandName (string, vide si non demandé), " +
    "bodyHtml (string, HTML Shopify propre), newHandle (string, slug propre ou vide), metaTitle (string ≤ 60), metaDescription (string ≤ 155), " +
    "tags (string, séparés par des virgules), productType (string), collections (string[], 1 à 3 recommandées), " +
    "imageAlts (string[], un alt par image, dans l'ordre), status ('ok'|'review'), notes (string[], points 'à vérifier').\n" +
    "GARDE-FOUS STRICTS — n'invente JAMAIS : dimensions, matériaux, compatibilités, certifications, garanties, pays d'origine, délais de livraison, prix, stock. " +
    "Si une donnée manque, reste prudent ou ajoute-la dans notes ('à vérifier') et mets status 'review'. " +
    "PRÉSERVE le sens des variantes/tailles (ne les réécris pas, n'en inventes pas). " +
    "Évite les superlatifs, les claims agressifs, le bourrage de mots-clés et les alt text absurdes. Pas de « Achetez maintenant »."
  );
}

export function buildTransformPrompt(products: ImportProductInput[], rules: ImportRules, mem: ImportMemory, ctx: ImportContext): string {
  const directives: string[] = [];
  directives.push(`Mode : ${TRANSFORM_LABEL[rules.transform]}.`);
  directives.push(`Titres : ${TITLE_LABEL[rules.titleStyle]}. Ne pas ajouter de caractéristique non présente (ex : LED, télécommande) ; titres naturels adaptés Shopify / Google Merchant.`);
  if (rules.brandNames) directives.push(`Noms brandés : génère un nom brandé UNIQUE par produit (style ${rules.brandNameStyle}), format « Titre | NomBrandé ». N'utilise JAMAIS un nom déjà pris : ${mem.brandNames.slice(0, 60).join(", ") || "(aucun pour l'instant)"}. Évite les doublons même avec accents.`);
  else directives.push("Noms brandés : aucun (titres descriptifs sans nom fantaisie).");
  const partLabel: Record<string, string> = { h2h3: "structure H2/H3", faq: "FAQ", benefits: "bénéfices", features: "caractéristiques", usage: "conseils d'usage/installation", reassurance: "réassurance" };
  const descLevel = { short: "courte", standard: "standard", long: "longue", html_rich: "HTML riche" }[rules.description];
  directives.push(`Description : ${descLevel}${rules.descriptionParts.length ? ` avec ${rules.descriptionParts.map((p) => partLabel[p] || p).join(", ")}` : ""}. Conserve les dimensions/tailles présentes${rules.convertUnits ? " ; convertis les pouces en cm si pertinent (garde les deux si utile)" : ""}. Mentionne matériaux/pièce recommandée UNIQUEMENT si présents ou clairement cohérents.`);
  if (rules.meta) directives.push("Meta : metaTitle naturel (≤ 60), metaDescription claire (≤ 155), sans promesse agressive, adaptée Google Merchant.");
  if (rules.altText) directives.push("Alt text : un alt par image (imageAlts, longueur = nombre d'images). Réutilise le MÊME nom produit dans chaque alt, différencié par la vue (vue de face, en situation, détail, dimensions, variante). Décris l'image avant de viser le mot-clé. Jamais « Image de… ».");
  if (rules.tagsType) directives.push("Tags / product_type : product_type clair, tags utiles (pas absurdes, pas inventés).");
  if (rules.internalLinking && rules.collections.length) directives.push(`Maillage : recommande 1 à 3 collections parmi : ${rules.collections.slice(0, 30).join(", ")}. Ajoute un maillage naturel dans bodyHtml avec des ancres variées (évite de répéter : ${mem.anchors.slice(0, 30).join(", ") || "(aucune encore)"}).`);
  else if (rules.collections.length) directives.push(`Collections : recommande 1 à 3 collections parmi : ${rules.collections.slice(0, 30).join(", ")}.`);
  directives.push(`Niveau d'intervention : ${rules.level}.`);
  const handleLabel: Record<HandleMode, string> = { keep: "garder les handles d'origine (newHandle vide)", clean: "nettoyer les handles", fr: "générer des handles en français", short: "générer des handles courts" };
  directives.push(`Handles : ${handleLabel[rules.handleMode]}.`);

  const ctxLine = [ctx.brandName && `Boutique : ${ctx.brandName}`, ctx.niche && `Niche : ${ctx.niche}`, ctx.positioning && `Positionnement : ${ctx.positioning}`].filter(Boolean).join(" · ");

  const list = products.map((p, i) => (
    `--- Produit ${i + 1} (handle: ${p.handle}) ---\n` +
    `Titre actuel : ${p.title}\n` +
    `Type : ${p.type || "(non renseigné)"} | Tags : ${p.tags || "(aucun)"} | Vendor : ${p.vendor || "(aucun)"}\n` +
    `Variantes (${p.variantCount}) : ${p.variantOptions.join(", ") || "(aucune option)"} | Prix exemple : ${p.priceSample || "(n/a)"}\n` +
    `Images : ${p.imageCount}${p.existingAlts.filter(Boolean).length ? ` | alts actuels : ${p.existingAlts.filter(Boolean).join(" / ")}` : ""}\n` +
    `Description actuelle : ${p.bodyExcerpt || "(vide)"}`
  )).join("\n\n");

  return (
    `${ctxLine ? ctxLine + "\n\n" : ""}=== Règles de transformation ===\n- ${directives.join("\n- ")}\n\n` +
    `=== ${products.length} produit(s) à transformer ===\n${list}\n\n` +
    `Renvoie le JSON {"products":[...]} avec un objet par produit, dans le MÊME ordre, en conservant le handle d'origine comme clé.`
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
    bodyHtml: str(o.bodyHtml),
    newHandle: str(o.newHandle) || undefined,
    metaTitle: str(o.metaTitle).slice(0, 65),
    metaDescription: str(o.metaDescription).slice(0, 160),
    tags: str(o.tags, fallback.tags),
    productType: str(o.productType, fallback.type),
    collections: arr(o.collections).slice(0, 3),
    imageAlts: alts.slice(0, fallback.imageCount),
    status: o.status === "review" ? "review" : "ok",
    notes: arr(o.notes),
  };
}

// ── Reconstruction du CSV Shopify final ─────────────────────────────────────

function ensureColumn(headers: string[], rows: string[][], map: DetectedColumns["map"], field: ShopifyField, headerName: string): number {
  if (map[field] !== undefined) return map[field]!;
  const idx = headers.length;
  headers.push(headerName);
  rows.forEach((r) => { while (r.length < idx) r.push(""); r.push(""); });
  map[field] = idx;
  return idx;
}

export interface ApplyResult { headers: string[]; rows: string[][] }

/** Applique les transformations validées sur le CSV d'origine (variantes/images/prix préservés). */
export function applyTransform(
  origHeaders: string[],
  origRows: string[][],
  detected: DetectedColumns,
  groups: ProductGroup[],
  results: TransformedProduct[],
  rules: ImportRules
): ApplyResult {
  const headers = [...origHeaders];
  const rows = origRows.map((r) => [...r]);
  const map = { ...detected.map };
  const iTitle = ensureColumn(headers, rows, map, "Title", "Title");
  const iBody = ensureColumn(headers, rows, map, "Body", "Body (HTML)");
  const iType = ensureColumn(headers, rows, map, "Type", "Type");
  const iTags = ensureColumn(headers, rows, map, "Tags", "Tags");
  const iSeoT = ensureColumn(headers, rows, map, "SeoTitle", "SEO Title");
  const iSeoD = ensureColumn(headers, rows, map, "SeoDescription", "SEO Description");
  const iAlt = ensureColumn(headers, rows, map, "ImageAlt", "Image Alt Text");
  const iHandle = map.Handle;

  const byHandle = new Map(results.map((r) => [r.handle, r]));
  for (const g of groups) {
    const t = byHandle.get(g.handle);
    if (!t) continue;
    const def = rows[g.defRow];
    if (def) {
      def[iTitle] = t.title;
      if (t.bodyHtml) def[iBody] = t.bodyHtml;
      if (rules.tagsType) { def[iType] = t.productType; def[iTags] = t.tags; }
      if (rules.meta) { def[iSeoT] = t.metaTitle; def[iSeoD] = t.metaDescription; }
    }
    if (rules.handleMode !== "keep" && t.newHandle && iHandle !== undefined) {
      for (const ri of g.rowIndices) rows[ri][iHandle] = t.newHandle;
    }
    if (rules.altText) {
      g.images.forEach((img, k) => { rows[img.rowIndex][iAlt] = t.imageAlts[k] || t.title; });
    }
  }
  return { headers, rows };
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

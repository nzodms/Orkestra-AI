import { stripHtml, type ShopifyField, type ProductGroup, type ImportRules, type Level } from "./import-factory";

// ──────────────────────────────────────────────────────────────────────────
// Import Factory — analyse DÉTERMINISTE d'un CSV exemple « déjà optimisé »,
// pour proposer un profil/preset d'import réutilisable. Aucune IA : on lit la
// structure (titres, descriptions, meta, variantes, tags, alt, collections).
// Aucune donnée n'est codée en dur ; tout vient du fichier de l'utilisateur.
// ──────────────────────────────────────────────────────────────────────────

export interface AnalysisLine { label: string; value: string }

export interface ImportStyleAnalysis {
  products: number;
  variants: number;
  images: number;
  columns: number;
  // Titres
  titleAvgWords: number;
  brandNamesDetected: boolean;
  titleSeparator: string | null;
  titleFormat: "plain" | "brand_suffix";
  brandNameExamples: string[];
  // Descriptions
  descAvgChars: number;
  hasH2: boolean;
  hasH3: boolean;
  hasLists: boolean;
  hasFaq: boolean;
  descLevel: Level;
  // Meta
  metaTitleHasBrand: boolean;
  metaSuffix: string | null;
  metaAvgChars: number;
  // Variantes
  optionsTranslatedFr: boolean;
  unitsCm: boolean;
  unitsInch: boolean;
  // Tags
  tagsAvg: number;
  tagsLongTail: boolean;
  tagsEnglish: boolean;
  // Alt
  altDifferentiated: boolean;
  altHasProductName: boolean;
  // Collections / maillage
  collections: string[];
  internalLinking: boolean;
  // Synthèse
  language: string;
  suggestedPresetId: string;
  suggestedPresetLabel: string;
  summary: AnalysisLine[];
}

const EN_WORDS = /\b(size|color|colour|single|set of|pcs|warm white|cold white|round|square|gold|black|white|silver|small|medium|large|pendant|ceiling|chandelier|lamp|glass|crystal|indoor|outdoor|bedroom|kitchen|living room|modern|the|and|with|for|your)\b/i;
const INCH_RE = /["”]|\binch(?:es)?\b|\bpouces?\b/i;
const CM_RE = /\bcm\b|\bmm\b/i;

function cell(row: string[], idx?: number): string { return idx === undefined ? "" : (row[idx] ?? "").trim(); }
function avg(nums: number[]): number { return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0; }

/** Détecte un suffixe meta récurrent en fin de meta description (ex. « ✓ Livraison gratuite. »). */
function detectMetaSuffix(metas: string[]): string | null {
  const candidates = new Map<string, number>();
  for (const m of metas) {
    const s = m.trim();
    if (!s) continue;
    let cand = "";
    const mk = s.lastIndexOf("✓");
    if (mk >= 0 && s.length - mk <= 40) cand = s.slice(mk).trim();
    else { const parts = s.split(/(?<=[.!])\s+/); cand = (parts[parts.length - 1] || "").trim(); }
    if (cand.length >= 6 && cand.length <= 40) candidates.set(cand, (candidates.get(cand) || 0) + 1);
  }
  let best: string | null = null, bestN = 0;
  for (const [c, n] of candidates) if (n > bestN) { best = c; bestN = n; }
  return best && bestN >= Math.max(2, Math.ceil(metas.filter(Boolean).length * 0.4)) ? best : null;
}

/** Analyse structurelle d'un catalogue exemple → profil détecté. */
export function analyzeExampleCatalog(
  headers: string[],
  rows: string[][],
  map: Partial<Record<ShopifyField, number>>,
  groups: ProductGroup[]
): ImportStyleAnalysis {
  const products = groups.length;
  const variants = groups.reduce((a, g) => a + g.variants.length, 0);
  const images = groups.reduce((a, g) => a + g.images.length, 0);

  // ── Titres ──
  const titles = groups.map((g) => g.title).filter(Boolean);
  const titleAvgWords = avg(titles.map((t) => t.split(/\s+/).filter(Boolean).length));
  let sepCount: Record<string, number> = { "|": 0, "-": 0, "–": 0 };
  const brandExamples: string[] = [];
  for (const t of titles) {
    for (const sep of ["|", "–", "-"]) {
      if (t.includes(` ${sep} `)) {
        sepCount[sep]++;
        const last = t.split(` ${sep} `).pop()!.trim();
        if (last && last.split(/\s+/).length <= 3) brandExamples.push(last);
        break;
      }
    }
  }
  const titleSeparator = (Object.entries(sepCount).sort((a, b) => b[1] - a[1])[0] || [null, 0])[1] > 0
    ? Object.entries(sepCount).sort((a, b) => b[1] - a[1])[0][0] : null;
  const brandNamesDetected = titleSeparator === "|" && brandExamples.length >= Math.max(2, Math.ceil(titles.length * 0.4));
  const titleFormat: "plain" | "brand_suffix" = brandNamesDetected ? "brand_suffix" : "plain";

  // ── Descriptions ──
  const bodies = groups.map((g) => g.body).filter(Boolean);
  const descAvgChars = avg(bodies.map((b) => stripHtml(b).length));
  const anyBody = bodies.join("\n");
  const hasH2 = /<h2\b/i.test(anyBody);
  const hasH3 = /<h3\b/i.test(anyBody);
  const hasLists = /<li\b/i.test(anyBody);
  const hasFaq = /<h4\b/i.test(anyBody) || /(question|faq|fréquent)/i.test(anyBody);
  const descLevel: Level = descAvgChars >= 3000 ? "ultra complet" : descAvgChars >= 1800 ? "poussé" : descAvgChars >= 700 ? "standard" : "léger";

  // ── Meta ──
  const seoTitles = groups.map((g) => g.seoTitle).filter(Boolean);
  const seoDescs = groups.map((g) => g.seoDescription).filter(Boolean);
  const metaTitleHasBrand = seoTitles.filter((t) => /\s[|\-–]\s/.test(t)).length >= Math.ceil(seoTitles.length * 0.4);
  const metaSuffix = detectMetaSuffix(seoDescs);
  const metaAvgChars = avg(seoDescs.map((m) => m.length));

  // ── Variantes / unités ──
  const optValues = groups.flatMap((g) => g.variants.map((v) => v.option1)).filter(Boolean);
  const optName1 = map.Option1Name !== undefined ? cell(headers, map.Option1Name) : "";
  const optBlob = `${optName1} ${optValues.join(" ")}`;
  const optionsTranslatedFr = optValues.length > 0 && !EN_WORDS.test(optBlob);
  const unitsInch = INCH_RE.test(optValues.join(" "));
  const unitsCm = CM_RE.test(optValues.join(" "));

  // ── Tags ──
  const tagLists = groups.map((g) => g.tags.split(",").map((t) => t.trim()).filter(Boolean));
  const tagsAvg = avg(tagLists.map((l) => l.length));
  const tagsLongTail = tagLists.some((l) => l.some((t) => t.split(/\s+/).length >= 2));
  const tagsEnglish = tagLists.some((l) => l.some((t) => EN_WORDS.test(t)));

  // ── Alt text ──
  const alts = groups.flatMap((g) => g.images.map((im) => im.alt)).filter(Boolean);
  const altDifferentiated = alts.length > 1 && new Set(alts.map((a) => a.toLowerCase())).size > 1;
  const altHasProductName = groups.some((g) => g.images.some((im) => im.alt && g.title && im.alt.toLowerCase().includes(g.title.toLowerCase().split(/\s+/).slice(0, 2).join(" "))));

  // ── Collections / maillage ──
  const collections = Array.from(new Set(groups.map((g) => g.collection).filter(Boolean))).slice(0, 12);
  const internalLinking = /<a\s+href/i.test(anyBody);

  // ── Langue ──
  const frHits = /[àâäéèêëîïôöûüç]/.test(`${titles.join(" ")} ${anyBody}`);
  const language = frHits || !EN_WORDS.test(`${titles.join(" ")}`) ? "Français" : "Anglais";

  // ── Synthèse / preset suggéré ──
  let suggestedPresetId = "migration";
  let suggestedPresetLabel = "Migration Shopify propre";
  const richEditorial = hasFaq || hasH2 || descLevel === "poussé" || descLevel === "ultra complet";
  if (brandNamesDetected && richEditorial) {
    suggestedPresetId = "brand"; suggestedPresetLabel = "Marque premium avec noms brandés";
  } else if (tagsEnglish || EN_WORDS.test(anyBody) || (!metaSuffix && descAvgChars < 400 && !hasH2)) {
    suggestedPresetId = "supplier"; suggestedPresetLabel = "Fournisseur → marque";
  } else if (!brandNamesDetected && titleAvgWords <= 8 && !hasFaq && descAvgChars < 1200) {
    suggestedPresetId = "merchant"; suggestedPresetLabel = "Catalogue Merchant-friendly";
  } else if (richEditorial) {
    suggestedPresetId = "brand"; suggestedPresetLabel = "Marque premium";
  }

  const yn = (b: boolean) => (b ? "oui" : "non");
  const summary: AnalysisLine[] = [
    { label: "Produits / variantes / images", value: `${products} · ${variants} · ${images}` },
    { label: "Titres", value: `${titleAvgWords} mots en moyenne${brandNamesDetected ? `, avec nom brandé (« … ${titleSeparator} Nom »)` : ", sans nom brandé"}` },
    ...(brandExamples.length ? [{ label: "Noms brandés détectés", value: Array.from(new Set(brandExamples)).slice(0, 4).join(", ") }] : []),
    { label: "Descriptions", value: `${descAvgChars} car. en moyenne · niveau ${descLevel}${hasH2 ? " · H2" : ""}${hasH3 ? " · H3" : ""}${hasLists ? " · listes" : ""}${hasFaq ? " · FAQ" : ""}` },
    { label: "Meta", value: `${metaAvgChars} car.${metaTitleHasBrand ? " · marque dans le meta title" : ""}${metaSuffix ? ` · suffixe « ${metaSuffix} »` : ""}` },
    { label: "Variantes", value: optValues.length ? `${optionsTranslatedFr ? "options en français" : "options à traduire"}${unitsCm ? " · cm" : ""}${unitsInch ? " · pouces (à convertir)" : ""}` : "aucune option" },
    { label: "Tags", value: tagsAvg ? `${tagsAvg} en moyenne${tagsLongTail ? " · longue traîne" : ""}${tagsEnglish ? " · anglais" : ""}` : "aucun" },
    { label: "Alt text", value: alts.length ? `${altDifferentiated ? "différenciés" : "identiques"}${altHasProductName ? " · avec nom produit" : ""}` : "aucun" },
    { label: "Maillage interne", value: yn(internalLinking) + (collections.length ? ` · ${collections.length} collection(s)` : "") },
    { label: "Niveau recommandé", value: descLevel },
  ];

  return {
    products, variants, images, columns: headers.length,
    titleAvgWords, brandNamesDetected, titleSeparator, titleFormat, brandNameExamples: Array.from(new Set(brandExamples)).slice(0, 6),
    descAvgChars, hasH2, hasH3, hasLists, hasFaq, descLevel,
    metaTitleHasBrand, metaSuffix, metaAvgChars,
    optionsTranslatedFr, unitsCm, unitsInch,
    tagsAvg, tagsLongTail, tagsEnglish,
    altDifferentiated, altHasProductName,
    collections, internalLinking,
    language, suggestedPresetId, suggestedPresetLabel, summary,
  };
}

/** Construit des règles d'import à partir de l'analyse (point de départ éditable). */
export function analysisToRules(a: ImportStyleAnalysis, base: ImportRules): ImportRules {
  return {
    ...base,
    language: a.language || base.language,
    brandNames: a.brandNamesDetected,
    titleFormat: a.titleFormat,
    description: a.descLevel === "ultra complet" || a.descLevel === "poussé" ? "html_rich" : "standard",
    level: a.descLevel,
    meta: a.metaAvgChars > 0 || !!a.metaSuffix,
    metaSuffix: a.metaSuffix || base.metaSuffix,
    altText: a.altDifferentiated || a.altHasProductName || base.altText,
    tagsType: a.tagsAvg > 0 || base.tagsType,
    convertUnits: a.unitsInch ? true : base.convertUnits,
    internalLinking: a.internalLinking,
  };
}

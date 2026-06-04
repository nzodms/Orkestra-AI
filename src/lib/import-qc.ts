import { FORBIDDEN_JARGON, stripHtml, normName, serializeCsv, type TransformedProduct, type ProductGroup, type ApplyResult } from "./import-factory";

// ──────────────────────────────────────────────────────────────────────────
// Import Factory — contrôle qualité DÉTERMINISTE (côté code, pas seulement IA).
// Corrige et signale : suffixe meta, longueur meta, jargon interne, titres
// mal terminés, doublons de noms brandés / handles, descriptions trop courtes.
// ──────────────────────────────────────────────────────────────────────────

export type QCStatus = "ok" | "warning" | "risk" | "failed";

export interface QCContext {
  metaSuffix?: string;
  vendor?: string;
  level?: string;
  oldTerms?: string[];
  /** Les noms brandés produit sont-ils activés ? (sinon vendor ≠ brand). */
  brandNames?: boolean;
  /** Langue cible (ex : « Français ») pour les contrôles linguistiques. */
  language?: string;
  tagsType?: boolean;
  /** Sets mutables partagés sur tout le lot (dédoublonnage / répétition). */
  usedBrand: Set<string>;
  usedHandle: Set<string>;
  usedMetaOpenings: Set<string>;
}

export interface QCReport {
  status: QCStatus;
  issues: string[];
  fixed: TransformedProduct;
}

const ORDER: Record<QCStatus, number> = { ok: 0, warning: 1, risk: 2, failed: 3 };
function escapeRe(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
const collapse = (s: string) => s.replace(/[ \t]{2,}/g, " ").replace(/\s+([,.;:!?])/g, "$1");

function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 2) return 3;
  const dp = Array.from({ length: m + 1 }, (_, i) => i);
  for (let j = 1; j <= n; j++) {
    let prev = dp[0]; dp[0] = j;
    for (let i = 1; i <= m; i++) {
      const tmp = dp[i];
      dp[i] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[i], dp[i - 1]);
      prev = tmp;
    }
  }
  return dp[m];
}
/** Détecte un nom déjà pris : exact, accent-insensible, ou trop similaire. */
function similarTo(n: string, set: Set<string>): { match: string; exact: boolean } | null {
  if (!n) return null;
  if (set.has(n)) return { match: n, exact: true };
  for (const m of set) {
    if (Math.min(n.length, m.length) >= 4 && n.slice(0, 4) === m.slice(0, 4)) return { match: m, exact: false };
    if (Math.abs(n.length - m.length) <= 1 && editDistance(n, m) <= 1) return { match: m, exact: false };
  }
  return null;
}

function enforceMeta(md: string, suffix?: string): { md: string; changed: boolean; tooLong: boolean } {
  let s = (md || "").trim();
  let changed = false;
  if (suffix) {
    if (!s.endsWith(suffix)) {
      const room = Math.max(0, 160 - suffix.length - 1);
      s = s.replace(/[\s.]+$/, "");
      if (s.length > room) s = s.slice(0, room).replace(/\s+\S*$/, "").trim();
      s = `${s} ${suffix}`.trim();
      changed = true;
    }
  }
  let tooLong = false;
  if (s.length > 160) {
    tooLong = true;
    if (suffix && s.endsWith(suffix)) {
      const room = Math.max(0, 160 - suffix.length - 1);
      const head = s.slice(0, s.length - suffix.length).trim().slice(0, room).replace(/\s+\S*$/, "").trim();
      s = `${head} ${suffix}`.trim();
    } else {
      s = s.slice(0, 160).replace(/\s+\S*$/, "").trim();
    }
    changed = true;
  }
  return { md: s, changed, tooLong };
}

function fixTitle(t: string): string {
  let s = (t || "").trim();
  s = s.replace(/[\s,;:–—-]+$/, "");
  s = s.replace(/\s+(et|ou|en|de|à|the|and|or|with|pour)$/i, "");
  return s.trim();
}

// ── Qualité française (corrections sûres + détection) ───────────────────────
// Corrections d'accents / fautes fréquentes (mot entier, casse préservée).
const FR_FIX: Record<string, string> = {
  ronf: "rond", carree: "carrée", carre: "carré", dore: "doré", doree: "dorée", dores: "dorés",
  craquele: "craquelé", craquelee: "craquelée", metal: "métal", metallique: "métallique",
  decoratif: "décoratif", decorative: "décorative", elegant: "élégant", elegante: "élégante",
  interieur: "intérieur", exterieur: "extérieur", lumiere: "lumière", electrique: "électrique",
  reglable: "réglable", tete: "tête", fenetre: "fenêtre", etagere: "étagère", chene: "chêne",
  modele: "modèle", matiere: "matière", piece: "pièce", coute: "coûte", cote: "côté",
  eclairage: "éclairage", eclaire: "éclaire", decor: "décor", decoration: "décoration",
  geometrique: "géométrique", etoile: "étoile", materiau: "matériau", materiaux: "matériaux",
  cable: "câble", demontable: "démontable", resistant: "résistant", resistante: "résistante",
  diametre: "diamètre", entree: "entrée", qualite: "qualité", securite: "sécurité", bebe: "bébé",
  argente: "argenté", cuivre: "cuivré", suspendue: "suspendue", reglages: "réglages",
};
// Anglais → français (remplacement 1:1 sûr).
const EN_FIX: Record<string, string> = {
  round: "rond", square: "carré", rectangular: "rectangulaire", gold: "doré", golden: "doré",
  black: "noir", white: "blanc", silver: "argenté", copper: "cuivré", modern: "moderne",
  contemporary: "contemporain", "ceiling light": "plafonnier", "ceiling lamp": "plafonnier",
  pendant: "suspension", chandelier: "lustre", lamp: "lampe", glass: "verre", crystal: "cristal",
  indoor: "intérieur", outdoor: "extérieur", bedroom: "chambre", kitchen: "cuisine",
  "living room": "salon", "dining room": "salle à manger", large: "grand", small: "petit",
  for: "pour", with: "avec", your: "votre", our: "notre", and: "et", adjustable: "réglable",
};
// Mots anglais à SIGNALER (RISK) s'ils restent après correction.
const EN_FLAG = ["raindrop", "ceiling", "pendant", "chandelier", "lamp", "light", "glass", "crystal", "indoor", "outdoor", "bedroom", "kitchen", "luxury", "premium", "minimalist", "nordic", "vintage", "modern", "contemporary", "round", "square", "gold", "black", "white"];
// Collections : anglais/incorrect → français naturel (clé = nom normalisé).
const COLLECTION_FIX: Record<string, string> = {
  foyer: "Entrée", entrance: "Entrée", hallway: "Couloir",
  livingroom: "Salon", diningroom: "Salle à manger", kitchen: "Cuisine", bedroom: "Chambre",
  bathroom: "Salle de bain", office: "Bureau",
  ceilinglights: "Plafonniers", ceilinglight: "Plafonnier", pendantlights: "Suspensions", pendantlight: "Suspension",
  pendants: "Suspensions", chandeliers: "Lustres", chandelier: "Lustres",
  walllights: "Appliques", walllight: "Applique", tablelamps: "Lampes à poser", tablelamp: "Lampe à poser",
  floorlamps: "Lampadaires", floorlamp: "Lampadaire",
};

function preserveCase(orig: string, repl: string): string {
  if (orig === orig.toUpperCase()) return repl.toUpperCase();
  if (orig[0] && orig[0] === orig[0].toUpperCase()) return repl[0].toUpperCase() + repl.slice(1);
  return repl;
}
function applyWordMap(s: string, map: Record<string, string>): { out: string; hits: string[] } {
  let out = s;
  const hits: string[] = [];
  for (const [bad, good] of Object.entries(map)) {
    const re = new RegExp(`\\b${escapeRe(bad)}\\b`, "gi");
    if (re.test(out)) { hits.push(bad); out = out.replace(re, (m) => preserveCase(m, good)); }
  }
  return { out, hits };
}
function fixBrandCase(s: string, vendor: string): string {
  if (!vendor) return s;
  return s.replace(new RegExp(`\\b${escapeRe(vendor)}\\b`, "gi"), vendor);
}
function capFirst(s: string): string { return s ? s[0].toUpperCase() + s.slice(1) : s; }
function isFrench(lang?: string): boolean { return /fran[çc]ais/i.test(lang || ""); }

/** Contrôle qualité + corrections déterministes d'un produit transformé. */
export function qualityControl(r: TransformedProduct, ctx: QCContext): QCReport {
  const issues: string[] = [];
  let status: QCStatus = "ok";
  const bump = (s: QCStatus) => { if (ORDER[s] > ORDER[status]) status = s; };
  const fixed: TransformedProduct = { ...r };
  const fr = isFrench(ctx.language);
  const vendor = ctx.vendor || "";

  // Vendor = marque saisie, casse EXACTE.
  if (vendor) fixed.vendor = vendor;

  // Vendor ≠ nom brandé : si noms brandés désactivés, on ignore totalement le
  // brandName ; s'il est activé mais égal au vendor, ce n'est pas un nom brandé.
  if (!ctx.brandNames) {
    fixed.brandName = undefined;
  } else if (fixed.brandName && vendor && normName(fixed.brandName) === normName(vendor)) {
    fixed.brandName = undefined; // le vendor n'est pas un nom brandé produit
  }

  // Titre : pas vide, ne finit pas par un mot/séparateur vide.
  fixed.title = fixTitle(fixed.title);
  if (!fixed.title.trim()) { issues.push("Titre vide"); bump("failed"); }

  // Jargon interne dans le texte public → strip + RISK.
  const hay = `${fixed.title} ${fixed.metaTitle} ${fixed.metaDescription} ${stripHtml(fixed.bodyHtml)}`.toLowerCase();
  const found = FORBIDDEN_JARGON.filter((f) => hay.includes(f));
  if (found.length) {
    issues.push(`Jargon interne retiré : ${Array.from(new Set(found)).join(", ")}`);
    bump("risk");
    for (const f of found) {
      const re = new RegExp(escapeRe(f), "gi");
      fixed.bodyHtml = fixed.bodyHtml.replace(re, "");
      fixed.metaDescription = fixed.metaDescription.replace(re, "");
      fixed.title = fixed.title.replace(re, "");
    }
    fixed.bodyHtml = collapse(fixed.bodyHtml);
    fixed.title = fixTitle(collapse(fixed.title));
  }

  // Anciens termes / domaines à supprimer.
  if (ctx.oldTerms?.length) {
    for (const term of ctx.oldTerms) {
      if (!term) continue;
      const re = new RegExp(escapeRe(term), "gi");
      if (re.test(`${fixed.title} ${fixed.bodyHtml} ${fixed.metaDescription}`)) {
        issues.push(`Terme à supprimer retiré : ${term}`);
        bump("risk");
        fixed.title = fixed.title.replace(re, "").trim();
        fixed.bodyHtml = collapse(fixed.bodyHtml.replace(re, ""));
        fixed.metaDescription = fixed.metaDescription.replace(re, "").trim();
      }
    }
  }

  // ── Qualité française : accents/typos + anglais résiduel (titre, meta, tags) ──
  if (fr) {
    const clean = (s: string) => { const a = applyWordMap(s, FR_FIX); const b = applyWordMap(a.out, EN_FIX); return { out: b.out, fr: a.hits, en: b.hits }; };
    const t = clean(fixed.title); fixed.title = t.out;
    const m = clean(fixed.metaTitle); fixed.metaTitle = m.out;
    const d = clean(fixed.metaDescription); fixed.metaDescription = d.out;
    const g = clean(fixed.tags); fixed.tags = g.out;
    const fixHits = Array.from(new Set([...t.fr, ...m.fr, ...d.fr, ...g.fr]));
    const enHits = Array.from(new Set([...t.en, ...m.en, ...d.en, ...g.en]));
    if (fixHits.length) { issues.push(`Accents / fautes corrigés : ${fixHits.slice(0, 5).join(", ")}`); bump("warning"); }
    if (enHits.length) { issues.push(`Mots anglais traduits : ${enHits.slice(0, 5).join(", ")}`); bump("warning"); }
    // Anglais résiduel non corrigé dans titre / meta title → RISK.
    const remain = EN_FLAG.filter((w) => new RegExp(`\\b${escapeRe(w)}\\b`, "i").test(`${fixed.title} ${fixed.metaTitle}`));
    if (remain.length) { issues.push(`Mot anglais résiduel : ${Array.from(new Set(remain)).slice(0, 4).join(", ")}`); bump("risk"); }
  }

  // ── Casse marque / vendor dans titre + meta title + meta description ──
  if (vendor) { fixed.title = fixBrandCase(fixed.title, vendor); fixed.metaTitle = fixBrandCase(fixed.metaTitle, vendor); fixed.metaDescription = fixBrandCase(fixed.metaDescription, vendor); }
  fixed.metaTitle = capFirst(fixed.metaTitle.trim());

  // Meta description : ≤ 160 + suffixe exact du profil.
  if (ctx.metaSuffix !== undefined && ctx.metaSuffix !== "") {
    const m = enforceMeta(fixed.metaDescription, ctx.metaSuffix);
    if (m.changed) { issues.push(m.tooLong ? "Meta description ajustée (≤ 160 + suffixe)" : "Suffixe meta ajouté"); bump("warning"); }
    fixed.metaDescription = m.md;
  } else if (fixed.metaDescription.length > 160) {
    fixed.metaDescription = fixed.metaDescription.slice(0, 160).replace(/\s+\S*$/, "").trim();
    issues.push("Meta description tronquée à 160"); bump("warning");
  }

  // Meta description : générique / répétitive ?
  const mdNorm = normName(fixed.metaDescription).replace(/[0-9]/g, "");
  if (/(elegancemoderne|decouvreznotre|elegancecontemporaine)/.test(mdNorm)) { issues.push("Meta description générique (« élégance moderne / découvrez notre »)"); bump("warning"); }
  const opening = fixed.metaDescription.toLowerCase().replace(/[^a-zàâäéèêëîïôöûüç ]/g, "").split(/\s+/).filter(Boolean).slice(0, 6).join(" ");
  if (opening.length > 8) {
    if (ctx.usedMetaOpenings.has(opening)) { issues.push("Meta description répétitive (même structure qu'un autre produit)"); bump("warning"); }
    else ctx.usedMetaOpenings.add(opening);
  }

  // Nom brandé : doublon exact / accent / trop similaire ? (uniquement si activé)
  if (ctx.brandNames && fixed.brandName) {
    const n = normName(fixed.brandName);
    const sim = similarTo(n, ctx.usedBrand);
    if (sim?.exact) { issues.push(`Nom brandé déjà utilisé : ${fixed.brandName}`); bump("risk"); }
    else if (sim) { issues.push(`Nom brandé trop similaire à un nom existant : ${fixed.brandName}`); bump("risk"); if (n) ctx.usedBrand.add(n); }
    else if (n) ctx.usedBrand.add(n);
  }

  // Handle : doublon (exact ou après normalisation) ?
  const h = (fixed.newHandle || "").trim().toLowerCase();
  if (h) {
    if (ctx.usedHandle.has(h)) { issues.push(`Handle déjà utilisé : ${h}`); bump("warning"); }
    else ctx.usedHandle.add(h);
  }

  // Tags trop pauvres.
  if (ctx.tagsType) {
    const tagCount = fixed.tags.split(",").map((t) => t.trim()).filter(Boolean).length;
    if (tagCount < 4) { issues.push(`Tags trop pauvres (${tagCount})`); bump("warning"); }
  }

  // Collections : français naturel (Foyer → Entrée), pas d'anglais.
  if (fr && fixed.collections.length) {
    fixed.collections = fixed.collections.map((c) => {
      const key = normName(c);
      if (COLLECTION_FIX[key]) { issues.push(`Collection « ${c} » → « ${COLLECTION_FIX[key]} »`); bump("warning"); return COLLECTION_FIX[key]; }
      return c;
    });
    const enCol = fixed.collections.find((c) => EN_FLAG.some((w) => new RegExp(`\\b${escapeRe(w)}\\b`, "i").test(c)));
    if (enCol) { issues.push(`Collection en anglais : ${enCol}`); bump("warning"); }
  }

  // Description trop courte en mode poussé / ultra.
  const words = stripHtml(fixed.bodyHtml).split(/\s+/).filter(Boolean).length;
  if ((ctx.level === "poussé" || ctx.level === "ultra complet") && words < 120) {
    issues.push(`Description courte (${words} mots)`); bump("warning");
  }

  // Doute IA signalé.
  if (r.status === "review") { if (r.notes?.length) issues.push(...r.notes); bump("warning"); }

  return { status, issues, fixed };
}

/** Rapport CSV des produits à vérifier / corrigés (téléchargeable). */
export function buildIssueReportCsv(groups: ProductGroup[], reports: Record<string, QCReport>): string {
  const headers = ["Handle", "Ancien titre", "Nouveau titre", "Statut", "Problèmes / corrections"];
  const rows: string[][] = [];
  for (const g of groups) {
    const rep = reports[g.handle];
    if (!rep || (rep.status === "ok" && rep.issues.length === 0)) continue;
    rows.push([g.handle, g.title, rep.fixed.title, rep.status.toUpperCase(), rep.issues.join(" · ")]);
  }
  return serializeCsv(headers, rows);
}

/** Rapport de modifications complet (résumé export + détail par produit). */
export function buildExportReport(groups: ProductGroup[], finalResults: TransformedProduct[], applied: ApplyResult, reports: Record<string, QCReport>): string {
  const qcCount = { ok: 0, warning: 0, risk: 0, failed: 0 };
  for (const g of groups) qcCount[reports[g.handle]?.status ?? "ok"]++;
  const reasons = applied.checks.filter((c) => c.status !== "ok").map((c) => `${c.label}${c.detail ? ` (${c.detail})` : ""}`);
  const summary: string[][] = [
    ["Produits exportés", String(applied.stats.products)],
    ["Variantes", String(applied.stats.variants)],
    ["Images", String(applied.stats.images)],
    ["Statut export global", applied.status.toUpperCase()],
    ["Produits OK / Warning / Risk / Failed", `${qcCount.ok} / ${qcCount.warning} / ${qcCount.risk} / ${qcCount.failed}`],
    ["Colonnes ajoutées", applied.stats.added.join(" | ") || "aucune"],
    ["Colonnes conservées", applied.stats.preserved.join(" | ") || "aucune"],
    ["Colonnes vidées (sécurité)", applied.stats.cleared.join(" | ") || "aucune"],
    ["Raisons export", reasons.join(" ; ") || "aucune"],
    ["", ""],
    ["Handle", "Ancien titre", "Nouveau titre", "Meta title", "product_type", "Statut QC", "Problèmes"],
  ];
  const detail = groups.map((g) => {
    const r = finalResults.find((x) => x.handle === g.handle);
    const rep = reports[g.handle];
    return [g.handle, g.title, r?.title ?? "", r?.metaTitle ?? "", r?.productType ?? "", (rep?.status ?? "ok").toUpperCase(), (rep?.issues ?? []).join(" · ")];
  });
  return serializeCsv(["Rapport Import Factory — résumé export", ""], [...summary, ...detail]);
}

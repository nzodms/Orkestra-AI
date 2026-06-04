import { FORBIDDEN_JARGON, stripHtml, normName, serializeCsv, type TransformedProduct, type ProductGroup } from "./import-factory";

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
  /** Sets mutables partagés sur tout le lot (dédoublonnage). */
  usedBrand: Set<string>;
  usedHandle: Set<string>;
}

export interface QCReport {
  status: QCStatus;
  issues: string[];
  fixed: TransformedProduct;
}

const ORDER: Record<QCStatus, number> = { ok: 0, warning: 1, risk: 2, failed: 3 };
function escapeRe(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
const collapse = (s: string) => s.replace(/[ \t]{2,}/g, " ").replace(/\s+([,.;:!?])/g, "$1");

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

/** Contrôle qualité + corrections déterministes d'un produit transformé. */
export function qualityControl(r: TransformedProduct, ctx: QCContext): QCReport {
  const issues: string[] = [];
  let status: QCStatus = "ok";
  const bump = (s: QCStatus) => { if (ORDER[s] > ORDER[status]) status = s; };
  const fixed: TransformedProduct = { ...r };

  // Vendor du profil.
  if (ctx.vendor) fixed.vendor = ctx.vendor;

  // Titre : pas vide, ne finit pas par un mot/séparateur vide.
  const beforeTitle = fixed.title;
  fixed.title = fixTitle(fixed.title);
  if (fixed.title !== beforeTitle) issues.push("Titre nettoyé (fin)");
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

  // Meta description : ≤ 160 + suffixe exact du profil.
  if (ctx.metaSuffix !== undefined && ctx.metaSuffix !== "") {
    const m = enforceMeta(fixed.metaDescription, ctx.metaSuffix);
    if (m.changed) issues.push(m.tooLong ? "Meta description ajustée (≤ 160 + suffixe)" : "Suffixe meta ajouté");
    if (m.changed) bump("warning");
    fixed.metaDescription = m.md;
  } else if (fixed.metaDescription.length > 160) {
    fixed.metaDescription = fixed.metaDescription.slice(0, 160).replace(/\s+\S*$/, "").trim();
    issues.push("Meta description tronquée à 160"); bump("warning");
  }

  // Nom brandé : doublon ?
  if (fixed.brandName) {
    const n = normName(fixed.brandName);
    if (n && ctx.usedBrand.has(n)) { issues.push(`Nom brandé en doublon : ${fixed.brandName}`); bump("risk"); }
    else if (n) ctx.usedBrand.add(n);
  }

  // Handle : doublon ?
  const h = (fixed.newHandle || "").trim().toLowerCase();
  if (h) {
    if (ctx.usedHandle.has(h)) { issues.push(`Handle en doublon : ${h}`); bump("warning"); }
    else ctx.usedHandle.add(h);
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

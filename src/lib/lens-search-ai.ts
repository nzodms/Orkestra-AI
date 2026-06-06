// ──────────────────────────────────────────────────────────────────────────
// Orkestra Lens — recherche MULTI-IA (côté serveur).
// Utilise les IA connectées (Gemini grounding + Claude web search) pour trouver
// de VRAIS liens web produits/fournisseurs à partir de l'analyse image. OpenAI
// sert déjà à l'analyse + aux mots-clés. Aucune donnée marketplace structurée
// n'est inventée : prix/MOQ/notes restent « non disponibles » si absents.
//
// Si aucune recherche web n'est disponible → mode ASSISTÉ : requêtes préremplies
// (Alibaba / AliExpress / Google / 1688) que l'utilisateur ouvre lui-même.
// ──────────────────────────────────────────────────────────────────────────

import { getEncrypted } from "./server/keyStore";
import { decryptSecret } from "./crypto";
import { geminiGroundedSearch } from "./ai/gemini";
import { claudeWebSearch } from "./ai/claude";
import { scoreWebResult, riskFromScore } from "./supplier-score";
import { pickKeywords } from "./supplier-search";
import type { LensAnalysis, SupplierResult, AssistedQuery } from "./lens-types";

export interface LensKeyRefs { openai?: string | null; claude?: string | null; gemini?: string | null }

// Clé BYOK (/connect) en priorité ; repli OPTIONNEL sur une variable d'env serveur.
async function resolveKey(ref: string | null | undefined, envVar: string): Promise<{ apiKey: string; model: string } | null> {
  if (ref) {
    const stored = await getEncrypted(ref);
    if (stored) { try { return { apiKey: decryptSecret(stored.encrypted), model: stored.meta.model || "" }; } catch { /* clé illisible */ } }
  }
  const env = (process.env[envVar] || "").trim();
  if (env) return { apiKey: env, model: "" };
  return null;
}

function hash(s: string): number { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
const STOP = new Set(["the", "a", "for", "with", "and", "of", "de", "la", "le", "pour", "set", "pro", "new"]);
function tokens(s: string): string[] {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w));
}
function titleSimilarity(keywords: string[], productType: string, title: string): number {
  const q = new Set([...keywords.flatMap(tokens), ...tokens(productType)]);
  const t = new Set(tokens(title));
  if (!q.size || !t.size) return 50;
  let inter = 0; for (const w of q) if (t.has(w)) inter++;
  return Math.max(35, Math.min(95, Math.round(45 + (inter / Math.min(q.size, t.size)) * 50)));
}

// Classification du domaine → source normalisée + qualité (marketplace fournisseur connu = haut).
function classifyDomain(host: string): { source: SupplierResult["source"]; quality: number; name: string } {
  const h = host.toLowerCase();
  if (h.includes("aliexpress")) return { source: "AliExpress", quality: 90, name: "AliExpress" };
  if (h.includes("alibaba")) return { source: "Alibaba", quality: 95, name: "Alibaba" };
  if (h.includes("1688")) return { source: "1688", quality: 85, name: "1688" };
  if (h.includes("made-in-china")) return { source: "Other", quality: 82, name: "Made-in-China" };
  if (h.includes("dhgate")) return { source: "Other", quality: 75, name: "DHgate" };
  if (h.includes("globalsources")) return { source: "Other", quality: 78, name: "Global Sources" };
  if (/amazon|ebay|etsy|temu|wish/.test(h)) return { source: "Other", quality: 55, name: host.replace(/^www\./, "") };
  return { source: "Other", quality: 42, name: host.replace(/^www\./, "") };
}
function priceInText(s: string): string | undefined {
  const m = (s || "").match(/(?:US\s*)?[$€£]\s?\d{1,4}(?:[.,]\d{1,2})?(?:\s?[-–]\s?[$€£]?\s?\d{1,4}(?:[.,]\d{1,2})?)?/);
  return m ? m[0].trim() : undefined;
}

/** Requêtes préremplies (mode assisté) : l'utilisateur ouvre la marketplace lui-même. */
export function buildAssistedQueries(analysis: LensAnalysis): AssistedQuery[] {
  const kw = pickKeywords(analysis)[0] || analysis.productType;
  const enc = encodeURIComponent(kw);
  return [
    { label: `Alibaba — ${kw}`, source: "Alibaba", url: `https://www.alibaba.com/trade/search?SearchText=${enc}` },
    { label: `AliExpress — ${kw}`, source: "AliExpress", url: `https://www.aliexpress.com/wholesale?SearchText=${enc}` },
    { label: `1688 — ${kw}`, source: "1688", url: `https://s.1688.com/selloffer/offer_search.htm?keywords=${enc}` },
    { label: `Google — ${kw} supplier`, source: "Google", url: `https://www.google.com/search?q=${encodeURIComponent(kw + " wholesale supplier")}` },
  ];
}

function normalizeWeb(items: { url: string; title: string }[], analysis: LensAnalysis, keywords: string[], maxItems: number): SupplierResult[] {
  const seen = new Set<string>();
  const out: SupplierResult[] = [];
  for (const it of items) {
    let host = "";
    try { host = new URL(it.url).hostname; } catch { continue; }
    const key = host + "|" + (it.title || "").toLowerCase().slice(0, 40);
    if (seen.has(key)) continue; seen.add(key);
    const { source, quality, name } = classifyDomain(host);
    const title = (it.title || name).slice(0, 90);
    const relevance = titleSimilarity(keywords, analysis.productType, title);
    const price = priceInText(title);
    const confidence = Math.round((relevance + quality) / 2);
    const { score, reasons } = scoreWebResult({
      relevance, domainQuality: quality, confidence, hasImage: false, hasSupplierInfo: !!price, hasLink: true,
    });
    out.push({
      id: `mai_${hash(it.url).toString(36)}`,
      source, title,
      productUrl: it.url,
      supplierName: name,
      price,                       // undefined → « non disponible » dans l'UI
      similarityScore: relevance,
      supplierScore: score,
      confidence,
      riskLevel: riskFromScore(score),
      reasons,
      simulated: false,
      hue: hash(title + source) % 360,
    });
    if (out.length >= maxItems) break;
  }
  return out.sort((a, b) => b.supplierScore - a.supplierScore);
}

export interface MultiAiResult { results: SupplierResult[]; models: string[]; queries: string[] }

/** Recherche multi-IA : Gemini grounding + Claude web search (en parallèle). Null si rien. */
export async function multiAiSearch(analysis: LensAnalysis, keyRefs: LensKeyRefs, maxItems = 8): Promise<MultiAiResult | null> {
  const keywords = pickKeywords(analysis);
  const query = `${keywords.join(" ")} ${analysis.productType} fournisseur grossiste wholesale supplier (Alibaba, AliExpress, 1688)`;
  const log = (event: string, extra: Record<string, unknown> = {}) =>
    console.log("[Lens/search]", { event, gemini: !!keyRefs.gemini, claude: !!keyRefs.claude, ...extra });
  const models: string[] = [];
  const web: { url: string; title: string }[] = [];

  log("multi-ai-start", { keywords });
  const geminiKey = await resolveKey(keyRefs.gemini, "GEMINI_API_KEY");
  const claudeKey = await resolveKey(keyRefs.claude, "ANTHROPIC_API_KEY");
  const tasks: Promise<void>[] = [];
  if (geminiKey) {
    tasks.push((async () => {
      const r = await geminiGroundedSearch(geminiKey.apiKey, geminiKey.model || "gemini-2.0-flash", query);
      if ("ok" in r && r.ok) { if (r.web.length) { models.push("Gemini"); web.push(...r.web); } log("gemini-grounding-ok", { found: r.web.length }); }
      else log("gemini-grounding-error", { code: (r as { code?: string }).code });
    })());
  }
  if (claudeKey) {
    tasks.push((async () => {
      const r = await claudeWebSearch(claudeKey.apiKey, claudeKey.model || "claude-sonnet-4-6", query);
      if ("ok" in r && r.ok) { if (r.web.length) { models.push("Claude"); web.push(...r.web); } log("claude-web-ok", { found: r.web.length }); }
      else log("claude-web-error", { code: (r as { code?: string }).code });
    })());
  }
  await Promise.allSettled(tasks);

  if (!web.length) { log("multi-ai-empty", { fallback: "assisted" }); return null; }
  const results = normalizeWeb(web, analysis, keywords, maxItems);
  if (!results.length) { log("multi-ai-no-results", { fallback: "assisted" }); return null; }
  log("multi-ai-ok", { models, results: results.length });
  return { results, models, queries: keywords };
}

/** Une recherche web multi-IA est-elle envisageable (IA connectée BYOK ou env serveur) ? */
export function multiAiAvailable(keyRefs: LensKeyRefs): boolean {
  return !!keyRefs.gemini || !!keyRefs.claude || !!(process.env.GEMINI_API_KEY || "").trim() || !!(process.env.ANTHROPIC_API_KEY || "").trim();
}

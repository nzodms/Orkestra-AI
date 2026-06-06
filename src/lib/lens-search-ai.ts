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
import { claudeWebSearch, claudeComplete } from "./ai/claude";
import { scoreWebResult, riskFromScore } from "./supplier-score";
import { pickKeywords } from "./supplier-search";
import type { LensAnalysis, SupplierResult } from "./lens-types";

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

// Claude COMPARE : juge la pertinence des liens (score 0-100 + raison + hors-sujet).
async function claudeCompare(name: string, results: SupplierResult[], key: { apiKey: string; model: string }): Promise<Map<string, { score: number; reason: string; off: boolean }> | null> {
  const list = results.slice(0, 12).map((r, i) => `${i + 1}. ${r.title} — ${r.productUrl}`).join("\n");
  const prompt = `Produit recherché : "${name}".\nLiens trouvés :\n${list}\n\nPour CHAQUE lien, juge s'il correspond à ce produit chez un fournisseur. Réponds en JSON :\n{"items":[{"url":"...","score":0-100,"offTopic":true|false,"reason":"raison courte en français"}]}\nN'invente PAS de prix ni de note. Sois strict : un lien hors sujet a offTopic=true.`;
  const r = await claudeComplete({ apiKey: key.apiKey, model: key.model || "claude-sonnet-4-6", system: "Tu compares des liens fournisseurs pour de l'e-commerce. Réponds en JSON valide uniquement.", prompt, json: true, maxTokens: 1200, temperature: 0.2 });
  if (!r.ok) return null;
  try {
    const parsed = JSON.parse(r.text) as { items?: { url?: string; score?: number; offTopic?: boolean; reason?: string }[] };
    const map = new Map<string, { score: number; reason: string; off: boolean }>();
    for (const it of parsed.items || []) {
      if (!it.url) continue;
      map.set(it.url, { score: Math.max(0, Math.min(100, Math.round(it.score ?? 50))), reason: (it.reason || "").trim() || "évalué par Claude", off: !!it.offTopic });
    }
    return map.size ? map : null;
  } catch { return null; }
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

/** Recherche multi-IA : Gemini grounding (web) → Claude compare/score. Null si rien. */
export async function multiAiSearch(analysis: LensAnalysis, keyRefs: LensKeyRefs, maxItems = 8): Promise<MultiAiResult | null> {
  const name = (analysis.productName || pickKeywords(analysis)[0] || analysis.productType || "").trim();
  const query = `${name} wholesale supplier manufacturer (alibaba aliexpress 1688)`;
  const log = (event: string, extra: Record<string, unknown> = {}) =>
    console.log("[Lens/search]", { event, gemini: !!keyRefs.gemini, claude: !!keyRefs.claude, ...extra });
  const models: string[] = [];
  const web: { url: string; title: string }[] = [];

  const geminiKey = await resolveKey(keyRefs.gemini, "GEMINI_API_KEY");
  const claudeKey = await resolveKey(keyRefs.claude, "ANTHROPIC_API_KEY");

  // 1) Gemini : recherche web (grounding) — source principale.
  if (geminiKey) {
    log("gemini-search-start", { name });
    const r = await geminiGroundedSearch(geminiKey.apiKey, geminiKey.model || "gemini-2.0-flash", query);
    if ("ok" in r && r.ok) { if (r.web.length) { models.push("Gemini"); web.push(...r.web); } log("gemini-search-ok", { found: r.web.length }); }
    else log("gemini-search-error", { code: (r as { code?: string }).code });
  }
  // 2) Claude web search en REPLI si Gemini n'a rien trouvé.
  if (!web.length && claudeKey) {
    const r = await claudeWebSearch(claudeKey.apiKey, claudeKey.model || "claude-sonnet-4-6", query);
    if ("ok" in r && r.ok) { if (r.web.length) { models.push("Claude"); web.push(...r.web); } log("claude-web-ok", { found: r.web.length }); }
    else log("claude-web-error", { code: (r as { code?: string }).code });
  }

  if (!web.length) { log("multi-ai-empty", { fallback: "links-only" }); return null; }
  let results = normalizeWeb(web, analysis, [name], maxItems);

  // 3) Claude COMPARE : reclasse / score / écarte les liens hors sujet.
  if (claudeKey && results.length) {
    log("claude-compare-start", { n: results.length });
    const cmp = await claudeCompare(name, results, claudeKey).catch(() => null);
    if (cmp) {
      results = results
        .filter((r) => !cmp.get(r.productUrl)?.off)
        .map((r) => { const c = cmp.get(r.productUrl); return c ? { ...r, supplierScore: c.score, confidence: c.score, riskLevel: riskFromScore(c.score), reasons: [c.reason] } : r; })
        .sort((a, b) => b.supplierScore - a.supplierScore);
      if (!models.includes("Claude")) models.push("Claude");
      log("claude-compare-ok", { kept: results.length });
    }
  }

  if (!results.length) { log("multi-ai-no-results", { fallback: "links-only" }); return null; }
  log("multi-ai-ok", { models, results: results.length });
  return { results, models, queries: [name] };
}

/** Une recherche web multi-IA est-elle envisageable (IA connectée BYOK ou env serveur) ? */
export function multiAiAvailable(keyRefs: LensKeyRefs): boolean {
  return !!keyRefs.gemini || !!keyRefs.claude || !!(process.env.GEMINI_API_KEY || "").trim() || !!(process.env.ANTHROPIC_API_KEY || "").trim();
}

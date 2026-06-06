// ──────────────────────────────────────────────────────────────────────────
// Orkestra Lens — analyse produit (côté serveur).
// Image → vision OpenAI (BYOK, obligatoire pour l'analyse RÉELLE). Sans clé /
// mode démo / URL produit seule → analyse SIMULÉE propre (étiquetée live:false),
// dérivée du contexte (URL, titre de page, niche) via le moteur de niche existant.
// ──────────────────────────────────────────────────────────────────────────

import { liveEnabled } from "./ai/generate";
import { visionComplete } from "./ai/openai";
import { geminiVision } from "./ai/gemini";
import { getEncrypted } from "./server/keyStore";
import { decryptSecret } from "./crypto";
import { detectNiche, type NicheKey } from "./import-factory";
import type { LensAnalysis, LensInputKind } from "./lens-types";

export interface LensKeyRefs { openai?: string | null; claude?: string | null; gemini?: string | null }

export interface LensAnalyzeInput {
  kind: LensInputKind;
  /** data URL (upload) ou URL http d'image. */
  image?: string;
  /** URL produit (fournisseur / concurrent / Shopify). */
  url?: string;
  /** Contexte page (clipper) : titre, domaine, texte proche. */
  pageContext?: { title?: string; domain?: string; text?: string };
}
export interface LensAnalyzeResult { ok: boolean; analysis?: LensAnalysis; error?: string; live: boolean; }

// Clé BYOK (/connect) en priorité ; repli OPTIONNEL sur une variable d'env serveur.
async function resolveKey(ref: string | null | undefined, envVar: string, defaultModel: string): Promise<{ apiKey: string; model: string } | null> {
  if (ref) {
    const stored = await getEncrypted(ref);
    if (stored) { try { return { apiKey: decryptSecret(stored.encrypted), model: stored.meta.model || defaultModel }; } catch { /* clé illisible */ } }
  }
  const env = (process.env[envVar] || "").trim();
  if (env) return { apiKey: env, model: defaultModel };
  return null;
}

const SYSTEM =
  "Tu es Orkestra Lens, expert en sourcing e-commerce. Tu analyses une image (ou une page) produit et tu renvoies UNIQUEMENT un JSON. " +
  "Tu ne décris que ce qui est VISIBLE / certain ; tu n'inventes pas de matière ou de spec. " +
  "Le champ productName est un NOM PRODUIT COURT EN ANGLAIS de 3 à 5 mots, sans phrase, optimisé pour une recherche fournisseur " +
  "(ex: \"pilates reformer machine\", \"glass pendant light\", \"portable bottle warmer\", \"wearable breast pump\"). " +
  "Les mots-clés doivent être ceux qu'un acheteur taperait chez un fournisseur.";

function buildPrompt(input: LensAnalyzeInput): string {
  const ctx = [
    input.url ? `URL produit : ${input.url}` : "",
    input.pageContext?.title ? `Titre de page : ${input.pageContext.title}` : "",
    input.pageContext?.domain ? `Domaine : ${input.pageContext.domain}` : "",
    input.pageContext?.text ? `Texte proche : ${input.pageContext.text.slice(0, 400)}` : "",
  ].filter(Boolean).join("\n");
  return (
    "Analyse ce produit pour du sourcing fournisseur (Alibaba / AliExpress).\n" +
    (ctx ? ctx + "\n" : "") +
    "Renvoie ce JSON EXACT :\n" +
    "{\n" +
    '  "productName": "nom produit COURT en anglais, 3 à 5 mots, sans phrase (ex. pilates reformer machine)",\n' +
    '  "productType": "type produit précis (ex. Reformer Pilates, Chauffe-Biberon, Suspension Verre)",\n' +
    '  "niche": "luminaire|bebe|beaute|mode|sport|cuisine|mobilier|electronique|animaux|maison|generaliste",\n' +
    '  "form": "forme générale", "color": "couleur dominante", "material": "matière APPARENTE si identifiable, sinon vide",\n' +
    '  "style": "style", "usage": "usage principal",\n' +
    '  "distinctive": ["éléments distinctifs visibles"], "variants": ["variantes probables"],\n' +
    '  "keywordsFr": ["3-6 mots-clés de recherche FR"],\n' +
    '  "keywordsEn": ["3-6 mots-clés fournisseur EN (les plus probables sur Alibaba)"] ,\n' +
    '  "keywordsSupplier": ["2-4 requêtes fournisseur précises EN"],\n' +
    '  "summary": "une phrase de synthèse"\n' +
    "}"
  );
}

function arr(v: unknown, max = 8): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x || "").trim()).filter(Boolean).slice(0, max);
}
function str(v: unknown): string { return typeof v === "string" ? v.trim() : ""; }

// Nettoie un nom produit en 3-5 mots EN (sans ponctuation, sans phrase).
function cleanName(s: string, fallback: string): string {
  const w = (s || "").replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter(Boolean).slice(0, 5);
  return (w.length >= 2 ? w.join(" ") : fallback).toLowerCase().trim();
}
function coerce(raw: unknown, live: boolean): LensAnalysis {
  const o = (raw || {}) as Record<string, unknown>;
  const niche = str(o.niche) || "generaliste";
  const kwEn = arr(o.keywordsEn, 6);
  const productType = str(o.productType) || "Produit";
  return {
    productType,
    productName: cleanName(str(o.productName), kwEn[0] || productType),
    niche,
    form: str(o.form) || undefined,
    color: str(o.color) || undefined,
    material: str(o.material) || undefined,
    style: str(o.style) || undefined,
    usage: str(o.usage) || undefined,
    distinctive: arr(o.distinctive, 6),
    variants: arr(o.variants, 6),
    keywordsFr: arr(o.keywordsFr, 6),
    keywordsEn: arr(o.keywordsEn, 6),
    keywordsSupplier: arr(o.keywordsSupplier, 4),
    summary: str(o.summary) || undefined,
    live,
  };
}

// ── Analyse SIMULÉE (pas de clé / mode démo / URL seule) ────────────────────
const NICHE_DEFAULTS: Record<NicheKey, { type: string; fr: string[]; en: string[] }> = {
  luminaire: { type: "Suspension", fr: ["suspension", "luminaire salon", "lustre moderne"], en: ["pendant light", "modern chandelier", "ceiling lamp"] },
  bebe: { type: "Accessoire bébé", fr: ["accessoire bébé", "puériculture", "repas bébé"], en: ["baby product", "bottle warmer", "baby care"] },
  beaute: { type: "Soin visage", fr: ["soin visage", "cosmétique", "routine beauté"], en: ["face serum", "skincare", "beauty device"] },
  mode: { type: "Vêtement", fr: ["robe", "mode femme", "vêtement tendance"], en: ["women dress", "fashion clothing", "apparel"] },
  sport: { type: "Équipement fitness", fr: ["fitness", "matériel sport", "entraînement maison"], en: ["fitness equipment", "home gym", "pilates"] },
  cuisine: { type: "Ustensile cuisine", fr: ["ustensile cuisine", "accessoire cuisine"], en: ["kitchen utensil", "cookware", "kitchen gadget"] },
  mobilier: { type: "Meuble", fr: ["meuble", "mobilier maison"], en: ["furniture", "home furniture"] },
  electronique: { type: "Accessoire high-tech", fr: ["accessoire high-tech", "gadget"], en: ["electronic gadget", "phone accessory", "smart device"] },
  animaux: { type: "Accessoire animal", fr: ["accessoire chien", "accessoire chat"], en: ["pet product", "dog accessory", "cat toy"] },
  maison: { type: "Décoration", fr: ["décoration maison", "objet déco"], en: ["home decor", "decoration", "ornament"] },
  generaliste: { type: "Produit", fr: ["produit tendance", "accessoire"], en: ["trending product", "gadget", "accessory"] },
};
function slugWords(url?: string): string[] {
  if (!url) return [];
  try {
    const u = new URL(url);
    return decodeURIComponent(u.pathname).split(/[^A-Za-z]+/).filter((w) => w.length >= 3 && !/html|www|com|shop|store|product|item|dp|www/i.test(w)).slice(0, 6);
  } catch { return url.split(/[^A-Za-z]+/).filter((w) => w.length >= 3).slice(0, 6); }
}
function mockAnalysis(input: LensAnalyzeInput): LensAnalysis {
  const text = `${input.url || ""} ${input.pageContext?.title || ""} ${input.pageContext?.text || ""} ${slugWords(input.url).join(" ")}`;
  const niche = detectNiche(text);
  const d = NICHE_DEFAULTS[niche];
  const words = slugWords(input.url);
  const guessed = words.slice(0, 3).join(" ").trim();
  return {
    productType: guessed ? guessed.replace(/\b\w/g, (c) => c.toUpperCase()) : d.type,
    productName: cleanName(words.join(" ") || d.en[0] || d.type, d.en[0] || "product"),
    niche,
    style: undefined, usage: undefined, color: undefined, material: undefined, form: undefined,
    distinctive: [], variants: [],
    keywordsFr: Array.from(new Set([...(guessed ? [guessed] : []), ...d.fr])).slice(0, 6),
    keywordsEn: Array.from(new Set([...(words.length ? [words.join(" ")] : []), ...d.en])).slice(0, 6),
    keywordsSupplier: d.en.slice(0, 3),
    summary: "Analyse simulée — connectez OpenAI et importez une image pour une analyse réelle.",
    live: false,
  };
}

export async function analyzeLens(input: LensAnalyzeInput, keyRefs?: LensKeyRefs): Promise<LensAnalyzeResult> {
  const hasImage = !!input.image && /^data:image\/|^https?:\/\//i.test(input.image);
  // Log serveur SÛR (jamais la clé) pour le debug Gemini.
  const log = (event: string, extra: Record<string, unknown> = {}) =>
    console.log("[Lens/analyze]", { event, kind: input.kind, hasImage, gemini: !!keyRefs?.gemini, openai: !!keyRefs?.openai, ...extra });

  const tryCoerce = (text: string, engine: "gemini" | "openai"): LensAnalysis | null => {
    try { const a = coerce(JSON.parse(text), true); a.sourceUrl = input.url; a.engine = engine; return a; } catch { return null; }
  };

  if (hasImage && liveEnabled()) {
    log("image-received");
    // 1) Gemini PRIORITAIRE (multimodal) quand connecté (BYOK ou env fallback).
    const gem = await resolveKey(keyRefs?.gemini, "GEMINI_API_KEY", "gemini-2.0-flash");
    if (gem) {
      const r = await geminiVision(gem.apiKey, gem.model || "gemini-2.0-flash", SYSTEM, buildPrompt(input), input.image!, true);
      if (r.ok) { const a = tryCoerce(r.text, "gemini"); if (a) { log("gemini-vision-product-name-ok", { productName: a.productName }); return { ok: true, analysis: a, live: true }; } log("gemini-vision-bad-json"); }
      else log("gemini-vision-error", { code: r.code });
    }
    // 2) Fallback OpenAI Vision.
    const openai = await resolveKey(keyRefs?.openai, "OPENAI_API_KEY", "gpt-4o");
    if (openai) {
      const r = await visionComplete({ apiKey: openai.apiKey, model: openai.model, system: SYSTEM, prompt: buildPrompt(input), imageUrl: input.image!, json: true, maxTokens: 900 });
      if (r.ok) { const a = tryCoerce(r.text, "openai"); if (a) { log("openai-vision-product-name-ok", { productName: a.productName, fallbackFromGemini: !!gem }); return { ok: true, analysis: a, live: true }; } log("openai-vision-bad-json"); }
      else log("openai-vision-error", { code: r.code });
    }
  }
  // 3) Repli simulé (pas d'image, pas de clé, ou échecs).
  log("simulated", { reason: !hasImage ? "no-image" : !liveEnabled() ? "mock-mode" : "no-key-or-failed" });
  const a = mockAnalysis(input);
  a.sourceUrl = input.url; a.engine = "simulated";
  return { ok: true, analysis: a, live: false };
}

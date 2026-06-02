import {
  generateCouncil,
  generateProductSeo,
  type CouncilContext,
  type ProductSeoInput,
} from "./engine";
import type { CouncilMode, AIProviderId, CouncilResult, ProductSeoResult, GenMeta } from "../types";
import { chatComplete } from "./openai";
import { getEncrypted } from "../server/keyStore";
import { decryptSecret } from "../crypto";

// ──────────────────────────────────────────────────────────────────────────
// Orchestration des générations : LIVE (OpenAI) si une clé est connectée et
// que le mode live est activé, sinon FALLBACK mock (templates contextualisés).
// Seul OpenAI est branché en live dans cette étape — les autres providers
// restent mock, l'architecture est prête à les accueillir.
// ──────────────────────────────────────────────────────────────────────────

export interface KeyRefs {
  openai?: string | null;
}

export function liveEnabled(): boolean {
  return process.env.ORKESTRA_MOCK_MODE === "false";
}

async function resolveOpenAIKey(refs?: KeyRefs): Promise<{ apiKey: string; model: string } | null> {
  if (!refs?.openai) return null;
  const stored = await getEncrypted(refs.openai);
  if (!stored) return null;
  try {
    const apiKey = decryptSecret(stored.encrypted);
    return { apiKey, model: stored.meta.model || "gpt-4o" };
  } catch {
    return null;
  }
}

function nowIso() {
  return new Date().toISOString();
}

// ── Contexte boutique → texte de prompt ─────────────────────────────────────

function contextBlock(ctx: CouncilContext): string {
  const lines: string[] = [];
  if (ctx.brandName) lines.push(`Boutique : ${ctx.brandName}`);
  if (ctx.niche) lines.push(`Niche : ${ctx.niche}`);
  if (ctx.positioning) lines.push(`Positionnement : ${ctx.positioning}`);
  if (ctx.language) lines.push(`Langue : ${ctx.language}`);
  if (ctx.collections?.length) lines.push(`Collections : ${ctx.collections.slice(0, 10).join(", ")}`);
  if (ctx.productTypes?.length) lines.push(`Types de produits : ${ctx.productTypes.slice(0, 8).join(", ")}`);
  if (ctx.primaryKeywords?.length) lines.push(`Mots-clés : ${ctx.primaryKeywords.join(", ")}`);
  if (ctx.competitors?.length) lines.push(`Concurrents : ${ctx.competitors.join(", ")}`);
  if (ctx.productsFound != null)
    lines.push(`Scan public : ${ctx.productsFound} produits trouvés, ${ctx.productsEnriched ?? 0} enrichis via products.json, ${ctx.productsAnalyzed ?? 0} analysés en HTML (couverture ${ctx.coverage ?? "n/a"}, source ${ctx.catalogSource ?? "n/a"}).`);
  if (ctx.weakDescriptions != null) lines.push(`Fiches à description faible : ${ctx.weakDescriptions}.`);
  if (ctx.weakTitles != null) lines.push(`Titres produits faibles : ${ctx.weakTitles}.`);
  if (ctx.englishCount != null) lines.push(`Textes anglais détectés : ${ctx.englishCount}.`);
  if (ctx.missingLegal?.length) lines.push(`Pages légales manquantes : ${ctx.missingLegal.join(", ")}.`);
  if (ctx.issuesSummary?.length) lines.push(`Problèmes détectés :\n- ${ctx.issuesSummary.slice(0, 8).join("\n- ")}`);
  if (ctx.scoresSummary) lines.push(`Scores : ${ctx.scoresSummary}.`);
  return lines.join("\n");
}

const MODE_LABEL: Record<CouncilMode, string> = {
  seo: "SEO e-commerce", code: "Code Shopify", merchant: "Google Merchant Center",
  email: "Email client", quote: "Devis", strategy: "Stratégie e-commerce",
  competitive: "Analyse concurrentielle", free: "Question libre",
};

// ── AI Council live ─────────────────────────────────────────────────────────

export async function runCouncil(
  mode: CouncilMode,
  question: string,
  providers: AIProviderId[],
  ctx: CouncilContext,
  refs?: KeyRefs
): Promise<{ result: CouncilResult; meta: GenMeta }> {
  // Scaffold mock (scores, sidebar, onglets) — réutilisé même en live.
  const scaffold = generateCouncil(mode, question, providers, ctx);

  if (!liveEnabled()) {
    return { result: scaffold, meta: { live: false, generatedAt: nowIso(), fallbackReason: "Mode démo (ORKESTRA_MOCK_MODE)" } };
  }
  const key = await resolveOpenAIKey(refs);
  if (!key) {
    return { result: scaffold, meta: { live: false, generatedAt: nowIso(), fallbackReason: "Aucune clé OpenAI connectée" } };
  }

  const system =
    "Tu es Orkestra, copilote e-commerce multi-IA spécialisé Shopify. Réponds en français, en markdown structuré (titres ##/###, listes, gras), de façon concrète et actionnable. " +
    "Appuie-toi STRICTEMENT sur les données réelles de la boutique fournies (scan public, mémoire boutique). Cite des chiffres réels quand ils sont disponibles. Ne sois pas générique.";
  const prompt =
    `Mode : ${MODE_LABEL[mode]}\n\n` +
    `=== Données de la boutique ===\n${contextBlock(ctx) || "(peu de données — reste prudent)"}\n\n` +
    `=== Demande de l'utilisateur ===\n${question}`;

  const r = await chatComplete({ apiKey: key.apiKey, model: key.model, system, prompt, temperature: 0.5, maxTokens: 2000 });
  if (!r.ok) {
    return { result: scaffold, meta: { live: false, generatedAt: nowIso(), fallbackReason: r.message } };
  }

  // On remplace la synthèse + la réponse OpenAI par le texte réel.
  const result: CouncilResult = { ...scaffold, finalAnswer: r.text };
  result.providerAnswers = scaffold.providerAnswers.map((p) =>
    p.provider === "openai" ? { ...p, answer: r.text } : p
  );
  if (!result.providerAnswers.some((p) => p.provider === "openai")) {
    result.providerAnswers = [
      { provider: "openai", model: r.model, specialty: "Réponse live OpenAI", answer: r.text, qualityScore: 90, strengths: ["Réponse réelle générée par votre clé OpenAI"], limits: [] },
      ...result.providerAnswers,
    ];
  }
  result.modelsUsed = [...new Set(["openai" as AIProviderId, ...result.modelsUsed])];

  return { result, meta: { live: true, provider: "openai", model: r.model, tokens: r.tokens, generatedAt: nowIso() } };
}

// ── SEO Studio live ─────────────────────────────────────────────────────────

export async function runProductSeo(
  input: ProductSeoInput,
  ctx: CouncilContext,
  refs?: KeyRefs
): Promise<{ result: ProductSeoResult; meta: GenMeta }> {
  const mock = generateProductSeo(input);

  if (!liveEnabled()) return { result: mock, meta: { live: false, generatedAt: nowIso(), fallbackReason: "Mode démo (ORKESTRA_MOCK_MODE)" } };
  const key = await resolveOpenAIKey(refs);
  if (!key) return { result: mock, meta: { live: false, generatedAt: nowIso(), fallbackReason: "Aucune clé OpenAI connectée" } };

  const system =
    "Tu es Orkestra, expert SEO e-commerce Shopify. Tu génères une fiche produit SEO complète en français. " +
    "Réponds UNIQUEMENT par un objet JSON valide avec EXACTEMENT ces clés : optimizedTitle (string), h1 (string), shortDescription (string), longDescriptionHtml (string, HTML Shopify propre), benefits (string[]), features (string[]), faq (array de {q,a}), metaTitle (string ≤60), metaDescription (string ≤155), imageAltTexts (string[]), handle (string, slug), primaryKeywords (string[]), longTailKeywords (string[]), internalLinks (string[]), seoScore (number 0-100), conversionScore (number 0-100), recommendations (string[]).";
  const prompt =
    `=== Boutique ===\n${contextBlock(ctx)}\n\n=== Produit ===\n` +
    `Nom : ${input.productName}\nCollection : ${input.collection || ""}\nCaractéristiques : ${input.features || ""}\n` +
    `Bénéfices : ${input.benefits || ""}\nMatériaux/dimensions : ${input.materials || ""}\nPrix : ${input.price || ""}\n` +
    `Public cible : ${input.audience || ""}\nMots-clés souhaités : ${input.keywords || ""}\nNiveau SEO : ${input.level}\n\n` +
    `Génère la fiche SEO ultra optimisée pour cette boutique.`;

  const r = await chatComplete({ apiKey: key.apiKey, model: key.model, system, prompt, temperature: 0.6, maxTokens: 2200, json: true });
  if (!r.ok) return { result: mock, meta: { live: false, generatedAt: nowIso(), fallbackReason: r.message } };

  try {
    const parsed = JSON.parse(r.text);
    const result = coerceSeo(parsed, mock);
    return { result, meta: { live: true, provider: "openai", model: r.model, tokens: r.tokens, generatedAt: nowIso() } };
  } catch {
    return { result: mock, meta: { live: false, generatedAt: nowIso(), fallbackReason: "Réponse OpenAI non parsable — fallback mock" } };
  }
}

/** Coerce la réponse JSON OpenAI vers ProductSeoResult, en complétant via le mock. */
function coerceSeo(p: any, mock: ProductSeoResult): ProductSeoResult {
  const arr = (v: any, fb: string[]) => (Array.isArray(v) ? v.map(String) : fb);
  const faq = Array.isArray(p?.faq)
    ? p.faq.filter((x: any) => x && (x.q || x.question)).map((x: any) => ({ q: String(x.q ?? x.question), a: String(x.a ?? x.answer ?? "") }))
    : mock.faq;
  return {
    optimizedTitle: p?.optimizedTitle ?? mock.optimizedTitle,
    h1: p?.h1 ?? mock.h1,
    shortDescription: p?.shortDescription ?? mock.shortDescription,
    longDescriptionHtml: p?.longDescriptionHtml ?? mock.longDescriptionHtml,
    benefits: arr(p?.benefits, mock.benefits),
    features: arr(p?.features, mock.features),
    faq: faq.length ? faq : mock.faq,
    metaTitle: (p?.metaTitle ?? mock.metaTitle).slice(0, 65),
    metaDescription: (p?.metaDescription ?? mock.metaDescription).slice(0, 160),
    imageAltTexts: arr(p?.imageAltTexts, mock.imageAltTexts),
    handle: p?.handle ?? mock.handle,
    primaryKeywords: arr(p?.primaryKeywords, mock.primaryKeywords),
    longTailKeywords: arr(p?.longTailKeywords, mock.longTailKeywords),
    internalLinks: arr(p?.internalLinks, mock.internalLinks),
    seoScore: typeof p?.seoScore === "number" ? p.seoScore : mock.seoScore,
    conversionScore: typeof p?.conversionScore === "number" ? p.conversionScore : mock.conversionScore,
    recommendations: arr(p?.recommendations, mock.recommendations),
  };
}

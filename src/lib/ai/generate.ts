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
  if (ctx.collectionsFound != null) lines.push(`Collections : ${ctx.collectionsFound} trouvées, ${ctx.collectionsAnalyzed ?? 0} analysées.`);
  if (ctx.weakDescriptions != null) lines.push(`Fiches à description absente/courte : ${ctx.weakDescriptions}.`);
  if (ctx.weakTitles != null) lines.push(`Titres produits faibles/génériques : ${ctx.weakTitles}.`);
  if (ctx.noType != null) lines.push(`Produits sans product_type : ${ctx.noType}.`);
  if (ctx.tagsCoverage != null) lines.push(`Couverture tags : ${ctx.tagsCoverage}% du catalogue.`);
  if (ctx.missingMeta != null) lines.push(`Meta descriptions manquantes (échantillon) : ${ctx.missingMeta}.`);
  if (ctx.imagesNoAlt != null) lines.push(`Images sans alt text : ${ctx.imagesNoAlt}.`);
  if (ctx.topTypes?.length) lines.push(`Types produits fréquents : ${ctx.topTypes.join(", ")}.`);
  if (ctx.englishCount != null) lines.push(`Textes anglais détectés : ${ctx.englishCount}.`);
  if (ctx.missingLegal?.length) lines.push(`Pages légales manquantes : ${ctx.missingLegal.join(", ")}.`);
  if (ctx.priorityProducts?.length)
    lines.push(
      `Produits prioritaires à optimiser (score contenu /100) :\n` +
        ctx.priorityProducts.slice(0, 6).map((p) => `  - ${p.title} (${p.contentScore}, ${p.reason})`).join("\n")
    );
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

  const hasScan = ctx.productsFound != null;
  const system =
    "Tu es Orkestra, copilote e-commerce multi-IA spécialisé Shopify. Tu réponds en français, en markdown structuré (## / ###, listes, gras), de façon dense, précise et directement actionnable.\n" +
    "RÈGLE ABSOLUE : tu n'as PAS le droit de répondre de manière générique. Chaque recommandation DOIT s'appuyer sur une donnée réelle du scan fournie (chiffre, nom de collection, nom de produit prioritaire, problème détecté) — ou alors tu indiques explicitement « donnée non disponible dans le scan ».\n" +
    "Interdits : phrases vagues du type « ajoutez du maillage interne », « optimisez vos fiches », « créez du contenu » SANS préciser OÙ, COMBIEN, POURQUOI, un EXEMPLE concret, le MODULE Orkestra (SEO Studio / Merchant Shield / Section Builder) et l'IMPACT attendu.\n" +
    "Pour toute correction (collection ou produit), propose du concret prêt à coller : title, meta description, H1, structure H2/H3, FAQ (questions réelles), maillage interne vers les vraies collections.\n" +
    "Adapte le vocabulaire à la niche détectée (ex. luminaires : pièce salon/chambre/cuisine/escalier, hauteur d'installation, type d'ampoule, matériau, ambiance lumineuse).\n" +
    "Distingue toujours : DIAGNOSTIC (ce que montre le scan), CORRECTION (le contenu proposé), ACTION (quoi faire + module Orkestra).";
  // En mode SEO, on impose la structure d'une vraie mission SEO Shopify.
  const seoStructure =
    "\n\nTu agis comme un EXPERT SEO Shopify. Sépare clairement : A) SEO collections, B) SEO produits, C) maillage interne, D) images/alt, E) blog/longue traîne, F) Merchant Center/structure catalogue, G) plan priorisé. Ne mélange pas tout dans une seule liste.\n" +
    "Structure imposée :\n" +
    "## 1. Résumé du scan SEO (produits trouvés/enrichis/analysés, collections, descriptions faibles, meta manquantes, images sans alt, product_type manquants, couverture)\n" +
    "## 2. Priorités SEO par impact (haute / moyenne / basse)\n" +
    "## 3. Collections à optimiser — pour CHAQUE collection RÉELLE fournie : problème, mot-clé principal, mots-clés secondaires, title proposé (≤60), meta proposée (≤155), texte SEO recommandé (intro 150–300 mots + H2/H3), FAQ (4–6), maillage interne (ancres exactes)\n" +
    "## 4. Produits à optimiser — pour CHAQUE produit prioritaire fourni : problème, mot-clé cible, correction, alt text proposé, FAQ produit, action SEO Studio\n" +
    "## 5. Maillage interne recommandé — tableau Source / Cible / Ancre / Impact (uniquement avec les collections réelles)\n" +
    "## 6. Stratégie mots-clés — courte traîne, transactionnels, longue traîne, blog, FAQ (adaptés à la niche)\n" +
    "## 7. Plan d'action 7 jours (jour par jour, chiffré)\n" +
    "## 8. Plan d'action 30 jours (par semaine)\n" +
    "## 9. Corrections prêtes à copier — 2 meta descriptions, 2 titles, 3 FAQ, 3 alt text, 3 ancres de maillage\n" +
    "## 🚀 Actions Orkestra (SEO Studio / Merchant Shield / Section Builder)\n" +
    "INTERDICTION D'INVENTER des collections/produits/pages non fournis. Si une donnée manque, écris « donnée non disponible via scan public » et propose une action prudente (ou indique qu'une connexion API Shopify sera nécessaire). Sois ambitieux et exhaustif : l'objectif est de MAXIMISER le SEO, pas de donner 5 conseils.";
  const structure = !hasScan
    ? ""
    : mode === "seo"
    ? seoStructure
    : "\n\nStructure imposée :\n## Résumé du scan\n## ✅ Ce qui va bien\n## 🔧 Problèmes détectés (avec chiffres)\n## 🛍️ Produits prioritaires (+ action par produit)\n## 📁 Collections prioritaires (corrections concrètes : title/meta/H1/FAQ/maillage)\n## ⚡ Quick wins\n## 🗓️ Plan 7 jours\n## 🗓️ Plan 30 jours\n## 🚀 Actions Orkestra";
  const prompt =
    `Mode : ${MODE_LABEL[mode]}\n\n` +
    `=== Données réelles du scan & de la boutique ===\n${contextBlock(ctx) || "(aucune donnée de scan — précise-le et reste prudent)"}\n` +
    structure +
    `\n\n=== Demande de l'utilisateur ===\n${question}`;

  const r = await chatComplete({ apiKey: key.apiKey, model: key.model, system, prompt, temperature: 0.4, maxTokens: mode === "seo" ? 3600 : 2400 });
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

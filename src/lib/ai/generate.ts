import {
  generateCouncil,
  generateProductSeo,
  isFollowupQuestion,
  followupTopic,
  type CouncilContext,
  type ProductSeoInput,
} from "./engine";
import type { CouncilMode, AIProviderId, CouncilResult, ProductSeoResult, GenMeta } from "../types";
import { chatComplete } from "./openai";
import { getPreset } from "../niche";
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
  if (ctx.country) lines.push(`Pays cible : ${ctx.country}`);
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
  if (ctx.legalFound?.length) lines.push(`Pages de confiance détectées : ${ctx.legalFound.join(", ")}.`);
  if (ctx.merchantScore != null) lines.push(`Score Merchant apparent : ${ctx.merchantScore}/100.`);
  if (ctx.formality) lines.push(`Ton de marque : ${ctx.formality}.`);
  if (ctx.shippingDelay) lines.push(`Délai de livraison annoncé : ${ctx.shippingDelay}.`);
  if (ctx.returnPolicy) lines.push(`Politique de retour : ${ctx.returnPolicy}.`);
  if (ctx.promises?.length) lines.push(`Promesses de marque : ${ctx.promises.join(", ")}.`);
  if (ctx.priorityProducts?.length)
    lines.push(
      `Produits prioritaires à optimiser (score contenu /100) :\n` +
        ctx.priorityProducts.slice(0, 6).map((p) => `  - ${p.title} (${p.contentScore}, ${p.reason})`).join("\n")
    );
  if (ctx.englishList?.length)
    lines.push(
      `Textes anglais exacts détectés :\n` +
        ctx.englishList.slice(0, 10).map((e) => `  - « ${e.text} » → « ${e.suggestion} » (source ${e.source}, impact ${e.impact})`).join("\n")
    );
  if (ctx.problems?.length)
    lines.push(
      `Problèmes détectés (structurés) :\n` +
        ctx.problems.slice(0, 10).map((p) => `  - [${p.severity}] ${p.area} → ${p.fix} (module ${p.module})`).join("\n")
    );
  else if (ctx.issuesSummary?.length) lines.push(`Problèmes détectés :\n- ${ctx.issuesSummary.slice(0, 8).join("\n- ")}`);
  if (ctx.scoresSummary) lines.push(`Scores : ${ctx.scoresSummary}.`);
  return lines.join("\n");
}

/** Bloc historique (provider-agnostique) injecté dans le prompt. */
function historyBlock(ctx: CouncilContext): string {
  if (!ctx.history?.length) return "";
  const turns = ctx.history.slice(-6).map((h) => `${h.role === "user" ? "Utilisateur" : "Orkestra"} : ${h.content.slice(0, 700)}`);
  return `\n\n=== Historique de la conversation ===\n${turns.join("\n")}`;
}

const MODE_LABEL: Record<CouncilMode, string> = {
  seo: "SEO e-commerce", code: "Code Shopify", merchant: "Google Merchant Center",
  email: "Email client", quote: "Devis", strategy: "Stratégie e-commerce",
  competitive: "Analyse concurrentielle", free: "Question libre",
};

// Rôle d'expert imposé par mode.
const MODE_ROLE: Record<CouncilMode, string> = {
  seo: "tu es un EXPERT SEO Shopify (collections, fiches, maillage, mots-clés).",
  merchant: "tu es un EXPERT Google Merchant Center / Shopping. Concentre-toi sur la conformité apparente et les risques AVANT soumission (pages légales, langue, descriptions, product_type, structure catalogue). Ne fais PAS d'audit SEO général. Ne promets JAMAIS l'absence de suspension — Google reste seul décisionnaire.",
  code: "tu es un EXPERT Liquid / Shopify Online Store 2.0 / UX. Si l'utilisateur demande du code ou une section, fournis un VRAI bloc Liquid + CSS + {% schema %} propre, commenté, responsive, avec instructions d'installation et une version sans JS. Ne donne PAS de conseils marketing vagues.",
  email: "tu es un assistant SAV e-commerce professionnel. Rédige un email PRÊT À ENVOYER (objet + corps + signature) adapté au ton de marque (vouvoiement/tutoiement), aux délais/retours/garanties fournis. N'invente AUCUNE info absente — mets [à confirmer]. Donne aussi une variante courte et une plus chaleureuse. Ne fais PAS d'audit SEO.",
  quote: "tu es un assistant commercial. Aide à structurer un devis professionnel (lignes, conditions, acompte, délais, message d'accompagnement, points à vérifier). Demande les infos manquantes. Ne fais PAS une analyse générale de boutique.",
  strategy: "tu es un consultant e-commerce / growth. Donne un diagnostic business + priorités par impact + roadmaps 7/30/90 jours basés sur les scores, le catalogue, les collections et la niche.",
  competitive: "tu es un analyste e-commerce. À partir UNIQUEMENT du contexte boutique fourni (niche, pays, langue, collections, produits, types, mots-clés, positionnement, style), GÉNÈRE 3 à 5 CONCURRENTS DIRECTS SPÉCIALISÉS probables (boutiques e-commerce vendant les mêmes catégories, positionnement proche), ADAPTÉS à cette niche précise — n'utilise la liste fallback fournie que comme inspiration, ne la recopie pas systématiquement. NE mets PAS de marketplaces/généralistes (Amazon, Cdiscount, Leroy Merlin, Maisons du Monde, La Redoute, ManoMano, Zalando, Sephora, Fnac…) en concurrents principaux : uniquement dans une section secondaire « acteurs généralistes à surveiller ». Il n'y a PAS de recherche web ni de crawl : annonce clairement « analyse indicative basée sur la niche, les produits et le positionnement détectés ; ajoutez les URLs de vos concurrents pour une analyse plus précise ». N'invente AUCUN chiffre (trafic, CA, conversion, parts de marché) ni fait précis non vérifié — emploie « probable », « à analyser », « à vérifier avec une URL ». Donne un niveau de confiance par concurrent.",
  free: "détecte l'intention de la question et réponds comme l'expert correspondant (SEO, Merchant, Code, Email, Devis, Stratégie ou Concurrence).",
};

function modeStructure(mode: CouncilMode): string {
  const seo =
    "Sépare clairement : A) SEO collections, B) SEO produits, C) maillage interne, D) images/alt, E) blog/longue traîne, F) Merchant/structure catalogue, G) plan priorisé.\nStructure imposée :\n## 1. Résumé du scan SEO\n## 2. Priorités par impact (haute/moyenne/basse)\n## 3. Collections à optimiser — pour CHAQUE collection RÉELLE : problème, mot-clé principal + secondaires, title (≤60), meta (≤155), texte SEO (intro 150–300 mots + H2/H3), FAQ (4–6), maillage (ancres)\n## 4. Produits à optimiser — pour CHAQUE produit prioritaire : problème, mot-clé cible, correction, alt text, FAQ produit, action SEO Studio\n## 5. Maillage interne (tableau Source/Cible/Ancre/Impact)\n## 6. Stratégie mots-clés (courte/transactionnels/longue traîne/blog/FAQ)\n## 7. Plan 7 jours\n## 8. Plan 30 jours\n## 9. Corrections prêtes à copier (2 meta, 2 titles, 3 FAQ, 3 alt, 3 ancres)\n## 🚀 Actions Orkestra";
  const map: Record<CouncilMode, string> = {
    seo,
    merchant:
      "Structure imposée :\n## Résumé conformité apparent (+ score Merchant apparent)\n## ✅ Éléments rassurants déjà présents (pages détectées)\n## 🔴 Risques critiques\n## 🟠 Risques importants\n## 🟡 Risques mineurs\n## ✅ Checklist avant soumission Merchant Center\n## Plan de correction priorisé\n## 🚀 Modules Orkestra\nRappelle le disclaimer (aucune garantie d'approbation).",
    code:
      "Structure imposée :\n## Diagnostic UX rapide (vue publique)\n## Section recommandée (objectif, où la placer, pourquoi, contenu)\n## 💻 Code (si demandé) : ```liquid (Liquid + {% schema %}), ```css, ```js si nécessaire — propre, commenté, responsive\n## Installation\n## Version sans JS\n## 🚀 Action Orkestra (Section Builder)",
    email:
      "Structure imposée :\n## Analyse rapide de la demande\n## Email prêt à envoyer (Objet + corps + signature)\n## Variante courte\n## Variante plus chaleureuse\nMets [à confirmer] pour toute info absente.",
    quote:
      "Structure imposée :\n## Résumé du besoin\n## Infos à demander si manquantes\n## Structure de devis (tableau lignes)\n## Conditions (acompte, délais, remise volume)\n## Message d'accompagnement (email)\n## Points à vérifier avant envoi",
    strategy:
      "Structure imposée :\n## Diagnostic business rapide\n## Priorités par impact\n## Opportunités de croissance (SEO, conversion, contenu, Ads/Merchant)\n## Roadmap 7 jours\n## Roadmap 30 jours\n## Roadmap 90 jours\n## Quick wins\n## Risques\n## 🚀 Modules Orkestra",
    competitive:
      "Structure imposée :\n## 1. Concurrents directs probables (3–5 spécialisés) — pour chacun : nom, type, raison de pertinence, proximité avec la boutique, niveau de confiance (élevé/moyen/à vérifier)\n## 2. Pourquoi ce sont vos concurrents (même niche, catégories proches, audience similaire, positionnement proche, intention de recherche similaire)\n## 3. Analyse indicative par concurrent (positionnement probable, catégories fortes probables, angle SEO probable, forces UX/conversion à surveiller, opportunités pour notre boutique, ce qu'Orkestra recommande de faire mieux)\n## 4. Opportunités pour la boutique (collections à renforcer, pages SEO à créer, guides d'achat, FAQ, maillage interne, différenciation de marque, sections UX, réassurance, contenu longue traîne)\n## 5. Acteurs généralistes à surveiller (section SECONDAIRE uniquement, non prioritaire)\n## 6. Prochaine étape : « Ajoutez 3 URLs concurrentes pour une analyse comparative plus précise. »\nAnalyse indicative (pas de recherche web) — aucun chiffre inventé.",
    free: "Détecte l'intention et applique la structure de l'expert correspondant.",
  };
  return map[mode];
}

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
    "Tu es Orkestra, copilote e-commerce multi-IA spécialisé Shopify. Tu réponds en français, en markdown structuré (## / ###, listes, gras), de façon dense, précise et directement actionnable.\n" +
    "RÈGLE ABSOLUE : pas de réponse générique. Chaque recommandation DOIT s'appuyer sur une donnée réelle fournie (chiffre, nom de collection, produit prioritaire, page légale, score) — sinon écris explicitement « donnée non disponible via scan public » et propose une action prudente (ou indique qu'une connexion API Shopify sera nécessaire). N'INVENTE jamais de collections/produits/pages/faits non fournis.\n" +
    "Interdits : « ajoutez du maillage interne », « optimisez vos fiches », « créez du contenu » SANS préciser OÙ, COMBIEN, POURQUOI, un EXEMPLE concret, le MODULE Orkestra et l'IMPACT.\n" +
    "Distingue toujours DIAGNOSTIC / CORRECTION / ACTION. Adapte le vocabulaire à la niche (ex. luminaires : pièce, hauteur d'installation, type d'ampoule, matériau, ambiance).\n" +
    `RÔLE POUR CE MODE — ${MODE_ROLE[mode]}`;

  // Logique de suivi COMMUNE à toutes les IA : si la question dépend du message
  // précédent, on répond précisément au point demandé sans refaire l'audit.
  const followup = isFollowupQuestion(question, ctx);
  const directive = followup
    ? `\n\n⚠️ QUESTION DE SUIVI (sujet probable : ${followupTopic(question)}). Réponds UNIQUEMENT et PRÉCISÉMENT à ce point précis, en t'appuyant sur l'historique et les données structurées fournies (ex. textes anglais exacts, produits prioritaires, pages légales). NE refais PAS l'audit complet, ne répète pas le plan ni les collections, sois court et direct. Donne : la donnée exacte demandée, la source/page si dispo, la correction, l'impact, le chemin Shopify probable, l'action Orkestra.`
    : "\n\n" + modeStructure(mode);
  // En mode Concurrence, on suggère des concurrents DIRECTS spécialisés (niche)
  // + les généralistes en secondaire, pour éviter une liste de marketplaces.
  let competitorHint = "";
  if (mode === "competitive") {
    const { preset } = getPreset(ctx);
    const generalists = preset.generalists ?? [];
    const direct = (ctx.competitors?.filter((c) => !generalists.some((g) => g.toLowerCase() === c.toLowerCase())) ?? []);
    const directList = direct.length ? direct : preset.competitors;
    competitorHint =
      `\n\n=== Concurrents — FALLBACK niche (inspiration, NE PAS recopier tel quel) ===\n` +
      `Exemples de concurrents spécialisés de cette niche (à adapter/affiner selon les produits, collections et positionnement détectés, ou à remplacer par de meilleurs si pertinent) : ${directList.slice(0, 5).join(", ")}.\n` +
      `Acteurs généralistes (UNIQUEMENT en section secondaire « à surveiller ») : ${generalists.join(", ")}.`;
  }
  const prompt =
    `Mode sélectionné : ${MODE_LABEL[mode]} (réponds STRICTEMENT selon ce mode, pas un autre).\n\n` +
    `=== Données réelles du scan & de la boutique ===\n${contextBlock(ctx) || "(aucune donnée de scan — précise-le et reste prudent)"}` +
    competitorHint +
    historyBlock(ctx) +
    directive +
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

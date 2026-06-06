import {
  generateCouncil,
  generateProductSeo,
  generateSection,
  isTargetedQuestion,
  classifyIntent,
  type CouncilContext,
  type ProductSeoInput,
  type SectionInput,
} from "./engine";
import type { CouncilMode, AIProviderId, CouncilResult, CouncilProviderAnswer, ProductSeoResult, SectionResult, GenMeta } from "../types";
import { chatComplete, type ChatOk } from "./openai";
import { claudeComplete } from "./claude";
import { getPreset } from "../niche";
import { routeSection, PROVIDER_NAME, type SectionMode } from "./sectionModelRouter";
import { getEncrypted } from "../server/keyStore";
import { decryptSecret } from "../crypto";

// Modes orientés relecture/correction de code.
const REVIEW_ORIENTED: SectionMode[] = ["review", "fix", "mobile", "nojs", "settings"];

// ──────────────────────────────────────────────────────────────────────────
// Orchestration des générations : LIVE (OpenAI) si une clé est connectée et
// que le mode live est activé, sinon FALLBACK mock (templates contextualisés).
// Seul OpenAI est branché en live dans cette étape — les autres providers
// restent mock, l'architecture est prête à les accueillir.
// ──────────────────────────────────────────────────────────────────────────

export interface KeyRefs {
  openai?: string | null;
  claude?: string | null;
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

async function resolveClaudeKey(refs?: KeyRefs): Promise<{ apiKey: string; model: string } | null> {
  if (!refs?.claude) return null;
  const stored = await getEncrypted(refs.claude);
  if (!stored) return null;
  try {
    return { apiKey: decryptSecret(stored.encrypted), model: stored.meta.model || "claude-sonnet-4-6" };
  } catch {
    return null;
  }
}

// Modes AI Council qui bénéficient d'une fusion OpenAI + Claude (demandes
// complexes / éditoriales). Les modes structurés/rapides restent OpenAI seul.
const FUSION_MODES = new Set<CouncilMode>(["code", "strategy", "competitive", "free", "email", "quote"]);

const FUSION_SYSTEM =
  "Tu es Orkestra, l'arbitre qui FUSIONNE les réponses de plusieurs IA en UNE réponse finale supérieure, en français, markdown structuré.\n" +
  "Tu reçois : la demande utilisateur, la Réponse A (OpenAI) et la Réponse B (Claude).\n" +
  "Produis la MEILLEURE réponse finale : reprends le meilleur des deux, SUPPRIME les doublons, garde le plus actionnable et précis, signale BRIÈVEMENT les contradictions importantes.\n" +
  "RÈGLES : ne fais PAS la somme des deux et ne rallonge pas inutilement ; reste précis sur la DERNIÈRE question ; si la demande est ciblée, reste ciblé (PAS de ré-audit complet) ; si une réponse invente une information non sourcée, ignore-la ; ne mentionne pas « Réponse A / Réponse B » dans le texte final.\n" +
  "Le champ 'final' DOIT se terminer par une section « ## Prochaine action » : UNE action concrète, sa priorité, et le module Orkestra où agir (Import Factory, Merchant Shield, Assistant Shopify).\n" +
  "Réponds UNIQUEMENT par un JSON : {\"final\": \"<réponse finale fusionnée en markdown>\", \"why\": {\"openai\": \"<ce qu'OpenAI a apporté, 1 phrase>\", \"claude\": \"<ce que Claude a apporté, 1 phrase>\", \"kept\": \"<ce que tu as gardé, 1 phrase>\", \"rejected\": \"<ce que tu as écarté : info non sourcée, répétition, vague… 1 phrase>\", \"contradiction\": \"<contradiction éventuelle + qui est retenu et pourquoi, sinon chaîne vide>\"}}.";

function fusionPrompt(question: string, a: string, b: string, targeted: boolean): string {
  return (
    `=== Demande de l'utilisateur ===\n${question}\n\n` +
    `=== Réponse A (OpenAI — structure & données) ===\n${a}\n\n` +
    `=== Réponse B (Claude — formulation & relecture) ===\n${b}\n\n` +
    (targeted ? "La demande est CIBLÉE : garde un format court et ciblé, ne refais pas d'audit.\n\n" : "") +
    "Rédige la réponse finale Orkestra fusionnée (la meilleure des deux, sans doublon)."
  );
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
  seo: "tu es un CONSULTANT SEO Shopify SENIOR (niveau agence), spécialisé e-commerce et Google Merchant Center. Tu livres une VRAIE stratégie SEO Shopify (pas une checklist) : audit page par page (accueil, collections, produits), mots-clés par intention ET par collection/produit, titles/meta NATURELS, contenus à ajouter avec le chemin Shopify exact, maillage interne, calendrier éditorial, routine hebdo, plans 7/30 jours. Les titles/meta doivent être DESCRIPTIFS, précis et adaptés SEO + Google Merchant Center — jamais bourrés d'adjectifs. N'emploie PAS automatiquement « premium », « professionnel », « haut de gamme », « meilleur », « qualité premium » : uniquement si une donnée le justifie. Dis clairement QUOI modifier, OÙ dans Shopify et POURQUOI. Si un élément est déjà bon (titres, descriptions, pages légales, scores), signale-le et recommande de NE PAS le retoucher.",
  merchant: "tu es un EXPERT Google Merchant Center / Shopping. Concentre-toi sur la conformité apparente et les risques AVANT soumission (pages légales, langue, descriptions, product_type, structure catalogue). Ne fais PAS d'audit SEO général. Ne promets JAMAIS l'absence de suspension — Google reste seul décisionnaire.",
  code: "tu es un développeur Shopify senior (niveau Claude pour le code Liquid/CSS/schema) et expert UI/UX premium. Tu produis des SECTIONS Shopify Online Store 2.0 complètes, propres, responsive et installables, dans une discussion naturelle. Tu fournis de VRAIS blocs de code (Liquid + {% schema %} JSON valide + CSS namespacé + JS encapsulé si nécessaire), des instructions d'installation et une checklist qualité. Pas de conseils marketing vagues.",
  email: "tu es un assistant SAV e-commerce professionnel. Rédige un email PRÊT À ENVOYER (objet + corps + signature) adapté au ton de marque (vouvoiement/tutoiement), aux délais/retours/garanties fournis. N'invente AUCUNE info absente — mets [à confirmer]. Donne aussi une variante courte et une plus chaleureuse. Ne fais PAS d'audit SEO.",
  quote: "tu es un assistant commercial. Aide à structurer un devis professionnel (lignes, conditions, acompte, délais, message d'accompagnement, points à vérifier). Demande les infos manquantes. Ne fais PAS une analyse générale de boutique.",
  strategy: "tu es un consultant e-commerce / growth. Donne un diagnostic business + priorités par impact + roadmaps 7/30/90 jours basés sur les scores, le catalogue, les collections et la niche.",
  competitive: "tu es un analyste e-commerce. À partir UNIQUEMENT du contexte boutique fourni (niche, pays, langue, collections, produits, types, mots-clés, positionnement, style), GÉNÈRE 3 à 5 CONCURRENTS DIRECTS SPÉCIALISÉS probables (boutiques e-commerce vendant les mêmes catégories, positionnement proche), ADAPTÉS à cette niche précise — n'utilise la liste fallback fournie que comme inspiration, ne la recopie pas systématiquement. NE mets PAS de marketplaces/généralistes (Amazon, Cdiscount, Leroy Merlin, Maisons du Monde, La Redoute, ManoMano, Zalando, Sephora, Fnac…) en concurrents principaux : uniquement dans une section secondaire « acteurs généralistes à surveiller ». Il n'y a PAS de recherche web ni de crawl : annonce clairement « analyse indicative basée sur la niche, les produits et le positionnement détectés ; ajoutez les URLs de vos concurrents pour une analyse plus précise ». N'invente AUCUN chiffre (trafic, CA, conversion, parts de marché) ni fait précis non vérifié — emploie « probable », « à analyser », « à vérifier avec une URL ». Donne un niveau de confiance par concurrent.",
  free: "détecte l'intention de la question et réponds comme l'expert correspondant (SEO, Merchant, Code, Email, Devis, Stratégie ou Concurrence).",
};

function modeStructure(mode: CouncilMode): string {
  const seo =
    "Réponds comme un CONSULTANT SEO Shopify SENIOR (niveau agence), pas une checklist. Vocabulaire pro mais clair (intention de recherche, requête transactionnelle, longue traîne, cocon sémantique, maillage interne, ancres descriptives, H1 unique, rich snippets, Google Merchant Center).\n" +
    "Structure imposée (respecte cet ORDRE et ces TITRES) :\n" +
    "## Diagnostic SEO exécutif (3–5 lignes : niche, enjeux réels, où se joue la croissance — basé sur les données du scan)\n" +
    "## Ce qui est déjà bon — à NE PAS retoucher (liste ce que le scan dit correct : titres faibles=0, tags élevés, meta présentes, pages légales OK, scores corrects — dis explicitement de ne pas les refaire)\n" +
    "## Ce qui bloque vraiment (3–5 vrais freins SEO prioritaires, chiffrés)\n" +
    "## Audit page d'accueil (title, meta, H1 UNIQUE, structure H2/H3, textes visibles, maillage vers les collections, promesse de marque, libellés anglais à traduire — avec le chemin Shopify)\n" +
    "## Audit collections — pour CHAQUE collection RÉELLE : intention de recherche, mot-clé principal + secondaires + longue traîne, title (≤60, naturel), meta (≤155, naturelle), description de collection 150–250 mots À METTRE dans la description, H1 unique + H2/H3, FAQ 4–6, maillage, chemin Shopify (Produits → Collections → Description ; meta via Aperçu du référencement naturel)\n" +
    "## Audit produits — pour CHAQUE produit prioritaire : problème réel, product_type, tags, mot-clé cible, correction de la description, meta, alt text, FAQ produit, maillage vers la collection parente, données Google Merchant (titre/type/description). N'optimise PAS ce que le scan dit déjà correct.\n" +
    "## Mots-clés par intention : courte traîne, transactionnels, longue traîne, informationnels, comparatifs, FAQ — PLUS une liste de mots-clés PAR COLLECTION et PAR PRODUIT prioritaire. Mots-clés NICHÉS (spécifiques à la niche), pas génériques.\n" +
    "## Titles/meta prêts à copier (naturels, descriptifs, adaptés SEO/GMC)\n" +
    "## Contenus à ajouter et où les ajouter dans Shopify (pour chaque contenu : quoi, où exactement dans Shopify, pourquoi)\n" +
    "## Maillage interne recommandé (tableau Source → Cible → Ancre descriptive → Impact)\n" +
    "## Calendrier éditorial 4 semaines (1 article/semaine : titre, mot-clé cible, intention, page à mailler, objectif SEO, CTA recommandé)\n" +
    "## Routine SEO hebdomadaire (enrichir 1 collection, optimiser 2 fiches produits, publier 1 article, ajouter 5–10 liens internes, corriger les alt text prioritaires, relancer un scan Orkestra, suivre Search Console, ajuster selon impressions/CTR. NE dis PAS « ajouter X produits par jour » : dis « ajouter de nouveaux produits seulement s'ils répondent à une vraie intention de recherche ou à une demande catalogue »)\n" +
    "## Plan 7 jours (chaque jour : action + CHEMIN SHOPIFY exact)\n" +
    "## Roadmap 30 jours (S1 technique visible, S2 pages business, S3 cocon de contenu, S4 consolidation + relance scan + Search Console)\n" +
    "## Actions Orkestra recommandées (modules RÉELS uniquement : Import Factory, Merchant Shield, AI Council, Code Shopify, Mémoire boutique)\n" +
    "CHEMINS SHOPIFY EXACTS à utiliser : Meta = Produit/Collection/Page → Aperçu du référencement naturel → Modifier ; Description collection = Produits → Collections → Collection → Description ; Alt text = Produit → Médias → Modifier le texte alternatif ; Product type = Produit → Organisation du produit → Type de produit ; Tags = Produit → Organisation du produit → Tags ; H1 multiples = Boutique en ligne → Thèmes → Personnaliser → Page concernée ; Textes anglais = Paramètres → Langues → Modifier le contenu du thème.\n" +
    "INTERDIT dans les titles/meta/contenus (sauf si une donnée le justifie) : « premium », « professionnel », « haut de gamme », « meilleur », « qualité premium », « Achetez maintenant », « Livraison rapide », « Commandez dès aujourd'hui ». Les titles doivent être NATURELS et descriptifs (ex. « Produit + attribut concret + usage | Marque », « Catégorie + matériau + pièce »). Le contenu de collection va dans la description de collection Shopify ou une section SEO du thème. Si tu recommandes un blog, fournis le calendrier éditorial complet (titre + mot-clé + intention + page à mailler + objectif SEO + CTA).";
  const map: Record<CouncilMode, string> = {
    seo,
    merchant:
      "Structure imposée :\n## Résumé conformité apparent (+ score Merchant apparent)\n## ✅ Éléments rassurants déjà présents (pages détectées)\n## 🔴 Risques critiques\n## 🟠 Risques importants\n## 🟡 Risques mineurs\n## ✅ Checklist avant soumission Merchant Center\n## Plan de correction priorisé\n## 🚀 Modules Orkestra\nRappelle le disclaimer (aucune garantie d'approbation).",
    code:
      "Tu génères des SECTIONS Shopify (Online Store 2.0) dans une discussion naturelle. Structure imposée :\n## 1. Résumé (type de section, objectif, page recommandée, pourquoi ça aide conversion/UX/SEO)\n## 2. Code complet — blocs markdown : ```liquid (HTML sémantique + Liquid valide + {% schema %} JSON VALIDE), ```css (responsive, classes TOUTES préfixées .ork-, mobile repensé), ```js UNIQUEMENT si nécessaire (IIFE encapsulé)\n## 3. Installation (où créer le fichier, comment l'ajouter au thème, comment personnaliser, points à vérifier avant publication)\n## 4. Checklist qualité (responsive, accessibilité, schema valide, classes namespacées, aucune dépendance externe, compatible OS 2.0, mobile vérifié)\n## 5. Pour aller plus loin (suggère : plus premium, mobile, plus de settings, sans JS, corriger, adapter niche/produit/home)\nRègles : aucune dépendance/librairie externe ; n'invente pas de données produit (placeholders modifiables) ; rendu propre si settings vides ; adapte le contenu/FAQ à la niche (ex. luminaires : hauteur, ampoule, pièce). Si l'utilisateur demande une MODIFICATION d'une section précédente (historique), reprends le code existant et modifie-le sans tout régénérer.",
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
  const claudeKey = await resolveClaudeKey(refs);
  if (!key && !claudeKey) {
    return { result: scaffold, meta: { live: false, generatedAt: nowIso(), fallbackReason: "Aucune clé IA connectée" } };
  }

  const system =
    "Tu es Orkestra, copilote e-commerce multi-IA spécialisé Shopify. Tu réponds en français, en markdown structuré (## / ###, listes, gras), de façon dense, précise et directement actionnable.\n" +
    "RÈGLE ABSOLUE : pas de réponse générique. Chaque recommandation DOIT s'appuyer sur une donnée réelle fournie (chiffre, nom de collection, produit prioritaire, page légale, score) — sinon écris explicitement « donnée non disponible via scan public » et propose une action prudente (ou indique qu'une connexion API Shopify sera nécessaire). N'INVENTE jamais de collections/produits/pages/faits non fournis.\n" +
    "Interdits : « ajoutez du maillage interne », « optimisez vos fiches », « créez du contenu » SANS préciser OÙ, COMBIEN, POURQUOI, un EXEMPLE concret, le MODULE Orkestra et l'IMPACT.\n" +
    "Distingue toujours DIAGNOSTIC / CORRECTION / ACTION. Adapte le vocabulaire à la niche (ex. luminaires : pièce, hauteur d'installation, type d'ampoule, matériau, ambiance).\n" +
    "RÈGLE DE SUIVI : si la dernière question est une question de suivi, réponds UNIQUEMENT à cette question — ne refais PAS l'audit complet, ne recycle pas un template. Utilise les problèmes structurés du scan pour répondre précisément : QUOI, OÙ (source/page), IMPACT, CORRECTION, CHEMIN SHOPIFY probable et MODULE Orkestra.\n" +
    "RÈGLE 'NE PAS TOUCHER CE QUI EST BON' : ne recommande jamais de modifier un élément que le scan indique comme correct (ex. titres faibles = 0, tags = 100%, pages légales présentes) — signale-le comme point fort et concentre-toi sur les vrais problèmes.\n" +
    "RÈGLE D'ADAPTATION : la réponse doit coller au MODE sélectionné et à la DERNIÈRE intention utilisateur. Question ciblée → réponse ciblée.\n" +
    "RÈGLE TITRES/META : n'emploie JAMAIS automatiquement « premium », « professionnel », « haut de gamme », « meilleur » ou « qualité premium » dans les titles/meta/contenus — ces mots ne sont autorisés que si une donnée réelle les justifie. Préfère des titres NATURELS, descriptifs et précis (mot-clé + attribut concret + marque), adaptés au SEO et à Google Merchant Center. Bannis « Achetez maintenant », « Livraison rapide », « Commandez dès aujourd'hui » sauf justification.\n" +
    "RÈGLE DEMANDE INCONNUE : si tu n'as pas assez d'informations (donnée non couverte par le scan public, réglage dépendant du thème ou d'une app), ne réponds PAS de façon générique. Raisonne avec le contexte boutique, propose le(s) chemin(s) Shopify probable(s), dis clairement ce qui manque et ce qu'il faudrait connecter (API Shopify, URL, précision) pour être certain, puis termine par une prochaine action claire. N'invente jamais et ne prétends PAS avoir cherché sur internet : aucune recherche web n'est branchée. Formulation possible : « Je n'ai pas assez d'informations pour confirmer ce point avec le scan public. Voici ce que je peux vérifier maintenant, et ce qu'il faudrait connecter pour être certain. »\n" +
    `RÔLE POUR CE MODE — ${MODE_ROLE[mode]}`;

  // Logique de suivi COMMUNE à toutes les IA : si la question dépend du message
  // précédent, on répond précisément au point demandé sans refaire l'audit.
  const targeted = isTargetedQuestion(question, ctx);
  const directive = targeted
    ? `\n\n⚠️ DEMANDE CIBLÉE (intention détectée : ${classifyIntent(question)}). La DERNIÈRE question utilisateur est PRIORITAIRE : réponds UNIQUEMENT et PRÉCISÉMENT à CETTE question. NE refais PAS d'audit complet, PAS de plan 30 jours, PAS de sections inutiles, ne recycle pas un rapport. Si la question contient « Contexte : … Réponds uniquement … », respecte-le à la lettre.\n` +
      `Appuie-toi sur les données réelles du scan pour « Ce qui est concerné » (textes anglais exacts, produits prioritaires, pages légales manquantes, meta/alt manquants…). Si une donnée n'est pas disponible, écris « donnée non disponible via scan public » — n'invente RIEN et ne prétends pas avoir cherché sur internet.\n` +
      `Format OBLIGATOIRE, court, EXACTEMENT dans cet ordre (omets une section seulement si elle n'a aucun sens pour la question) :\n` +
      `### Réponse directe\n(1 à 3 phrases qui répondent exactement à la demande)\n` +
      `### Ce qui est concerné\n(éléments réels détectés par le scan, sinon « donnée non disponible via scan public »)\n` +
      `### Pourquoi c'est important\n(impact SEO / Merchant / conversion selon le sujet, 1 à 3 puces)\n` +
      `### Comment corriger\n(étapes concrètes et courtes)\n` +
      `### Où corriger dans Shopify\n(chemin Shopify exact)\n` +
      `### Action suivante\n(UNE seule action claire ou un module Orkestra : Import Factory, Merchant Shield, Assistant Shopify)\n` +
      `N'ajoute AUCUNE autre section. Reste dans le périmètre du mode « ${MODE_LABEL[mode]} ».`
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

  // Mode Code Shopify : Claude recommandé (sections longues), OpenAI en repli live.
  const codeRouting = mode === "code" ? routeSection({ type: question, complexity: "avancé", action: null, connected: providers }) : null;
  const codeMeta = codeRouting ? { recommendedProvider: PROVIDER_NAME[codeRouting.recommendedProvider], routingNote: codeRouting.note } : {};
  const maxTok = mode === "seo" ? 4096 : mode === "code" ? 3600 : 2400;

  const claudeReady = !!claudeKey && providers.includes("anthropic");
  const wantFusion = !!key && claudeReady && FUSION_MODES.has(mode);

  // Réponse individuelle → CouncilProviderAnswer.
  const openaiPA = (answer: string, model: string): CouncilProviderAnswer => ({ provider: "openai", model, specialty: "Génération structurée & données", answer, qualityScore: 90, strengths: ["Structure claire", "Appui sur les données du scan", "Format actionnable"], limits: ["Style parfois mécanique"] });
  const claudePA = (answer: string, model: string): CouncilProviderAnswer => ({ provider: "anthropic", model, specialty: "Relecture premium & formulation", answer, qualityScore: 92, strengths: ["Formulation naturelle", "Relecture éditoriale", "Cohérence du ton"], limits: ["Moins orienté JSON/structure brute"] });

  // ── Fusion OpenAI + Claude (modes complexes, les deux connectés) ──
  if (wantFusion) {
    const [oa, ca] = await Promise.all([
      chatComplete({ apiKey: key!.apiKey, model: key!.model, system, prompt, temperature: 0.4, maxTokens: maxTok }),
      claudeComplete({ apiKey: claudeKey!.apiKey, model: claudeKey!.model, system, prompt, temperature: 0.5, maxTokens: maxTok }),
    ]);
    // Les deux échouent → fallback mock.
    if (!oa.ok && !ca.ok) return { result: scaffold, meta: { live: false, generatedAt: nowIso(), fallbackReason: oa.message, ...codeMeta } };
    // Exactement une a réussi → on garde celle-ci (§8, dégradation gracieuse).
    if (!oa.ok || !ca.ok) {
      const isOpenai = oa.ok;
      const good = (oa.ok ? oa : ca) as ChatOk;
      const pa = isOpenai ? openaiPA(good.text, good.model) : claudePA(good.text, good.model);
      const result: CouncilResult = { ...scaffold, finalAnswer: good.text, providerAnswers: [pa], modelsUsed: [isOpenai ? "openai" : "anthropic"], synthesisReasons: [isOpenai ? "Claude indisponible — réponse OpenAI conservée." : "OpenAI indisponible — réponse Claude conservée."] };
      return { result, meta: { live: true, provider: isOpenai ? "openai" : "anthropic", model: good.model, tokens: good.tokens, generatedAt: nowIso(), fallbackReason: isOpenai ? "Claude indisponible, réponse OpenAI conservée" : undefined, ...codeMeta } };
    }
    // Les deux OK → synthèse Orkestra (arbitre = OpenAI, structuré, sortie JSON).
    const synth = await chatComplete({ apiKey: key!.apiKey, model: key!.model, system: FUSION_SYSTEM, prompt: fusionPrompt(question, oa.text, ca.text, targeted), temperature: 0.3, maxTokens: maxTok, json: true });
    let finalAnswer = oa.text;
    let councilWhy: CouncilResult["councilWhy"];
    if (synth.ok) {
      try {
        const p = JSON.parse(synth.text) as { final?: unknown; why?: Record<string, unknown> };
        const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
        if (s(p.final)) finalAnswer = s(p.final);
        if (p.why) councilWhy = { openai: s(p.why.openai), claude: s(p.why.claude), kept: s(p.why.kept), rejected: s(p.why.rejected), contradiction: s(p.why.contradiction) || undefined };
      } catch { finalAnswer = oa.text; }
    }
    const result: CouncilResult = {
      ...scaffold,
      finalAnswer,
      providerAnswers: [openaiPA(oa.text, oa.model), claudePA(ca.text, ca.model)],
      modelsUsed: ["openai", "anthropic"],
      councilWhy,
      synthesisReasons: [
        "OpenAI : structure, données du scan et format actionnable.",
        "Claude : formulation naturelle et relecture éditoriale.",
        "Orkestra : doublons retirés, contradictions arbitrées, recommandation finale priorisée.",
      ],
    };
    const tokens = (oa.tokens || 0) + (ca.tokens || 0) + (synth.ok ? synth.tokens || 0 : 0);
    return { result, meta: { live: true, fusion: true, provider: "openai+anthropic", models: `${oa.model} + ${ca.model}`, model: oa.model, tokens, generatedAt: nowIso(), ...codeMeta } };
  }

  // ── Claude seul (pas de clé OpenAI) ──
  if (!key && claudeKey) {
    const ca = await claudeComplete({ apiKey: claudeKey.apiKey, model: claudeKey.model, system, prompt, temperature: 0.5, maxTokens: maxTok });
    if (!ca.ok) return { result: scaffold, meta: { live: false, generatedAt: nowIso(), fallbackReason: ca.message, ...codeMeta } };
    const result: CouncilResult = { ...scaffold, finalAnswer: ca.text, providerAnswers: [claudePA(ca.text, ca.model)], modelsUsed: ["anthropic"] };
    return { result, meta: { live: true, provider: "anthropic", model: ca.model, tokens: ca.tokens, generatedAt: nowIso(), ...codeMeta } };
  }

  // ── OpenAI seul (comportement historique) ──
  const r = await chatComplete({ apiKey: key!.apiKey, model: key!.model, system, prompt, temperature: 0.4, maxTokens: maxTok });
  if (!r.ok) {
    return { result: scaffold, meta: { live: false, generatedAt: nowIso(), fallbackReason: r.message, ...codeMeta } };
  }
  const result: CouncilResult = { ...scaffold, finalAnswer: r.text };
  result.providerAnswers = scaffold.providerAnswers.map((p) =>
    p.provider === "openai" ? { ...p, answer: r.text } : p
  );
  if (!result.providerAnswers.some((p) => p.provider === "openai")) {
    result.providerAnswers = [openaiPA(r.text, r.model), ...result.providerAnswers];
  }
  result.modelsUsed = [...new Set(["openai" as AIProviderId, ...result.modelsUsed])];
  return { result, meta: { live: true, provider: "openai", model: r.model, tokens: r.tokens, generatedAt: nowIso(), ...codeMeta } };
}

// ── Import Factory live ─────────────────────────────────────────────────────────

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
    "Réponds UNIQUEMENT par un objet JSON valide avec EXACTEMENT ces clés : optimizedTitle (string), h1 (string), shortDescription (string), longDescriptionHtml (string, HTML Shopify propre), benefits (string[]), features (string[]), faq (array de {q,a}), metaTitle (string ≤60), metaDescription (string ≤155), imageAltTexts (string[]), handle (string, slug), primaryKeywords (string[]), longTailKeywords (string[]), internalLinks (string[]), tags (string[], tags Shopify), productType (string, type de produit), parentCollection (string, collection parente pour le maillage), merchantNote (string, recommandation Google Merchant : titre/type/description du flux), seoScore (number 0-100), conversionScore (number 0-100), recommendations (string[]). " +
    "Titres et meta NATURELS et descriptifs (mot-clé + attribut concret + marque), adaptés SEO + Google Merchant Center. N'emploie PAS automatiquement « premium », « professionnel », « meilleur », « haut de gamme », « qualité premium », ni « Achetez maintenant / Livraison rapide ».";
  const levelGuide =
    input.level === "ultra"
      ? "Niveau ULTRA : longDescriptionHtml de 400 à 700 mots, structure H2/H3, paragraphes propres, listes à puces, conseils d'usage, réassurance et FAQ — ton naturel, aucun blabla générique."
      : input.level === "poussé"
      ? "Niveau POUSSÉ : description complète et structurée (200–350 mots) avec bénéfices, caractéristiques, conseils d'usage et FAQ."
      : "Niveau STANDARD : description courte et exploitable (120–180 mots), claire et naturelle (sortie rapide à relire avant publication).";
  const prompt =
    `=== Boutique ===\n${contextBlock(ctx)}\n\n=== Produit ===\n` +
    `Nom : ${input.productName}\nCollection : ${input.collection || ""}\nCaractéristiques : ${input.features || ""}\n` +
    `Bénéfices : ${input.benefits || ""}\nMatériaux/dimensions : ${input.materials || ""}\nPrix : ${input.price || ""}\n` +
    `Public cible : ${input.audience || ""}\nMots-clés souhaités : ${input.keywords || ""}\nNiveau : ${input.level}\n` +
    `${levelGuide}\n` +
    `Reste FACTUEL : matériaux, dimensions, usage, entretien, compatibilité, contexte d'utilisation. Pas de claim non prouvé (« meilleur », « professionnel », « qualité supérieure »), pas de « Achetez maintenant ».\n\n` +
    `Génère la fiche produit complète, prête à coller dans Shopify.`;

  const r = await chatComplete({ apiKey: key.apiKey, model: key.model, system, prompt, temperature: 0.6, maxTokens: input.level === "ultra" ? 3200 : 2200, json: true });
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
    tags: arr(p?.tags, mock.tags ?? []),
    productType: p?.productType ?? mock.productType,
    parentCollection: p?.parentCollection ?? mock.parentCollection,
    merchantNote: p?.merchantNote ?? mock.merchantNote,
  };
}

// ── Section Builder live ────────────────────────────────────────────────────

/**
 * Modèle recommandé pour le Section Builder.
 * Aujourd'hui : OpenAI (seul live). Demain : Claude pour les sections longues/
 * complexes, OpenAI pour corriger/optimiser, OpenRouter pour router.
 */
export const recommendedProviderForSectionBuilder = {
  current: "openai" as AIProviderId,
  futureComplex: "anthropic" as AIProviderId, // Claude (sections longues/complexes)
  futureReview: "openai" as AIProviderId, // correction / optimisation / responsive
};

export interface SectionImprove {
  /** Directive d'amélioration : premium | mobile | nojs | fix | settings | simplify | niche | product | home */
  directive?: string;
  /** Code existant à modifier (au lieu de régénérer). */
  existing?: { liquid: string; css: string; js: string; schema: string };
}

const IMPROVE_LABEL: Record<string, string> = {
  premium: "rends la section plus premium (hiérarchie, espacements, ombres subtiles, micro-interactions) sans la complexifier inutilement",
  mobile: "optimise fortement le rendu mobile (layout repensé, tailles tactiles, pas de débordement)",
  nojs: "supprime tout le JavaScript et propose une version 100% CSS/Liquid (utilise <details>/<summary> ou équivalent si besoin)",
  fix: "corrige le code (Liquid valide, schema JSON valide, classes préfixées, pas de dépendance externe)",
  settings: "ajoute davantage de settings utiles dans le {% schema %} (textes, couleurs, alignement, spacing, activation animations, nombre d'items, CTA, liens)",
  simplify: "simplifie le code tout en gardant le rendu premium et responsive",
  niche: "adapte le contenu et le vocabulaire à la niche de la boutique",
  product: "adapte la section pour une PAGE PRODUIT (placement, contenu, settings)",
  home: "adapte la section pour la PAGE D'ACCUEIL (placement, contenu, settings)",
};

export async function runSection(
  input: SectionInput,
  ctx: CouncilContext,
  refs?: KeyRefs,
  opts?: SectionImprove,
  connected: AIProviderId[] = []
): Promise<{ result: SectionResult; meta: GenMeta }> {
  const mock = generateSection({
    ...input,
    niche: input.niche ?? ctx.niche,
    brandName: input.brandName ?? ctx.brandName,
    collection: input.collection ?? ctx.collections?.[0],
  });

  // Routing IA/code : choisit le meilleur moteur dispo selon type/complexité/action.
  const routing = routeSection({
    type: input.type,
    complexity: input.complexity,
    action: opts?.directive ?? null,
    connected: connected.length ? connected : refs?.openai ? ["openai"] : [],
  });
  const recProvider = PROVIDER_NAME[routing.recommendedProvider];

  if (!liveEnabled())
    return { result: mock, meta: { live: false, generatedAt: nowIso(), fallbackReason: "Mode démo (ORKESTRA_MOCK_MODE)", recommendedProvider: recProvider, routingNote: routing.note } };
  // Seul OpenAI est live-capable aujourd'hui : si le routeur ne désigne pas un
  // moteur live, on retombe proprement sur le mock enrichi.
  const key = routing.usedProvider === "openai" ? await resolveOpenAIKey(refs) : null;
  if (!key)
    return { result: mock, meta: { live: false, generatedAt: nowIso(), fallbackReason: "Aucun moteur live disponible pour cette section", recommendedProvider: recProvider, routingNote: routing.note } };

  // Prompt orienté selon le tier (long/robuste pour complexe/ultra ; review pour correction).
  const depth =
    routing.tier === "simple"
      ? "Section concise mais soignée."
      : "Section LONGUE et ROBUSTE : Liquid complet, schema détaillé (settings + blocks + presets), CSS robuste et responsive, accessibilité poussée. Ne prends aucun raccourci.";
  const reviewLine = REVIEW_ORIENTED.includes(routing.mode)
    ? "\nMODE RELECTURE/CORRECTION : agis comme un développeur qui relit le code — détecte et corrige les erreurs Liquid/schema, namespace les classes, optimise le mobile/l'accessibilité, supprime le JS inutile, et produis une version finale prête à coller."
    : "";
  const system =
    "Tu es un expert thèmes Shopify (Liquid, Online Store 2.0) et UI/UX premium (qualité Apple/Linear/Framer). Tu génères des SECTIONS Shopify autonomes, propres, modernes et responsive.\n" +
    depth + reviewLine + "\n" +
    "Réponds UNIQUEMENT par un objet JSON valide avec EXACTEMENT ces clés : summary (string markdown), liquid (string), css (string), js (string, vide si inutile), schema (string contenant le bloc {% schema %} ... {% endschema %} avec un JSON VALIDE), installSteps (string[]), responsiveChecklist (array de {label, ok:boolean}).\n" +
    "RÈGLES STRICTES : compatible Online Store 2.0 ; section autonome ; HTML sémantique ; Liquid valide ; AUCUNE dépendance/librairie externe ; classes CSS TOUTES préfixées par `.ork-<nom>` (jamais .container/.button/.title nus) ; responsive solide (mobile repensé, clamp(), media queries) ; éviter le JS si CSS/Liquid suffit, sinon JS encapsulé en IIFE sans variable globale ; schema JSON VALIDE (settings + blocks si pertinent) ; rendu propre même si les settings sont vides (utilise `default`) ; n'invente PAS de données produit — utilise des placeholders modifiables ; accessibilité (contraste, focus, aria).";

  let task: string;
  if (opts?.existing) {
    task =
      `Améliore la section EXISTANTE suivante : ${IMPROVE_LABEL[opts.directive || "premium"] || opts.directive}. ` +
      `Modifie le code fourni sans tout régénérer inutilement, garde la cohérence.\n\n` +
      `LIQUID:\n${opts.existing.liquid}\n\nCSS:\n${opts.existing.css}\n\nJS:\n${opts.existing.js}\n\nSCHEMA:\n${opts.existing.schema}`;
  } else {
    task =
      `Crée une section « ${input.type} ».\n` +
      `Objectif : ${input.goal || "(non précisé)"}\nPage cible : ${input.page || "(non précisé)"}\nStyle : ${input.style || "premium"}\nTon : ${input.tone || "élégant"}\n` +
      `Couleur d'accent : ${input.colors || "#6d5ef2"}\nAnimation : ${input.animation || (input.animations ? "fade-in" : "aucune")}\nComplexité : ${input.complexity || "avancé"}\n` +
      `Mobile priority : ${input.mobilePriority ? "oui" : "non"}\nSettings customizer : ${input.needsSettings === false ? "minimal" : "oui"}\nJS : ${input.allowJs === false ? "interdit" : "autorisé si utile"}\nVersion sans JS : ${input.noJsVersion ? "oui" : "si possible"}\n` +
      `Contenu à intégrer : ${input.content || "(générer un contenu placeholder crédible et modifiable)"}`;
  }

  const prompt =
    `=== Contexte boutique ===\n${contextBlock(ctx) || "(peu de données — utilise des placeholders)"}\n\n=== Tâche ===\n${task}`;

  const r = await chatComplete({ apiKey: key.apiKey, model: key.model, system, prompt, temperature: 0.3, maxTokens: routing.tier === "simple" ? 2600 : 3800, json: true });
  if (!r.ok) return { result: mock, meta: { live: false, generatedAt: nowIso(), fallbackReason: r.message, recommendedProvider: recProvider, routingNote: routing.note } };

  try {
    const p = JSON.parse(r.text);
    const result = coerceSection(p, mock, input.complexity);
    return {
      result,
      meta: {
        live: true,
        provider: "openai",
        model: r.model,
        tokens: r.tokens,
        generatedAt: nowIso(),
        recommendedProvider: recProvider,
        routingNote: routing.note,
        reviewer: routing.reviewerProvider ? PROVIDER_NAME[routing.reviewerProvider] : undefined,
      },
    };
  } catch {
    return { result: mock, meta: { live: false, generatedAt: nowIso(), fallbackReason: "Réponse OpenAI non parsable — fallback mock", recommendedProvider: recProvider, routingNote: routing.note } };
  }
}

/** Coerce + vérification qualité du résultat de section. */
function coerceSection(p: any, mock: SectionResult, complexity?: string): SectionResult {
  const str = (v: any, fb: string) => (typeof v === "string" && v.trim() ? v : fb);
  const liquid = str(p?.liquid, mock.liquid);
  const css = str(p?.css, mock.css);
  const js = typeof p?.js === "string" ? p.js : mock.js;
  const schema = str(p?.schema, mock.schema);

  const warnings: string[] = [];
  if (!liquid) warnings.push("Liquid manquant.");
  if (!css) warnings.push("CSS manquant.");
  if (!/\{%\s*schema\s*%\}/.test(schema)) warnings.push("Bloc {% schema %} manquant ou invalide.");
  if (!/\.ork-/.test(css)) warnings.push("Classes CSS non préfixées (.ork-) — risque de conflit avec le thème.");
  try {
    JSON.parse(schema.replace(/{%\s*schema\s*%}/, "").replace(/{%\s*endschema\s*%}/, "").trim());
  } catch {
    warnings.push("Le schema JSON pourrait être invalide — vérifiez avant publication.");
  }

  return {
    summary: str(p?.summary, mock.summary || ""),
    liquid,
    css,
    js: js || "// Aucun JavaScript nécessaire pour cette section.",
    schema,
    installSteps: Array.isArray(p?.installSteps) && p.installSteps.length ? p.installSteps.map(String) : mock.installSteps,
    responsiveChecklist:
      Array.isArray(p?.responsiveChecklist) && p.responsiveChecklist.length
        ? p.responsiveChecklist.map((x: any) => ({ label: String(x?.label ?? x), ok: x?.ok !== false }))
        : mock.responsiveChecklist,
    warnings,
    complexity: complexity || mock.complexity,
  };
}

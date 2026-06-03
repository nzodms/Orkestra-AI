import type {
  ProductSeoResult,
  SectionResult,
  MerchantAudit,
  CouncilResult,
  CouncilMode,
  AIProviderId,
  SeoLevel,
} from "../types";

// ──────────────────────────────────────────────────────────────────────────
// Moteur de génération de contenu.
//
// En V1 (mock mode), ce moteur produit des sorties structurées réalistes à
// partir des entrées utilisateur + de la mémoire boutique. Quand les vrais
// providers seront branchés, ces fonctions composeront un prompt et
// parseront la réponse IA — la forme des résultats reste identique.
// ──────────────────────────────────────────────────────────────────────────

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface ProductSeoInput {
  productName: string;
  url?: string;
  collection?: string;
  features?: string;
  benefits?: string;
  materials?: string;
  price?: string;
  audience?: string;
  keywords?: string;
  ton?: string;
  level: SeoLevel;
}

export function generateProductSeo(input: ProductSeoInput): ProductSeoResult {
  const name = input.productName || "Produit";
  const kw = (input.keywords || name)
    .split(/[,\n]/)
    .map((k) => k.trim())
    .filter(Boolean);
  const primary = kw.slice(0, 3);
  const depth = input.level === "ultra" ? 3 : input.level === "poussé" ? 2 : 1;

  const features = (input.features || "")
    .split(/[,\n]/)
    .map((f) => f.trim())
    .filter(Boolean);
  const benefits = (input.benefits || "")
    .split(/[,\n]/)
    .map((b) => b.trim())
    .filter(Boolean);

  const baseScore = 62 + depth * 9;

  return {
    optimizedTitle: `${name} — ${primary[0] || "qualité premium"} | Livraison rapide`,
    h1: `${name} : ${input.audience ? `pensé pour ${input.audience}` : "le choix premium"}`,
    shortDescription: `Découvrez ${name}, ${
      benefits[0]?.toLowerCase() || "conçu pour durer"
    }. ${input.materials ? input.materials + ". " : ""}Idéal ${
      input.audience ? `pour ${input.audience}` : "au quotidien"
    }.`,
    longDescriptionHtml: buildLongDescription(name, benefits, features, input),
    benefits: benefits.length
      ? benefits
      : ["Qualité durable", "Confort optimal", "Design soigné"],
    features: features.length
      ? features
      : ["Matériaux sélectionnés", "Finitions premium", "Garantie incluse"],
    faq: [
      {
        q: `Quelles sont les caractéristiques de ${name} ?`,
        a: `${name} ${
          input.materials ? "est fabriqué avec " + input.materials + " et " : ""
        }offre ${benefits[0]?.toLowerCase() || "une qualité durable"}.`,
      },
      {
        q: "Quels sont les délais de livraison ?",
        a: "La livraison est rapide et suivie. Vous recevez un numéro de suivi dès l'expédition.",
      },
      {
        q: "Puis-je retourner le produit ?",
        a: "Oui, vous bénéficiez d'une politique de retour claire sous 14 jours.",
      },
    ].slice(0, depth + 1),
    metaTitle: `${name} | ${primary[0] || "Boutique"} de qualité`.slice(0, 60),
    metaDescription: `${name} : ${
      benefits[0]?.toLowerCase() || "qualité premium"
    }. Livraison rapide, paiement sécurisé. Commandez dès maintenant.`.slice(0, 155),
    imageAltTexts: [
      `${name} vue de face`,
      `${name} en situation ${input.audience ? "pour " + input.audience : "d'usage"}`,
      `Détail des finitions de ${name}`,
    ],
    handle: slugify(name),
    primaryKeywords: primary.length ? primary : [slugify(name)],
    longTailKeywords: [
      `acheter ${name.toLowerCase()}`,
      `${name.toLowerCase()} pas cher`,
      `meilleur ${name.toLowerCase()} ${new Date().getFullYear()}`,
      `${name.toLowerCase()} ${input.audience || "avis"}`,
    ],
    internalLinks: [
      input.collection ? `Collection « ${input.collection} »` : "Collection associée",
      "Guide d'achat de la catégorie",
      "FAQ livraison & retours",
    ],
    seoScore: Math.min(98, baseScore + (kw.length ? 6 : 0)),
    conversionScore: Math.min(96, baseScore - 4 + benefits.length * 2),
    recommendations: [
      "Ajoutez 3 à 5 images haute qualité avec alt text optimisé.",
      "Intégrez des avis clients pour renforcer la preuve sociale.",
      input.price ? "Affichez clairement le rapport qualité/prix." : "Indiquez le prix et les options de paiement.",
      depth < 3 ? "Passez en niveau « ultra » pour enrichir le maillage interne." : "Ajoutez une vidéo produit pour booster la conversion.",
    ],
  };
}

function buildLongDescription(
  name: string,
  benefits: string[],
  features: string[],
  input: ProductSeoInput
): string {
  const b = benefits.length ? benefits : ["Qualité durable", "Confort optimal", "Design soigné"];
  const f = features.length ? features : ["Matériaux premium", "Finitions soignées"];
  return `<div class="product-description">
  <h2>Pourquoi choisir ${name} ?</h2>
  <p>${name} a été pensé ${input.audience ? `pour ${input.audience}` : "pour celles et ceux qui exigent le meilleur"}. ${
    input.materials ? `Fabriqué avec ${input.materials}, il ` : "Il "
  }allie qualité et longévité.</p>
  <h3>Les bénéfices</h3>
  <ul>
${b.map((x) => `    <li><strong>${x}</strong></li>`).join("\n")}
  </ul>
  <h3>Caractéristiques</h3>
  <ul>
${f.map((x) => `    <li>${x}</li>`).join("\n")}
  </ul>
  <p>Commandez ${name} dès aujourd'hui et profitez d'une livraison rapide et d'un paiement 100% sécurisé.</p>
</div>`;
}

// ── Section Builder ───────────────────────────────────────────────────────

export interface SectionInput {
  type: string;
  goal?: string;
  style?: string;
  colors?: string;
  content?: string;
  animations?: boolean;
  complexity?: "simple" | "standard" | "avancé";
}

export function generateSection(input: SectionInput): SectionResult {
  const type = input.type || "Hero premium";
  const accent = input.colors || "#6d5ef2";
  const id = slugify(type) || "orkestra-section";

  const liquid = `{% comment %}
  Section générée par Orkestra AI — ${type}
  Compatible Shopify Online Store 2.0
{% endcomment %}
<section class="ork-${id}" style="--accent: {{ section.settings.accent_color }};">
  <div class="ork-${id}__inner">
    {% if section.settings.heading != blank %}
      <h2 class="ork-${id}__title">{{ section.settings.heading }}</h2>
    {% endif %}
    {% if section.settings.subheading != blank %}
      <p class="ork-${id}__subtitle">{{ section.settings.subheading }}</p>
    {% endif %}
    {% if section.settings.button_label != blank %}
      <a href="{{ section.settings.button_link }}" class="ork-${id}__cta">
        {{ section.settings.button_label }}
      </a>
    {% endif %}
  </div>
</section>`;

  const css = `.ork-${id} {
  padding: clamp(48px, 8vw, 96px) 20px;
  background: var(--accent, ${accent});
  color: #fff;
}
.ork-${id}__inner {
  max-width: 1080px;
  margin: 0 auto;
  text-align: center;
  ${input.animations ? "animation: ork-fade .6s ease-out both;" : ""}
}
.ork-${id}__title { font-size: clamp(28px, 5vw, 48px); font-weight: 700; line-height: 1.1; }
.ork-${id}__subtitle { font-size: clamp(16px, 2.5vw, 20px); opacity: .85; margin-top: 12px; }
.ork-${id}__cta {
  display: inline-block; margin-top: 28px; padding: 14px 28px;
  background: #fff; color: var(--accent, ${accent}); border-radius: 999px;
  font-weight: 600; text-decoration: none; transition: transform .2s ease;
}
.ork-${id}__cta:hover { transform: translateY(-2px); }
${input.animations ? "@keyframes ork-fade { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: none } }" : ""}
@media (max-width: 600px) { .ork-${id} { padding: 40px 16px; } }`;

  const js = input.animations
    ? `// Animation au scroll (IntersectionObserver)
document.querySelectorAll('.ork-${id}__inner').forEach((el) => {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => e.isIntersecting && e.target.classList.add('is-visible'));
  }, { threshold: 0.2 });
  io.observe(el);
});`
    : "// Aucun JS nécessaire pour cette section.";

  const schema = `{% schema %}
{
  "name": "${type}",
  "tag": "section",
  "class": "ork-section",
  "settings": [
    { "type": "text", "id": "heading", "label": "Titre", "default": "${type}" },
    { "type": "text", "id": "subheading", "label": "Sous-titre" },
    { "type": "color", "id": "accent_color", "label": "Couleur d'accent", "default": "${accent}" },
    { "type": "text", "id": "button_label", "label": "Texte du bouton", "default": "Découvrir" },
    { "type": "url", "id": "button_link", "label": "Lien du bouton" }
  ],
  "presets": [{ "name": "${type}" }]
}
{% endschema %}`;

  return {
    liquid,
    css,
    js,
    schema,
    installSteps: [
      "Dans l'admin Shopify, allez dans Boutique en ligne → Thèmes → ⋯ → Modifier le code.",
      `Créez une nouvelle section : Sections → Ajouter → nommez-la « ${id} ».`,
      "Collez le code Liquid + le bloc {% schema %} fourni dans le fichier .liquid.",
      "Ajoutez le CSS (et le JS si présent) dans la balise <style>/<script> de la section ou dans votre fichier d'assets.",
      "Enregistrez, puis ajoutez la section depuis l'éditeur de thème (Personnaliser).",
    ],
    responsiveChecklist: [
      { label: "Titre lisible sur mobile (clamp)", ok: true },
      { label: "Padding adaptatif", ok: true },
      { label: "CTA accessible au doigt (44px)", ok: true },
      { label: "Pas de débordement horizontal", ok: true },
      { label: "Contraste texte/fond suffisant", ok: true },
    ],
  };
}

// ── Merchant Shield ───────────────────────────────────────────────────────

export interface MerchantContext {
  brandName?: string;
  niche?: string;
  language?: string;
  collections?: string[];
  /** Nombre réel de textes anglais détectés par le scan public. */
  englishCount?: number;
  /** Score Merchant réel issu du scan (override le calcul). */
  scoreHint?: number;
  /** Pages légales essentielles manquantes (libellés). */
  missingLegal?: string[];
}

export function generateMerchantAudit(ctx: MerchantContext = {}): MerchantAudit {
  const lang = ctx.language || "française";
  const cols = ctx.collections?.length ? ctx.collections : ["vos collections"];
  const hasEnglish = ctx.englishCount != null;
  const issues: MerchantAudit["issues"] = [
    {
      id: "m1",
      category: "Pages légales",
      severity: "critique",
      title: "Politique de retour introuvable ou incomplète",
      explanation:
        "Google Merchant Center exige une politique de retour claire et accessible. Son absence est une cause fréquente de suspension.",
      fix: "Ajoutez une page « Politique de retour » détaillée (délai, conditions, frais) et liez-la dans le footer.",
      priority: 1,
      resolved: false,
    },
    {
      id: "m2",
      category: "Cohérence langue",
      severity: "critique",
      title: hasEnglish
        ? `${ctx.englishCount} texte(s) en anglais détecté(s) par le scan`
        : `Textes en anglais détectés sur une boutique ${lang === "française" ? "FR" : lang}`,
      explanation:
        "Des libellés thème en anglais (« Add to cart », « Sold out ») nuisent à la confiance et à la conformité.",
      fix: "Traduisez les libellés via l'éditeur de langue Shopify (Paramètres → Langues → Modifier).",
      priority: 2,
      resolved: false,
    },
    {
      id: "m3",
      category: "Transparence entreprise",
      severity: "important",
      title: "Informations entreprise insuffisantes",
      explanation:
        "Une page « À propos » et des mentions légales complètes rassurent Google et les acheteurs.",
      fix: "Complétez les mentions légales (raison sociale, adresse, contact) et étoffez la page À propos.",
      priority: 3,
      resolved: false,
    },
    {
      id: "m4",
      category: "Contenu produit",
      severity: "important",
      title: `Descriptions trop faibles sur ${cols.slice(0, 2).join(", ")}`,
      explanation:
        `Des descriptions trop courtes ou dupliquées sur ${cols.slice(0, 3).join(", ")} dégradent le SEO et la confiance.`,
      fix: "Générez des fiches produits SEO complètes via le SEO Studio (200+ mots, bénéfices, FAQ).",
      priority: 4,
      resolved: false,
    },
    {
      id: "m5",
      category: "Promotions",
      severity: "mineur",
      title: "Promotions potentiellement agressives",
      explanation:
        "Des réductions « -80% » permanentes peuvent déclencher un signal misrepresentation.",
      fix: "Limitez les promotions dans le temps et affichez des prix de référence cohérents.",
      priority: 5,
      resolved: false,
    },
    {
      id: "m6",
      category: "Page contact",
      severity: "mineur",
      title: "Moyens de contact limités",
      explanation: "Un seul moyen de contact réduit la confiance perçue.",
      fix: "Ajoutez un email, un formulaire et idéalement un délai de réponse annoncé.",
      priority: 6,
      resolved: false,
    },
  ];
  // Score réel du scan si disponible, sinon basé sur la sévérité des problèmes.
  if (ctx.scoreHint != null) {
    return { score: Math.max(20, Math.min(99, Math.round(ctx.scoreHint))), issues };
  }
  const open = issues.filter((i) => !i.resolved);
  const penalty = open.reduce(
    (acc, i) => acc + (i.severity === "critique" ? 18 : i.severity === "important" ? 9 : 3),
    0
  );
  return { score: Math.max(20, 100 - penalty), issues };
}

// ── AI Council ────────────────────────────────────────────────────────────

import type { CouncilProviderAnswer, CouncilScores, SiteReview } from "../types";
import { getPreset, buildReviewIssues, detectNiche, type NicheKey } from "../niche";

const MODE_LABEL: Record<CouncilMode, string> = {
  seo: "SEO e-commerce",
  code: "Code Shopify",
  merchant: "Google Merchant Center",
  email: "Email client",
  quote: "Devis",
  strategy: "Stratégie e-commerce",
  competitive: "Analyse concurrentielle",
  free: "Question libre",
};

export interface CouncilContext {
  brandName?: string;
  niche?: string;
  url?: string;
  positioning?: string;
  language?: string;
  collections?: string[];
  productTypes?: string[];
  primaryKeywords?: string[];
  secondaryKeywords?: string[];
  competitors?: string[];
  promises?: string[];
  guarantees?: string[];
  /** Données réelles issues du scan public (si une analyse existe). */
  englishCount?: number;
  missingLegal?: string[];
  pagesAnalyzed?: number;
  productsFound?: number;
  productsAnalyzed?: number;
  productsEnriched?: number;
  weakDescriptions?: number;
  weakTitles?: number;
  collectionsFound?: number;
  coverage?: string;
  catalogSource?: string;
  collectionsAnalyzed?: number;
  noType?: number;
  tagsCoverage?: number;
  topTypes?: string[];
  missingMeta?: number;
  imagesNoAlt?: number;
  priorityProducts?: { title: string; reason: string; contentScore: number }[];
  issuesSummary?: string[];
  scoresSummary?: string;
  /** Question précédente, pour la continuité de conversation. */
  previousQuestion?: string;
  /** Directive issue d'un bouton d'action. */
  directive?: "improve" | "shorten" | "premium" | "html" | null;
}

// Helpers d'accès aux données boutique (avec repli générique si vide).
function brandOf(ctx: CouncilContext): string {
  return ctx.brandName || "votre boutique";
}
function collectionsOf(ctx: CouncilContext): string[] {
  return ctx.collections?.length ? ctx.collections : ["vos collections principales"];
}
function productsOf(ctx: CouncilContext): string[] {
  return ctx.productTypes?.length ? ctx.productTypes : ["vos produits phares"];
}
function keywordsOf(ctx: CouncilContext): string[] {
  return ctx.primaryKeywords?.length ? ctx.primaryKeywords : ["vos mots-clés principaux"];
}
function nicheOf(ctx: CouncilContext): string {
  return ctx.niche || "votre niche";
}

// Spécialités, forces et limites de chaque IA (utilisées dans les onglets).
const PROVIDER_PROFILE: Record<
  AIProviderId,
  { specialty: string; strengths: string[]; limits: string[]; bias: number }
> = {
  openai: {
    specialty: "Exécution & structure opérationnelle",
    strengths: ["Plans d'action clairs et ordonnés", "Très bon sur les checklists et priorisation"],
    limits: ["Style parfois générique", "Peut manquer de finesse rédactionnelle"],
    bias: 6,
  },
  anthropic: {
    specialty: "Rédaction premium & nuance",
    strengths: ["Ton de marque naturel et premium", "Excellentes explications pédagogiques"],
    limits: ["Réponses parfois plus longues", "Moins orienté chiffres bruts"],
    bias: 8,
  },
  gemini: {
    specialty: "Analyse, recherche & conformité",
    strengths: ["Bon sur la conformité Merchant Center", "Approche analytique et data"],
    limits: ["Mise en forme parfois irrégulière", "Style moins commercial"],
    bias: 4,
  },
  openrouter: {
    specialty: "Polyvalence multi-modèles",
    strengths: ["Variante rapide et alternative", "Bon rapport vitesse/qualité"],
    limits: ["Qualité dépend du modèle routé", "Moins prévisible"],
    bias: 2,
  },
  mistral: {
    specialty: "Rapidité & efficacité technique",
    strengths: ["Réponses concises et efficaces", "Très bon en français"],
    limits: ["Moins de profondeur sur les sujets complexes", "Peu de nuances stratégiques"],
    bias: 1,
  },
};

export function generateCouncil(
  mode: CouncilMode,
  question: string,
  providers: AIProviderId[],
  ctx: CouncilContext = {}
): CouncilResult {
  const active = providers.length ? providers : (["openai"] as AIProviderId[]);

  // Une demande de review/analyse de site déclenche une analyse complète.
  const reviewIntent = isReviewIntent(question);
  const sr = reviewIntent ? buildSiteReview(ctx) : null;

  // Réponse finale fusionnée, riche et structurée (markdown).
  const baseMarkdown = sr ? sr.markdown : buildFinalAnswer(mode, question, ctx);
  const finalAnswer = applyDirective(baseMarkdown, ctx.directive);

  const providerAnswers: CouncilProviderAnswer[] = active.map((p) => {
    const profile = PROVIDER_PROFILE[p];
    return {
      provider: p,
      model: defaultModelFor(p),
      specialty: profile.specialty,
      answer: buildProviderAnswer(p, ctx, baseMarkdown),
      qualityScore: 78 + profile.bias + (mode === "seo" || reviewIntent ? 3 : 0),
      strengths: profile.strengths,
      limits: profile.limits,
    };
  });

  const best = [...providerAnswers].sort((a, b) => b.qualityScore - a.qualityScore)[0];
  const quality = Math.min(98, (best?.qualityScore ?? 84) + 5 + Math.min(active.length, 4));

  const scores: CouncilScores = {
    quality,
    clarity: Math.min(98, quality - 2),
    actionable: Math.min(99, quality + 1),
    seo: mode === "seo" || reviewIntent ? Math.min(96, quality - 4) : undefined,
  };

  const nextActions = sr
    ? ["Corriger les collections (SEO Studio)", "Lancer Merchant Shield", "Réordonner la page d'accueil (Section Builder)"]
    : nextActionsFor(mode);

  return {
    finalAnswer,
    qualityScore: quality,
    scores,
    timeSaved: sr ? "~4 h d'audit manuel" : estimateTimeSaved(mode),
    modelsUsed: active,
    nextActions,
    synthesisReasons: [
      `${active.length} IA interrogée${active.length > 1 ? "s" : ""} en parallèle puis fusionnée${active.length > 1 ? "s" : ""}.`,
      sr
        ? "Analyse complète du site croisée avec les données de votre boutique."
        : `Structure la plus complète retenue pour le mode « ${MODE_LABEL[mode]} ».`,
      "Contradictions arbitrées en faveur des bonnes pratiques e-commerce Shopify.",
      ctx.previousQuestion ? "Contexte de la question précédente conservé." : "Ton aligné sur la mémoire boutique.",
    ],
    providerAnswers,
    review: sr?.review,
  };
}

function defaultModelFor(p: AIProviderId): string {
  const map: Record<AIProviderId, string> = {
    openai: "gpt-4o",
    anthropic: "claude-sonnet-4-6",
    gemini: "gemini-1.5-pro",
    openrouter: "openrouter/auto",
    mistral: "mistral-large-latest",
  };
  return map[p];
}

function estimateTimeSaved(mode: CouncilMode): string {
  const map: Record<CouncilMode, string> = {
    seo: "~3 h de travail SEO",
    code: "~2 h de dev front",
    merchant: "~2 h 30 d'audit",
    email: "~25 min de rédaction",
    quote: "~40 min de devis",
    strategy: "~4 h de cadrage",
    competitive: "~3 h de veille",
    free: "~1 h de recherche",
  };
  return map[mode];
}

function nextActionsFor(mode: CouncilMode): string[] {
  const map: Record<CouncilMode, string[]> = {
    seo: ["Générer 3 fiches produits dans le SEO Studio", "Optimiser les meta des collections", "Lancer Merchant Shield"],
    code: ["Générer la section dans le Section Builder", "Tester le rendu mobile", "Ajouter les settings au customizer"],
    merchant: ["Lancer un audit complet Merchant Shield", "Corriger les pages légales", "Traduire les libellés EN"],
    email: ["Dupliquer comme modèle d'email", "Adapter le ton de marque", "Ajouter un CTA mesurable"],
    quote: ["Exporter le devis en HTML", "Ajouter vos conditions de vente", "Personnaliser par client"],
    strategy: ["Construire le plan d'action 30 jours", "Prioriser par impact/effort", "Définir les KPIs"],
    competitive: ["Lister 3 concurrents dans la Mémoire boutique", "Identifier vos angles différenciants", "Adapter le SEO"],
    free: ["Affiner la question", "Demander un plan d'action", "Générer le contenu associé"],
  };
  return map[mode];
}

// ── Construction de la réponse finale (markdown structuré) ──────────────────

function buildFinalAnswer(mode: CouncilMode, question: string, ctx: CouncilContext): string {
  const isPlan = /30\s*jours?|plan d'action|planning|roadmap|sur 30/i.test(question);
  switch (mode) {
    case "seo":
      return isPlan ? seoPlan30(ctx) : seoAnswer(ctx);
    case "code":
      return codeAnswer(ctx);
    case "merchant":
      return merchantAnswer(ctx);
    case "email":
      return emailAnswer(ctx);
    case "quote":
      return quoteAnswer(ctx);
    case "strategy":
      return isPlan ? strategyPlan30(ctx) : strategyAnswer(ctx);
    case "competitive":
      return competitiveAnswer(ctx);
    default:
      return freeAnswer(question, ctx);
  }
}

/** Détecte une demande de review/analyse complète de site. */
export function isReviewIntent(question: string): boolean {
  return /\b(review|revue|analyse[rz]?|audit|passe[rz]?\s+en\s+revue|diagnosti)/i.test(question) &&
    /\b(site|boutique|shop|store|page d'accueil|home)\b/i.test(question);
}

function scanContextLine(ctx: CouncilContext): string {
  if (ctx.productsFound == null) return "";
  const enriched = ctx.productsEnriched ? ` · ${ctx.productsEnriched} enrichis via products.json` : "";
  const weak = ctx.weakDescriptions ? ` ${ctx.weakDescriptions} fiche(s) ont une description faible.` : "";
  return `> 📊 Scan : ${ctx.productsFound} produit(s) trouvés${enriched} · ${ctx.productsAnalyzed ?? 0} analysés en HTML${ctx.catalogSource ? ` (source ${ctx.catalogSource}` : ""}${ctx.catalogSource ? `, couverture ${ctx.coverage ?? "n/a"})` : ""}.${weak}\n\n`;
}

// Vocabulaire spécifique par niche (pour des corrections concrètes).
interface NicheVocab {
  pieces: string[];
  faqs: (coll: string) => string[];
  descHints: string;
}
function nicheVocab(key: NicheKey): NicheVocab {
  // Les noms de collections sont au pluriel (« Suspensions ») → on emploie le
  // pluriel possessif (« vos suspensions ») pour éviter tout article singulier
  // genré incorrect (« un suspension »).
  const map: Partial<Record<NicheKey, NicheVocab>> = {
    luminaires: {
      pieces: ["salon", "salle à manger", "cuisine", "chambre", "escalier"],
      faqs: (c) => [
        `Quel modèle de ${c.toLowerCase()} choisir selon la pièce (salon, salle à manger, chambre) ?`,
        `À quelle hauteur installer vos ${c.toLowerCase()} ?`,
        `Quel type d'ampoule privilégier pour vos ${c.toLowerCase()} (LED, culot, intensité) ?`,
      ],
      descHints: "matériau, dimensions, hauteur d'installation, type d'ampoule, pièce (salon/chambre/cuisine), style déco et ambiance lumineuse",
    },
    beaute: {
      pieces: ["peau sèche", "peau grasse", "peau sensible"],
      faqs: (c) => [
        `Pour quel type de peau vos ${c.toLowerCase()} sont-ils adaptés ?`,
        `Comment intégrer ces ${c.toLowerCase()} dans une routine ?`,
        `Quels sont les ingrédients clés et leurs bénéfices ?`,
      ],
      descHints: "ingrédients/actifs, type de peau, mode d'emploi, routine, bénéfices et résultats",
    },
    bebe: {
      pieces: ["0-6 mois", "6-12 mois", "1-3 ans"],
      faqs: (c) => [
        `À partir de quel âge utiliser vos ${c.toLowerCase()} ?`,
        `Vos ${c.toLowerCase()} respectent-ils les normes de sécurité ?`,
        `Comment les entretenir / les nettoyer ?`,
      ],
      descHints: "âge recommandé, normes de sécurité, matériaux (coton bio…), confort et entretien",
    },
    mode: {
      pieces: ["décontracté", "soirée", "bureau"],
      faqs: (c) => [
        `Comment choisir sa taille pour vos ${c.toLowerCase()} ?`,
        `Quelle matière pour vos ${c.toLowerCase()} et comment les entretenir ?`,
        `Comment associer vos ${c.toLowerCase()} (idées de looks) ?`,
      ],
      descHints: "guide des tailles, matière, coupe, entretien et idées de looks",
    },
  };
  return (
    map[key] ?? {
      pieces: ["usage quotidien"],
      faqs: (c) => [
        `Comment bien choisir parmi vos ${c.toLowerCase()} ?`,
        `Quelles sont les caractéristiques importantes à comparer ?`,
        `Quels sont les délais de livraison et la politique de retour ?`,
      ],
      descHints: "bénéfices, caractéristiques, dimensions, usage et entretien",
    }
  );
}

/** Bloc de correction concrète prêt à coller pour une collection. */
function productAction(reason: string, vocab: NicheVocab): string {
  const r = reason.toLowerCase();
  if (r.includes("type")) return `renseigner le **product_type** + enrichir la description (${vocab.descHints}) et ajouter une FAQ`;
  if (r.includes("description") && r.includes("absente")) return `rédiger une description **200+ mots** (${vocab.descHints}) + FAQ + alt text`;
  if (r.includes("description")) return `étoffer la description à **200+ mots** (${vocab.descHints}) + ajouter une FAQ`;
  if (r.includes("titre")) return `réécrire le titre avec mot-clé + usage/pièce (ex. « pour ${vocab.pieces[0]} »)`;
  if (r.includes("tag")) return `ajouter des tags cohérents (style, ${vocab.pieces.slice(0, 2).join(", ")}, matériau)`;
  return `compléter alt text des images + enrichir la fiche (${vocab.descHints})`;
}

function dataUsed(ctx: CouncilContext): string[] {
  const d: string[] = [];
  if (ctx.productsFound != null) d.push(`${ctx.productsFound} produits trouvés · ${ctx.productsEnriched ?? 0} enrichis · ${ctx.productsAnalyzed ?? 0} analysés HTML`);
  if (ctx.collectionsFound != null) d.push(`${ctx.collectionsFound} collections trouvées · ${ctx.collectionsAnalyzed ?? 0} analysées`);
  if (ctx.weakDescriptions != null) d.push(`${ctx.weakDescriptions} fiches à description faible`);
  if (ctx.weakTitles != null) d.push(`${ctx.weakTitles} titres faibles`);
  if (ctx.noType != null) d.push(`${ctx.noType} produits sans type`);
  if (ctx.tagsCoverage != null) d.push(`tags exploités sur ${ctx.tagsCoverage}% du catalogue`);
  if (ctx.missingMeta != null) d.push(`${ctx.missingMeta} meta descriptions manquantes (échantillon)`);
  if (ctx.imagesNoAlt != null) d.push(`${ctx.imagesNoAlt} images sans alt text`);
  if (ctx.englishCount != null) d.push(`${ctx.englishCount} textes anglais détectés`);
  if (ctx.missingLegal?.length) d.push(`pages légales manquantes : ${ctx.missingLegal.join(", ")}`);
  if (ctx.scoresSummary) d.push(ctx.scoresSummary);
  if (ctx.coverage) d.push(`couverture du scan : ${ctx.coverage}`);
  return d;
}

function seoAnswer(ctx: CouncilContext): string {
  // Si on a les données du scan → audit data-driven. Sinon → version générique.
  return ctx.productsFound != null ? dataDrivenSeoAudit(ctx) : seoAnswerGeneric(ctx);
}

function singularize(s: string): string {
  const words = s.trim().split(" ");
  words[0] = words[0].replace(/(s|x)$/i, "");
  return words.join(" ").toLowerCase();
}

/** Stratégie mots-clés adaptée à la niche, dérivée des collections réelles. */
function nicheKeywords(
  key: NicheKey,
  vocab: NicheVocab,
  cols: string[]
): { short: string[]; transactional: string[]; longtail: string[]; blog: string[]; faq: string[] } {
  const sing = cols.map(singularize);
  const short = key === "luminaires"
    ? ["lustre", "suspension", "plafonnier", "lampe de chevet", "luminaire"]
    : (sing.length ? sing : ["votre catégorie"]).slice(0, 5);
  const transactional = cols.slice(0, 4).flatMap((c) => [`acheter ${c.toLowerCase()}`, `${c.toLowerCase()} design`]);
  const piece = vocab.pieces;
  let longtail: string[] = [];
  if (key === "luminaires") {
    longtail = [
      `${sing[0] || "suspension"} salle à manger design`,
      `hauteur ${sing[0] || "suspension"} salle à manger`,
      "quel plafonnier pour une chambre",
      "luminaire escalier haut plafond",
      "lustre moderne salon contemporain",
    ];
  } else {
    longtail = (sing.length ? sing : ["produit"]).slice(0, 3).flatMap((x) => [`comment choisir ${x}`, `meilleur ${x} ${new Date().getFullYear()}`]);
  }
  longtail = [...longtail, ...cols.slice(0, 3).map((c) => `${c.toLowerCase()} pour ${piece[0]}`)].slice(0, 9);
  const blog = (cols.length ? cols : ["votre collection"]).slice(0, 3).map((c) => `Guide : comment choisir ${singularize(c)}`);
  const faq = vocab.faqs(cols[0] || "produits");
  return { short, transactional, longtail, blog, faq };
}

/** Bloc SEO complet pour UNE collection réelle (proposition prête à coller). */
function collectionSeoBlock(ctx: CouncilContext, coll: string, vocab: NicheVocab, others: string[]): string {
  const s = brandOf(ctx);
  const sing = singularize(coll);
  const faqs = vocab.faqs(coll);
  const secondary = vocab.pieces.slice(0, 3).map((p) => `${sing} ${p}`);
  const internal = others.filter((c) => c !== coll).slice(0, 3);
  return `**📁 Collection « ${coll} »**
- *Problème probable* : texte SEO d'introduction et FAQ absents (à confirmer page par page — donnée partielle via scan public).
- *Mot-clé principal* : \`${sing}\`
- *Mots-clés secondaires* : ${secondary.map((k) => `\`${k}\``).join(", ")}
- *Title proposé* : \`${coll} ${vocab.pieces[0] ? "— " + vocab.pieces[0] : ""} | ${s}\` (≤ 60 car.)
- *Meta proposée* : \`Découvrez nos ${coll.toLowerCase()} pour ${vocab.pieces.slice(0, 3).join(", ")}. Sélection premium, livraison gratuite.\` (≤ 155 car.)
- *Texte SEO (150–300 mots)* : intro (bénéfice + ${vocab.descHints.split(",").slice(0, 2).join(",")}) → **H2 « Comment bien choisir vos ${coll.toLowerCase()} »** → **H2 « Nos best-sellers »** → bloc FAQ.
- *FAQ (4–6)* :
  - ${faqs[0]}
  - ${faqs[1]}
  - ${faqs[2]}
  - Quelle garantie et quels délais de livraison ?
- *Maillage interne à ajouter* : ${internal.length ? internal.map((c) => `lien vers « ${c} » (ancre « ${singularize(c)} ${vocab.pieces[0]} »)`).join(" ; ") : "vers les collections complémentaires une fois détectées"}.`;
}

/** Bloc SEO pour UN produit prioritaire réel. */
function productSeoBlock(p: { title: string; reason: string; contentScore: number }, vocab: NicheVocab): string {
  const target = singularize(p.title.split(" ").slice(0, 4).join(" "));
  return `**🛍️ ${p.title}** (score contenu ${p.contentScore}/100)
- *Problème* : ${p.reason.toLowerCase()}.
- *Mot-clé cible* : \`${target}\`
- *Correction* : ${productAction(p.reason, vocab)}.
- *Alt text proposé* : « ${p.title} — ${vocab.pieces[0]} ».
- *FAQ produit* : « ${vocab.faqs(p.title)[0]} » ; « Quels sont les délais de livraison et la garantie ? »
- *Action* : ouvrir le **SEO Studio** (pré-rempli depuis ce produit) → générer description 200+ mots + FAQ + meta + alt text.`;
}

/** Matrice de maillage interne à partir des collections réelles. */
function maillageBlock(cols: string[], vocab: NicheVocab): string {
  if (cols.length < 2) return "_Maillage interne : au moins 2 collections détectées sont nécessaires (donnée partielle via scan public)._";
  const rows: string[] = ["| Source | Cible | Ancre | Impact |", "|---|---|---|---|"];
  for (let i = 0; i < Math.min(cols.length, 4); i++) {
    const src = cols[i];
    const dst = cols[(i + 1) % cols.length];
    rows.push(`| ${src} | ${dst} | « ${singularize(dst)} ${vocab.pieces[0] || ""} » | Renforce le cocon sémantique ${vocab.pieces[0] ? "(" + vocab.pieces[0] + ")" : ""} |`);
  }
  return rows.join("\n");
}

/** Corrections prêtes à copier (2 meta, 2 titles, 3 FAQ, 3 alt, 3 ancres). */
function readyToCopyBlock(ctx: CouncilContext, cols: string[], vocab: NicheVocab): string {
  const s = brandOf(ctx);
  const c0 = cols[0] || "Collection";
  const c1 = cols[1] || cols[0] || "Collection";
  const faqs = vocab.faqs(c0);
  return `**Titles**
- \`${c0} ${vocab.pieces[0] ? "— " + vocab.pieces[0] : ""} | ${s}\`
- \`${c1} design ${vocab.pieces[1] ? "pour " + vocab.pieces[1] : ""} | ${s}\`

**Meta descriptions**
- \`Découvrez nos ${c0.toLowerCase()} pour ${vocab.pieces.slice(0, 3).join(", ")}. Sélection premium, livraison gratuite.\`
- \`Nos ${c1.toLowerCase()} au meilleur rapport qualité/prix. Conseils d'expert, paiement sécurisé et retours simplifiés.\`

**FAQ**
- ${faqs[0]}
- ${faqs[1]}
- ${faqs[2]}

**Alt text**
- « ${singularize(c0)} ${vocab.pieces[0]} — ${s} »
- « ${singularize(c1)} design ${vocab.pieces[1] || ""} »
- « ambiance ${vocab.pieces[0]} avec ${singularize(c0)} »

**Ancres de maillage**
- « ${singularize(c1)} ${vocab.pieces[0]} » (vers « ${c1} »)
- « nos ${c0.toLowerCase()} » (depuis une fiche produit)
- « guide : comment choisir ${singularize(c0)} » (depuis un article de blog)`;
}

function dataDrivenSeoAudit(ctx: CouncilContext): string {
  const s = brandOf(ctx);
  const niche = nicheOf(ctx);
  const key = detectNiche(`${ctx.niche ?? ""} ${ctx.brandName ?? ""}`);
  const vocab = nicheVocab(key);
  // « Ne pas inventer » : on n'utilise que les données réellement détectées.
  const realCols = ctx.collections?.length ? ctx.collections : [];
  const cols = realCols.length ? realCols : collectionsOf(ctx);
  const prio = ctx.priorityProducts ?? [];
  const kw = nicheKeywords(key, vocab, realCols);

  // Priorités par impact.
  const high: string[] = [];
  const mid: string[] = [];
  const low: string[] = [];
  if (ctx.weakDescriptions) high.push(`Enrichir les **${ctx.weakDescriptions} fiches** à description faible (commencer par les best-sellers).`);
  if (realCols.length) high.push(`Ajouter texte SEO + FAQ sur les collections : ${realCols.slice(0, 4).join(", ")}.`);
  if (ctx.missingMeta) high.push(`Réécrire les **${ctx.missingMeta} meta descriptions** manquantes.`);
  if (ctx.noType) mid.push(`Renseigner le \`product_type\` sur **${ctx.noType} produits** (catégorisation + flux Shopping).`);
  if (ctx.imagesNoAlt) mid.push(`Ajouter les alt text sur **${ctx.imagesNoAlt} images**.`);
  mid.push("Mettre en place le maillage interne collection ↔ collection (voir matrice).");
  if (ctx.tagsCoverage != null && ctx.tagsCoverage < 60) low.push(`Améliorer les tags (couverture actuelle ${ctx.tagsCoverage}%).`);
  low.push("Créer un cluster blog (guides d'achat) relié aux collections.");
  if (ctx.englishCount) high.push(`Traduire les **${ctx.englishCount} textes anglais** (confiance + cohérence).`);

  const colBlocks = realCols.length
    ? realCols.slice(0, 3).map((c) => collectionSeoBlock(ctx, c, vocab, realCols)).join("\n\n")
    : "_Donnée non disponible via scan public : aucune collection détectée. Une connexion API Shopify permettra l'analyse collection par collection._";
  const prodBlocks = prio.length
    ? prio.slice(0, 5).map((p) => productSeoBlock(p, vocab)).join("\n\n")
    : "_Donnée non disponible via scan public : aucun produit prioritaire isolé. Élargissez le scan ou connectez l'API Shopify._";

  return `## 🎯 Stratégie SEO de ${s} — mission complète basée sur le scan

${scanContextLine(ctx)}**Analyse basée sur le scan.** Niche : **${niche}**. Objectif : mieux ranker collections + produits, capter la longue traîne, renforcer le maillage interne et réduire les problèmes visibles.

## 1. 📊 Résumé du scan SEO
${dataUsed(ctx).map((d) => `- ${d}`).join("\n")}

## 2. 🥇 Priorités SEO par impact
**Priorité haute**
${high.map((x) => `- ${x}`).join("\n") || "- (rien de bloquant détecté)"}

**Priorité moyenne**
${mid.map((x) => `- ${x}`).join("\n")}

**Priorité basse**
${low.map((x) => `- ${x}`).join("\n")}

## 3. 📁 Collections à optimiser
${colBlocks}

## 4. 🛍️ Produits à optimiser
${prodBlocks}

## 5. 🔗 Maillage interne recommandé
${maillageBlock(realCols, vocab)}

> Règle : chaque fiche produit doit lier vers sa collection ; chaque collection vers 2–3 collections complémentaires ; chaque article de blog vers la collection cible.

## 6. 🔑 Stratégie mots-clés
- **Courte traîne** : ${kw.short.map((k) => `\`${k}\``).join(", ")}
- **Transactionnels** : ${kw.transactional.map((k) => `\`${k}\``).join(", ")}
- **Longue traîne** : ${kw.longtail.map((k) => `\`${k}\``).join(", ")}
- **Blog** : ${kw.blog.map((k) => `« ${k} »`).join(", ")}
- **FAQ** : ${kw.faq.map((k) => `« ${k} »`).join(" ")}

## 7. 🗓️ Plan d'action 7 jours
- **J1** : traduire les textes anglais (${ctx.englishCount ?? 0}) + corriger les meta manquantes (${ctx.missingMeta ?? 0}).
- **J2** : renseigner les \`product_type\` manquants (${ctx.noType ?? 0}).
- **J3–4** : réécrire title + meta + intro SEO + FAQ de « ${cols[0] || "votre collection principale"} »${cols[1] ? " et « " + cols[1] + " »" : ""}.
- **J5–6** : enrichir les 5 produits prioritaires (description 200+ mots, FAQ, alt text) via le SEO Studio.
- **J7** : poser le maillage interne entre ${realCols.slice(0, 3).join(" ↔ ") || "vos collections"}.

## 8. 🗓️ Plan d'action 30 jours
- **Semaine 1** : quick wins (langue, meta, product_type).
- **Semaine 2** : texte SEO + FAQ sur toutes les collections principales (${realCols.slice(0, 4).join(", ") || "à détecter"}).
- **Semaine 3** : enrichir 15–20 fiches produits (en partant des scores de contenu les plus bas).
- **Semaine 4** : maillage interne complet + 2 guides blog (${kw.blog.slice(0, 2).join(" ; ")}) reliés aux collections.

## 9. ✂️ Corrections prêtes à copier
${readyToCopyBlock(ctx, cols, vocab)}

## 🚀 Actions Orkestra
- **SEO Studio** : fiches produits prioritaires + meta + FAQ collections.
- **Merchant Shield** : textes anglais + pages légales + structure catalogue.
- **Section Builder** : bloc FAQ de collection + réassurance.

> Données manquantes (texte SEO exact par collection, balises actuelles) : non disponibles via scan public — une connexion API Shopify les rendra exploitables.`;
}

function seoAnswerGeneric(ctx: CouncilContext): string {
  const s = brandOf(ctx);
  const cols = collectionsOf(ctx);
  const kws = keywordsOf(ctx);
  const niche = nicheOf(ctx);
  return `## Plan SEO pour ${s}

**Diagnostic express** — ${s} évolue sur la niche **${niche}**. Le potentiel SEO repose sur trois piliers : la structure des collections (${cols.slice(0, 3).join(", ")}…), la qualité des fiches produits et le maillage interne.

> 💡 Lancez un **scan public** de votre boutique pour une analyse chiffrée et des produits prioritaires concrets.

### Priorités SEO
1. **Pages collections** (${cols.slice(0, 4).join(", ")}) — title + 150–300 mots + FAQ.
2. **Fiches produits** — H1 orienté bénéfice (« ${kws[0] || "produit"} »), description 200+ mots, FAQ, avis.
3. **Meta** uniques (≤ 60 / ≤ 155 car.) avec CTA.
4. **Maillage interne** blog → ${cols.slice(0, 2).join(" / ")}.
5. **Alt text** avec mot-clé sur toutes les images.

> Demandez **« fais-moi le plan d'action sur 30 jours »** pour un planning détaillé.`;
}

function seoPlan30(ctx: CouncilContext): string {
  const cols = collectionsOf(ctx);
  return `## Plan d'action SEO — 30 jours pour ${brandOf(ctx)}

Plan structuré en 4 semaines, du plus fort impact au plus structurel.

### Semaine 1 — Fondations & quick wins
- [ ] Auditer les meta titles/descriptions manquantes ou dupliquées.
- [ ] Réécrire les meta des collections **${cols.slice(0, 2).join(", ")}** (≤ 60 / ≤ 155 car.).
- [ ] Corriger les alt text des images produits prioritaires.
- **Impact attendu :** visibilité rapide sur les pages déjà indexées.

### Semaine 2 — Collections
- [ ] Ajouter 150–300 mots de contenu SEO unique sur ${cols.slice(0, 4).join(", ")}.
- [ ] Structurer H1/H2 + bloc FAQ de collection.
- [ ] Mettre en place le maillage interne entre collections liées.
- **Impact attendu :** gain de positions sur les requêtes commerciales.

### Semaine 3 — Fiches produits
- [ ] Réécrire les 10 fiches les plus vues (200+ mots, bénéfices, FAQ).
- [ ] Ajouter avis/preuve sociale au-dessus de la ligne de flottaison.
- [ ] Optimiser les handles et les balises.
- **Impact attendu :** meilleure conversion + longue traîne produit.

### Semaine 4 — Contenu & autorité
- [ ] Publier 2 articles de blog longue traîne pointant vers les collections.
- [ ] Renforcer le maillage blog → collections → produits.
- [ ] Lancer **Merchant Shield** pour la conformité.
- **Impact attendu :** trafic incrémental et autorité thématique.

### 📊 Suivi
- KPIs : positions moyennes, clics Search Console, taux de conversion par page.
- Revue hebdomadaire le vendredi : ce qui bouge, ce qu'on ajuste.

> Je peux générer directement les fiches produits (SEO Studio) ou les meta — dites-moi par quoi commencer.`;
}

function codeAnswer(ctx: CouncilContext): string {
  return `## Implémentation Shopify (Online Store 2.0)

Pour ${brandOf(ctx)}, voici l'approche propre et maintenable :

### Architecture recommandée
- **Section dédiée** avec un bloc \`{% schema %}\` pour exposer les réglages dans le customizer.
- **CSS responsive** : \`clamp()\` pour les tailles + media queries pour les points de rupture.
- **JS optionnel** chargé via \`IntersectionObserver\` (animations au scroll), jamais bloquant.

### Bonnes pratiques
- Préfixez vos classes (\`.ork-…\`) pour éviter les conflits avec le thème.
- Pas de styles inline en dur : tout passe par les settings du schema.
- Vérifiez l'accessibilité (contraste, cibles tactiles ≥ 44px).

### Étapes
1. Créez la section dans **Modifier le code → Sections**.
2. Collez Liquid + \`{% schema %}\`, puis le CSS dans le \`<style>\` de la section.
3. Ajoutez la section depuis **Personnaliser**.

> ⚡ Ouvrez le **Section Builder** : il génère le Liquid + CSS + schema complets, prêts à coller, avec checklist responsive.`;
}

function merchantAnswer(ctx: CouncilContext): string {
  const cols = collectionsOf(ctx);
  return `## Conformité Merchant Center pour ${brandOf(ctx)}

Voici les risques les plus fréquents et comment les réduire. *(Aucun outil ne garantit l'absence de suspension — Google reste seul décisionnaire.)*

### Priorités critiques
1. **Politique de retour** claire et accessible (délai, conditions, frais).
2. **Cohérence de langue** : aucun libellé EN sur une boutique ${ctx.language || "FR"}.

### Priorités importantes
3. **Mentions légales & page À propos** complètes (transparence entreprise).
4. **Descriptions produits solides** sur ${cols.slice(0, 2).join(", ")} (200+ mots, pas de duplication).

### Priorités mineures
5. Promotions non agressives (éviter les « -80% » permanents).
6. Plusieurs moyens de contact + délai de réponse annoncé.

### ✅ Checklist
- [ ] Pages légales présentes et liées au footer.
- [ ] Libellés du thème traduits.
- [ ] Prix cohérents entre fiche, panier et flux.

> Lancez **Merchant Shield** pour un audit détaillé avec score et correctifs générables.`;
}

function emailAnswer(ctx: CouncilContext): string {
  const s = brandOf(ctx);
  return `## Email client professionnel — ${s}

**Objet :** clair et orienté bénéfice (ex. « Votre commande ${s} : voici la suite »).

---

Bonjour [Prénom],

Merci pour votre message. [Reformulation empathique de la demande pour montrer qu'on a compris.]

Voici ce que je vous propose :
- **Solution** : [action concrète].
- **Délai** : [échéance réaliste].
- **Prochaine étape** : [ce que le client doit faire, le cas échéant].

Si vous avez la moindre question, je reste à votre disposition.

Bien à vous,
[Votre nom] — Service client ${s}

---

> Ton aligné sur votre marque. Demandez **« rends-le plus chaleureux »** ou **« plus formel »** pour ajuster.`;
}

function quoteAnswer(ctx: CouncilContext): string {
  const s = brandOf(ctx);
  return `## Devis — ${s}

**Émis par :** ${s}  ·  **Pour :** [Client]  ·  **Date :** [date]  ·  **Validité :** 30 jours

### Prestations
| Prestation | Description | Qté | PU HT | Total HT |
|---|---|---|---|---|
| [Prestation 1] | [détail] | 1 | [€] | [€] |
| [Prestation 2] | [détail] | 1 | [€] | [€] |

### Récapitulatif
- **Total HT :** [€]
- **TVA (20%) :** [€]
- **Total TTC :** [€]

### Conditions
- Acompte de 30% à la commande, solde à la livraison.
- Délai de réalisation : [X jours] après validation.

> Exportez ce devis en HTML via le bouton **Convertir en HTML**.`;
}

function strategyAnswer(ctx: CouncilContext): string {
  return `## Stratégie e-commerce pour ${brandOf(ctx)}

Une croissance saine s'appuie sur trois moteurs travaillés en parallèle.

### 1. Acquisition
- **SEO** : collections + fiches + blog longue traîne (canal durable).
- **Ads** : Google Shopping/Meta sur vos best-sellers à forte marge.

### 2. Conversion
- Fiches produits premium (bénéfices, FAQ, preuve sociale).
- Réassurance : livraison, retours, paiement sécurisé visibles.
- Réduisez la friction du checkout.

### 3. Rétention
- Email/SMS : bienvenue, panier abandonné, post-achat.
- Programme de fidélité / offres exclusives.

### 🎯 Priorisation
Commencez par la **conversion** (ROI immédiat), puis l'**acquisition** (volume), enfin la **rétention** (LTV).

> Demandez **« plan d'action sur 30 jours »** pour un planning détaillé.`;
}

function strategyPlan30(ctx: CouncilContext): string {
  return `## Plan stratégique — 30 jours pour ${brandOf(ctx)}

### Semaine 1 — Conversion (ROI immédiat)
- [ ] Auditer le tunnel et lever les frictions du checkout.
- [ ] Ajouter réassurance + avis sur les fiches clés.

### Semaine 2 — Contenu & SEO
- [ ] Optimiser collections + 10 fiches best-sellers.
- [ ] Lancer le maillage interne.

### Semaine 3 — Acquisition
- [ ] Configurer Google Shopping sur les produits à marge.
- [ ] Tester 2 angles publicitaires.

### Semaine 4 — Rétention
- [ ] Mettre en place les scénarios email (bienvenue, panier, post-achat).
- [ ] Définir une offre de fidélité.

### 📊 KPIs
Taux de conversion, panier moyen, CAC, LTV, ROAS.`;
}

function competitiveAnswer(ctx: CouncilContext): string {
  const s = brandOf(ctx);
  const comp = ctx.competitors?.length ? ctx.competitors : ["vos concurrents directs"];
  return `## Analyse concurrentielle — niche ${nicheOf(ctx)}

Cadre d'analyse pour positionner ${s} face à ${comp.slice(0, 3).join(", ")}.

### Axes à comparer
- **Positionnement & prix** : où se situe ${s} (${ctx.positioning || "premium"}) face à ${comp[0]} ?
- **USP** : promesse unique mise en avant en page d'accueil.
- **Contenu SEO** : profondeur des fiches, blog, FAQ.
- **Preuve sociale** : volume et qualité des avis.
- **Expérience** : vitesse, mobile, réassurance.

### Méthode
1. Comparez-vous à ${comp.slice(0, 3).join(", ")}.
2. Notez chaque axe de 1 à 5.
3. Identifiez vos **angles différenciants** (là où vous pouvez gagner vite).

### 🎯 Sortie
Un tableau forces/faiblesses + 3 angles à exploiter dans votre SEO et vos fiches.

> Renseignez vos concurrents dans la **Mémoire boutique** pour des analyses personnalisées.`;
}

function freeAnswer(q: string, ctx: CouncilContext): string {
  return `## Réponse de l'orchestre

${q ? `Concernant votre demande « ${q.trim()} » :` : "Voici une réponse structurée et actionnable :"}

- **Contexte** : analyse appliquée à ${brandOf(ctx)} (niche ${nicheOf(ctx)}).
- **Recommandation principale** : l'action à plus fort impact à lancer en premier.
- **Étapes** : 3 à 5 actions concrètes et ordonnées.
- **Mesure** : comment vérifier que ça fonctionne.

> Précisez un mode (SEO, Code Shopify, Merchant Center…) en haut pour une réponse encore plus ciblée.`;
}

// ── Review / analyse complète de site (adaptée à la boutique) ────────────────

export function buildSiteReview(ctx: CouncilContext): { markdown: string; review: SiteReview } {
  const s = brandOf(ctx);
  const niche = nicheOf(ctx);
  const cols = collectionsOf(ctx);
  const kws = keywordsOf(ctx);

  // Ordres & problèmes ADAPTÉS À LA NICHE de la boutique active.
  const { preset } = getPreset(ctx);
  const homepageOrder = preset.homepageOrder;
  const productPageStructure = preset.productPageStructure;
  const issues = buildReviewIssues(ctx);

  const markdown = `## Review complète de ${s}

${scanContextLine(ctx)}Analyse adaptée à votre niche **${niche}**. Voici l'état des lieux, page par page, puis les recommandations priorisées.

### 🔍 SEO global
- Intention bien identifiable (${kws.slice(0, 3).map((k) => `« ${k} »`).join(", ")}) mais sous-exploitée.
- Collections et fiches produits insuffisamment optimisées (texte, Hn, meta).

### 🏠 Page d'accueil
- Hero présent mais promesse à clarifier (bénéfice + ambiance).
- Réassurance et preuve sociale trop basses → à remonter.
- **Ordre recommandé :** ${homepageOrder.join(" → ")}.

### 📁 Pages collections
- ${cols.slice(0, 4).join(", ")} : peu ou pas de texte SEO unique, pas de FAQ.
- Un seul H1 par page, des H2 par sous-thème à ajouter.

### 🛍️ Pages produits
- Descriptions courtes, bénéfices peu visibles, pas de FAQ produit ni d'avis bien placés.
- **Structure idéale :** ${productPageStructure.join(" → ")}.

### ✍️ Contenu & rédaction
- Qualité des descriptions : à renforcer (200+ mots, orienté bénéfices et ambiance).
- Contenu potentiellement dupliqué entre fiches similaires → différencier.

### 🏷️ Meta & balises
- Meta titles/descriptions manquantes ou dupliquées ; H1/H2/H3 à structurer.
- Alt text d'images souvent absents (ajouter le mot-clé, ex. « ${kws[0]} »).

### 🌐 Traduction & cohérence
- ${ctx.englishCount != null ? `${ctx.englishCount} texte(s) anglais détecté(s) par le scan public` : "Textes anglais résiduels du thème détectés (libellés panier)"}.
- Vérifier les erreurs de traduction et la cohérence de marque.

### 🛡️ Conformité & confiance (Merchant Center)
- ${ctx.missingLegal?.length ? `Pages manquantes détectées : ${ctx.missingLegal.join(", ")}.` : "Politique de retour/livraison et mentions légales à compléter et rendre visibles."}
- Page contact à enrichir (plusieurs moyens + délai de réponse).
- Risque **misrepresentation** à surveiller (promotions, cohérence prix).

### 🧭 UX & conversion
- Réassurance (livraison gratuite, paiement sécurisé, garanties) à afficher plus tôt.
- Éléments manquants pour rassurer : avis visibles, garanties, FAQ.

> 👉 Ci-dessous, chaque problème détecté est listé avec sa **gravité**, son **impact**, la **correction recommandée** et un bouton **Corriger avec Orkestra**.`;

  return {
    markdown,
    review: { summary: markdown, homepageOrder, productPageStructure, issues },
  };
}

// ── Réponses individuelles par IA (onglets) ─────────────────────────────────

function buildProviderAnswer(p: AIProviderId, ctx: CouncilContext, baseMarkdown: string): string {
  const profile = PROVIDER_PROFILE[p];
  const s = brandOf(ctx);
  const angle: Record<AIProviderId, string> = {
    openai: `Voici ma version la plus **opérationnelle** : j'ai priorisé une feuille de route claire et ordonnée pour ${s}, avec des actions immédiatement exécutables.`,
    anthropic: `J'ai privilégié une réponse **rédigée et nuancée**, alignée sur le ton premium de ${s}, en expliquant le *pourquoi* derrière chaque recommandation.`,
    gemini: `J'ai adopté un angle **analytique** : cohérence, conformité et données pour ${s} avant de recommander.`,
    openrouter: `Variante **rapide et alternative** : une lecture complémentaire utile pour ${s}, à comparer avec les autres modèles.`,
    mistral: `Réponse **concise et efficace** en français pour ${s}, droit aux actions essentielles.`,
  };
  return `${angle[p]}\n\n${condense(baseMarkdown)}\n\n*Spécialité : ${profile.specialty}.*`;
}

/** Condense une réponse markdown en gardant titres et premières puces. */
function condense(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let bulletsAfterHeading = 0;
  for (const line of lines) {
    if (/^#{2,3}\s/.test(line)) {
      out.push(line.replace(/^###?\s/, "### "));
      bulletsAfterHeading = 0;
    } else if (/^\s*[-*\d.]/.test(line) && bulletsAfterHeading < 2) {
      out.push(line);
      bulletsAfterHeading++;
    }
    if (out.length > 16) break;
  }
  return out.join("\n");
}

// ── Directives des boutons d'action ─────────────────────────────────────────

function applyDirective(answer: string, directive?: CouncilContext["directive"]): string {
  switch (directive) {
    case "shorten":
      return "## Version courte (TL;DR)\n\n" + condense(answer);
    case "premium":
      return answer + "\n\n---\n\n> ✨ **Touche premium** : soignez la cohérence visuelle, le storytelling de marque et la réassurance haut de gamme à chaque étape.";
    case "improve":
      return answer + "\n\n---\n\n> 🔁 **Version améliorée** : recommandations enrichies de bonnes pratiques e-commerce supplémentaires et d'un ordre de priorité affiné.";
    case "html":
      return "## Export HTML\n\n```html\n" + markdownToHtml(answer) + "\n```";
    default:
      return answer;
  }
}

/** Conversion markdown → HTML simple (pour le bouton « Convertir en HTML »). */
function markdownToHtml(md: string): string {
  return md
    .split("\n")
    .map((l) => {
      if (/^##\s/.test(l)) return `<h2>${l.replace(/^##\s/, "")}</h2>`;
      if (/^###\s/.test(l)) return `<h3>${l.replace(/^###\s/, "")}</h3>`;
      if (/^\s*-\s/.test(l)) return `<li>${l.replace(/^\s*-\s/, "")}</li>`;
      if (l.trim() === "") return "";
      return `<p>${l}</p>`;
    })
    .filter(Boolean)
    .join("\n");
}

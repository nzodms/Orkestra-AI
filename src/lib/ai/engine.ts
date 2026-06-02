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

export function generateMerchantAudit(): MerchantAudit {
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
      title: "Textes en anglais détectés sur une boutique FR",
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
      title: "Descriptions produits trop faibles",
      explanation:
        "Des descriptions trop courtes ou dupliquées dégradent le SEO et la confiance.",
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
  // Score basé sur la sévérité des problèmes ouverts.
  const open = issues.filter((i) => !i.resolved);
  const penalty = open.reduce(
    (acc, i) => acc + (i.severity === "critique" ? 18 : i.severity === "important" ? 9 : 3),
    0
  );
  return { score: Math.max(20, 100 - penalty), issues };
}

// ── AI Council ────────────────────────────────────────────────────────────

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

export function generateCouncil(
  mode: CouncilMode,
  question: string,
  providers: AIProviderId[]
): CouncilResult {
  const active = providers.length ? providers : (["openai"] as AIProviderId[]);
  const providerAnswers = active.map((p, i) => ({
    provider: p,
    answer: `Réponse de ${p} (mode ${MODE_LABEL[mode]}) : ${draftAnswer(mode, question, i)}`,
    qualityScore: 72 + ((i * 7) % 20),
  }));

  const best = [...providerAnswers].sort((a, b) => b.qualityScore - a.qualityScore)[0];

  return {
    finalAnswer: synthesize(mode, question, providerAnswers.length),
    qualityScore: Math.min(97, (best?.qualityScore || 80) + 6),
    synthesisReasons: [
      `${providerAnswers.length} modèle(s) interrogé(s) en parallèle puis fusionnés.`,
      `La synthèse retient la structure la plus complète et adaptée au mode « ${MODE_LABEL[mode]} ».`,
      "Les contradictions entre modèles ont été arbitrées en faveur des bonnes pratiques e-commerce.",
      "Le ton a été aligné sur la mémoire boutique.",
    ],
    providerAnswers,
  };
}

function draftAnswer(mode: CouncilMode, q: string, seed: number): string {
  const variants = [
    "voici une approche structurée et directement actionnable.",
    "je recommande de prioriser l'impact business et la clarté.",
    "concentrons-nous sur les leviers à fort retour rapide.",
  ];
  return `${q ? `« ${q.slice(0, 60)} » → ` : ""}${variants[seed % variants.length]}`;
}

function synthesize(mode: CouncilMode, q: string, n: number): string {
  const intro = q
    ? `Voici la réponse finale recommandée par l'orchestre (${n} IA fusionnées) :\n\n`
    : "";
  const byMode: Record<CouncilMode, string> = {
    seo: "1. Ciblez une intention de recherche précise.\n2. Optimisez le title, la meta et le H1.\n3. Structurez le contenu (H2/H3, FAQ).\n4. Ajoutez du maillage interne vers les collections clés.\n5. Mesurez et itérez.",
    code: "Voici un plan d'implémentation Shopify 2.0 propre :\n- Section dédiée avec {% schema %} pour le customizer.\n- CSS responsive (clamp + media queries).\n- JS optionnel via IntersectionObserver.\nUtilisez le Section Builder pour générer le code complet.",
    merchant: "Priorités conformité :\n1. Politique de retour & livraison claires.\n2. Mentions légales complètes.\n3. Cohérence de langue.\n4. Descriptions produits solides.\nLancez un audit Merchant Shield pour le détail.",
    email: "Objet accrocheur + ouverture personnalisée + bénéfice clair + CTA unique + signature. Gardez un ton aligné sur votre marque.",
    quote: "Structurez : contexte client, prestations, livrables, délais, prix HT/TTC, conditions, validité de l'offre.",
    strategy: "Travaillez l'acquisition (SEO + ads), la conversion (fiches + réassurance) et la rétention (email/SMS) en parallèle.",
    competitive: "Comparez positionnement, prix, USP, contenu SEO et preuve sociale des concurrents pour identifier vos angles.",
    free: "Voici une réponse synthétique et actionnable basée sur les meilleures pratiques e-commerce.",
  };
  return intro + byMode[mode];
}

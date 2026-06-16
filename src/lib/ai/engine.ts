import type {
  ProductSeoResult,
  SectionResult,
  MerchantAudit,
  CouncilResult,
  CouncilFormat,
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
    optimizedTitle: `${name}${benefits[0] ? ` — ${benefits[0].toLowerCase()}` : ""}`,
    h1: `${name}${input.audience ? ` pour ${input.audience}` : ""}`,
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
      : ["Matériaux sélectionnés", "Finitions soignées", "Garantie incluse"],
    faq: [
      {
        q: `Quelles sont les caractéristiques de ${name} ?`,
        a: `${name} ${
          input.materials ? "est fabriqué avec " + input.materials + " et " : ""
        }offre ${benefits[0]?.toLowerCase() || "une qualité durable"}.`,
      },
      {
        q: "Quels sont les délais de livraison ?",
        a: "La livraison est soignée et suivie. Vous recevez un numéro de suivi dès l'expédition.",
      },
      {
        q: "Puis-je retourner le produit ?",
        a: "Oui, vous bénéficiez d'une politique de retour claire sous 14 jours.",
      },
    ].slice(0, depth + 1),
    metaTitle: `${name}`.slice(0, 60),
    metaDescription: `${name} : ${
      benefits[0]?.toLowerCase() || "conçu pour répondre à votre besoin"
    }. ${input.materials ? input.materials + ". " : ""}Livraison soignée et paiement sécurisé.`.slice(0, 155),
    imageAltTexts: [
      `${name} vue de face`,
      `${name} en situation ${input.audience ? "pour " + input.audience : "d'usage"}`,
      `Détail des finitions de ${name}`,
    ],
    handle: slugify(name),
    primaryKeywords: primary.length ? primary : [slugify(name)],
    longTailKeywords: [
      `acheter ${name.toLowerCase()}`,
      `${name.toLowerCase()} avis`,
      `comment choisir ${(primary[0] || name).toLowerCase()}`,
      `${name.toLowerCase()} ${input.audience || "maison"}`,
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
    productType: cap((input.collection ? singularize(input.collection) : name.split(/\s+/)[0]) || name),
    parentCollection: input.collection || undefined,
    tags: Array.from(new Set([
      ...(input.audience ? [input.audience.toLowerCase()] : []),
      ...features.slice(0, 2).map((f) => f.toLowerCase()),
      ...(input.materials ? [input.materials.split(/[ ,]/)[0].toLowerCase()] : []),
    ].filter(Boolean))).slice(0, 6),
    merchantNote: `Flux Google Shopping : titre « ${name} », type « ${cap((input.collection ? singularize(input.collection) : name.split(/\s+/)[0]) || name)} », description factuelle (matériau, dimensions, usage).`,
  };
}

function buildLongDescription(
  name: string,
  benefits: string[],
  features: string[],
  input: ProductSeoInput
): string {
  const b = benefits.length ? benefits : ["Conçu pour durer", "Confortable à l'usage", "Design soigné"];
  const f = features.length ? features : ["Matériaux sélectionnés", "Finitions soignées"];
  return `<div class="product-description">
  <h2>Pourquoi choisir ${name} ?</h2>
  <p>${name} a été pensé ${input.audience ? `pour ${input.audience}` : "pour un usage au quotidien"}. ${
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
  <p>Profitez d'une livraison soignée et d'un paiement 100% sécurisé.</p>
</div>`;
}

// ── Import Factory : générateurs additionnels (purs, niche/scan-aware) ──────────
// Utilisables côté client (aucune dépendance serveur). Pas de superlatif forcé.

export interface CollectionSeoResult {
  title: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  descriptionHtml: string;
  outline: string[];
  faq: { q: string; a: string }[];
  primaryKeywords: string[];
  longTailKeywords: string[];
  internalLinks: string[];
  productLinks: string[];
  cta: string;
  where: string;
}

export function generateCollectionSeo(input: {
  collection: string; niche?: string; brandName?: string; positioning?: string; keywords?: string; others?: string[];
}): CollectionSeoResult {
  const key = detectNiche(`${input.niche ?? ""} ${input.brandName ?? ""}`);
  const vocab = nicheVocab(key);
  const coll = input.collection || "Collection";
  const sing = singularize(coll);
  const ctx = { brandName: input.brandName, positioning: input.positioning } as CouncilContext;
  const faqs = vocab.faqs(coll);
  const hints = vocab.descHints.split(",").slice(0, 3).map((s) => s.trim());
  const kwInput = (input.keywords || "").split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
  const primary = kwInput.length ? kwInput.slice(0, 3) : [sing, `acheter ${sing}`, `${sing} ${vocab.pieces[0]}`];
  const others = (input.others ?? []).filter((c) => c !== coll).slice(0, 3);
  const pieces3 = vocab.pieces.slice(0, 3);
  const descriptionHtml = `<h2>Comment choisir ${articled(sing)} ?</h2>
<p>Découvrez notre sélection de ${coll.toLowerCase()}, ${nicheBenefit(key)}. Pour bien choisir, comparez ${hints.join(", ")} afin de trouver le modèle adapté à votre usage et à votre budget.</p>
<p>Chaque modèle de la collection « ${coll} » répond à un besoin précis (${pieces3.join(", ")}). Que vous cherchiez ${pieces3[0] || "un usage quotidien"} ou ${pieces3[1] || "une utilisation occasionnelle"}, vous trouverez une option pensée pour durer.</p>
<h2>Nos conseils pour bien choisir</h2>
<ul>${hints.map((h) => `<li><strong>${cap(h)}</strong> : un critère à comparer avant l'achat.</li>`).join("")}</ul>
<h2>Pourquoi commander chez nous</h2>
<p>Livraison soignée et suivie, politique de retour claire et conseils avant achat : nous vous accompagnons pour faire le bon choix sans mauvaise surprise.</p>`;
  return {
    title: titleFor(coll, ctx),
    metaTitle: titleFor(coll, ctx),
    metaDescription: metaFor(coll, key),
    h1: coll,
    descriptionHtml,
    outline: [`H1 : ${coll}`, `H2 : Comment choisir ${articled(sing)}`, "H2 : Nos conseils pour bien choisir", "H2 : Nos best-sellers", "H2 : Pourquoi commander chez nous", "H2 : Questions fréquentes"],
    faq: [
      { q: faqs[0] || `Comment choisir ${articled(sing)} ?`, a: `Cela dépend de ${hints.join(", ")}. Comparez ces critères selon votre usage.` },
      { q: faqs[1] || `Quel ${sing} pour quel usage ?`, a: `Selon votre usage (${vocab.pieces.slice(0, 2).join(", ")}), un modèle sera plus adapté qu'un autre.` },
      { q: faqs[2] || `Quel budget prévoir pour ${articled(sing)} ?`, a: "Le prix varie selon les matériaux, les dimensions et les finitions. Plusieurs gammes sont proposées pour s'adapter à votre budget." },
      { q: faqs[3] || `Comment entretenir ${articled(sing)} ?`, a: "Un entretien régulier et adapté au matériau prolonge la durée de vie du produit. Les conseils figurent sur chaque fiche." },
      { q: "Quels sont les délais de livraison et la garantie ?", a: "Livraison soignée et suivie, avec une politique de retour claire et une garantie selon le produit." },
    ],
    primaryKeywords: primary,
    longTailKeywords: [`quel ${sing} choisir`, `${sing} ${vocab.pieces[0]}`, `${sing} ${vocab.pieces[1] || vocab.pieces[0]}`],
    internalLinks: others.length ? others.map((c) => `Vers « ${c} » (ancre « ${singularize(c)} ${vocab.pieces[0]} »)`) : ["Vers vos collections complémentaires"],
    productLinks: [
      `Mettez en avant 3–4 best-sellers de « ${coll} » en haut de page`,
      "Liez les nouveautés de la collection",
      `Lien croisé vers ${others[0] ? "« " + others[0] + " »" : "une collection complémentaire"}`,
    ],
    cta: `« Voir nos ${coll.toLowerCase()} »`,
    where: "Shopify → Produits → Collections → Collection concernée → Description",
  };
}

export interface MetaVariant { title: string; metaDescription: string; titleLen: number; metaLen: number; angle: string; why: string; gmcRisk: "faible" | "moyen"; }

export function generateMetaVariants(input: {
  subject: string; type: "produit" | "collection" | "accueil"; niche?: string; brandName?: string; keywords?: string;
}): MetaVariant[] {
  const key = detectNiche(`${input.niche ?? ""} ${input.brandName ?? ""}`);
  const brand = input.brandName || "";
  const s = (input.subject || (input.type === "accueil" ? input.niche || "Boutique" : "Page")).trim();
  const cap1 = cap(s);
  const kw = (input.keywords || "").split(/[,\n]/).map((x) => x.trim()).filter(Boolean)[0];
  const benefit = nicheBenefit(key);
  const suffix = brand ? ` | ${brand}` : "";
  const raw: { title: string; metaDescription: string; angle: string; why: string; gmcRisk: "faible" | "moyen" }[] = [
    { title: `${cap1}${suffix}`, metaDescription: `Découvrez ${s.toLowerCase()}, ${benefit}. Conseils pour bien choisir et livraison soignée.`, angle: "SEO naturel", why: "Descriptive, mot-clé en tête de title.", gmcRisk: "faible" },
    { title: kw ? `${cap(kw)}${suffix}` : `${cap1}${suffix}`, metaDescription: `${cap1} : ${benefit}. Livraison soignée et paiement sécurisé.`, angle: "Conversion", why: "Met en avant le bénéfice et la réassurance.", gmcRisk: "moyen" },
    { title: `${cap1} en ligne${suffix}`.length <= 60 ? `${cap1} en ligne${suffix}` : `${cap1}${suffix}`, metaDescription: `${cap1} : sélection, caractéristiques et conseils. Livraison et retours clairs.`, angle: "Sobre / Merchant-friendly", why: "Factuelle, sans superlatif — adaptée Google Merchant.", gmcRisk: "faible" },
  ];
  return raw.map((v) => {
    const title = v.title.slice(0, 60);
    const md = v.metaDescription.slice(0, 155);
    return { title, metaDescription: md, titleLen: title.length, metaLen: md.length, angle: v.angle, why: v.why, gmcRisk: v.gmcRisk };
  });
}

export interface AltTextItem { alt: string; type: string; keyword: string; }

export function generateAltTexts(input: { subject: string; niche?: string; count?: number }): AltTextItem[] {
  const key = detectNiche(input.niche ?? "");
  const vocab = nicheVocab(key);
  const s = (input.subject || "produit").trim();
  const k = singularize(s.split(" ").slice(0, 3).join(" "));
  const items: AltTextItem[] = [
    { alt: `${s} vue de face`, type: "Photo principale (packshot)", keyword: k },
    { alt: `${s} en situation (${vocab.pieces[0]})`, type: "Mise en situation", keyword: `${k} ${vocab.pieces[0]}` },
    { alt: `Détail et finitions de ${s.toLowerCase()}`, type: "Gros plan / détail", keyword: `${k} détail` },
    { alt: `${s} — ${vocab.pieces[1] || vocab.pieces[0]}`, type: "Variante / contexte", keyword: `${k} ${vocab.pieces[1] || vocab.pieces[0]}` },
    { alt: `${s} : dimensions`, type: "Schéma / dimensions", keyword: `${k} dimensions` },
  ];
  return items.slice(0, Math.max(3, Math.min(5, input.count ?? 5)));
}

export interface BlogOutlineResult {
  title: string; metaTitle: string; metaDescription: string; keyword: string; secondaryKeywords: string[];
  intent: string; angle: string; priority: string; why: string;
  intro: string; outline: string[]; faq: { q: string; a: string }[]; internalLink: string; cta: string;
}

export function generateBlogOutline(input: {
  topic?: string; collection?: string; niche?: string; brandName?: string; keywords?: string;
}): BlogOutlineResult {
  const key = detectNiche(`${input.niche ?? ""} ${input.brandName ?? ""}`);
  const vocab = nicheVocab(key);
  const coll = input.collection || "votre collection";
  const sing = singularize(coll);
  const kw = (input.keywords || "").split(/[,\n]/).map((s) => s.trim()).filter(Boolean)[0] || `quel ${sing} choisir`;
  const title = input.topic?.trim() || `Comment choisir ${articled(sing)} pour ${vocab.pieces[0]} ?`;
  const faqs = vocab.faqs(coll);
  const hints = vocab.descHints.split(",").slice(0, 3).map((s) => s.trim());
  return {
    title,
    metaTitle: title.slice(0, 60),
    metaDescription: `${title} Nos conseils pour bien choisir, comparer et acheter.`.slice(0, 155),
    keyword: kw,
    secondaryKeywords: [`${sing} ${vocab.pieces[0]}`, `comment choisir ${sing}`, `${sing} avis`],
    intent: "guide d'achat (informationnel → transactionnel)",
    angle: `Guide pédagogique qui pousse la collection « ${coll} ».`,
    priority: "Haute (intention proche de l'achat)",
    why: `Capte la longue traîne « ${kw} » et redirige le lecteur vers la collection « ${coll} ».`,
    intro: `Vous hésitez sur ${articled(sing)} ? Ce guide aide à choisir selon ${hints.slice(0, 2).join(", ")}.`,
    outline: [
      `H2 : Pourquoi bien choisir ${articled(sing)} ?`,
      `H2 : Les critères qui comptent (${hints.join(", ")})`,
      "H2 : Notre sélection recommandée",
      "H2 : Questions fréquentes",
    ],
    faq: [
      { q: faqs[0], a: "Réponse courte orientée bénéfice, puis lien vers la collection." },
      { q: faqs[1], a: "Réponse pédagogique avec un exemple concret." },
    ],
    internalLink: `Maillage : lien vers la collection « ${coll} » (ancre « ${sing} ${vocab.pieces[0]} »).`,
    cta: `« Découvrir la collection ${coll} »`,
  };
}

// ── Section Builder ───────────────────────────────────────────────────────

export interface SectionInput {
  type: string;
  goal?: string;
  page?: string; // home | produit | collection | blog | page
  style?: string; // premium | minimal | apple | luxe | éditorial | conversion | glassmorphism
  tone?: string;
  colors?: string;
  content?: string;
  animation?: string; // aucune | fade-in | slide-up | accordéon | hover | reveal | sticky
  animations?: boolean; // compat
  complexity?: "simple" | "avancé" | "ultra premium" | "standard";
  mobilePriority?: boolean;
  needsSettings?: boolean;
  allowJs?: boolean;
  noJsVersion?: boolean;
  collection?: string;
  product?: string;
  niche?: string;
  brandName?: string;
  pieces?: string[];
}

/** Clé interne de type de section. */
function sectionKey(type: string): string {
  const t = (type || "").toLowerCase();
  if (/faq/.test(t)) return "faq";
  if (/comparat|comparaison/.test(t)) return "comparison";
  if (/bénéfice|benefice|avantage/.test(t)) return "benefits";
  if (/storytelling|histoire|à propos/.test(t)) return "storytelling";
  if (/avis|témoign|temoign|review/.test(t)) return "reviews";
  if (/taille|guide des tailles|sizing/.test(t)) return "sizeguide";
  if (/avant.?apr|avant\/apr/.test(t)) return "beforeafter";
  if (/réassur|reassur|confiance/.test(t)) return "reassurance";
  if (/sticky|add.?to.?cart|panier/.test(t)) return "sticky";
  if (/image.*texte|texte.*image|split/.test(t)) return "imagetext";
  if (/collection/.test(t)) return "collection";
  return "hero";
}

interface SecCtx {
  id: string;
  accent: string;
  anim: boolean;
  niche: string;
  pieces: string[];
  brand: string;
}

export function generateSection(input: SectionInput): SectionResult {
  const type = input.type || "Hero premium";
  const key = sectionKey(type);
  const accent = (input.colors && /^#?[0-9a-f]{3,8}$/i.test(input.colors.trim()) ? input.colors.trim() : input.colors) || "#6d5ef2";
  const id = slugify(type) || "section";
  const anim = input.animation ? input.animation !== "aucune" : input.animations !== false;
  const niche = input.niche || "votre boutique";
  const pieces = input.pieces?.length ? input.pieces : ["salon", "chambre", "cuisine"];
  const sc: SecCtx = { id, accent: accent.startsWith("#") ? accent : `#${accent}`, anim, niche, pieces, brand: input.brandName || "votre marque" };

  const built = buildSection(key, sc, input);
  const complexity = input.complexity || "avancé";

  // ── Vérification qualité avant affichage ──
  const warnings: string[] = [];
  if (!built.liquid.includes("{% schema %}") && !built.schema.includes("{% schema %}")) warnings.push("Schema manquant.");
  if (!/\.ork-/.test(built.css)) warnings.push("Classes CSS non préfixées détectées.");
  if (built.needsJs && !built.js.trim()) warnings.push("JS attendu mais absent.");
  try {
    const json = built.schema.replace(/{%\s*schema\s*%}/, "").replace(/{%\s*endschema\s*%}/, "").trim();
    JSON.parse(json);
  } catch {
    warnings.push("Le schema JSON pourrait être invalide — vérifiez avant publication.");
  }

  const summary = `**Objectif** : ${input.goal || sectionPurpose(key)}.
**Emplacement recommandé** : ${sectionPlacement(key, input.page)}.
**Pourquoi** : ${sectionWhy(key)}.
**Données utilisées** : niche « ${niche} »${input.collection ? `, collection « ${input.collection} »` : ""}${input.product ? `, produit « ${input.product} »` : ""}, ton ${input.tone || "premium"}, style ${input.style || "premium"}.`;

  return {
    summary,
    liquid: built.liquid,
    css: built.css,
    js: built.js || "// Aucun JavaScript nécessaire pour cette section.",
    schema: built.schema,
    installSteps: [
      `Admin Shopify → Boutique en ligne → Thèmes → ⋯ → Modifier le code.`,
      `Sections → Ajouter un fichier → nommez-le « ${id}.liquid ».`,
      `Collez le code Liquid + le bloc {% schema %} ci-dessous dans ce fichier.`,
      built.needsJs
        ? `Le CSS et le JS sont inclus dans le fichier (balises <style>/<script>) — aucun asset externe à ajouter.`
        : `Le CSS est inclus dans le fichier (balise <style>) — aucun asset externe à ajouter.`,
      `Enregistrez, puis ajoutez la section via Personnaliser et réglez les options dans le customizer.`,
      `Checklist avant publication : aperçu mobile, contenu réel, contraste, liens des CTA.`,
    ],
    responsiveChecklist: [
      { label: "Desktop : grille/hiérarchie propre", ok: true },
      { label: "Mobile : layout repensé (pas juste réduit)", ok: true },
      { label: "Images : ratio fixe, pas de saut de mise en page", ok: true },
      { label: "CTA : cible tactile ≥ 44px", ok: true },
      { label: "Spacing : clamp() fluide", ok: true },
      { label: "Accessibilité : contraste + focus visibles", ok: true },
      { label: "Vitesse : aucune librairie externe", ok: true },
    ],
    warnings,
    complexity,
  };
}

function sectionPurpose(key: string): string {
  const m: Record<string, string> = {
    hero: "capter l'attention et orienter vers l'action principale",
    faq: "lever les objections et capter les rich snippets FAQ",
    comparison: "aider à choisir et justifier le prix (conversion)",
    benefits: "résumer les bénéfices clés en un coup d'œil",
    storytelling: "incarner la marque et créer du lien émotionnel",
    reviews: "renforcer la preuve sociale et la confiance",
    sizeguide: "réduire les hésitations et les retours",
    beforeafter: "démontrer le résultat de façon visuelle",
    reassurance: "rassurer immédiatement (livraison, retours, paiement)",
    sticky: "garder le bouton d'achat toujours accessible (conversion mobile)",
    imagetext: "présenter un argument fort avec un visuel",
    collection: "mettre en avant une collection et son contenu SEO",
  };
  return m[key] || "améliorer l'expérience et la conversion";
}
function sectionPlacement(key: string, page?: string): string {
  const m: Record<string, string> = {
    hero: "tout en haut de la page d'accueil",
    faq: "bas de page produit et bas de page collection",
    comparison: "page produit, sous la description",
    benefits: "page d'accueil et page produit, au-dessus de la ligne de flottaison",
    storytelling: "page d'accueil (milieu) ou page À propos",
    reviews: "page d'accueil et page produit",
    sizeguide: "page produit (onglet ou sous le sélecteur)",
    beforeafter: "page produit ou page d'accueil",
    reassurance: "juste sous le hero (home) et sous le prix (produit)",
    sticky: "page produit (barre flottante mobile + desktop)",
    imagetext: "page d'accueil ou page produit",
    collection: "page d'accueil ou haut de page collection",
  };
  return page ? `${m[key] || "selon votre besoin"} (page ${page})` : m[key] || "selon votre besoin";
}
function sectionWhy(key: string): string {
  const m: Record<string, string> = {
    faq: "répond aux questions fréquentes → moins d'abandons + SEO (FAQ schema).",
    reassurance: "les signaux de confiance augmentent le taux de conversion, surtout sur mobile.",
    reviews: "la preuve sociale est l'un des leviers de conversion les plus forts.",
    sticky: "l'accès permanent au CTA d'achat améliore nettement la conversion mobile.",
    comparison: "clarifier les différences réduit l'hésitation et justifie le prix.",
  };
  return m[key] || "structure premium + responsive soigné = meilleure conversion et image de marque.";
}

interface BuiltSection { liquid: string; css: string; js: string; schema: string; needsJs: boolean }

function buildSection(key: string, c: SecCtx, input: SectionInput): BuiltSection {
  switch (key) {
    case "faq": return buildFaq(c);
    case "reassurance": return buildReassurance(c);
    case "benefits": return buildBenefits(c);
    case "imagetext": return buildImageText(c);
    case "reviews": return buildReviews(c);
    case "comparison": return buildComparison(c);
    case "collection": return buildCollection(c, input);
    case "storytelling": return buildStorytelling(c);
    case "sticky": return buildSticky(c, input);
    case "sizeguide": return buildSizeGuide(c);
    case "beforeafter": return buildBeforeAfter(c, input);
    default: return buildHero(c);
  }
}

// Base CSS commune (namespacée).
function baseCss(id: string, accent: string): string {
  return `.ork-${id}{--ork-accent:{{ section.settings.accent_color | default: '${accent}' }};--ork-radius:16px;padding:clamp(40px,7vw,88px) 20px;color:#1a1a1a;}
.ork-${id} *{box-sizing:border-box;}
.ork-${id} .ork-wrap{max-width:1120px;margin:0 auto;}
.ork-${id} .ork-eyebrow{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--ork-accent);font-weight:600;}
.ork-${id} .ork-h{font-size:clamp(26px,4vw,42px);line-height:1.12;font-weight:700;margin:.3em 0;}
.ork-${id} .ork-sub{font-size:clamp(15px,2vw,18px);color:#555;max-width:60ch;}
.ork-${id} .ork-cta{display:inline-flex;align-items:center;gap:8px;min-height:46px;padding:13px 26px;border-radius:999px;background:var(--ork-accent);color:#fff;font-weight:600;text-decoration:none;transition:transform .2s ease,box-shadow .2s ease;}
.ork-${id} .ork-cta:hover{transform:translateY(-2px);box-shadow:0 10px 30px -10px var(--ork-accent);}
@media (prefers-reduced-motion:reduce){.ork-${id} *{animation:none!important;transition:none!important;}}`;
}
function fadeCss(id: string, anim: boolean): string {
  return anim
    ? `\n.ork-${id} [data-ork-reveal]{opacity:0;transform:translateY(18px);transition:opacity .6s ease,transform .6s ease;}
.ork-${id} [data-ork-reveal].is-in{opacity:1;transform:none;}`
    : "";
}
function revealJs(id: string, anim: boolean): string {
  if (!anim) return "";
  return `(function(){
  var els=document.querySelectorAll('.ork-${id} [data-ork-reveal]');
  if(!('IntersectionObserver' in window)){els.forEach(function(e){e.classList.add('is-in');});return;}
  var io=new IntersectionObserver(function(ent){ent.forEach(function(e){if(e.isIntersecting){e.target.classList.add('is-in');io.unobserve(e.target);}});},{threshold:.15});
  els.forEach(function(e){io.observe(e);});
})();`;
}

function buildHero(c: SecCtx): BuiltSection {
  const id = c.id;
  const liquid = `{% comment %} Orkestra — Hero premium (Online Store 2.0) {% endcomment %}
<section class="ork-${id}" data-section-id="{{ section.id }}">
  <div class="ork-wrap ork-${id}__grid">
    <div class="ork-${id}__content" data-ork-reveal>
      {% if section.settings.eyebrow != blank %}<span class="ork-eyebrow">{{ section.settings.eyebrow }}</span>{% endif %}
      <h2 class="ork-h">{{ section.settings.heading | default: 'Un titre fort et clair' }}</h2>
      {% if section.settings.subheading != blank %}<p class="ork-sub">{{ section.settings.subheading }}</p>{% endif %}
      <div class="ork-${id}__cta-row">
        {% if section.settings.button_label != blank %}<a class="ork-cta" href="{{ section.settings.button_link }}">{{ section.settings.button_label }}</a>{% endif %}
        {% if section.settings.button2_label != blank %}<a class="ork-${id}__cta2" href="{{ section.settings.button2_link }}">{{ section.settings.button2_label }}</a>{% endif %}
      </div>
      {% if section.blocks.size > 0 %}
      <ul class="ork-${id}__badges">
        {% for block in section.blocks %}<li {{ block.shopify_attributes }}>{{ block.settings.label }}</li>{% endfor %}
      </ul>
      {% endif %}
    </div>
    <div class="ork-${id}__media" data-ork-reveal>
      {% if section.settings.image != blank %}
        <img src="{{ section.settings.image | image_url: width: 1200 }}" alt="{{ section.settings.image.alt | escape }}" width="600" height="600" loading="lazy">
      {% else %}
        <div class="ork-${id}__ph" role="img" aria-label="Emplacement visuel"></div>
      {% endif %}
    </div>
  </div>
</section>`;
  const css = `${baseCss(id, c.accent)}
.ork-${id}__grid{display:grid;grid-template-columns:1.05fr .95fr;gap:clamp(24px,4vw,56px);align-items:center;}
.ork-${id}__cta-row{display:flex;flex-wrap:wrap;gap:12px;margin-top:24px;}
.ork-${id}__cta2{display:inline-flex;align-items:center;min-height:46px;padding:13px 22px;border-radius:999px;border:1px solid #e3e3e8;color:#1a1a1a;text-decoration:none;font-weight:600;}
.ork-${id}__badges{list-style:none;display:flex;flex-wrap:wrap;gap:10px 20px;padding:0;margin:26px 0 0;font-size:14px;color:#444;}
.ork-${id}__badges li{display:flex;align-items:center;gap:6px;}
.ork-${id}__badges li::before{content:'✓';color:var(--ork-accent);font-weight:700;}
.ork-${id}__media img,.ork-${id}__ph{width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:var(--ork-radius);box-shadow:0 24px 60px -24px rgba(16,24,40,.25);}
.ork-${id}__ph{background:linear-gradient(135deg,var(--ork-accent),#0000), #f1f1f5;}
@media (max-width:860px){.ork-${id}__grid{grid-template-columns:1fr;}.ork-${id}__media{order:-1;}}${fadeCss(id, c.anim)}`;
  const schema = `{% schema %}
{
  "name": "Hero premium",
  "tag": "section",
  "settings": [
    { "type": "text", "id": "eyebrow", "label": "Sur-titre" },
    { "type": "text", "id": "heading", "label": "Titre", "default": "Un titre fort et clair" },
    { "type": "textarea", "id": "subheading", "label": "Sous-titre" },
    { "type": "image_picker", "id": "image", "label": "Visuel" },
    { "type": "color", "id": "accent_color", "label": "Couleur d'accent", "default": "${c.accent}" },
    { "type": "text", "id": "button_label", "label": "CTA principal", "default": "Découvrir" },
    { "type": "url", "id": "button_link", "label": "Lien CTA principal" },
    { "type": "text", "id": "button2_label", "label": "CTA secondaire" },
    { "type": "url", "id": "button2_link", "label": "Lien CTA secondaire" }
  ],
  "blocks": [
    { "type": "badge", "name": "Badge réassurance", "settings": [ { "type": "text", "id": "label", "label": "Texte", "default": "Livraison gratuite" } ] }
  ],
  "max_blocks": 4,
  "presets": [{ "name": "Hero premium", "blocks": [ { "type": "badge" }, { "type": "badge" } ] }]
}
{% endschema %}`;
  return { liquid, css, js: revealJs(id, c.anim), schema, needsJs: c.anim };
}

function buildFaq(c: SecCtx): BuiltSection {
  const id = c.id;
  // Accordéon natif <details>/<summary> → accessible et SANS JS.
  const liquid = `{% comment %} Orkestra — FAQ (accordéon natif, sans JS) {% endcomment %}
<section class="ork-${id}">
  <div class="ork-wrap">
    <div class="ork-${id}__head" data-ork-reveal>
      {% if section.settings.eyebrow != blank %}<span class="ork-eyebrow">{{ section.settings.eyebrow }}</span>{% endif %}
      <h2 class="ork-h">{{ section.settings.heading | default: 'Questions fréquentes' }}</h2>
    </div>
    <div class="ork-${id}__list">
      {% for block in section.blocks %}
      <details class="ork-${id}__item" {% if forloop.first and section.settings.open_first %}open{% endif %} {{ block.shopify_attributes }}>
        <summary class="ork-${id}__q">{{ block.settings.question | default: 'Votre question ?' }}<span class="ork-${id}__icon" aria-hidden="true"></span></summary>
        <div class="ork-${id}__a">{{ block.settings.answer }}</div>
      </details>
      {% endfor %}
    </div>
  </div>
</section>`;
  const css = `${baseCss(id, c.accent)}
.ork-${id}__head{text-align:center;margin-bottom:clamp(20px,3vw,36px);}
.ork-${id}__list{max-width:760px;margin:0 auto;display:flex;flex-direction:column;gap:12px;}
.ork-${id}__item{border:1px solid #ececf1;border-radius:var(--ork-radius);background:#fff;overflow:hidden;}
.ork-${id}__q{cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:18px 20px;font-weight:600;font-size:16px;}
.ork-${id}__q::-webkit-details-marker{display:none;}
.ork-${id}__icon{position:relative;width:14px;height:14px;flex:none;}
.ork-${id}__icon::before,.ork-${id}__icon::after{content:'';position:absolute;background:var(--ork-accent);border-radius:2px;transition:transform .25s ease;}
.ork-${id}__icon::before{top:6px;left:0;width:14px;height:2px;}
.ork-${id}__icon::after{top:0;left:6px;width:2px;height:14px;}
.ork-${id}__item[open] .ork-${id}__icon::after{transform:scaleY(0);}
.ork-${id}__a{padding:0 20px 18px;color:#555;line-height:1.6;}
.ork-${id}__item[open]{border-color:var(--ork-accent);box-shadow:0 12px 30px -18px rgba(16,24,40,.2);}${fadeCss(id, c.anim)}`;
  const schema = `{% schema %}
{
  "name": "FAQ",
  "tag": "section",
  "settings": [
    { "type": "text", "id": "eyebrow", "label": "Sur-titre" },
    { "type": "text", "id": "heading", "label": "Titre", "default": "Questions fréquentes" },
    { "type": "color", "id": "accent_color", "label": "Couleur d'accent", "default": "${c.accent}" },
    { "type": "checkbox", "id": "open_first", "label": "Ouvrir la 1re question", "default": true }
  ],
  "blocks": [
    { "type": "qa", "name": "Question", "settings": [
      { "type": "text", "id": "question", "label": "Question", "default": "${c.niche.includes("lumi") ? "À quelle hauteur installer ma suspension ?" : "Votre question ?"}" },
      { "type": "richtext", "id": "answer", "label": "Réponse", "default": "<p>Votre réponse claire et rassurante.</p>" }
    ] }
  ],
  "max_blocks": 12,
  "presets": [{ "name": "FAQ", "blocks": [ { "type": "qa" }, { "type": "qa" }, { "type": "qa" } ] }]
}
{% endschema %}`;
  return { liquid, css, js: "", schema, needsJs: false };
}

function buildReassurance(c: SecCtx): BuiltSection {
  const id = c.id;
  const liquid = `{% comment %} Orkestra — Bloc réassurance {% endcomment %}
<section class="ork-${id}">
  <div class="ork-wrap ork-${id}__grid">
    {% for block in section.blocks %}
    <div class="ork-${id}__item" data-ork-reveal {{ block.shopify_attributes }}>
      {% if block.settings.icon != blank %}<img class="ork-${id}__ic" src="{{ block.settings.icon | image_url: width: 96 }}" alt="" width="40" height="40" loading="lazy">{% else %}<span class="ork-${id}__ic ork-${id}__ic--ph" aria-hidden="true">★</span>{% endif %}
      <div><p class="ork-${id}__t">{{ block.settings.title | default: 'Avantage' }}</p>{% if block.settings.text != blank %}<p class="ork-${id}__d">{{ block.settings.text }}</p>{% endif %}</div>
    </div>
    {% endfor %}
  </div>
</section>`;
  const css = `${baseCss(id, c.accent)}
.ork-${id}{padding-block:clamp(28px,4vw,48px);}
.ork-${id}__grid{display:grid;grid-template-columns:repeat(4,1fr);gap:clamp(14px,2vw,24px);}
.ork-${id}__item{display:flex;gap:12px;align-items:center;padding:16px;border:1px solid #ececf1;border-radius:var(--ork-radius);background:#fff;}
.ork-${id}__ic{width:40px;height:40px;display:grid;place-items:center;border-radius:10px;background:color-mix(in srgb,var(--ork-accent) 12%,#fff);color:var(--ork-accent);}
.ork-${id}__t{font-weight:600;margin:0;}
.ork-${id}__d{margin:2px 0 0;color:#666;font-size:14px;}
@media (max-width:860px){.ork-${id}__grid{grid-template-columns:repeat(2,1fr);}}
@media (max-width:480px){.ork-${id}__grid{grid-template-columns:1fr;}}${fadeCss(id, c.anim)}`;
  const schema = `{% schema %}
{
  "name": "Réassurance",
  "tag": "section",
  "settings": [ { "type": "color", "id": "accent_color", "label": "Couleur d'accent", "default": "${c.accent}" } ],
  "blocks": [
    { "type": "item", "name": "Atout", "settings": [
      { "type": "image_picker", "id": "icon", "label": "Icône (optionnel)" },
      { "type": "text", "id": "title", "label": "Titre", "default": "Livraison gratuite" },
      { "type": "text", "id": "text", "label": "Texte", "default": "Dès 49€ d'achat" }
    ] }
  ],
  "max_blocks": 6,
  "presets": [{ "name": "Réassurance", "blocks": [ { "type": "item" }, { "type": "item" }, { "type": "item" }, { "type": "item" } ] }]
}
{% endschema %}`;
  return { liquid, css, js: "", schema, needsJs: false };
}

function buildBenefits(c: SecCtx): BuiltSection {
  const id = c.id;
  const liquid = `{% comment %} Orkestra — Section bénéfices {% endcomment %}
<section class="ork-${id}">
  <div class="ork-wrap">
    <div class="ork-${id}__head" data-ork-reveal>
      {% if section.settings.eyebrow != blank %}<span class="ork-eyebrow">{{ section.settings.eyebrow }}</span>{% endif %}
      <h2 class="ork-h">{{ section.settings.heading | default: 'Pourquoi nous choisir' }}</h2>
    </div>
    <div class="ork-${id}__grid">
      {% for block in section.blocks %}
      <article class="ork-${id}__card" data-ork-reveal {{ block.shopify_attributes }}>
        <span class="ork-${id}__ic" aria-hidden="true">{{ block.settings.emoji | default: '✦' }}</span>
        <h3 class="ork-${id}__t">{{ block.settings.title | default: 'Bénéfice' }}</h3>
        <p class="ork-${id}__d">{{ block.settings.text }}</p>
      </article>
      {% endfor %}
    </div>
  </div>
</section>`;
  const css = `${baseCss(id, c.accent)}
.ork-${id}__head{text-align:center;margin-bottom:clamp(24px,3vw,40px);}
.ork-${id}__head .ork-h{margin-inline:auto;}
.ork-${id}__grid{display:grid;grid-template-columns:repeat(3,1fr);gap:clamp(16px,2vw,24px);}
.ork-${id}__card{padding:26px;border:1px solid #ececf1;border-radius:var(--ork-radius);background:#fff;transition:transform .2s ease,box-shadow .2s ease;}
.ork-${id}__card:hover{transform:translateY(-4px);box-shadow:0 18px 40px -22px rgba(16,24,40,.25);}
.ork-${id}__ic{display:grid;place-items:center;width:46px;height:46px;border-radius:12px;font-size:20px;background:color-mix(in srgb,var(--ork-accent) 12%,#fff);}
.ork-${id}__t{font-size:18px;margin:16px 0 6px;}
.ork-${id}__d{color:#666;line-height:1.55;margin:0;}
@media (max-width:860px){.ork-${id}__grid{grid-template-columns:1fr;}}${fadeCss(id, c.anim)}`;
  const schema = `{% schema %}
{
  "name": "Bénéfices",
  "tag": "section",
  "settings": [
    { "type": "text", "id": "eyebrow", "label": "Sur-titre" },
    { "type": "text", "id": "heading", "label": "Titre", "default": "Pourquoi nous choisir" },
    { "type": "color", "id": "accent_color", "label": "Couleur d'accent", "default": "${c.accent}" }
  ],
  "blocks": [
    { "type": "benefit", "name": "Bénéfice", "settings": [
      { "type": "text", "id": "emoji", "label": "Icône (emoji)", "default": "✦" },
      { "type": "text", "id": "title", "label": "Titre", "default": "Qualité durable" },
      { "type": "textarea", "id": "text", "label": "Texte", "default": "Des matériaux sélectionnés pour durer." }
    ] }
  ],
  "max_blocks": 6,
  "presets": [{ "name": "Bénéfices", "blocks": [ { "type": "benefit" }, { "type": "benefit" }, { "type": "benefit" } ] }]
}
{% endschema %}`;
  return { liquid, css, js: revealJs(id, c.anim), schema, needsJs: c.anim };
}

function buildImageText(c: SecCtx): BuiltSection {
  const id = c.id;
  const liquid = `{% comment %} Orkestra — Image + texte {% endcomment %}
<section class="ork-${id} ork-${id}--{{ section.settings.image_position }}">
  <div class="ork-wrap ork-${id}__grid">
    <div class="ork-${id}__media" data-ork-reveal>
      {% if section.settings.image != blank %}<img src="{{ section.settings.image | image_url: width: 1000 }}" alt="{{ section.settings.image.alt | escape }}" width="560" height="460" loading="lazy">{% else %}<div class="ork-${id}__ph" role="img" aria-label="Visuel"></div>{% endif %}
    </div>
    <div class="ork-${id}__content" data-ork-reveal>
      {% if section.settings.eyebrow != blank %}<span class="ork-eyebrow">{{ section.settings.eyebrow }}</span>{% endif %}
      <h2 class="ork-h">{{ section.settings.heading | default: 'Un argument fort' }}</h2>
      {% if section.settings.text != blank %}<div class="ork-sub">{{ section.settings.text }}</div>{% endif %}
      {% if section.blocks.size > 0 %}<ul class="ork-${id}__points">{% for block in section.blocks %}<li {{ block.shopify_attributes }}>{{ block.settings.label }}</li>{% endfor %}</ul>{% endif %}
      {% if section.settings.button_label != blank %}<a class="ork-cta" href="{{ section.settings.button_link }}">{{ section.settings.button_label }}</a>{% endif %}
    </div>
  </div>
</section>`;
  const css = `${baseCss(id, c.accent)}
.ork-${id}__grid{display:grid;grid-template-columns:1fr 1fr;gap:clamp(24px,4vw,56px);align-items:center;}
.ork-${id}--right .ork-${id}__media{order:2;}
.ork-${id}__media img,.ork-${id}__ph{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:var(--ork-radius);box-shadow:0 24px 60px -28px rgba(16,24,40,.3);}
.ork-${id}__ph{background:#f1f1f5;}
.ork-${id}__points{list-style:none;padding:0;margin:18px 0;display:grid;gap:10px;}
.ork-${id}__points li{display:flex;gap:10px;align-items:flex-start;color:#444;}
.ork-${id}__points li::before{content:'✓';color:var(--ork-accent);font-weight:700;}
.ork-${id} .ork-cta{margin-top:8px;}
@media (max-width:860px){.ork-${id}__grid{grid-template-columns:1fr;}.ork-${id}--right .ork-${id}__media{order:-1;}}${fadeCss(id, c.anim)}`;
  const schema = `{% schema %}
{
  "name": "Image + texte",
  "tag": "section",
  "settings": [
    { "type": "select", "id": "image_position", "label": "Position image", "default": "left", "options": [ { "value": "left", "label": "Gauche" }, { "value": "right", "label": "Droite" } ] },
    { "type": "image_picker", "id": "image", "label": "Image" },
    { "type": "text", "id": "eyebrow", "label": "Sur-titre" },
    { "type": "text", "id": "heading", "label": "Titre", "default": "Un argument fort" },
    { "type": "richtext", "id": "text", "label": "Texte", "default": "<p>Décrivez ici votre promesse.</p>" },
    { "type": "color", "id": "accent_color", "label": "Couleur d'accent", "default": "${c.accent}" },
    { "type": "text", "id": "button_label", "label": "CTA" },
    { "type": "url", "id": "button_link", "label": "Lien CTA" }
  ],
  "blocks": [ { "type": "point", "name": "Point clé", "settings": [ { "type": "text", "id": "label", "label": "Texte", "default": "Un point clé" } ] } ],
  "max_blocks": 5,
  "presets": [{ "name": "Image + texte", "blocks": [ { "type": "point" }, { "type": "point" }, { "type": "point" } ] }]
}
{% endschema %}`;
  return { liquid, css, js: revealJs(id, c.anim), schema, needsJs: c.anim };
}

function buildReviews(c: SecCtx): BuiltSection {
  const id = c.id;
  const liquid = `{% comment %} Orkestra — Avis clients (grille, sans JS) {% endcomment %}
<section class="ork-${id}">
  <div class="ork-wrap">
    <div class="ork-${id}__head" data-ork-reveal>
      <h2 class="ork-h">{{ section.settings.heading | default: 'Ils nous font confiance' }}</h2>
    </div>
    <div class="ork-${id}__grid">
      {% for block in section.blocks %}
      <figure class="ork-${id}__card" data-ork-reveal {{ block.shopify_attributes }}>
        <div class="ork-${id}__stars" aria-label="{{ block.settings.rating }} sur 5">{% assign r = block.settings.rating | default: 5 %}{% for i in (1..5) %}<span class="{% if i <= r %}is-on{% endif %}">★</span>{% endfor %}</div>
        <blockquote class="ork-${id}__q">{{ block.settings.text }}</blockquote>
        <figcaption class="ork-${id}__by"><span class="ork-${id}__av" aria-hidden="true">{{ block.settings.name | slice: 0 }}</span>{{ block.settings.name | default: 'Client vérifié' }}{% if block.settings.verified %} <span class="ork-${id}__vf">✓ Vérifié</span>{% endif %}</figcaption>
      </figure>
      {% endfor %}
    </div>
  </div>
</section>`;
  const css = `${baseCss(id, c.accent)}
.ork-${id}__head{text-align:center;margin-bottom:clamp(20px,3vw,36px);}
.ork-${id}__grid{display:grid;grid-template-columns:repeat(3,1fr);gap:clamp(16px,2vw,22px);}
.ork-${id}__card{padding:22px;border:1px solid #ececf1;border-radius:var(--ork-radius);background:#fff;margin:0;}
.ork-${id}__stars{color:#d8d8df;letter-spacing:2px;}
.ork-${id}__stars .is-on{color:#f5b301;}
.ork-${id}__q{margin:12px 0 16px;color:#333;line-height:1.55;font-size:15px;}
.ork-${id}__by{display:flex;align-items:center;gap:10px;font-weight:600;font-size:14px;}
.ork-${id}__av{display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:var(--ork-accent);color:#fff;text-transform:uppercase;}
.ork-${id}__vf{color:#16a34a;font-weight:600;font-size:12px;}
@media (max-width:860px){.ork-${id}__grid{grid-template-columns:1fr;}}${fadeCss(id, c.anim)}`;
  const schema = `{% schema %}
{
  "name": "Avis clients",
  "tag": "section",
  "settings": [
    { "type": "text", "id": "heading", "label": "Titre", "default": "Ils nous font confiance" },
    { "type": "color", "id": "accent_color", "label": "Couleur d'accent", "default": "${c.accent}" }
  ],
  "blocks": [
    { "type": "review", "name": "Avis", "settings": [
      { "type": "range", "id": "rating", "label": "Note", "min": 1, "max": 5, "step": 1, "default": 5 },
      { "type": "textarea", "id": "text", "label": "Avis", "default": "Produit conforme et livraison rapide, je recommande !" },
      { "type": "text", "id": "name", "label": "Prénom", "default": "Camille" },
      { "type": "checkbox", "id": "verified", "label": "Badge vérifié", "default": true }
    ] }
  ],
  "max_blocks": 9,
  "presets": [{ "name": "Avis clients", "blocks": [ { "type": "review" }, { "type": "review" }, { "type": "review" } ] }]
}
{% endschema %}`;
  return { liquid, css, js: "", schema, needsJs: false };
}

function buildComparison(c: SecCtx): BuiltSection {
  const id = c.id;
  const liquid = `{% comment %} Orkestra — Comparatif {% endcomment %}
<section class="ork-${id}">
  <div class="ork-wrap">
    <div class="ork-${id}__head" data-ork-reveal><h2 class="ork-h">{{ section.settings.heading | default: 'Pourquoi nous comparer' }}</h2></div>
    <div class="ork-${id}__scroll">
      <table class="ork-${id}__table">
        <thead><tr><th>{{ section.settings.col_feature | default: 'Critère' }}</th><th class="is-us">{{ section.settings.col_us | default: 'Nous' }}</th><th>{{ section.settings.col_other | default: 'Autres' }}</th></tr></thead>
        <tbody>
          {% for block in section.blocks %}
          <tr {{ block.shopify_attributes }}><td>{{ block.settings.feature }}</td><td class="is-us">{% if block.settings.us %}✓{% else %}—{% endif %}</td><td>{% if block.settings.other %}✓{% else %}—{% endif %}</td></tr>
          {% endfor %}
        </tbody>
      </table>
    </div>
    {% if section.settings.button_label != blank %}<div class="ork-${id}__cta-row"><a class="ork-cta" href="{{ section.settings.button_link }}">{{ section.settings.button_label }}</a></div>{% endif %}
  </div>
</section>`;
  const css = `${baseCss(id, c.accent)}
.ork-${id}__head{text-align:center;margin-bottom:24px;}
.ork-${id}__scroll{overflow-x:auto;border-radius:var(--ork-radius);border:1px solid #ececf1;}
.ork-${id}__table{width:100%;border-collapse:collapse;min-width:520px;background:#fff;}
.ork-${id}__table th,.ork-${id}__table td{padding:14px 18px;text-align:left;border-bottom:1px solid #f0f0f4;}
.ork-${id}__table thead th{font-size:14px;color:#555;}
.ork-${id}__table .is-us{background:color-mix(in srgb,var(--ork-accent) 8%,#fff);font-weight:600;text-align:center;}
.ork-${id}__table td.is-us{color:var(--ork-accent);font-size:18px;}
.ork-${id}__table td:nth-child(3){text-align:center;color:#aaa;}
.ork-${id}__cta-row{text-align:center;margin-top:24px;}${fadeCss(id, c.anim)}`;
  const schema = `{% schema %}
{
  "name": "Comparatif",
  "tag": "section",
  "settings": [
    { "type": "text", "id": "heading", "label": "Titre", "default": "Pourquoi nous comparer" },
    { "type": "text", "id": "col_feature", "label": "Colonne critère", "default": "Critère" },
    { "type": "text", "id": "col_us", "label": "Colonne nous", "default": "Nous" },
    { "type": "text", "id": "col_other", "label": "Colonne autres", "default": "Autres" },
    { "type": "color", "id": "accent_color", "label": "Couleur d'accent", "default": "${c.accent}" },
    { "type": "text", "id": "button_label", "label": "CTA", "default": "Découvrir" },
    { "type": "url", "id": "button_link", "label": "Lien CTA" }
  ],
  "blocks": [
    { "type": "row", "name": "Ligne", "settings": [
      { "type": "text", "id": "feature", "label": "Critère", "default": "Qualité premium" },
      { "type": "checkbox", "id": "us", "label": "Nous", "default": true },
      { "type": "checkbox", "id": "other", "label": "Autres", "default": false }
    ] }
  ],
  "max_blocks": 12,
  "presets": [{ "name": "Comparatif", "blocks": [ { "type": "row" }, { "type": "row" }, { "type": "row" } ] }]
}
{% endschema %}`;
  return { liquid, css, js: "", schema, needsJs: false };
}

function buildCollection(c: SecCtx, input: SectionInput): BuiltSection {
  const id = c.id;
  const liquid = `{% comment %} Orkestra — Collection premium {% endcomment %}
<section class="ork-${id}">
  <div class="ork-wrap">
    <div class="ork-${id}__head" data-ork-reveal>
      {% if section.settings.eyebrow != blank %}<span class="ork-eyebrow">{{ section.settings.eyebrow }}</span>{% endif %}
      <h2 class="ork-h">{{ section.settings.heading | default: 'Notre collection' }}</h2>
      {% if section.settings.text != blank %}<div class="ork-sub">{{ section.settings.text }}</div>{% endif %}
    </div>
    {% assign coll = section.settings.collection %}
    <div class="ork-${id}__grid">
      {% if coll != blank %}
        {% for product in coll.products limit: section.settings.count %}
        <a class="ork-${id}__card" href="{{ product.url }}" data-ork-reveal>
          <span class="ork-${id}__img">{% if product.featured_image %}<img src="{{ product.featured_image | image_url: width: 600 }}" alt="{{ product.featured_image.alt | escape }}" width="300" height="300" loading="lazy">{% endif %}</span>
          <span class="ork-${id}__name">{{ product.title }}</span>
          <span class="ork-${id}__price">{{ product.price | money }}</span>
        </a>
        {% endfor %}
      {% else %}
        {% for i in (1..section.settings.count) %}<div class="ork-${id}__card ork-${id}__card--ph" data-ork-reveal><span class="ork-${id}__img"></span><span class="ork-${id}__name">Produit {{ i }}</span></div>{% endfor %}
      {% endif %}
    </div>
    {% if section.settings.button_label != blank %}<div class="ork-${id}__cta-row"><a class="ork-cta" href="{{ section.settings.button_link | default: coll.url }}">{{ section.settings.button_label }}</a></div>{% endif %}
  </div>
</section>`;
  const css = `${baseCss(id, c.accent)}
.ork-${id}__head{text-align:center;margin-bottom:clamp(20px,3vw,36px);}
.ork-${id}__head .ork-sub{margin-inline:auto;}
.ork-${id}__grid{display:grid;grid-template-columns:repeat(4,1fr);gap:clamp(14px,2vw,22px);}
.ork-${id}__card{display:flex;flex-direction:column;gap:8px;text-decoration:none;color:inherit;}
.ork-${id}__img{display:block;aspect-ratio:1/1;border-radius:var(--ork-radius);overflow:hidden;background:#f1f1f5;}
.ork-${id}__img img{width:100%;height:100%;object-fit:cover;transition:transform .35s ease;}
.ork-${id}__card:hover .ork-${id}__img img{transform:scale(1.05);}
.ork-${id}__name{font-weight:600;font-size:15px;}
.ork-${id}__price{color:var(--ork-accent);font-weight:600;}
.ork-${id}__cta-row{text-align:center;margin-top:28px;}
@media (max-width:860px){.ork-${id}__grid{grid-template-columns:repeat(2,1fr);}}${fadeCss(id, c.anim)}`;
  const schema = `{% schema %}
{
  "name": "Collection premium",
  "tag": "section",
  "settings": [
    { "type": "text", "id": "eyebrow", "label": "Sur-titre" },
    { "type": "text", "id": "heading", "label": "Titre", "default": "${input.collection || "Notre collection"}" },
    { "type": "richtext", "id": "text", "label": "Texte SEO court", "default": "<p>Une sélection ${c.niche}.</p>" },
    { "type": "collection", "id": "collection", "label": "Collection Shopify" },
    { "type": "range", "id": "count", "label": "Nombre de produits", "min": 2, "max": 12, "step": 1, "default": 4 },
    { "type": "color", "id": "accent_color", "label": "Couleur d'accent", "default": "${c.accent}" },
    { "type": "text", "id": "button_label", "label": "CTA", "default": "Voir la collection" },
    { "type": "url", "id": "button_link", "label": "Lien CTA (sinon collection)" }
  ],
  "presets": [{ "name": "Collection premium" }]
}
{% endschema %}`;
  return { liquid, css, js: revealJs(id, c.anim), schema, needsJs: c.anim };
}

function buildStorytelling(c: SecCtx): BuiltSection {
  const id = c.id;
  const liquid = `{% comment %} Orkestra — Storytelling {% endcomment %}
<section class="ork-${id}">
  <div class="ork-wrap ork-${id}__grid">
    <div class="ork-${id}__media" data-ork-reveal>{% if section.settings.image != blank %}<img src="{{ section.settings.image | image_url: width: 1000 }}" alt="{{ section.settings.image.alt | escape }}" width="540" height="620" loading="lazy">{% else %}<div class="ork-${id}__ph" role="img" aria-label="Visuel"></div>{% endif %}</div>
    <div class="ork-${id}__content" data-ork-reveal>
      {% if section.settings.eyebrow != blank %}<span class="ork-eyebrow">{{ section.settings.eyebrow }}</span>{% endif %}
      <h2 class="ork-h">{{ section.settings.heading | default: 'Notre histoire' }}</h2>
      {% if section.settings.text != blank %}<div class="ork-sub">{{ section.settings.text }}</div>{% endif %}
      {% if section.settings.button_label != blank %}<a class="ork-cta" href="{{ section.settings.button_link }}">{{ section.settings.button_label }}</a>{% endif %}
    </div>
  </div>
</section>`;
  const css = `${baseCss(id, c.accent)}
.ork-${id}{background:linear-gradient(180deg,color-mix(in srgb,var(--ork-accent) 5%,#fff),#fff);}
.ork-${id}__grid{display:grid;grid-template-columns:.9fr 1.1fr;gap:clamp(24px,4vw,56px);align-items:center;}
.ork-${id}__media img,.ork-${id}__ph{width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:var(--ork-radius);box-shadow:0 30px 70px -30px rgba(16,24,40,.35);}
.ork-${id}__ph{background:#eceaf6;}
.ork-${id} .ork-cta{margin-top:18px;}
@media (max-width:860px){.ork-${id}__grid{grid-template-columns:1fr;}}${fadeCss(id, c.anim)}`;
  const schema = `{% schema %}
{
  "name": "Storytelling",
  "tag": "section",
  "settings": [
    { "type": "image_picker", "id": "image", "label": "Image" },
    { "type": "text", "id": "eyebrow", "label": "Sur-titre", "default": "Notre marque" },
    { "type": "text", "id": "heading", "label": "Titre", "default": "Notre histoire" },
    { "type": "richtext", "id": "text", "label": "Récit", "default": "<p>Racontez ici la naissance de ${c.brand} et votre mission.</p>" },
    { "type": "color", "id": "accent_color", "label": "Couleur d'accent", "default": "${c.accent}" },
    { "type": "text", "id": "button_label", "label": "CTA" },
    { "type": "url", "id": "button_link", "label": "Lien CTA" }
  ],
  "presets": [{ "name": "Storytelling" }]
}
{% endschema %}`;
  return { liquid, css, js: revealJs(id, c.anim), schema, needsJs: c.anim };
}

function buildSticky(c: SecCtx, input: SectionInput): BuiltSection {
  const id = c.id;
  // Nécessite du JS (afficher au scroll). Encapsulé, sans pollution globale.
  const liquid = `{% comment %} Orkestra — Sticky add-to-cart (à placer dans product.json) {% endcomment %}
<div class="ork-${id}" id="ork-${id}" hidden>
  <div class="ork-wrap ork-${id}__bar">
    <span class="ork-${id}__title">{{ product.title | default: section.settings.fallback_title }}</span>
    {% if product %}<span class="ork-${id}__price">{{ product.selected_or_first_available_variant.price | money }}</span>{% endif %}
    {% if product %}
    <form method="post" action="/cart/add" class="ork-${id}__form">
      <input type="hidden" name="id" value="{{ product.selected_or_first_available_variant.id }}">
      <button type="submit" class="ork-cta" {% unless product.available %}disabled{% endunless %}>{% if product.available %}{{ section.settings.button_label | default: 'Ajouter au panier' }}{% else %}Épuisé{% endif %}</button>
    </form>
    {% else %}<a class="ork-cta" href="{{ section.settings.button_link }}">{{ section.settings.button_label | default: 'Ajouter au panier' }}</a>{% endif %}
  </div>
</div>`;
  const css = `.ork-${id}{position:fixed;left:0;right:0;bottom:0;z-index:60;background:rgba(255,255,255,.92);backdrop-filter:saturate(160%) blur(10px);border-top:1px solid #ececf1;transform:translateY(100%);transition:transform .3s ease;}
.ork-${id}.is-visible{transform:none;}
.ork-${id} .ork-wrap{max-width:1120px;margin:0 auto;}
.ork-${id}__bar{display:flex;align-items:center;gap:16px;padding:12px 20px;}
.ork-${id}__title{font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.ork-${id}__price{font-weight:700;color:{{ section.settings.accent_color | default: '${c.accent}' }};}
.ork-${id}__form{margin:0;}
.ork-${id} .ork-cta{background:{{ section.settings.accent_color | default: '${c.accent}' }};}
@media (max-width:600px){.ork-${id}__price{display:none;}.ork-${id}__title{font-size:14px;}}`;
  const js = `(function(){
  var bar=document.getElementById('ork-${id}');
  if(!bar)return;
  bar.hidden=false;
  var trigger=document.querySelector('[name="add"], .product-form__submit, form[action*="/cart/add"] button[type="submit"]');
  function toggle(){
    var show=true;
    if(trigger){var r=trigger.getBoundingClientRect();show=(r.bottom<0||r.top>window.innerHeight);}
    else{show=window.scrollY>500;}
    bar.classList.toggle('is-visible',show);
  }
  window.addEventListener('scroll',toggle,{passive:true});
  window.addEventListener('resize',toggle);toggle();
})();`;
  const schema = `{% schema %}
{
  "name": "Sticky panier",
  "tag": "section",
  "settings": [
    { "type": "paragraph", "content": "À ajouter sur le modèle Produit (product.json). Le prix et le bouton utilisent le produit courant." },
    { "type": "text", "id": "button_label", "label": "Texte du bouton", "default": "Ajouter au panier" },
    { "type": "text", "id": "fallback_title", "label": "Titre de repli", "default": "${input.product || "Notre produit"}" },
    { "type": "url", "id": "button_link", "label": "Lien (hors page produit)" },
    { "type": "color", "id": "accent_color", "label": "Couleur d'accent", "default": "${c.accent}" }
  ],
  "presets": [{ "name": "Sticky panier" }]
}
{% endschema %}`;
  return { liquid, css, js, schema, needsJs: true };
}

function buildSizeGuide(c: SecCtx): BuiltSection {
  const id = c.id;
  const liquid = `{% comment %} Orkestra — Guide des tailles {% endcomment %}
<section class="ork-${id}">
  <div class="ork-wrap">
    <div class="ork-${id}__head" data-ork-reveal><h2 class="ork-h">{{ section.settings.heading | default: 'Guide des tailles' }}</h2>{% if section.settings.intro != blank %}<p class="ork-sub">{{ section.settings.intro }}</p>{% endif %}</div>
    <div class="ork-${id}__scroll">
      <table class="ork-${id}__table">
        <thead><tr><th>{{ section.settings.c1 | default: 'Taille' }}</th><th>{{ section.settings.c2 | default: 'A (cm)' }}</th><th>{{ section.settings.c3 | default: 'B (cm)' }}</th></tr></thead>
        <tbody>{% for block in section.blocks %}<tr {{ block.shopify_attributes }}><td>{{ block.settings.v1 }}</td><td>{{ block.settings.v2 }}</td><td>{{ block.settings.v3 }}</td></tr>{% endfor %}</tbody>
      </table>
    </div>
    {% if section.settings.note != blank %}<p class="ork-${id}__note">{{ section.settings.note }}</p>{% endif %}
  </div>
</section>`;
  const css = `${baseCss(id, c.accent)}
.ork-${id}__head{text-align:center;margin-bottom:20px;}
.ork-${id}__scroll{overflow-x:auto;border:1px solid #ececf1;border-radius:var(--ork-radius);}
.ork-${id}__table{width:100%;border-collapse:collapse;min-width:480px;background:#fff;}
.ork-${id}__table th,.ork-${id}__table td{padding:13px 16px;border-bottom:1px solid #f0f0f4;text-align:left;}
.ork-${id}__table thead th{background:color-mix(in srgb,var(--ork-accent) 8%,#fff);}
.ork-${id}__note{margin-top:14px;color:#666;font-size:14px;}${fadeCss(id, c.anim)}`;
  const schema = `{% schema %}
{
  "name": "Guide des tailles",
  "tag": "section",
  "settings": [
    { "type": "text", "id": "heading", "label": "Titre", "default": "Guide des tailles" },
    { "type": "textarea", "id": "intro", "label": "Intro / conseils de mesure" },
    { "type": "text", "id": "c1", "label": "Colonne 1", "default": "Taille" },
    { "type": "text", "id": "c2", "label": "Colonne 2", "default": "A (cm)" },
    { "type": "text", "id": "c3", "label": "Colonne 3", "default": "B (cm)" },
    { "type": "text", "id": "note", "label": "Note", "default": "Entre deux tailles, choisissez la plus grande." },
    { "type": "color", "id": "accent_color", "label": "Couleur d'accent", "default": "${c.accent}" }
  ],
  "blocks": [ { "type": "row", "name": "Ligne", "settings": [ { "type": "text", "id": "v1", "label": "Col 1", "default": "M" }, { "type": "text", "id": "v2", "label": "Col 2", "default": "00" }, { "type": "text", "id": "v3", "label": "Col 3", "default": "00" } ] } ],
  "max_blocks": 12,
  "presets": [{ "name": "Guide des tailles", "blocks": [ { "type": "row" }, { "type": "row" }, { "type": "row" } ] }]
}
{% endschema %}`;
  return { liquid, css, js: "", schema, needsJs: false };
}

function buildBeforeAfter(c: SecCtx, input: SectionInput): BuiltSection {
  const id = c.id;
  const allowJs = input.allowJs !== false && input.noJsVersion !== true;
  if (!allowJs) {
    // Version SANS JS : double image côte à côte.
    const liquid = `{% comment %} Orkestra — Avant/Après (double image, sans JS) {% endcomment %}
<section class="ork-${id}">
  <div class="ork-wrap">
    <div class="ork-${id}__head" data-ork-reveal><h2 class="ork-h">{{ section.settings.heading | default: 'Avant / Après' }}</h2></div>
    <div class="ork-${id}__pair">
      <figure>{% if section.settings.before != blank %}<img src="{{ section.settings.before | image_url: width: 800 }}" alt="Avant" width="400" height="400" loading="lazy">{% else %}<div class="ork-${id}__ph"></div>{% endif %}<figcaption>{{ section.settings.before_label | default: 'Avant' }}</figcaption></figure>
      <figure>{% if section.settings.after != blank %}<img src="{{ section.settings.after | image_url: width: 800 }}" alt="Après" width="400" height="400" loading="lazy">{% else %}<div class="ork-${id}__ph"></div>{% endif %}<figcaption>{{ section.settings.after_label | default: 'Après' }}</figcaption></figure>
    </div>
  </div>
</section>`;
    const css = `${baseCss(id, c.accent)}
.ork-${id}__head{text-align:center;margin-bottom:20px;}
.ork-${id}__pair{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
.ork-${id}__pair figure{margin:0;}
.ork-${id}__pair img,.ork-${id}__ph{width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:var(--ork-radius);}
.ork-${id}__ph{background:#f1f1f5;}
.ork-${id}__pair figcaption{margin-top:8px;text-align:center;font-weight:600;color:#555;}${fadeCss(id, c.anim)}`;
    const schema = beforeAfterSchema(id, c.accent);
    return { liquid, css, js: "", schema, needsJs: false };
  }
  // Version slider (JS encapsulé).
  const liquid = `{% comment %} Orkestra — Avant/Après (slider) {% endcomment %}
<section class="ork-${id}">
  <div class="ork-wrap">
    <div class="ork-${id}__head" data-ork-reveal><h2 class="ork-h">{{ section.settings.heading | default: 'Avant / Après' }}</h2></div>
    <div class="ork-${id}__ba" data-ork-ba>
      <div class="ork-${id}__img ork-${id}__img--after">{% if section.settings.after != blank %}<img src="{{ section.settings.after | image_url: width: 1200 }}" alt="Après" loading="lazy">{% endif %}<span class="ork-${id}__lbl">{{ section.settings.after_label | default: 'Après' }}</span></div>
      <div class="ork-${id}__img ork-${id}__img--before" data-ork-before>{% if section.settings.before != blank %}<img src="{{ section.settings.before | image_url: width: 1200 }}" alt="Avant" loading="lazy">{% endif %}<span class="ork-${id}__lbl">{{ section.settings.before_label | default: 'Avant' }}</span></div>
      <input class="ork-${id}__range" type="range" min="0" max="100" value="50" aria-label="Comparer avant et après">
      <span class="ork-${id}__handle" aria-hidden="true"></span>
    </div>
  </div>
</section>`;
  const css = `${baseCss(id, c.accent)}
.ork-${id}__head{text-align:center;margin-bottom:20px;}
.ork-${id}__ba{position:relative;max-width:820px;margin:0 auto;aspect-ratio:16/10;border-radius:var(--ork-radius);overflow:hidden;}
.ork-${id}__img{position:absolute;inset:0;}
.ork-${id}__img img{width:100%;height:100%;object-fit:cover;}
.ork-${id}__img--before{width:50%;overflow:hidden;border-right:2px solid #fff;}
.ork-${id}__lbl{position:absolute;bottom:10px;left:10px;background:rgba(0,0,0,.55);color:#fff;font-size:12px;padding:3px 8px;border-radius:999px;}
.ork-${id}__img--after .ork-${id}__lbl{left:auto;right:10px;}
.ork-${id}__range{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:ew-resize;}
.ork-${id}__handle{position:absolute;top:0;bottom:0;left:50%;width:2px;background:#fff;transform:translateX(-50%);pointer-events:none;box-shadow:0 0 0 6px rgba(255,255,255,.25);}`;
  const js = `(function(){
  document.querySelectorAll('.ork-${id} [data-ork-ba]').forEach(function(ba){
    var before=ba.querySelector('[data-ork-before]'),range=ba.querySelector('.ork-${id}__range'),handle=ba.querySelector('.ork-${id}__handle');
    function set(v){before.style.width=v+'%';handle.style.left=v+'%';}
    range.addEventListener('input',function(){set(range.value);});set(50);
  });
})();`;
  return { liquid, css, js, schema: beforeAfterSchema(id, c.accent), needsJs: true };
}
function beforeAfterSchema(id: string, accent: string): string {
  return `{% schema %}
{
  "name": "Avant / Après",
  "tag": "section",
  "settings": [
    { "type": "text", "id": "heading", "label": "Titre", "default": "Avant / Après" },
    { "type": "image_picker", "id": "before", "label": "Image avant" },
    { "type": "image_picker", "id": "after", "label": "Image après" },
    { "type": "text", "id": "before_label", "label": "Légende avant", "default": "Avant" },
    { "type": "text", "id": "after_label", "label": "Légende après", "default": "Après" },
    { "type": "color", "id": "accent_color", "label": "Couleur d'accent", "default": "${accent}" }
  ],
  "presets": [{ "name": "Avant / Après" }]
}
{% endschema %}`;
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
      fix: "Générez des fiches produits SEO complètes via Import Factory (200+ mots, bénéfices, FAQ).",
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
  country?: string;
  language?: string;
  collections?: string[];
  productTypes?: string[];
  primaryKeywords?: string[];
  secondaryKeywords?: string[];
  competitors?: string[];
  promises?: string[];
  guarantees?: string[];
  formality?: string;
  shippingDelay?: string;
  returnPolicy?: string;
  /** Données réelles issues du scan public (si une analyse existe). */
  englishCount?: number;
  missingLegal?: string[];
  legalFound?: string[];
  merchantScore?: number;
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
  /** Liste structurée des textes anglais détectés (pour le drill-down). */
  englishList?: { text: string; suggestion: string; source: string; impact: string }[];
  /** Problèmes détectés structurés (drill-down). */
  problems?: { area: string; severity: string; impact: string; fix: string; module: string }[];
  /** Historique de conversation (provider-agnostique). */
  history?: { role: "user" | "assistant"; content: string }[];
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

// ── Conversation naturelle (salutations, smalltalk, capacités) ──────────────
/** Message court/social qui ne doit PAS déclencher un rapport complet. */
export function isSmalltalk(q: string): boolean {
  const t = q.trim().toLowerCase().replace(/[!?.…\s]+$/g, "");
  if (t.length > 40) return false;
  if (/^(salut|bonjour|bonsoir|hello|hey+|coucou|yo|hi|hola|cc|wesh)\b/.test(t)) return true;
  if (/^(merci|thanks?|ok|oki|d'?accord|super|g[ée]nial|parfait|nickel|top|cool|ça marche|ca marche|bien re[çc]u)\b/.test(t)) return true;
  if (/^(ça va|ca va|comment ça va|comment ca va|tu vas bien)\b/.test(t)) return true;
  if (/(qui es[- ]tu|c'?est quoi orkestra|tu (peux )?fais? quoi|tu sers à quoi|que (peux|sais)[- ]tu faire|tu peux m'?aider|aide[- ]?moi|\bhelp\b)$/.test(t)) return true;
  return false;
}

function isCapabilityQuestion(q: string): boolean {
  const t = q.toLowerCase();
  return /(qui es[- ]tu|tu (peux )?fais? quoi|tu sers à quoi|que (peux|sais)[- ]tu faire|c'?est quoi orkestra|tu peux m'?aider)/.test(t);
}

/** Suggestions de départ transversales (écran d'accueil / salutation). */
function starterSuggestions(): { label: string; q: string }[] {
  return [
    { label: "Audit SEO rapide", q: "Fais-moi un audit SEO rapide de ma boutique." },
    { label: "Optimiser une fiche produit", q: "Optimise une fiche produit : titre, meta, description, FAQ et alt." },
    { label: "Comprendre mes pertes", q: "Explique-moi où ma boutique perd de l'argent et pourquoi." },
    { label: "Mes priorités", q: "Quels problèmes dois-je corriger en premier ?" },
    { label: "Risques Merchant Center", q: "Quels risques peuvent bloquer mes annonces Google Shopping ?" },
    { label: "Plan d'action 7 jours", q: "Fais-moi un plan d'action concret sur 7 jours." },
  ];
}

/** Suggestions de suivi adaptées au mode après une réponse. */
function followupSuggestions(mode: CouncilMode): { label: string; q: string }[] {
  const map: Partial<Record<CouncilMode, { label: string; q: string }[]>> = {
    seo: [
      { label: "Produits à optimiser en priorité", q: "Quels produits dois-je optimiser en priorité ?" },
      { label: "Générer les meta manquantes", q: "Génère les meta descriptions manquantes, prêtes à copier." },
      { label: "Réécrire les titres faibles", q: "Réécris les titres produits trop faibles." },
      { label: "Plan 7 jours", q: "Fais-moi le plan d'action SEO sur 7 jours avec les chemins Shopify." },
    ],
    merchant: [
      { label: "Risques qui bloquent les annonces", q: "Quels risques peuvent bloquer mes annonces Google Shopping ?" },
      { label: "Réécrire les promesses risquées", q: "Réécris les promesses trop risquées de façon factuelle." },
      { label: "Rendre une fiche conforme", q: "Rends cette fiche plus conforme Google Shopping." },
    ],
    strategy: [
      { label: "3 actions les plus rentables", q: "Quelles sont les 3 actions les plus rentables à faire aujourd'hui ?" },
      { label: "Prioriser par impact/effort", q: "Classe les actions par impact et effort." },
      { label: "Plan 30 jours", q: "Construis un plan d'action sur 30 jours." },
    ],
    code: [
      { label: "Adapter au thème", q: "Adapte cette section à mon thème Shopify et explique l'installation." },
      { label: "Version mobile", q: "Optimise le rendu mobile de cette section." },
    ],
    email: [
      { label: "Version plus courte", q: "Donne une version plus courte de cet email." },
      { label: "Ton plus chaleureux", q: "Réécris cet email avec un ton plus chaleureux." },
    ],
  };
  return map[mode] ?? [
    { label: "Résumer en 10 actions", q: "Résume en 10 actions concrètes et priorisées." },
    { label: "Quelles priorités ?", q: "Quelles sont les priorités à traiter en premier ?" },
    { label: "Plan 7 jours", q: "Donne-moi un plan d'action concret sur 7 jours." },
  ];
}

/** Base de données utilisée (transparence simulé vs réel). */
function dataBasisFor(ctx: CouncilContext): "public" | "none" {
  if (ctx.productsFound != null || ctx.collections?.length || ctx.priorityProducts?.length || ctx.legalFound?.length) return "public";
  return "none";
}

function councilFormat(mode: CouncilMode, question: string): CouncilFormat {
  if (isReviewIntent(question)) return "analysis";
  if (/30\s*jours?|plan d'action|roadmap|sur 30|plan 7|7\s*jours?/i.test(question)) return "plan";
  if (mode === "strategy") return "plan";
  if (mode === "email" || mode === "quote" || mode === "code") return "generation";
  const intent = classifyIntent(question);
  if (intent === "generation_texte" || intent === "produit_seo" || intent === "meta_description" || intent === "collection_seo") return "generation";
  return "diagnostic";
}

/** Réponse conversationnelle (salutation / capacités) — courte, naturelle, sans rapport. */
function buildConversation(question: string, ctx: CouncilContext): string {
  const store = ctx.brandName ? `**${ctx.brandName}**` : "votre boutique";
  if (isCapabilityQuestion(question)) {
    return (
      `Je suis **Orkestra**, votre copilote e-commerce. Je travaille sur ${store} pour vous aider à :\n\n` +
      `- **SEO** — titres, meta, contenu, maillage interne\n` +
      `- **Fiches produits** — réécriture, FAQ, alt, export CSV Shopify\n` +
      `- **Tunnel & conversion** — comprendre où vous perdez des ventes\n` +
      `- **Merchant Center** — éviter ce qui bloque vos annonces\n` +
      `- **Stratégie** — prioriser les actions les plus rentables\n\n` +
      `Par quoi on commence ?`
    );
  }
  return `Salut 👋 Je suis prêt. On travaille sur quoi aujourd'hui pour ${store} — SEO, fiches produits, tunnel, Merchant Center, import catalogue ou stratégie ?`;
}

export function generateCouncil(
  mode: CouncilMode,
  question: string,
  providers: AIProviderId[],
  ctx: CouncilContext = {}
): CouncilResult {
  const active = providers.length ? providers : (["openai"] as AIProviderId[]);

  // ── Conversation naturelle (salut, merci, « tu fais quoi ») → pas de rapport ──
  if (isSmalltalk(question) && !ctx.directive && !isFollowupQuestion(question, ctx)) {
    const text = buildConversation(question, ctx);
    return {
      finalAnswer: text,
      qualityScore: 0,
      scores: { quality: 0, clarity: 0, actionable: 0 },
      timeSaved: "",
      modelsUsed: active,
      nextActions: [],
      synthesisReasons: [],
      providerAnswers: active.map((p) => ({
        provider: p,
        model: defaultModelFor(p),
        specialty: PROVIDER_PROFILE[p].specialty,
        answer: text,
        qualityScore: 0,
        strengths: [],
        limits: [],
      })),
      format: "conversation",
      suggestions: starterSuggestions(),
      dataBasis: dataBasisFor(ctx),
    };
  }

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
    ? ["Corriger les collections (Import Factory)", "Lancer Merchant Shield", "Réordonner la page d'accueil (Section Builder)"]
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
    format: sr ? "analysis" : councilFormat(mode, question),
    suggestions: followupSuggestions(mode),
    dataBasis: dataBasisFor(ctx),
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
    seo: ["Générer 3 fiches produits dans Import Factory", "Optimiser les meta des collections", "Lancer Merchant Shield"],
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

/** Bandeau commun : Mode utilisé · Données utilisées · Limite. */
function modeBanner(mode: CouncilMode, ctx: CouncilContext): string {
  const data: string[] = [];
  if (ctx.productsFound != null) data.push("scan public");
  if (ctx.collections?.length) data.push("collections détectées");
  if (ctx.productsEnriched) data.push("produits enrichis (products.json)");
  if (ctx.priorityProducts?.length) data.push("produits prioritaires");
  if (ctx.legalFound?.length || ctx.missingLegal?.length) data.push("pages légales");
  const list = data.length ? data.join(", ") : "mémoire boutique";
  return `> **Mode : ${MODE_LABEL[mode]}** · Données utilisées : ${list} · Limite : analyse basée sur la vue publique (API Shopify non connectée).\n\n`;
}

function buildFinalAnswer(mode: CouncilMode, question: string, ctx: CouncilContext): string {
  // Demande CIBLÉE (bouton inter-module ou question précise) → réponse courte et
  // exacte (6 parties), PAS de ré-audit complet. La dernière question prime.
  if (isTargetedQuestion(question, ctx) && !isReviewIntent(question)) {
    return modeBanner(mode, ctx) + targetedAnswer(mode, question, ctx);
  }
  const isPlan = /30\s*jours?|plan d'action|planning|roadmap|sur 30/i.test(question);
  switch (mode) {
    case "seo":
      return modeBanner(mode, ctx) + (isPlan ? seoPlan30(ctx) : seoAnswer(ctx));
    case "code":
      return modeBanner(mode, ctx) + codeAnswer(ctx, question);
    case "merchant":
      return modeBanner(mode, ctx) + merchantAnswer(ctx);
    case "email":
      return modeBanner(mode, ctx) + emailAnswer(ctx, question);
    case "quote":
      return modeBanner(mode, ctx) + quoteAnswer(ctx, question);
    case "strategy":
      return modeBanner(mode, ctx) + (isPlan ? strategyPlan30(ctx) : strategyAnswer(ctx));
    case "competitive":
      return modeBanner(mode, ctx) + competitiveAnswer(ctx);
    default:
      return freeAnswer(question, ctx);
  }
}

/** Détection d'intention pour le mode « Question libre » → route vers le bon expert. */
function detectIntent(q: string): CouncilMode {
  const t = q.toLowerCase();
  if (/\b(merchant|google ads|google shopping|shopping|suspend|bannis|conformit|misrepresentation)\b/.test(t)) return "merchant";
  if (/\b(code|liquid|section|css|theme|thème|bouton|hero|faq|réassurance|reassurance|comparatif|sticky|avis|page produit|customizer)\b/.test(t)) return "code";
  if (/\b(email|e-mail|mail|client|sav|réclamation|reclamation|relance|retard|remboursement|répondre au client)\b/.test(t)) return "email";
  if (/\b(devis|quote|cotation|b2b|sur mesure|sur-mesure|remise volume)\b/.test(t)) return "quote";
  if (/\b(stratégie|strategie|croissance|growth|business|roadmap|scaler|développer|chiffre d'affaires|ca\b)\b/.test(t)) return "strategy";
  if (/\b(concurrent|concurrence|compétiteur|competiteur|marché|benchmark)\b/.test(t)) return "competitive";
  if (/\b(seo|référencement|referencement|mot-?clé|mot-?cle|meta|ranking|google|collection|maillage|longue traîne|backlink)\b/.test(t)) return "seo";
  return "free";
}

// ── Conversation / follow-up (logique commune à toutes les IA) ──────────────

/** Une question est-elle un suivi du message précédent ? */
export function isFollowupQuestion(question: string, ctx: CouncilContext): boolean {
  if (!ctx.history?.length) return false;
  const q = question.trim().toLowerCase();
  if (q.split(/\s+/).length <= 7) return true; // question courte → suivi probable
  return /\b(où|ou ça|lesquel|quel|quels|quelle|c'est grave|comment (je |le )?corrig|comment (je )?règle|comment regler|comment régler|donne|fais|juste|seulement|uniquement|liste|montre|celui|celle|ça|cela|ce mot|le mot|cette|ces|résume|resume|plus court|plus premium|version|et pour|et le|et la)\b/i.test(q);
}

export type FollowupTopic =
  | "english" | "meta" | "products" | "collections" | "alt" | "legal"
  | "product_type" | "h1" | "where" | "severity" | "code" | "plan" | "shorten" | "premium" | "generic";

export function followupTopic(question: string): FollowupTopic {
  const t = question.toLowerCase();
  if (/anglais|english|mot.*(traduire|corriger)|traduire|libellé/.test(t)) return "english";
  if (/product.?type|type de produit|catégorie produit|categorisation/.test(t)) return "product_type";
  if (/\bh1\b|titre h1|balise h1|multiple h1/.test(t)) return "h1";
  if (/meta|title|balise titre/.test(t)) return "meta";
  if (/alt|image/.test(t)) return "alt";
  if (/collection|catégorie|categorie/.test(t)) return "collections";
  if (/produit|fiche|article/.test(t)) return "products";
  if (/légal|legal|mention|cgv|confidential|retour|livraison|contact|garantie/.test(t)) return "legal";
  if (/où|chemin|dans shopify|admin|trouver|localis/.test(t)) return "where";
  if (/grave|important|risque|priorit|sérieux|serieux/.test(t)) return "severity";
  if (/code|liquid|section|css|schema/.test(t)) return "code";
  if (/plan|7 jours|30 jours|roadmap/.test(t)) return "plan";
  if (/plus court|raccourci|résume|resume/.test(t)) return "shorten";
  if (/premium|améliore|ameliore|mieux/.test(t)) return "premium";
  return "generic";
}

// ── Intention de la dernière demande (priorité absolue) ─────────────────────
export type CouncilIntent =
  | "audit_global" | "correction_precise" | "localisation_shopify" | "impact_priorite"
  | "generation_texte" | "explication_gmc" | "probleme_promotion" | "textes_anglais"
  | "product_type" | "meta_description" | "alt_text" | "h1" | "page_legale"
  | "collection_seo" | "produit_seo" | "code_shopify" | "email_client" | "devis"
  | "strategie" | "concurrence" | "claims" | "question_libre";

/** Classe la dernière demande pour répondre EXACTEMENT (pas d'audit générique). */
export function classifyIntent(q: string): CouncilIntent {
  const t = q.toLowerCase();
  if (/audit (complet|merchant complet)|analyse (complète|complete|ma boutique|mon site)|améliore[rz]? (mon|le|la) (seo|boutique|référencement|referencement)|passe en revue|review (du|de) (site|boutique)|fais[- ].{0,14}plan|roadmap|plan (d'action |sur )?30|stratégie seo complète|comment améliorer mon seo|tout (mon|le) seo/.test(t)) return "audit_global";
  if (/promotion|réduction|reduction|prix barré|prix barre|code promo|bandeau|urgence|vente flash|\bsoldes?\b|offre limitée|compte à rebours/.test(t)) return "probleme_promotion";
  if (/trop marketing|claims?|factuel|misrepresentation|promesses? (trop|risqu)|réécrire.*(sobre|factuel)/.test(t)) return "claims";
  if (/texte.?anglais|anglais|english|traduire|libellé/.test(t)) return "textes_anglais";
  if (/product.?type|type de produit/.test(t)) return "product_type";
  if (/page.?l[ée]gale|mentions|\bcgv\b|confidential|politique (de )?(retour|livraison|remboursement|confidentialité)|page contact|pages? de confiance/.test(t)) return "page_legale";
  if (/alt.?text|texte alternatif/.test(t)) return "alt_text";
  if (/\bmeta\b|méta|balise titre|\btitle\b|meta description|meta title/.test(t)) return "meta_description";
  if (/\bh1\b/.test(t)) return "h1";
  if (/où (l'?ajouter|ajouter|corriger|modifier|trouve|se trouve|cliquer|mettre|placer)|chemin shopify|dans shopify|étape par étape/.test(t)) return "localisation_shopify";
  if (/\bimpact\b|gravité|gravite|pourquoi (c'est|est-ce|ce) (important|grave|un (risque|problème|probleme))|conséquence|consequence/.test(t)) return "impact_priorite";
  if (/merchant|google shopping|\bgmc\b|performance max|pmax|\bfeed\b/.test(t)) return "explication_gmc";
  if (/génère|genere|rédige|redige|écris|ecris|texte (prêt|à copier|à coller)|prêt à coller|donne[- ]moi (le|les|la|un|une) (texte|meta|description|titre|fiche)/.test(t)) return "generation_texte";
  if (/collection/.test(t)) return "collection_seo";
  if (/fiche produit|produit seo|description produit/.test(t)) return "produit_seo";
  if (/\bcode\b|liquid|section|\bcss\b|schema/.test(t)) return "code_shopify";
  if (/email|e-mail|\bmail\b|\bsav\b|répondre au client/.test(t)) return "email_client";
  if (/devis|quote|cotation/.test(t)) return "devis";
  if (/stratégie|strategie|croissance|growth|business/.test(t)) return "strategie";
  if (/concurrent|concurrence|benchmark|compétiteur|competiteur/.test(t)) return "concurrence";
  if (/correction|corriger|comment (corriger|régler|regler|réparer|reparer)/.test(t)) return "correction_precise";
  return "question_libre";
}

const TARGETED_INTENTS = new Set<CouncilIntent>([
  "correction_precise", "localisation_shopify", "impact_priorite", "generation_texte",
  "explication_gmc", "probleme_promotion", "textes_anglais", "product_type",
  "meta_description", "alt_text", "h1", "page_legale", "claims",
]);

/** La demande est-elle CIBLÉE (réponse courte) plutôt qu'un audit global ? */
export function isTargetedQuestion(question: string, ctx: CouncilContext): boolean {
  if (/réponds? uniquement|reponds? uniquement|\bcontexte\s*:|uniquement (sur|à|au sujet)|seulement (sur|à propos)/i.test(question)) return true;
  const intent = classifyIntent(question);
  if (intent === "audit_global") return false;
  if (TARGETED_INTENTS.has(intent)) return true;
  if ((intent === "collection_seo" || intent === "produit_seo") && /\bou\b|où|comment|génère|genere|rédige|redige|cette|ce |ajouter|modifier/i.test(question)) return true;
  return isFollowupQuestion(question, ctx);
}

/** Réponse CIBLÉE au format 6 parties (mock). */
function six(p: { direct: string; concerned?: string; why?: string; how?: string; where?: string; next?: string }): string {
  let o = `### Réponse directe\n${p.direct}\n`;
  if (p.concerned) o += `\n### Ce qui est concerné\n${p.concerned}\n`;
  if (p.why) o += `\n### Pourquoi c'est important\n${p.why}\n`;
  if (p.how) o += `\n### Comment corriger\n${p.how}\n`;
  if (p.where) o += `\n### Où corriger dans Shopify\n${p.where}\n`;
  if (p.next) o += `\n### Action suivante\n${p.next}\n`;
  return o;
}

function targetedAnswer(mode: CouncilMode, question: string, ctx: CouncilContext): string {
  const intent = classifyIntent(question);
  switch (intent) {
    case "textes_anglais": {
      const list = ctx.englishList ?? [];
      const n = ctx.englishCount ?? list.length;
      return six({
        direct: n ? `${n} libellé(s) anglais à traduire en français pour renforcer la confiance et réduire le risque Merchant.` : "Aucun texte anglais isolé via le scan public — vérifiez « Add to cart », « Sold out » dans le thème.",
        concerned: list.length ? list.slice(0, 8).map((e) => `- \`${e.text}\` → \`${e.suggestion}\` (${e.source})`).join("\n") : "_Liste exacte non isolée via scan public._",
        why: "- Confiance utilisateur et cohérence de marque.\n- Signal négatif possible pour Google Merchant Center.",
        how: "Repérez chaque libellé et remplacez-le par sa traduction française (thème + apps).",
        where: shopifyPath("english"),
        next: "Corriger via **Assistant Shopify**, puis relancer un scan Orkestra.",
      });
    }
    case "probleme_promotion":
      return six({
        direct: "Une réduction n'est pas interdite, mais avant une demande GMC évitez les promotions agressives, permanentes ou floues qui créent une incohérence prix/offre.",
        concerned: "_Promotions non confirmables via le scan public — à vérifier sur votre boutique : prix barrés, codes promo, bandeaux « -50% », urgence, comptes à rebours._",
        why: "- Incohérence prix site / feed = risque de cohérence pour Google.\n- Urgence artificielle ou réduction permanente = impression d'offre trompeuse.",
        how: "Clarifiez les conditions, supprimez les bandeaux d'urgence permanents, et vérifiez que le prix affiché = prix du feed. Boutique récente : privilégiez un site stable avant la demande.",
        where: "Shopify → Réductions · bandeaux : Boutique en ligne → Thèmes → Personnaliser",
        next: "Stabiliser les promotions, puis relancer l'audit **Merchant Shield**.",
      });
    case "claims":
      return six({
        direct: "Réécrivez les formulations trop marketing (« meilleur », « professionnel », « garanti ») de façon factuelle pour limiter le risque de misrepresentation.",
        concerned: "Textes à vérifier sur vos fiches produits et promesses de marque.",
        why: "- Google peut considérer un claim non prouvé comme trompeur.\n- Un texte factuel rassure autant et réduit le risque.",
        how: "Remplacez les superlatifs par des faits : matériaux, dimensions, usages. Ex. « pliable en bois massif, stable à domicile » plutôt que « le meilleur produit professionnel ».",
        where: "Produits / Pages concernés → contenu et Aperçu du référencement naturel",
        next: "Générer des textes factuels dans le **Import Factory**.",
      });
    case "product_type": {
      const prods = ctx.priorityProducts ?? [];
      return six({
        direct: `Renseignez le \`product_type\` sur les fiches concernées${ctx.noType ? ` (${ctx.noType} produit(s) sans type)` : ""} pour fiabiliser la catégorisation et le flux Shopping.`,
        concerned: prods.length ? prods.slice(0, 5).map((p) => `- ${p.title} → type suggéré : « ${cap(singularize(p.title.split(" ")[0] || p.title))} »`).join("\n") : "_Produits non isolés via scan public._",
        why: "- Catégorisation fiable des produits.\n- Flux Google Shopping plus propre.",
        how: "Ouvrez chaque produit → « Organisation du produit » → « Type de produit » (cohérent d'un produit à l'autre).",
        where: shopifyPath("product_type"),
        next: "Voir la procédure pas-à-pas dans **Assistant Shopify**.",
      });
    }
    case "page_legale": {
      const missing = ctx.missingLegal ?? [];
      return six({
        direct: missing.length ? `Complétez ces pages avant de soumettre Google Merchant Center : ${missing.join(", ")}.` : "Vérifiez que vos pages essentielles sont présentes, accessibles et liées au footer.",
        concerned: missing.length ? missing.map((m) => `- ${m}`).join("\n") : "_Pages essentielles : contact, retours, livraison, mentions, confidentialité._",
        why: "- Pages de confiance = exigence fréquente de Merchant Center.\n- Leur absence est une cause courante de refus.",
        how: "Politiques : Paramètres → Politiques. Autres pages (Contact, FAQ) : Boutique en ligne → Pages → Ajouter. Liez-les au footer.",
        where: shopifyPath("legal"),
        next: "Générer les textes de politiques (mode adapté) puis les publier.",
      });
    }
    case "meta_description":
      return six({
        direct: `Rédigez des meta naturelles (title ≤ 60, description ≤ 155)${ctx.missingMeta ? ` — ${ctx.missingMeta} manquante(s)` : ""}.`,
        concerned: ctx.collections?.length ? `Pages prioritaires : ${ctx.collections.slice(0, 4).join(", ")}.` : "_Pages concernées non isolées via scan public._",
        why: "- Une meta claire améliore le taux de clic dans Google.\n- Évitez « Achetez maintenant », « Qualité premium ».",
        how: "Title = mot-clé + attribut concret + marque. Description = bénéfice + critères + livraison soignée.",
        where: shopifyPath("meta"),
        next: "Générer 3 variantes dans le **Import Factory** (workflow Meta).",
      });
    case "alt_text":
      return six({
        direct: `Ajoutez des alt text descriptifs et naturels${ctx.imagesNoAlt ? ` (${ctx.imagesNoAlt} image(s) sans alt)` : ""}, sans bourrage de mots-clés.`,
        concerned: "Images des produits prioritaires et des collections principales.",
        why: "- Mineur pour Merchant, utile pour le SEO images et l'accessibilité.",
        how: "Décrivez ce que montre l'image avant de viser le mot-clé.",
        where: shopifyPath("alt"),
        next: "Générer les alt text dans le **Import Factory** (workflow Alt text).",
      });
    case "h1":
      return six({
        direct: "Assurez un seul H1 par page (accueil, collection, produit).",
        why: "- Un H1 unique = meilleure structure sémantique pour Google.",
        how: "Vérifiez qu'un seul bloc sert de titre principal ; ajustez via l'éditeur de thème ou le code.",
        where: shopifyPath("h1"),
        next: "Voir la procédure dans **Assistant Shopify**.",
      });
    case "localisation_shopify": {
      const sub = followupTopic(question);
      return six({
        direct: "Voici où agir dans Shopify pour ce point précis.",
        where: shopifyPath(sub === "where" || sub === "generic" ? "meta" : sub),
        how: "Suivez le chemin ci-dessus, modifiez le champ concerné, enregistrez, puis vérifiez le rendu.",
        next: "Procédure détaillée dans **Assistant Shopify**.",
      });
    }
    case "impact_priorite":
      return six({
        direct: "Voici l'impact et la priorité de ce point, sans refaire l'audit complet.",
        concerned: ctx.problems?.length ? ctx.problems.slice(0, 4).map((p) => `- [${p.severity}] ${p.area}`).join("\n") : "_Précisez l'élément pour un impact ciblé._",
        why: "- SEO : visibilité et trafic.\n- Merchant : confiance et conformité.\n- Conversion : clarté et réassurance.",
        next: "Corriger en priorité les éléments critiques (pages de confiance, langue).",
      });
    case "explication_gmc":
      return six({
        direct: "Voici le risque Merchant Center sur ce point et comment le réduire.",
        why: "- Merchant Center vérifie la cohérence et la confiance (pages légales, langue, prix, claims).\n- Orkestra réduit les risques visibles ; Google reste seul décisionnaire.",
        how: "Corrigez d'abord les pages de confiance et la cohérence de langue, puis les données produit et les promotions.",
        where: "Audit complet : **Merchant Shield**",
        next: "Lancer / relancer l'audit dans **Merchant Shield**.",
      });
    case "generation_texte":
      return six({
        direct: "Pour un texte prêt à copier (meta, description, FAQ, alt, article), le **Import Factory** produit la sortie structurée et copiable, alignée sur votre niche et conforme Merchant.",
        next: "Ouvrir le **Import Factory** et choisir le workflow correspondant.",
      });
    default:
      return answerFollowup(mode, question, ctx);
  }
}

/** Chemin Shopify probable selon le sujet (où corriger). */
function shopifyPath(topic: string): string {
  const m: Record<string, string> = {
    english: "Shopify → Paramètres → Langues → Modifier le contenu du thème (rechercher le libellé EN).",
    meta: "Shopify → Produit / Collection / Page → Aperçu du référencement naturel → Modifier.",
    alt: "Shopify → Produit → Médias → Modifier le texte alternatif.",
    product_type: "Shopify → Produit → Organisation du produit → Type de produit.",
    tags: "Shopify → Produit → Organisation du produit → Tags.",
    h1: "Shopify → Boutique en ligne → Thèmes → Personnaliser → Page concernée.",
    collections: "Shopify → Produits → Collections → Collection concernée → Description.",
    home: "Shopify → Boutique en ligne → Thèmes → Personnaliser → Page d'accueil.",
    legal: "Shopify → Paramètres → Politiques (retour, livraison, confidentialité, CGV) ou Boutique en ligne → Pages.",
    code: "Shopify → Boutique en ligne → Thèmes → ⋯ → Modifier le code → Sections.",
  };
  // On retire le point final : les appelants ajoutent leur propre ponctuation
  // (évite les « .. » en fin de phrase).
  const path = m[topic] || "Localisation exacte non disponible via scan public. Une connexion API Shopify permettra de localiser et corriger plus précisément.";
  return path.replace(/\s*\.\s*$/, "");
}

/** Réponse COURTE et CIBLÉE à une question de suivi (mock). Pas de ré-audit. */
function answerFollowup(mode: CouncilMode, question: string, ctx: CouncilContext): string {
  const topic = followupTopic(question);
  const s = brandOf(ctx);

  if (topic === "english") {
    const list = ctx.englishList ?? [];
    if (!list.length) {
      if (!ctx.englishCount) return `### Textes anglais détectés\nAucun texte anglais visible détecté dans le scan public.`;
      return `### Textes anglais détectés\nLe scan a détecté **${ctx.englishCount}** libellé(s) anglais. Source exacte non localisée via scan public : le texte est probablement dans le thème, une section ou les traductions Shopify.\n\n**Où corriger** : ${shopifyPath("english")}\n**Module Orkestra** : Merchant Shield / Assistant Shopify · **Priorité** : Haute.`;
    }
    return `### Textes anglais détectés (${list.length})
${list.slice(0, 10).map((e, i) => `${i + 1}. \`${e.text}\`
   - Source/page : ${e.source}
   - Correction française : \`${e.suggestion}\`
   - Impact : ${e.impact} (cohérence linguistique, confiance, signal Merchant Center)
   - Où corriger : ${shopifyPath("english")}
   - Module Orkestra : Merchant Shield / Assistant Shopify
   - Priorité : Haute`).join("\n")}`;
  }

  if (topic === "product_type") {
    return `### Type de produit (product_type)\n${ctx.noType != null ? (ctx.noType > 0 ? `**${ctx.noType} produit(s)** sans \`product_type\` détecté(s).` : "Type de produit : OK sur l'échantillon — non prioritaire.") : "_Donnée non disponible via scan public._"}\n- Impact : catégorisation et flux Google Shopping moins fiables.\n- Où corriger : ${shopifyPath("product_type")}\n- Module : Merchant Shield · Priorité : ${ctx.noType ? "Moyenne" : "—"}.`;
  }

  if (topic === "h1") {
    return `### Balises H1\nVérifiez qu'il y a **un seul H1** par page (home/collection/produit).\n- Impact : un H1 unique = meilleure structure sémantique SEO.\n- Où corriger : ${shopifyPath("h1")}\n- Module : Import Factory / Code Shopify.`;
  }

  if (topic === "products") {
    const p = ctx.priorityProducts ?? [];
    if (!p.length) return `_Aucun produit prioritaire isolé via le scan public. Élargissez le scan ou connectez l'API Shopify._`;
    return `## Produits concernés (${p.length})
${p.slice(0, 6).map((x, i) => `${i + 1}. **${x.title}** — ${x.reason.toLowerCase()} (contenu ${x.contentScore}/100).`).join("\n")}

**Action** : ouvrez le **Import Factory** (pré-rempli depuis ces produits) pour enrichir description + FAQ + alt text.`;
  }

  if (topic === "collections") {
    const cols = ctx.collections ?? [];
    return cols.length
      ? `## Collections concernées\n${cols.slice(0, 8).map((c) => `- ${c}`).join("\n")}\n\n**Action** : texte SEO + FAQ par collection (Import Factory).`
      : `_Aucune collection détectée via le scan public._`;
  }

  if (topic === "meta") {
    if (ctx.missingMeta === 0) return `### Meta descriptions\nMeta : OK selon le scan public (échantillon) — non prioritaire.`;
    return `### Meta à corriger\n${ctx.missingMeta != null ? `**${ctx.missingMeta}** meta manquantes détectées (échantillon).` : "_Nombre exact non disponible via scan public._"}\n- Exemple prêt à coller : \`Découvrez nos ${(ctx.collections?.[0] || "produits").toLowerCase()} : conseils pour bien choisir et livraison soignée.\` (≤ 155 car., naturel, sans superlatif)\n- Où corriger : ${shopifyPath("meta")}\n- Module : Import Factory · Priorité : Haute.`;
  }

  if (topic === "alt") {
    if (ctx.imagesNoAlt === 0) return `### Alt text des images\nAlt text : OK selon le scan public — non prioritaire.`;
    return `### Images sans alt text\n${ctx.imagesNoAlt != null ? `**${ctx.imagesNoAlt}** image(s) sans alt détectée(s).` : "_Nombre non disponible._"}\n- Exemple d'alt : « ${(ctx.collections?.[0] || "produit").toLowerCase()} — ${nicheOf(ctx)} ».\n- Où corriger : ${shopifyPath("alt")}\n- Module : Import Factory · Priorité : Basse/Moyenne.`;
  }

  if (topic === "legal") {
    const missing = ctx.missingLegal ?? [];
    return missing.length
      ? `### Pages légales manquantes\n${missing.map((m) => `- **${m}** — Où : ${shopifyPath("legal")}`).join("\n")}\n\n**Module** : Merchant Shield · **Priorité** : Haute.`
      : `### Pages légales\nAucune page essentielle manquante détectée${ctx.legalFound?.length ? ` (présentes : ${ctx.legalFound.join(", ")})` : ""} — socle de confiance propre.`;
  }

  if (topic === "where") {
    // Devine le sujet précédent depuis l'historique.
    const prev = (ctx.history?.slice().reverse().find((h) => h.role === "assistant")?.content || "").toLowerCase();
    const sub =
      /anglais/.test(prev) ? "english" :
      /product.?type|type de produit/.test(prev) ? "product_type" :
      /\bh1\b/.test(prev) ? "h1" :
      /meta/.test(prev) ? "meta" :
      /alt|image/.test(prev) ? "alt" :
      /collection/.test(prev) ? "collections" :
      /légal|legal|retour|livraison|mention|cgv/.test(prev) ? "legal" : "code";
    return `### Où corriger dans Shopify\n${shopifyPath(sub)}`;
  }

  if (topic === "severity") {
    const high: string[] = [];
    if (ctx.weakDescriptions) high.push(`**${ctx.weakDescriptions} descriptions faibles** (SEO/conversion)`);
    if (ctx.englishCount) high.push(`**${ctx.englishCount} textes anglais** (confiance/Merchant)`);
    if (ctx.missingLegal?.length) high.push(`pages légales manquantes (${ctx.missingLegal.join(", ")})`);
    const ok: string[] = [];
    if (ctx.weakTitles === 0) ok.push("titres produits");
    if (ctx.tagsCoverage != null && ctx.tagsCoverage >= 90) ok.push("tags");
    if (ctx.missingMeta === 0) ok.push("meta");
    if (ctx.legalFound?.length && !ctx.missingLegal?.length) ok.push("pages légales");
    return `### Niveau de gravité\n**À traiter en priorité** : ${high.length ? high.join(", ") : "rien de bloquant majeur sur l'échantillon."}\n**Secondaire** : alt text, tags, maillage.${ok.length ? `\n**Déjà bon (ne pas toucher)** : ${ok.join(", ")}.` : ""}`;
  }

  if (topic === "code") {
    return codeAnswer(ctx, question); // génère le code ciblé
  }

  if (topic === "plan") {
    const cols = ctx.collections ?? [];
    return `## Plan 7 jours (ciblé)
- **J1** : corriger ${ctx.englishCount ?? 0} textes anglais + ${ctx.missingMeta ?? 0} meta manquantes.
- **J2** : product_type manquants (${ctx.noType ?? 0}).
- **J3–4** : texte SEO + FAQ sur « ${cols[0] || "collection principale"} »${cols[1] ? " et « " + cols[1] + " »" : ""}.
- **J5–7** : enrichir les produits prioritaires (Import Factory).`;
  }

  // generic / shorten / premium : réponse courte contextualisée
  return `## Réponse ciblée\nConcernant « ${question.trim().slice(0, 100)} » pour ${s} : je réponds directement à ce point sans refaire l'audit complet.\n- ${ctx.englishCount ? `Textes anglais : ${ctx.englishCount} détecté(s).` : ""} ${ctx.weakDescriptions ? `Fiches faibles : ${ctx.weakDescriptions}.` : ""} ${ctx.missingMeta ? `Meta manquantes : ${ctx.missingMeta}.` : ""}\n> Précisez le point (meta, anglais, produits, collections, code…) pour une réponse encore plus directe.`;
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
    sport: {
      pieces: ["maison", "débutant", "studio", "espace réduit"],
      faqs: (c) => [
        `Comment choisir vos ${c.toLowerCase()} selon votre niveau et l'espace disponible ?`,
        `Quels exercices pratiquer avec vos ${c.toLowerCase()} à la maison ?`,
        `Bois ou aluminium : quel matériau privilégier pour vos ${c.toLowerCase()} ?`,
        `Comment entretenir, plier et ranger vos ${c.toLowerCase()} ?`,
      ],
      descHints: "niveau (débutant à confirmé), espace disponible et dimensions, matériau (bois, aluminium), système de pliage/rangement, exercices possibles, entretien",
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

/** Bénéfice concret par niche (pour des metas naturelles, sans superlatif). */
function nicheBenefit(key: NicheKey): string {
  const m: Partial<Record<NicheKey, string>> = {
    luminaires: "pour éclairer et habiller chaque pièce, du salon à la chambre",
    beaute: "pour une routine adaptée à votre type de peau",
    bebe: "pensés pour la sécurité, le confort et l'éveil de bébé",
    mode: "à porter au quotidien comme aux grandes occasions",
    bijoux: "à offrir ou à s'offrir, pensés pour durer",
    maison: "pour un intérieur chaleureux et à votre image",
    hightech: "choisis pour leurs performances et leur fiabilité au quotidien",
    sport: "pour vous entraîner chez vous, à votre rythme",
    animalerie: "pour le bien-être et le confort de votre animal",
  };
  return m[key] || "pour répondre précisément à votre besoin";
}

/**
 * Meta description naturelle (≤ 155 car.). Pas de superlatif automatique
 * (« premium », « meilleur »…) ni de formule faible (« Achetez maintenant »,
 * « Livraison rapide »). Descriptive et orientée bénéfice/usage.
 */
function metaFor(coll: string, key: NicheKey): string {
  const c = coll.toLowerCase();
  const de = /^[aeiouéèêâîôûh]/i.test(c) ? "d'" : "de ";
  const meta = `Découvrez notre sélection ${de}${c}, ${nicheBenefit(key)}. Conseils pour bien choisir et livraison soignée.`;
  return meta.length > 155 ? meta.slice(0, 152) + "…" : meta;
}

/**
 * Meta title NATUREL et descriptif (≤ 60 car.) — adapté SEO + Google Merchant
 * Center. Aucun adjectif promotionnel automatique (« premium », « professionnel »,
 * « haut de gamme », « meilleur », « qualité premium »). Forme : « Collection | Marque ».
 */
function titleFor(coll: string, ctx: CouncilContext): string {
  const brand = brandOf(ctx);
  const t = `${coll} | ${brand}`;
  if (t.length <= 60) return t;
  return coll.length <= 60 ? coll : coll.slice(0, 59) + "…";
}

/**
 * Variante de title avec un attribut concret (usage/contexte), sans superlatif.
 * Ex. « Produit + usage | Marque ». Repli sur le title simple si trop long.
 */
function titleVariant(coll: string, ctx: CouncilContext, vocab: NicheVocab): string {
  const brand = brandOf(ctx);
  const attr = vocab.pieces[0];
  const t = `${cap(singularize(coll))} ${attr} | ${brand}`;
  return t.length <= 60 ? t : titleFor(coll, ctx);
}

/** Stratégie mots-clés riche, adaptée à la niche, dérivée des collections réelles. */
function nicheKeywords(
  key: NicheKey,
  vocab: NicheVocab,
  cols: string[]
): { short: string[]; transactional: string[]; longtail: string[]; informational: string[]; comparative: string[]; faq: string[]; blog: string[] } {
  const sing = cols.map(singularize);
  const base = sing.length ? sing : ["votre catégorie"];
  const short = key === "luminaires"
    ? ["lustre", "suspension", "plafonnier", "lampe de chevet", "luminaire"]
    : base.slice(0, 5);
  const transactional = cols.slice(0, 4).flatMap((c) => [`acheter ${c.toLowerCase()}`, `${c.toLowerCase()} ${ctx0(key)}`]);
  const piece = vocab.pieces;
  const longtail = [
    ...cols.slice(0, 3).map((c) => `${singularize(c)} ${piece[0]}`),
    ...base.slice(0, 2).map((x) => `quel ${x} choisir`),
    ...(key === "luminaires" ? ["hauteur suspension salle à manger", "luminaire pour escalier haut plafond"] : []),
  ].slice(0, 8);
  const informational = [
    ...base.slice(0, 2).map((x) => `bienfaits ${x}`),
    ...base.slice(0, 1).map((x) => `comment utiliser ${x}`),
    ...(key === "luminaires" ? ["quelle ampoule choisir", "bien éclairer une chambre"] : ["comment entretenir " + (base[0] || "produit")]),
  ].slice(0, 6);
  const comparative = sing.length >= 2
    ? [`${sing[0]} ou ${sing[1]}`, `${sing[0]} : quel modèle choisir`]
    : [`${base[0]} : quel modèle choisir`];
  const faq = vocab.faqs(cols[0] || "produits");
  const blog = blogCalendar(key, vocab, cols).slice(0, 4).map((b) => b.title);
  return { short, transactional, longtail, informational, comparative, faq, blog };
}
function ctx0(key: NicheKey): string {
  return key === "mode" ? "femme" : key === "beaute" ? "naturel" : key === "sport" ? "maison" : "design";
}

interface BlogIdea { title: string; intent: string; keyword: string; link: string; objective: string; cta: string }
type RawIdea = Omit<BlogIdea, "objective" | "cta">;

/** Objectif SEO d'un article selon son intention. */
function blogObjective(intent: string): string {
  if (/transac|achat/.test(intent)) return "capter une requête proche de l'achat et router le trafic vers la page business (collection)";
  if (/comparatif/.test(intent)) return "lever l'hésitation entre deux options et sécuriser la décision d'achat";
  return "gagner en autorité thématique, capter la longue traîne informationnelle puis rediriger vers les collections";
}
/** CTA recommandé selon la page à mailler. */
function blogCta(link: string): string {
  const m = link.match(/«\s*([^»]+?)\s*»/);
  if (m) return `« Découvrir la collection ${m[1].trim()} »`;
  if (/fiche|produit/.test(link)) return "« Voir les modèles concernés »";
  return "« Voir notre sélection »";
}

/** Calendrier éditorial : 8–10 idées d'articles, chacune reliée à une collection. */
function blogCalendar(key: NicheKey, vocab: NicheVocab, cols: string[]): BlogIdea[] {
  const c = (i: number) => cols[i] || cols[0] || "votre collection";
  const sing = (i: number) => singularize(c(i));
  const raw: RawIdea[] = [];
  if (cols.length) {
    raw.push({ title: `Comment choisir ${articled(sing(0))} pour ${vocab.pieces[0]} ?`, intent: "guide d'achat (transactionnel)", keyword: `quel ${sing(0)} choisir`, link: `collection « ${c(0)} »` });
    if (cols[1]) raw.push({ title: `${cap(sing(0))} ou ${sing(1)} : que choisir selon votre besoin ?`, intent: "comparatif", keyword: `${sing(0)} ou ${sing(1)}`, link: `collections « ${c(0)} » et « ${c(1)} »` });
    raw.push({ title: `${cap(c(0))} : nos conseils pour bien choisir`, intent: "informationnel", keyword: `guide ${sing(0)}`, link: `collection « ${c(0)} »` });
    if (cols[2]) raw.push({ title: `Quel ${sing(2)} pour ${vocab.pieces[1] || vocab.pieces[0]} ?`, intent: "guide d'achat", keyword: `${sing(2)} ${vocab.pieces[1] || ""}`.trim(), link: `collection « ${c(2)} »` });
  }
  // Idées informationnelles spécifiques à la niche.
  if (key === "luminaires") {
    raw.push({ title: "À quelle hauteur installer une suspension au-dessus d'une table ?", intent: "informationnel", keyword: "hauteur suspension salle à manger", link: "collection « Suspensions »" });
    raw.push({ title: "Quelle ampoule choisir (LED, culot, température de couleur) ?", intent: "informationnel", keyword: "quelle ampoule choisir", link: "fiches produits" });
    raw.push({ title: "Bien éclairer chaque pièce : salon, chambre, cuisine, escalier", intent: "informationnel / cocon", keyword: "éclairage par pièce", link: "collections principales" });
    raw.push({ title: "Entretenir et nettoyer ses luminaires sans les abîmer", intent: "informationnel", keyword: "entretien luminaire", link: "FAQ produit" });
  } else if (key === "sport") {
    raw.push({ title: `Bois ou aluminium : quel ${sing(0)} choisir ?`, intent: "comparatif", keyword: `${sing(0)} bois ou aluminium`, link: `collection « ${c(0)} »` });
    raw.push({ title: `${cap(sing(0))} pliable : avantages, rangement et usage à domicile`, intent: "guide d'achat", keyword: `${sing(0)} pliable maison`, link: `collection « ${c(0)} »` });
    raw.push({ title: `Exercices ${sing(0)} pour débuter à la maison`, intent: "informationnel", keyword: `exercices ${sing(0)} débutant`, link: "fiches produits" });
    raw.push({ title: "Aménager un espace d'entraînement chez soi (même petit)", intent: "informationnel / cocon", keyword: "espace entraînement maison", link: "collections principales" });
  } else {
    raw.push({ title: `Les bienfaits ${articled(sing(0))} au quotidien`, intent: "informationnel", keyword: `bienfaits ${sing(0)}`, link: `collection « ${c(0)} »` });
    raw.push({ title: `${cap(sing(0))} : erreurs fréquentes à éviter`, intent: "informationnel", keyword: `${sing(0)} conseils`, link: `collection « ${c(0)} »` });
    raw.push({ title: `Comment entretenir ${articled(sing(0))} ?`, intent: "informationnel", keyword: `entretien ${sing(0)}`, link: "FAQ produit" });
  }
  return raw.slice(0, 10).map((b) => ({ ...b, objective: blogObjective(b.intent), cta: blogCta(b.link) }));
}
function cap(s: string): string { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function articled(s: string): string {
  // « un/une » approximatif évité : on emploie « son » (neutre, naturel en FR).
  return `son ${s}`;
}

/** Bloc SEO complet pour UNE collection réelle (niveau consultant). */
function collectionSeoBlock(ctx: CouncilContext, coll: string, vocab: NicheVocab, others: string[]): string {
  const key = detectNiche(`${ctx.niche ?? ""} ${ctx.brandName ?? ""}`);
  const sing = singularize(coll);
  const faqs = vocab.faqs(coll);
  const secondary = vocab.pieces.slice(0, 3).map((p) => `${sing} ${p}`);
  const internal = others.filter((c) => c !== coll).slice(0, 3);
  return `**📁 Collection « ${coll} »** — page business prioritaire (requête transactionnelle)
- **Intention de recherche** : transactionnelle (« acheter / choisir ${sing} »).
- **Mot-clé principal** : \`${sing}\` · **secondaires** : ${secondary.map((k) => `\`${k}\``).join(", ")} · **longue traîne** : \`quel ${sing} choisir\`, \`${sing} ${vocab.pieces[0]}\`.
- **Title (≤60)** : \`${titleFor(coll, ctx)}\`
- **Meta description (≤155)** : \`${metaFor(coll, key)}\`
- **Description de collection (150–250 mots)** : intro orientée bénéfice + critères de choix (${vocab.descHints.split(",").slice(0, 3).join(",")}), à placer **en haut de la description de collection**.
- **Structure** : **H1 unique** « ${coll} » → **H2 « Comment choisir ${articled(sing)} »** → **H2 « Nos best-sellers »** → **H2 « Questions fréquentes »**.
- **FAQ (4–6 questions)** : ${faqs[0]} / ${faqs[1]} / ${faqs[2]} / Quels délais de livraison et quelle garantie ?
- **Maillage interne** : ${internal.length ? internal.map((c) => `lien vers « ${c} » (ancre « ${singularize(c)} ${vocab.pieces[0]} »)`).join(" ; ") : "vers les collections complémentaires"}.
- **Où dans Shopify** : description → ${shopifyPath("collections")} · meta → ${shopifyPath("meta")} · FAQ → section dédiée du thème ou **AI Council → Code Shopify**.`;
}

/** Mot-clé produit propre : ~3 mots significatifs, sans mot-vide final. */
function productKeyword(title: string): string {
  const stop = new Set(["en", "de", "du", "des", "la", "le", "les", "à", "au", "aux", "et", "pour", "avec", "sur", "ou"]);
  const words = title.split(/\s+/).filter(Boolean).slice(0, 4);
  while (words.length > 1 && stop.has(words[words.length - 1].toLowerCase())) words.pop();
  return singularize(words.join(" "));
}

/** Bloc SEO pour UN produit prioritaire réel. */
function productSeoBlock(p: { title: string; reason: string; contentScore: number }, vocab: NicheVocab, parent?: string): string {
  const kwd = productKeyword(p.title);
  const ptype = cap(p.title.split(/\s+/)[0] || kwd); // catégorie (1er mot)
  const piece = vocab.pieces[0];
  return `**🛍️ ${p.title}** (score contenu ${p.contentScore}/100)
- **Problème détecté** : ${p.reason.toLowerCase()}.
- **Mot-clé cible** : \`${kwd}\` · **longue traîne** : \`${kwd} ${piece}\`, \`acheter ${kwd}\`.
- **Correction de la description** : ${productAction(p.reason, vocab)}.
- **product_type** : \`${ptype}\` (catégorie) · **Où** : ${shopifyPath("product_type")}.
- **Tags** : ${vocab.pieces.slice(0, 3).join(", ")}, matériau · **Où** : ${shopifyPath("tags")}.
- **Title / meta** : \`${p.title}\` (descriptif, ≤ 60 car., ajouter « | marque » si la place le permet) · **Où** : ${shopifyPath("meta")}.
- **Alt text** : « ${p.title} — ${piece} » · **Où** : ${shopifyPath("alt")}.
- **FAQ produit** : « ${vocab.faqs(p.title)[0]} » ; « Délais de livraison et garantie ? »
- **Maillage** : lien vers ${parent ? `la collection parente « ${parent} »` : "sa collection parente"} (ancre « ${kwd} ${piece} »).
- **Google Merchant** : titre \`${p.title}\`, type \`${ptype}\`, description factuelle (matériau, dimensions, usage) pour un flux Shopping cohérent.
- **Action** : **AI Council → Import Factory** (pré-rempli) → description 200+ mots + FAQ + meta + alt text.`;
}

/** Matrice de maillage interne à partir des collections réelles. */
function maillageBlock(cols: string[], vocab: NicheVocab): string {
  if (cols.length < 2) return "_Maillage interne : au moins 2 collections détectées sont nécessaires (donnée partielle via scan public)._";
  const rows: string[] = ["| Source | Cible | Ancre optimisée | Impact |", "|---|---|---|---|"];
  for (let i = 0; i < Math.min(cols.length, 4); i++) {
    const src = cols[i];
    const dst = cols[(i + 1) % cols.length];
    rows.push(`| ${src} | ${dst} | « ${singularize(dst)} ${vocab.pieces[0] || ""} » | Renforce le cocon sémantique ${vocab.pieces[0] ? "(" + vocab.pieces[0] + ")" : ""} |`);
  }
  return rows.join("\n");
}

/** Corrections prêtes à copier (2 meta, 2 titles, 3 FAQ, 3 alt, 3 ancres). */
function readyToCopyBlock(ctx: CouncilContext, cols: string[], vocab: NicheVocab): string {
  const key = detectNiche(`${ctx.niche ?? ""} ${ctx.brandName ?? ""}`);
  const c0 = cols[0] || "Collection";
  const c1 = cols[1] || cols[0] || "Collection";
  const faqs = vocab.faqs(c0);
  return `**Titles (naturels, ≤ 60 car., sans superlatif)**
- \`${titleFor(c0, ctx)}\`
- \`${titleVariant(c0, ctx, vocab)}\`
- \`${titleFor(c1, ctx)}\`

**Meta descriptions (≤ 155 car.)**
- \`${metaFor(c0, key)}\`
- \`${metaFor(c1, key)}\`

**FAQ (prêtes à coller)**
- ${faqs[0]}
- ${faqs[1]}
- ${faqs[2]}

**Alt text**
- « ${singularize(c0)} ${vocab.pieces[0]} — ${brandOf(ctx)} »
- « ${singularize(c1)} pour ${vocab.pieces[1] || vocab.pieces[0]} »
- « ${singularize(c0)} en situation (${vocab.pieces[0]}) »

**Ancres de maillage descriptives**
- « ${singularize(c1)} ${vocab.pieces[0]} » (vers « ${c1} »)
- « nos ${c0.toLowerCase()} » (depuis une fiche produit vers sa collection)
- « guide : comment choisir ${articled(singularize(c0))} » (depuis un article de blog)`;
}

/** Audit SEO de la page d'accueil (vitrine de marque + hub de maillage). */
function homeSeoBlock(ctx: CouncilContext, vocab: NicheVocab, cols: string[], key: NicheKey): string {
  const brand = brandOf(ctx);
  const niche = nicheOf(ctx);
  const top = cols.slice(0, 4);
  const benefit = nicheBenefit(key);
  const homeTitle = `${cap(niche)} | ${brand}`;
  const homeMeta = (() => {
    const cols2 = top.slice(0, 2).map((c) => c.toLowerCase()).join(" et ");
    const m = `${cap(niche)} ${benefit}. Découvrez ${cols2 ? "nos " + cols2 : "nos collections"} sur ${brand}.`;
    return m.length > 155 ? m.slice(0, 152) + "…" : m;
  })();
  const promise = ctx.promises?.[0];
  const anchors = top.length
    ? top.slice(0, 3).map((c) => `« ${singularize(c)} ${vocab.pieces[0]} » → « ${c} »`).join(" ; ")
    : "ancres descriptives vers vos collections principales";
  return `**🏠 Page d'accueil** — vitrine de marque + hub de maillage vers les collections.
- **Title (≤60)** : \`${homeTitle.length <= 60 ? homeTitle : brand}\` — décrit l'offre et la marque, sans superlatif.
- **Meta description (≤155)** : \`${homeMeta}\`
- **H1 unique** : un seul H1 qui pose la promesse (ex. « ${cap(niche)} ${benefit} »). Vérifier qu'aucun logo/slogan n'est balisé en second H1. Où : ${shopifyPath("h1")}.
- **Structure H2/H3** : H2 « Nos collections », « Best-sellers », « Pourquoi ${brand} », « Avis clients », « Questions fréquentes » — intégrer le mot-clé dans les titres (ex. « Nos ${(top[0] || "produits").toLowerCase()} »).
- **Textes visibles** : 2–3 phrases d'intro orientées bénéfice/usage (${vocab.descHints.split(",").slice(0, 2).join(",")}), sans remplissage ni superlatif.
- **Maillage vers collections** : liens explicites ${top.length ? `vers ${top.join(", ")}` : "vers vos collections"} avec ancres descriptives (${anchors}), pas « voir plus ».
- **Promesse** : ${promise ? `mettre « ${promise} » au-dessus de la ligne de flottaison` : "afficher une promesse claire (différenciation, usage, garantie) au-dessus de la ligne de flottaison"}.
- **Cohérence de langue** : ${ctx.englishCount ? `traduire les ${ctx.englishCount} libellé(s) anglais détecté(s)` : "vérifier qu'aucun libellé anglais (« Add to cart », « Sold out ») ne subsiste"}. Où : ${shopifyPath("english")}.
- **Où éditer** : contenu → ${shopifyPath("home")} · title/meta de la home → ${shopifyPath("meta")}.`;
}

/** Mots-clés ciblés par collection réelle. */
function keywordsByCollection(cols: string[], vocab: NicheVocab): { coll: string; kws: string[] }[] {
  return cols.slice(0, 5).map((c) => {
    const k = singularize(c);
    return { coll: c, kws: [k, `acheter ${k}`, `${k} ${vocab.pieces[0]}`, `quel ${k} choisir`] };
  });
}
/** Mots-clés ciblés par produit prioritaire réel. */
function keywordsByProduct(prio: { title: string }[], vocab: NicheVocab): { title: string; kws: string[] }[] {
  return prio.slice(0, 5).map((p) => {
    const k = productKeyword(p.title);
    return { title: p.title, kws: [k, `${k} avis`, `${k} ${vocab.pieces[0]}`] };
  });
}

/** « Contenus à ajouter et où les ajouter dans Shopify » (tableau quoi/où/pourquoi). */
function contentToAddBlock(ctx: CouncilContext, cols: string[], vocab: NicheVocab): string {
  const c0 = cols[0] || "collection principale";
  const rows = [
    "| Contenu à ajouter | Où exactement dans Shopify | Pourquoi |",
    "|---|---|---|",
    `| Description de collection 150–250 mots (${cols.slice(0, 3).join(", ") || "collections"}) | ${shopifyPath("collections")} | Donne du contenu indexable aux pages transactionnelles |`,
    `| FAQ de collection (4–6 questions) | Section FAQ du thème ou AI Council → Code Shopify | Rich snippets + réponses aux objections |`,
    `| Meta title/description par page | ${shopifyPath("meta")} | CTR dans Google + cohérence Merchant |`,
    `| Alt text descriptif sur les images clés | ${shopifyPath("alt")} | Accessibilité + référencement images |`,
    `| product_type + tags sur les fiches | ${shopifyPath("product_type")} / ${shopifyPath("tags")} | Catégorisation + flux Google Shopping |`,
    `| 1 article de blog/semaine maillé vers « ${c0} » | Boutique en ligne → Articles de blog → Ajouter | Longue traîne + maillage vers les collections |`,
  ];
  return rows.join("\n");
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
  const byColl = keywordsByCollection(realCols, vocab);
  const byProd = keywordsByProduct(prio, vocab);

  // Priorités par impact.
  const high: string[] = [];
  const mid: string[] = [];
  const low: string[] = [];
  if (ctx.weakDescriptions) high.push(`Enrichir les **${ctx.weakDescriptions} fiches** à description faible (commencer par les best-sellers).`);
  if (realCols.length) high.push(`Ajouter texte SEO + FAQ sur les collections : ${realCols.slice(0, 4).join(", ")}.`);
  if (ctx.missingMeta) high.push(`Réécrire les **${ctx.missingMeta} meta descriptions** manquantes.`);
  if (ctx.englishCount) high.push(`Traduire les **${ctx.englishCount} textes anglais** (confiance + cohérence + signal Merchant).`);
  if (ctx.noType) mid.push(`Renseigner le \`product_type\` sur **${ctx.noType} produits** (catégorisation + flux Shopping).`);
  if (ctx.imagesNoAlt) mid.push(`Ajouter les alt text sur **${ctx.imagesNoAlt} images**.`);
  mid.push("Mettre en place le maillage interne collection ↔ collection (voir matrice).");
  if (ctx.tagsCoverage != null && ctx.tagsCoverage < 60) low.push(`Améliorer les tags (couverture actuelle ${ctx.tagsCoverage}%).`);
  low.push("Créer un cluster blog (guides d'achat) relié aux collections.");

  const colBlocks = realCols.length
    ? realCols.slice(0, 3).map((c) => collectionSeoBlock(ctx, c, vocab, realCols)).join("\n\n")
    : "_Donnée non disponible via scan public : aucune collection détectée. Une connexion API Shopify permettra l'analyse collection par collection._";
  const prodBlocks = prio.length
    ? prio.slice(0, 5).map((p) => productSeoBlock(p, vocab, realCols[0])).join("\n\n")
    : "_Donnée non disponible via scan public : aucun produit prioritaire isolé. Élargissez le scan ou connectez l'API Shopify._";

  // Points déjà bons (à NE PAS retoucher).
  const good: string[] = [];
  if (ctx.weakTitles === 0) good.push("**Titres produits** : corrects (0 titre faible détecté) — ne pas les réécrire.");
  if (ctx.weakDescriptions === 0) good.push("**Descriptions produits** : correctes selon le scan — ne pas tout refaire.");
  if (ctx.tagsCoverage != null && ctx.tagsCoverage >= 80) good.push(`**Tags** : couverture ${ctx.tagsCoverage}% — laisser tel quel.`);
  if (ctx.missingMeta === 0) good.push("**Meta descriptions** : présentes sur l'échantillon — ne pas les remplacer.");
  if (ctx.legalFound?.length && !ctx.missingLegal?.length) good.push("**Pages de confiance** : socle légal présent — ne pas y toucher.");

  const ideas = blogCalendar(key, vocab, realCols);
  const cal = ideas.slice(0, 4);

  return `## 🎯 Stratégie SEO Shopify de ${s}

${scanContextLine(ctx)}## Diagnostic SEO exécutif
${s} opère sur la niche **${niche}**${ctx.positioning ? ` (positionnement ${ctx.positioning})` : ""}. La croissance SEO se joue sur trois leviers : (1) l'**optimisation on-page des pages business** (collections = requêtes transactionnelles), (2) la **profondeur des fiches produits** (conversion + longue traîne + flux Merchant), (3) un **cocon de contenu** (blog) qui capte la longue traîne et alimente le maillage interne.

**Données exploitées** : ${dataUsed(ctx).join(" · ") || "mémoire boutique (lancez un scan pour des chiffres précis)"}.

## ✅ Ce qui est déjà bon — à NE PAS retoucher
${good.length ? good.map((g) => `- ${g}`).join("\n") : "- (peu de signaux positifs isolés sur la vue publique — l'API Shopify affinera ce constat)"}
> Ne refais pas ces éléments : concentre le temps sur les vrais blocages ci-dessous.

## 🚧 Ce qui bloque vraiment
${high.length ? high.map((x) => `- ${x}`).join("\n") : "- (rien de bloquant détecté sur la vue publique)"}
**Ensuite (impact moyen)** : ${mid.join(" · ")}
**Plus tard (impact faible)** : ${low.join(" · ")}

## 🏠 Audit page d'accueil
${homeSeoBlock(ctx, vocab, cols, key)}

## 📁 Audit collections (pages business prioritaires)
> Les collections captent les **requêtes transactionnelles** : ce sont vos pages prioritaires à positionner.
${colBlocks}

## 🛍️ Audit produits (conversion + longue traîne + Merchant)
> Rôle : conversion, longue traîne produit, flux Google Shopping et maillage vers la collection parente.
${prodBlocks}

## 🔑 Mots-clés par intention
- **Courte traîne** : ${kw.short.map((k) => `\`${k}\``).join(", ")}
- **Transactionnels** : ${kw.transactional.map((k) => `\`${k}\``).join(", ")}
- **Longue traîne** : ${kw.longtail.map((k) => `\`${k}\``).join(", ")}
- **Informationnels** : ${kw.informational.map((k) => `\`${k}\``).join(", ")}
- **Comparatifs** : ${kw.comparative.map((k) => `\`${k}\``).join(", ")}
- **FAQ** : ${kw.faq.map((k) => `« ${k} »`).join(" ")}

**Mots-clés par collection**
${byColl.length ? byColl.map((b) => `- **${b.coll}** : ${b.kws.map((k) => `\`${k}\``).join(", ")}`).join("\n") : "- _collections non détectées via scan public_"}

**Mots-clés par produit prioritaire**
${byProd.length ? byProd.map((b) => `- **${b.title}** : ${b.kws.map((k) => `\`${k}\``).join(", ")}`).join("\n") : "- _produits prioritaires non isolés via scan public_"}

## ✂️ Titles / meta prêts à copier
${readyToCopyBlock(ctx, cols, vocab)}

## 📝 Contenus à ajouter et où les ajouter dans Shopify
${contentToAddBlock(ctx, cols, vocab)}

## 🔗 Maillage interne recommandé
${maillageBlock(realCols, vocab)}
> Principe du **cocon sémantique** : fiche produit → collection parente ; collection → 2–3 collections sœurs ; article de blog → collection cible (ancres descriptives, jamais « cliquez ici »).

## 🗓️ Calendrier éditorial 4 semaines
> Rythme : **1 article/semaine**, chacun maillé vers une collection.

| Semaine | Article | Mot-clé cible | Intention | Page à mailler | Objectif SEO | CTA recommandé |
|---|---|---|---|---|---|---|
${cal.map((b, i) => `| S${i + 1} | ${b.title} | \`${b.keyword}\` | ${b.intent} | ${b.link} | ${b.objective} | ${b.cta} |`).join("\n")}

**Autres idées** : ${ideas.slice(4).map((b) => `« ${b.title} »`).join(" · ") || "à étoffer après le 1er mois"}.

## 🔁 Routine SEO hebdomadaire
- Enrichir **1 collection** (texte + FAQ).
- Optimiser **2 fiches produits** (en partant des scores de contenu les plus bas).
- Publier **1 article de blog** longue traîne.
- Ajouter **5 à 10 liens internes** (collections ↔ collections, blog → collections, fiches → collection parente).
- Corriger les **alt text prioritaires** des nouvelles images.
- Relancer un **scan Orkestra** pour mesurer la progression.
- Suivre **Google Search Console** (impressions, position, CTR par page).
- Ajuster selon les **impressions et le CTR** : retravailler en priorité les titles/meta des pages affichées mais peu cliquées.
> Produits : **ajouter de nouveaux produits seulement s'ils répondent à une vraie intention de recherche ou à une demande catalogue** — pas de cadence automatique « X produits/jour ».

## 📅 Plan 7 jours (où agir dans Shopify)
- **J1 — Cohérence de langue** : traduire les ${ctx.englishCount ?? 0} textes anglais. Où : ${shopifyPath("english")}
- **J2 — Indexation/CTR** : rédiger les ${ctx.missingMeta ?? 0} meta descriptions manquantes (modèles ci-dessus). Où : ${shopifyPath("meta")}
- **J3 — Structure** : un **H1 unique** sur la home + corriger les H1 multiples. Où : ${shopifyPath("h1")}
- **J4 — Flux catalogue** : compléter \`product_type\` (${ctx.noType ?? 0}) et les tags. Où : ${shopifyPath("product_type")} / ${shopifyPath("tags")}
- **J5 — Page business** : description de collection 200–300 mots sur « ${cols[0] || "collection principale"} ». Où : ${shopifyPath("collections")}
- **J6 — FAQ collection** : ajouter une FAQ (rich snippets). Comment : section FAQ du thème ou **AI Council → Code Shopify**.
- **J7 — Contenu** : publier l'article « ${cal[0]?.title || "1er guide d'achat"} » + 3 liens internes vers ${realCols.slice(0, 3).join(", ") || "vos collections"}.

## 🗺️ Roadmap 30 jours
- **Semaine 1 — Technique visible** : textes anglais, meta, H1, tags/product_type.
- **Semaine 2 — Pages business** : collections principales (${realCols.slice(0, 4).join(", ") || "à détecter"}) + fiches prioritaires + alt text des images clés.
- **Semaine 3 — Cocon sémantique** : 2 à 4 articles longue traîne + liens internes vers les collections.
- **Semaine 4 — Consolidation** : FAQ, maillage complet, **relance d'un scan Orkestra**, suivi Search Console (positions/CTR), ajustements.

## 🚀 Actions Orkestra recommandées
- **Import Factory** : générer les meta descriptions et les contenus collectionnels/fiches.
- **Merchant Shield** : vérifier les textes anglais et les signaux de confiance (avant Google Shopping).
- **AI Council** : produire la stratégie blog et le plan de maillage interne.
- **Code Shopify (AI Council)** : créer une FAQ de collection ou une section guide.
- **Mémoire boutique** : garder ton, niche et mots-clés cohérents dans toutes les générations.

> Données non visibles via scan public (balises exactes par page, contenu réel des collections) : une **connexion API Shopify** les rendra exploitables pour un audit encore plus précis.`;
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

> Je peux générer directement les fiches produits (Import Factory) ou les meta — dites-moi par quoi commencer.`;
}

function sectionTypeFromQuestion(q: string): string {
  const t = q.toLowerCase();
  if (/faq|question/.test(t)) return "FAQ animée";
  if (/réassur|reassur|confiance|garantie|livraison/.test(t)) return "Bloc réassurance";
  if (/comparatif|comparaison|versus/.test(t)) return "Comparatif produit";
  if (/avis|témoignage|temoignage|review/.test(t)) return "Avis clients";
  if (/sticky|panier|add to cart/.test(t)) return "Sticky add-to-cart";
  if (/storytelling|histoire|à propos/.test(t)) return "Storytelling";
  if (/bénéfice|benefice|avantage/.test(t)) return "Section bénéfices";
  if (/image|texte/.test(t)) return "Image + texte";
  return "Hero premium";
}

function codeAnswer(ctx: CouncilContext, question: string): string {
  const s = brandOf(ctx);
  const niche = nicheOf(ctx);
  const explainOnly = /\b(explique|où (l['’])?installer|où installer|comment (ajouter|installer)|où dans shopify|précaution|precaution)\b/i.test(question) && !/\b(crée|cree|génère|genere|code|écris|ecris|fais)\b/i.test(question);
  const type = sectionTypeFromQuestion(question);

  if (explainOnly) {
    return `## 🧩 Installer une section dans Shopify

1. **Admin Shopify → Boutique en ligne → Thèmes → ⋯ → Modifier le code.**
2. **Sections → Ajouter un fichier** → nommez-le \`ma-section.liquid\`.
3. Collez le **Liquid + le \`{% schema %}\`** (le CSS et le JS éventuels vont dans la balise \`<style>\`/\`<script>\` du même fichier — aucun asset externe).
4. Enregistrez, puis **Personnaliser** → ajoutez la section et réglez ses options.
5. **Avant publication** : aperçu mobile, contenu réel, contraste, liens des CTA.

> Dites-moi quel type de section vous voulez (FAQ, hero, réassurance, comparatif…) et je vous génère le code complet, adapté à ${s}.`;
  }

  // Génère une section premium adaptée à la niche/boutique.
  const sec = generateSection({
    type,
    goal: `Section ${type} pour ${s} (${niche})`,
    animations: true,
    niche: ctx.niche,
    brandName: ctx.brandName,
    collection: ctx.collections?.[0],
  });
  const jsBlock = sec.js && !/aucun js/i.test(sec.js) ? `\n**JS (encapsulé, non bloquant)**\n\`\`\`js\n${sec.js}\n\`\`\`` : "\n_Aucun JavaScript nécessaire (CSS/Liquid suffisent)._";
  const faqHint = niche.includes("lumi")
    ? " — pour des luminaires, pensez aux questions : hauteur d'installation, type d'ampoule, choix selon la pièce (salon, salle à manger, chambre, escalier), entretien, livraison/retours."
    : "";

  return `## 🧩 Section Shopify — ${type} pour ${s}

### 1. Résumé
- **Type** : ${type}
- **Objectif** : ${sectionPurpose(sectionKey(type))}${faqHint}
- **Page recommandée** : ${sectionPlacement(sectionKey(type), undefined)}
- **Pourquoi** : ${sectionWhy(sectionKey(type))}${ctx.collections?.length ? ` Aligné sur vos collections (${ctx.collections.slice(0, 3).join(", ")}).` : ""}

### 2. Code complet (Online Store 2.0)
**Liquid**
\`\`\`liquid
${sec.liquid}
\`\`\`
**CSS**
\`\`\`css
${sec.css}
\`\`\`
**Schema**
\`\`\`liquid
${sec.schema}
\`\`\`${jsBlock}

### 3. Installation
${sec.installSteps.map((x, i) => `${i + 1}. ${x}`).join("\n")}

### 4. Checklist qualité
${sec.responsiveChecklist.map((c) => `- ✅ ${c.label}`).join("\n")}
- ✅ Schema JSON valide · classes namespacées \`.ork-\` · aucune dépendance externe${sec.warnings && sec.warnings.length ? `\n- ⚠️ ${sec.warnings.join(" · ")}` : ""}

### 5. Pour aller plus loin (demandez simplement)
« Rends-la plus premium » · « Optimise le mobile » · « Ajoute plus de settings » · « Version sans JS » · « Corrige le code » · « Adapte à ma niche » · « Adapte pour ma page produit » · « Adapte pour la home » · « Fais une version plus luxe »

> ⚠️ **Mode démo** — ceci est un exemple de structure. Connectez OpenAI (ou Claude prochainement) pour générer/raffiner une version premium finale avant installation.`;
}

function merchantAnswer(ctx: CouncilContext): string {
  const s = brandOf(ctx);
  const found = ctx.legalFound ?? [];
  const missing = ctx.missingLegal ?? [];
  const score = ctx.merchantScore;

  const reassuring: string[] = [];
  for (const f of found) reassuring.push(`${f} détectée : OK`);
  if (!reassuring.length) reassuring.push("Aucune page de confiance détectée publiquement (à vérifier).");

  const critical: string[] = [];
  const important: string[] = [];
  const minor: string[] = [];
  for (const m of missing) {
    if (/retour|livraison|mentions/i.test(m)) critical.push(`**${m} non détectée** → cause fréquente de refus/suspension Merchant.`);
    else important.push(`**${m} non détectée** → à ajouter avant soumission.`);
  }
  if (ctx.englishCount) critical.push(`**${ctx.englishCount} textes anglais** sur une boutique ${ctx.language || "FR"} → incohérence de langue (signal négatif).`);
  if (ctx.weakDescriptions) important.push(`**${ctx.weakDescriptions} fiches** à description faible → risque « contenu insuffisant / misrepresentation ».`);
  if (ctx.noType) important.push(`**${ctx.noType} produits sans \`product_type\`** → catégorisation faible dans le flux Shopping.`);
  if (ctx.imagesNoAlt) minor.push(`**${ctx.imagesNoAlt} images sans alt** → impact SEO/accessibilité, priorité Merchant **secondaire** vs pages légales/descriptions.`);
  if (!found.includes("Garantie")) important.push("**Garantie** non détectée → à ajouter ou clarifier (rassure Google et l'acheteur).");
  if (!critical.length) critical.push("Aucun risque critique évident détecté sur la vue publique — vérifiez tout de même les pages légales en profondeur.");

  return `## 🛡️ Audit conformité Merchant Center — ${s}

> ⚠️ Aucun outil ne peut garantir l'absence de suspension. Orkestra **détecte les risques fréquents visibles publiquement** et aide à rendre la boutique plus propre **avant soumission** à Google Merchant Center / Shopping. Google reste seul décisionnaire.

### 📊 Résumé conformité apparent
${dataUsed(ctx).filter((d) => /produit|collection|anglais|légal|meta|images|couverture/i.test(d)).map((d) => `- ${d}`).join("\n") || "- Données de scan limitées."}
${score != null ? `\n**Score Merchant apparent : ${score}/100** (estimation vue publique).` : ""}

### ✅ Éléments rassurants déjà présents
${reassuring.map((r) => `- ${r}`).join("\n")}

### 🔴 Risques critiques (à corriger avant Shopping)
${critical.map((r) => `- ${r}`).join("\n")}

### 🟠 Risques importants
${important.length ? important.map((r) => `- ${r}`).join("\n") : "- Aucun risque important supplémentaire détecté."}

### 🟡 Risques mineurs
${minor.length ? minor.map((r) => `- ${r}`).join("\n") : "- Promotions trop agressives à éviter ; multiplier les moyens de contact."}

### ✅ Checklist avant soumission Merchant Center
- [ ] Politique de **retour** et de **livraison** claires, liées au footer.
- [ ] **Mentions légales**, **CGV**, **confidentialité**, **contact** présentes.
- [ ] **Garantie** et informations entreprise visibles.
- [ ] **Aucun texte anglais** résiduel (${ctx.englishCount ?? 0} détecté(s)).
- [ ] Descriptions produits solides (200+ mots) sur les best-sellers.
- [ ] \`product_type\` renseigné, prix cohérents fiche/panier/flux.

### 🗂️ Plan de correction priorisé
1. Pages légales manquantes${missing.length ? ` (${missing.join(", ")})` : ""}.
2. Traduction des libellés anglais.
3. Enrichissement des descriptions + product_type.
4. Alt text (priorité plus basse côté Merchant).

### 🚀 Modules Orkestra
- **Merchant Shield** : audit détaillé + correctifs générables.
- **Import Factory** : descriptions produits solides + meta.
- **Section Builder** : bloc réassurance + pages de confiance.`;
}

type EmailCase = "retard" | "retour" | "dimensions" | "hesitant" | "b2b" | "reclamation" | "relance" | "devis" | "general";
function detectEmailCase(q: string): EmailCase {
  const t = q.toLowerCase();
  if (/retard|pas reçu|pas recu|où est|ou est|suivi/.test(t)) return "retard";
  if (/retour|rembours|rétract|retract|échange|echange/.test(t)) return "retour";
  if (/dimension|taille|mesure|hauteur|largeur/.test(t)) return "dimensions";
  if (/hésit|hesit|conseil|aider à choisir|lequel/.test(t)) return "hesitant";
  if (/b2b|professionnel|grossiste|revendeur|entreprise/.test(t)) return "b2b";
  if (/réclam|reclam|mécontent|mecontent|cassé|casse|défect|defect|plainte/.test(t)) return "reclamation";
  if (/relance|sans réponse|sans reponse|panier abandonné/.test(t)) return "relance";
  if (/devis|cotation|prix pour|tarif/.test(t)) return "devis";
  return "general";
}

function emailAnswer(ctx: CouncilContext, question: string): string {
  const s = brandOf(ctx);
  const vous = ctx.formality === "tutoiement" ? "tu" : "vous";
  const greet = vous === "tu" ? "Bonjour [Prénom]," : "Bonjour [Prénom],";
  const ship = ctx.shippingDelay || "[délai de livraison à confirmer]";
  const ret = ctx.returnPolicy || "[politique de retour à confirmer]";
  const c = detectEmailCase(question);

  const cases: Record<EmailCase, { analyse: string; objet: string; corps: string }> = {
    retard: { analyse: "Le client s'inquiète d'un retard de livraison → rassurer + donner une action concrète (suivi).", objet: `Votre commande ${s} — suivi et délai`, corps: `Merci pour votre message, et navré pour l'attente. Votre commande a bien été prise en compte ; le délai habituel est de ${ship}. Je vérifie immédiatement le suivi et reviens vers vous avec le statut exact. Si le colis devait dépasser le délai annoncé, nous trouverons une solution (renvoi ou geste commercial).` },
    retour: { analyse: "Demande de retour/remboursement → rappeler la politique et faciliter la démarche.", objet: `Votre retour ${s} — marche à suivre`, corps: `Bien sûr, c'est possible. Notre politique : ${ret}. Pour lancer le retour, indiquez-${vous === "tu" ? "moi" : "moi"} votre numéro de commande ; je ${vous === "tu" ? "t'" : "vous "}envoie les instructions et l'étiquette le cas échéant. Le remboursement est traité dès réception et contrôle de l'article.` },
    dimensions: { analyse: "Demande de dimensions/caractéristiques → donner les infos disponibles, ne pas inventer.", objet: `Dimensions & caractéristiques — ${s}`, corps: `Merci de votre intérêt. Pour ce produit, voici les informations [à compléter depuis la fiche : dimensions, matériau, ${ctx.niche?.includes("lumi") ? "hauteur d'installation, type d'ampoule" : "usage"}]. Si vous me précisez le modèle exact, je vous confirme les mesures et vous conseille selon votre besoin.` },
    hesitant: { analyse: "Client hésitant → rassurer, conseiller, lever l'objection.", objet: `Je vous aide à choisir — ${s}`, corps: `Avec plaisir ! Pour bien vous conseiller : quel est votre besoin (pièce, style, budget) ? En général, ${vous === "tu" ? "tu peux" : "vous pouvez"} compter sur ${ctx.promises?.slice(0, 2).join(", ") || "notre sélection premium"}. Et si le produit ne convient pas, ${ret}.` },
    b2b: { analyse: "Demande B2B/pro → ouvrir le dialogue, proposer conditions volume.", objet: `Demande professionnelle — ${s}`, corps: `Merci pour votre intérêt. Nous accompagnons les professionnels (revendeurs, projets). Pour vous faire une proposition adaptée : quels produits/quantités visez-vous, et pour quelle échéance ? Je reviens vers vous avec des conditions (tarifs volume, délais, livraison).` },
    reclamation: { analyse: "Réclamation → empathie d'abord, puis solution rapide.", objet: `Votre réclamation — nous prenons en charge (${s})`, corps: `Je suis sincèrement navré pour ce désagrément, ce n'est pas le niveau de qualité que nous visons. Pouvez-${vous === "tu" ? "tu m'" : "vous m'"}envoyer une photo et votre numéro de commande ? Je vous propose immédiatement [remplacement / remboursement] et fais le nécessaire en priorité.` },
    relance: { analyse: "Relance/panier abandonné → rappel doux + incitation.", objet: `Votre sélection ${s} vous attend`, corps: `Je reviens vers ${vous === "tu" ? "toi" : "vous"} : votre sélection est toujours disponible. Si une question vous a retenu (livraison, dimensions, choix), je suis là pour ${vous === "tu" ? "t'" : "vous "}aider. Pour rappel : ${ctx.promises?.slice(0, 2).join(", ") || "livraison soignée et retours simples"}.` },
    devis: { analyse: "Demande de prix/devis par email → cadrer le besoin avant chiffrage.", objet: `Votre demande de devis — ${s}`, corps: `Merci pour votre demande. Pour établir un devis précis : quels produits/quantités, et pour quelle date de livraison souhaitée ? Dès réception, je vous envoie un devis détaillé (prix, délais, conditions).` },
    general: { analyse: "Demande générale → réponse pro, claire, orientée solution.", objet: `Votre message — ${s}`, corps: `Merci pour votre message. [Reformulation de la demande.] Voici ce que je vous propose : [solution concrète], sous [délai]. ${ret}. Je reste à votre disposition pour toute question.` },
  };
  const e = cases[c];

  return `## ✉️ Email client — ${s}

**Analyse rapide** : ${e.analyse}

### Email prêt à envoyer
**Objet :** ${e.objet}

---
${greet}

${e.corps}

${vous === "tu" ? "À très vite," : "Bien à vous,"}
[Votre prénom] — Service client ${s}
---

### Variante courte
> ${greet} ${e.corps.split(".")[0]}. Je m'en occupe et reviens vers ${vous === "tu" ? "toi" : "vous"} rapidement. ${vous === "tu" ? "À bientôt" : "Bien à vous"}, ${s}.

### Variante plus chaleureuse
> Ajoutez une touche personnelle (remerciement sincère, petit geste) et un emoji léger si votre marque le permet.

> ⚠️ Les informations entre [crochets] ne sont pas confirmées par le scan public — **à vérifier dans votre back-office** avant envoi (ton : ${ctx.formality || "vouvoiement"}${ctx.shippingDelay ? `, livraison ${ctx.shippingDelay}` : ""}).`;
}

function quoteAnswer(ctx: CouncilContext, question: string): string {
  const s = brandOf(ctx);
  const ship = ctx.shippingDelay || "[délai à confirmer]";
  return `## 🧾 Assistant devis — ${s}

**Résumé du besoin** : ${question ? `« ${question.trim().slice(0, 120)} »` : "devis commercial (à préciser)"}.

### À demander si l'info manque
- Produits/références exactes + **quantités**.
- **Date de livraison** souhaitée + adresse (national/international).
- Cadre : particulier, **B2B / revendeur**, projet **sur-mesure**, **lot**, livraison spéciale.
- Budget indicatif (utile pour proposer une gamme).

### Structure de devis recommandée
**Émis par :** ${s} · **Pour :** [Client] · **Date :** [date] · **Validité :** 30 jours

| Réf. | Désignation | Qté | PU HT | Remise | Total HT |
|---|---|---|---|---|---|
| [réf.1] | [produit] | [qté] | [€] | [%] | [€] |
| [réf.2] | [produit] | [qté] | [€] | [%] | [€] |

**Récapitulatif** : Total HT [€] · TVA 20% [€] · **Total TTC [€]**

### Conditions
- **Acompte** 30% à la commande, solde avant expédition (ajustable B2B).
- **Délai** : ${ship} après validation (préciser si sur-mesure).
- **Remise volume** : proposer un palier (ex. -5% dès [X] unités, -10% dès [Y]).
- Frais de livraison : [selon poids/destination].

### Message d'accompagnement (email)
> Bonjour [Prénom], suite à votre demande, voici votre devis en pièce jointe. Il est valable 30 jours et inclut [points clés]. Je reste disponible pour l'ajuster (quantités, délais, livraison). Bien à vous, ${s}.

### ✅ À vérifier avant envoi
- Prix et remises cohérents avec vos marges.
- TVA et mentions légales (n° devis, SIRET).
- Délais réalistes selon stock/sur-mesure.

> Données produits/prix exactes : **non disponibles via scan public** — à renseigner depuis votre catalogue (l'API Shopify les rendra automatiques).`;
}

function strategyAnswer(ctx: CouncilContext): string {
  const s = brandOf(ctx);
  const cols = ctx.collections?.length ? ctx.collections : [];
  return `## 📈 Diagnostic & stratégie e-commerce — ${s}

### Diagnostic business rapide
${dataUsed(ctx).slice(0, 6).map((d) => `- ${d}`).join("\n") || "- Lancez un scan pour un diagnostic chiffré."}
- Niche : **${nicheOf(ctx)}**, positionnement **${ctx.positioning || "premium"}**.

### Priorités par impact
- **Haut** : ${ctx.weakDescriptions ? `enrichir ${ctx.weakDescriptions} fiches faibles + ` : ""}optimiser le SEO des collections (${cols.slice(0, 3).join(", ") || "principales"}) — ROI durable.
- **Moyen** : réassurance + preuve sociale pour la conversion ; ${ctx.englishCount ? `traduire ${ctx.englishCount} libellés ; ` : ""}corriger les pages légales.
- **Bas** : alt text, tags, structure catalogue.

### Opportunités de croissance
- **SEO** : ${ctx.productsFound ?? "de nombreux"} produits → fort potentiel longue traîne (clusters par collection).
- **Conversion** : fiches premium + FAQ + avis = +taux de transformation sans coût d'acquisition.
- **Contenu** : guides d'achat (« comment choisir… ») reliés aux collections.
- **Ads/Merchant** : flux Shopping propre (product_type, descriptions) sur les best-sellers à marge.

### Roadmap
**7 jours** — quick wins : meta manquantes (${ctx.missingMeta ?? 0}), textes anglais (${ctx.englishCount ?? 0}), product_type (${ctx.noType ?? 0}), réassurance home.
**30 jours** — contenu SEO collections + 15–20 fiches enrichies + maillage interne + scénarios email (bienvenue, panier, post-achat).
**90 jours** — clusters blog, programme fidélité, montée en puissance Google Shopping, optimisation continue (A/B fiches & home).

### ⚡ Quick wins
- Bloc réassurance haut de home (Section Builder).
- FAQ collections (rich snippets).
- Avis clients visibles au-dessus de la ligne de flottaison.

### ⚠️ Risques
- Conformité Merchant (pages légales/langue) avant d'investir en Ads.
- Contenu dupliqué/fournisseur sur les fiches → pénalisant SEO.

### 🚀 Modules Orkestra
- **Import Factory** (contenu), **Merchant Shield** (conformité avant Ads), **Section Builder** (conversion).

> Demandez **« plan d'action sur 30 jours »** pour le détail hebdomadaire.`;
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

function competitorBlock(name: string, ctx: CouncilContext, vocab: NicheVocab): string {
  const niche = nicheOf(ctx);
  const cats = (ctx.collections?.length ? ctx.collections : (ctx.productTypes ?? [])).slice(0, 4).join(", ") || niche;
  return `**${name}**
- *Type* : boutique e-commerce spécialisée ${niche}.
- *Positionnement probable* : proche du vôtre (${ctx.positioning || "premium"}), spécialiste de la catégorie.
- *Catégories fortes* : ${cats}.
- *Angle SEO probable* : pages collections optimisées + guides d'achat (${vocab.descHints.split(",").slice(0, 2).join(",")}) — à analyser.
- *Forces UX/conversion à surveiller* : fiches riches, réassurance, avis clients (à vérifier avec une URL).
- *Opportunité pour vous* : créer des collections plus riches + un meilleur maillage interne par ${vocab.pieces[0] ? "pièce (" + vocab.pieces.slice(0, 3).join(", ") + ")" : "usage"}.
- *Orkestra recommande* : les dépasser sur la profondeur de contenu (FAQ, guides) et la spécificité longue traîne.`;
}

function competitiveAnswer(ctx: CouncilContext): string {
  const s = brandOf(ctx);
  const niche = nicheOf(ctx);
  const key = detectNiche(`${ctx.niche ?? ""} ${ctx.brandName ?? ""}`);
  const { preset } = getPreset(ctx);
  const vocab = nicheVocab(key);

  // Concurrents DIRECTS spécialisés (saisis par l'utilisateur, sinon preset),
  // en excluant les généralistes.
  const generalists = preset.generalists ?? [];
  const userDirect = (ctx.competitors ?? []).filter((c) => !generalists.some((g) => g.toLowerCase() === c.toLowerCase()));
  const direct = (userDirect.length ? userDirect : preset.competitors).slice(0, 5);
  const fromUser = userDirect.length > 0;
  const conf = fromUser ? "confiance élevée (fourni)" : "confiance : à confirmer (basée sur la niche)";
  const cols = ctx.collections ?? [];

  return `## ⚔️ Analyse concurrentielle — ${s} (niche ${niche})

> ℹ️ **Analyse indicative basée sur la niche, les produits et le positionnement détectés** (pas de recherche web ni de crawl concurrent). Les noms ci-dessous sont des **concurrents directs probables** ; aucun chiffre (trafic, CA, conversion, parts de marché) n'est affirmé. **Ajoutez les URLs de vos concurrents** pour une analyse plus précise.

## 1. Concurrents directs probables (spécialisés)
${direct.map((c) => `- **${c}** — e-commerce spécialisé ${niche} · proche de ${s} (niche, ${ctx.positioning || "premium"}, ${ctx.country || "FR"}) · ${conf}.`).join("\n")}

## 2. Pourquoi ce sont vos concurrents
- **Même niche** : ${niche}${cols.length ? ` (catégories : ${cols.slice(0, 4).join(", ")})` : ""}.
- **Positionnement proche** : ${ctx.positioning || "premium"}, ${ctx.language || "FR"}.
- **Même audience & intention d'achat** : ils ciblent les mêmes requêtes que vous (pas une marketplace généraliste).

## 3. Analyse rapide par concurrent
${direct.slice(0, 4).map((c) => competitorBlock(c, ctx, vocab)).join("\n\n")}

## 4. Opportunités pour ${s}
- **Collections à renforcer** : ${cols.slice(0, 4).join(", ") || "vos collections principales"} (texte SEO + FAQ).
- **Pages SEO à créer** : guides d'achat (${vocab.faqs(cols[0] || "produits")[0]}).
- **Maillage interne** : par ${vocab.pieces[0] ? "pièce (" + vocab.pieces.slice(0, 3).join(", ") + ")" : "thématique"}, collection ↔ collection.
- **Différenciation marque** : ${ctx.promises?.slice(0, 2).join(", ") || "service & conseil d'expert"}.
- **Réassurance & UX** : avis clients, livraison/retours visibles, sections comparatives.
- **Stratégie contenu** : longue traîne (${nicheKeywords(key, vocab, cols).longtail.slice(0, 3).map((k) => `« ${k} »`).join(", ")}).

## 5. Acteurs généralistes à surveiller (secondaire)
${generalists.length ? generalists.map((g) => `- ${g}`).join("\n") : "- (aucun identifié)"}
> ⚠️ **Pas vos concurrents directs principaux** : difficiles à battre frontalement, mais à surveiller (prix, délais). Votre avantage = la **spécialisation** et la profondeur de contenu.

## 6. Prochaine étape
**Ajoutez les URLs de 3 concurrents** dans la Mémoire boutique pour une analyse comparative plus précise (à confirmer avec leurs vraies pages).`;
}

function freeAnswer(q: string, ctx: CouncilContext): string {
  // Routing intelligent : on bascule vers l'expert correspondant à l'intention.
  const intent = detectIntent(q || "");
  if (intent !== "free") {
    return `> **Mode : Question libre** · intention détectée → **${MODE_LABEL[intent]}**. Pour une réponse encore plus ciblée, sélectionnez ce mode en haut.\n\n` + buildFinalAnswer(intent, q, ctx);
  }
  // Demande d'aide Shopify "comment faire" → mini guide pas à pas.
  if (/comment|où|ou |pourquoi|aide/i.test(q)) {
    return `> **Mode : Question libre** · Données : mémoire boutique\n\n## Réponse Orkestra — ${brandOf(ctx)}

Concernant « ${q.trim().slice(0, 120)} » :
1. **Diagnostic** : ce que ça implique pour votre boutique (${nicheOf(ctx)}).
2. **Étapes concrètes** : 3 à 5 actions ordonnées.
3. **Module Orkestra** recommandé selon le sujet (Import Factory / Merchant Shield / Section Builder / Assistant Shopify).
4. **Mesure** : comment vérifier le résultat.

> Précisez un mode (SEO, Merchant Center, Code Shopify…) pour une réponse d'expert dédiée.`;
  }
  return `> **Mode : Question libre** · Données : mémoire boutique\n\n## Réponse Orkestra — ${brandOf(ctx)}

${q ? `Concernant « ${q.trim().slice(0, 120)} » :` : "Voici une réponse structurée :"}
- **Contexte** : ${nicheOf(ctx)}, positionnement ${ctx.positioning || "premium"}${ctx.productsFound ? `, ${ctx.productsFound} produits détectés` : ""}.
- **Recommandation principale** : l'action à plus fort impact à lancer en premier.
- **Étapes** : 3 à 5 actions concrètes.
- **Module Orkestra** recommandé + **mesure** du résultat.

> Sélectionnez un mode en haut (SEO, Merchant, Code…) pour une réponse d'expert spécialisée.`;
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

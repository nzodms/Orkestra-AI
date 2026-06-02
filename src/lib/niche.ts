import type { ReviewIssue, StoreScores, DashboardMetrics } from "./types";

// ──────────────────────────────────────────────────────────────────────────
// Génération dynamique de données boutique.
//
// AUCUNE donnée n'est hardcodée pour une boutique précise. À partir des
// informations saisies par l'utilisateur (nom, URL, niche, pays, langue,
// positionnement), on détecte la niche et on génère un profil + une analyse
// COHÉRENTS avec cette boutique. C'est la base de la « simulation » du mode
// mock — remplaçable par un vrai scan Shopify sans changer la forme des données.
// ──────────────────────────────────────────────────────────────────────────

export type NicheKey =
  | "luminaires"
  | "mode"
  | "beaute"
  | "bebe"
  | "bijoux"
  | "maison"
  | "hightech"
  | "sport"
  | "animalerie"
  | "generic";

export interface NicheCtx {
  brandName?: string;
  niche?: string;
  language?: string;
  positioning?: string;
  country?: string;
  collections?: string[];
  productTypes?: string[];
  primaryKeywords?: string[];
}

interface NichePreset {
  label: string;
  collections: string[];
  productTypes: string[];
  primaryKeywords: string[];
  secondaryKeywords: string[];
  competitors: string[];
  sampleProduct: string;
  homepageOrder: string[];
  productPageStructure: string[];
}

const STANDARD_HOME = [
  "Hero clair (promesse + visuel)",
  "Bandeau de réassurance (livraison, paiement, retours)",
  "Collections principales",
  "Best-sellers / produits phares",
  "Preuve sociale (avis clients)",
  "Storytelling de marque",
  "FAQ",
  "Newsletter",
];

const STANDARD_PRODUCT = [
  "Galerie produit",
  "Titre / prix / CTA d'achat",
  "Bénéfices rapides (3–4 puces)",
  "Livraison / retours / garantie",
  "Description SEO longue",
  "Caractéristiques techniques",
  "Guide / dimensions",
  "FAQ produit",
  "Avis clients",
  "Produits complémentaires",
];

export const NICHES: Record<NicheKey, NichePreset> = {
  luminaires: {
    label: "Luminaires & décoration intérieure",
    collections: ["Lustres", "Suspensions", "Plafonniers", "Lampes de chevet", "Appliques", "Lampadaires"],
    productTypes: ["Lustre", "Suspension", "Plafonnier", "Lampe de chevet", "Applique murale", "Lampadaire"],
    primaryKeywords: ["lustre salon", "suspension luminaire", "plafonnier moderne", "lampe design"],
    secondaryKeywords: ["lampe de chevet design", "applique murale", "luminaire LED", "éclairage intérieur"],
    competitors: ["Maisons du Monde", "Leroy Merlin", "La Redoute Intérieurs"],
    sampleProduct: "Suspension salle à manger laiton",
    homepageOrder: [
      "Hero ambiance (mise en scène lumineuse)",
      "Bandeau de réassurance (livraison, paiement, garantie)",
      "Collections par pièce (salon, chambre, cuisine…)",
      "Best-sellers",
      "Inspiration / ambiances déco",
      "Avis clients",
      "Guide d'achat & FAQ (type de lumière, dimensions)",
      "Newsletter",
    ],
    productPageStructure: [
      "Galerie en situation (rendu lumineux)",
      "Titre / prix / CTA",
      "Bénéfices (ambiance, design, lumière)",
      "Type de lumière, intensité, compatibilité variateur",
      "Dimensions & hauteur d'installation recommandée",
      "Livraison / retours / garantie",
      "Description SEO longue",
      "FAQ produit (ampoule, pose, entretien)",
      "Avis clients",
      "Produits complémentaires (ampoules, variateurs)",
    ],
  },
  mode: {
    label: "Mode & accessoires",
    collections: ["Nouveautés", "Hauts", "Bas", "Robes", "Accessoires", "Best-sellers"],
    productTypes: ["T-shirt", "Robe", "Pantalon", "Veste", "Sac", "Accessoire"],
    primaryKeywords: ["vêtements femme", "robe tendance", "mode éthique", "accessoires mode"],
    secondaryKeywords: ["t-shirt coton bio", "veste élégante", "tenue de soirée", "look casual"],
    competitors: ["Zalando", "Asos", "Sézane"],
    sampleProduct: "Robe midi en lin",
    homepageOrder: [
      "Hero lookbook (visuel mode fort)",
      "Bandeau de réassurance (livraison, retours offerts)",
      "Nouveautés",
      "Collections / catégories",
      "Best-sellers",
      "Preuve sociale (UGC, Instagram)",
      "Guide des tailles & FAQ",
      "Newsletter",
    ],
    productPageStructure: [
      "Galerie (porté + détails matière)",
      "Titre / prix / CTA",
      "Sélecteur taille / couleur",
      "Guide des tailles",
      "Bénéfices (matière, coupe, entretien)",
      "Livraison / retours offerts",
      "Description SEO longue",
      "FAQ produit",
      "Avis clients (avec photos)",
      "Looks complémentaires",
    ],
  },
  beaute: {
    label: "Beauté & cosmétiques",
    collections: ["Soins visage", "Soins corps", "Maquillage", "Cheveux", "Coffrets", "Nouveautés"],
    productTypes: ["Crème", "Sérum", "Nettoyant", "Huile", "Masque", "Coffret"],
    primaryKeywords: ["soin visage naturel", "sérum hydratant", "cosmétique bio", "routine peau"],
    secondaryKeywords: ["crème anti-âge", "soin cheveux", "maquillage naturel", "peau sensible"],
    competitors: ["Sephora", "Typology", "Nuxe"],
    sampleProduct: "Sérum hydratant à l'acide hyaluronique",
    homepageOrder: [
      "Hero promesse (résultat / bénéfice peau)",
      "Bandeau de réassurance (clean, vegan, livraison)",
      "Best-sellers",
      "Routines / collections par besoin",
      "Ingrédients & bénéfices",
      "Avis & avant/après",
      "FAQ (composition, usage)",
      "Newsletter",
    ],
    productPageStructure: [
      "Galerie (packaging + texture)",
      "Titre / prix / CTA",
      "Bénéfices clés",
      "Ingrédients & actifs",
      "Mode d'emploi / routine",
      "Livraison / retours",
      "Description SEO longue",
      "FAQ produit (type de peau, fréquence)",
      "Avis & avant/après",
      "Produits de la routine",
    ],
  },
  bebe: {
    label: "Bébé & puériculture",
    collections: ["Éveil & jouets", "Repas", "Sommeil", "Sortie & promenade", "Vêtements bébé", "Sécurité"],
    productTypes: ["Jouet d'éveil", "Gigoteuse", "Biberon", "Tapis d'éveil", "Veilleuse", "Body"],
    primaryKeywords: ["jouet éveil bébé", "gigoteuse coton bio", "puériculture", "cadeau naissance"],
    secondaryKeywords: ["tapis d'éveil", "veilleuse bébé", "biberon anti-colique", "vêtement bébé bio"],
    competitors: ["Vertbaudet", "Aubert", "Natalys"],
    sampleProduct: "Veilleuse nomade rechargeable",
    homepageOrder: [
      "Hero rassurant (univers doux)",
      "Bandeau de réassurance (sécurité, normes, livraison)",
      "Collections par âge (0-6 mois, 6-12 mois…)",
      "Best-sellers",
      "Avis parents",
      "Guides & conseils (sécurité, sommeil)",
      "FAQ",
      "Newsletter",
    ],
    productPageStructure: [
      "Galerie (produit + en situation)",
      "Titre / prix / CTA",
      "Bénéfices (confort, sécurité, éveil)",
      "Normes de sécurité & âge recommandé",
      "Matériaux (coton bio, sans substances nocives)",
      "Livraison / retours",
      "Description SEO longue",
      "FAQ produit (entretien, sécurité)",
      "Avis parents",
      "Produits complémentaires",
    ],
  },
  bijoux: {
    label: "Bijoux & accessoires",
    collections: ["Colliers", "Bracelets", "Bagues", "Boucles d'oreilles", "Montres", "Coffrets cadeaux"],
    productTypes: ["Collier", "Bracelet", "Bague", "Boucles d'oreilles", "Montre"],
    primaryKeywords: ["bijoux femme", "collier plaqué or", "bague argent", "cadeau bijou"],
    secondaryKeywords: ["bracelet personnalisé", "boucles d'oreilles", "bijou minimaliste", "montre élégante"],
    competitors: ["Pandora", "Histoire d'Or", "Gemmyo"],
    sampleProduct: "Collier plaqué or pendentif lune",
    homepageOrder: STANDARD_HOME,
    productPageStructure: [
      "Galerie (porté + macro détails)",
      "Titre / prix / CTA",
      "Matériaux (plaqué or, argent 925…)",
      "Dimensions & ajustabilité",
      "Bénéfices (cadeau, hypoallergénique)",
      "Livraison / retours / garantie",
      "Description SEO longue",
      "FAQ produit (entretien, taille)",
      "Avis clients",
      "Coffrets & produits complémentaires",
    ],
  },
  maison: {
    label: "Décoration & maison",
    collections: ["Mobilier", "Textile", "Décoration murale", "Art de la table", "Rangement", "Nouveautés"],
    productTypes: ["Meuble", "Coussin", "Tableau", "Vaisselle", "Tapis", "Objet déco"],
    primaryKeywords: ["décoration intérieure", "mobilier design", "déco salon", "art de la table"],
    secondaryKeywords: ["coussin décoratif", "tapis salon", "tableau mural", "vase design"],
    competitors: ["Maisons du Monde", "La Redoute Intérieurs", "Westwing"],
    sampleProduct: "Vase en céramique fait main",
    homepageOrder: STANDARD_HOME,
    productPageStructure: STANDARD_PRODUCT,
  },
  hightech: {
    label: "High-tech & accessoires",
    collections: ["Audio", "Charge & énergie", "Accessoires téléphone", "Objets connectés", "Gaming", "Nouveautés"],
    productTypes: ["Écouteurs", "Chargeur", "Coque", "Enceinte", "Accessoire connecté"],
    primaryKeywords: ["écouteurs sans fil", "chargeur rapide", "accessoires smartphone", "objet connecté"],
    secondaryKeywords: ["coque téléphone", "enceinte bluetooth", "batterie externe", "câble USB-C"],
    competitors: ["Amazon", "Fnac/Darty", "Boulanger"],
    sampleProduct: "Écouteurs sans fil à réduction de bruit",
    homepageOrder: STANDARD_HOME,
    productPageStructure: [
      "Galerie (produit + usage)",
      "Titre / prix / CTA",
      "Bénéfices clés",
      "Caractéristiques techniques (autonomie, compatibilité)",
      "Contenu de la boîte",
      "Livraison / retours / garantie",
      "Description SEO longue",
      "FAQ produit",
      "Avis clients",
      "Accessoires complémentaires",
    ],
  },
  sport: {
    label: "Sport & fitness",
    collections: ["Vêtements de sport", "Équipement", "Accessoires", "Nutrition", "Récupération", "Nouveautés"],
    productTypes: ["Legging", "Brassière", "Tapis", "Haltère", "Gourde", "Accessoire fitness"],
    primaryKeywords: ["vêtements de sport", "équipement fitness", "legging sport", "accessoires yoga"],
    secondaryKeywords: ["tapis de yoga", "brassière sport", "matériel musculation", "gourde sport"],
    competitors: ["Decathlon", "Nike", "Gymshark"],
    sampleProduct: "Legging de sport taille haute",
    homepageOrder: STANDARD_HOME,
    productPageStructure: STANDARD_PRODUCT,
  },
  animalerie: {
    label: "Animalerie & accessoires",
    collections: ["Chien", "Chat", "Alimentation", "Jouets", "Couchage", "Accessoires"],
    productTypes: ["Croquettes", "Jouet", "Panier", "Laisse", "Gamelle", "Accessoire"],
    primaryKeywords: ["accessoires chien", "jouet chat", "alimentation animale", "panier animal"],
    secondaryKeywords: ["laisse chien", "arbre à chat", "croquettes naturelles", "couchage animal"],
    competitors: ["Zooplus", "Maxi Zoo", "Wanimo"],
    sampleProduct: "Panier orthopédique pour chien",
    homepageOrder: STANDARD_HOME,
    productPageStructure: STANDARD_PRODUCT,
  },
  generic: {
    label: "votre niche",
    collections: ["Nouveautés", "Best-sellers", "Collection principale", "Accessoires", "Promotions"],
    productTypes: ["Produit phare", "Accessoire", "Pack", "Édition limitée"],
    primaryKeywords: ["votre mot-clé principal", "votre produit phare", "votre catégorie"],
    secondaryKeywords: ["mot-clé secondaire", "produit complémentaire", "longue traîne"],
    competitors: ["Concurrent 1", "Concurrent 2", "Concurrent 3"],
    sampleProduct: "Votre produit phare",
    homepageOrder: STANDARD_HOME,
    productPageStructure: STANDARD_PRODUCT,
  },
};

/** Détecte la niche à partir de tout texte (niche saisie, nom, URL). */
export function detectNiche(text: string | undefined): NicheKey {
  const t = (text || "").toLowerCase();
  if (/lumi|lustre|suspension|plafonnier|lampe|éclair|eclair|luminaire/.test(t)) return "luminaires";
  if (/beaut|cosm|soin|maquill|skincare|parfum|crème|creme|sérum|serum/.test(t)) return "beaute";
  if (/bébé|bebe|puéricult|puericult|maternité|naissance|baby|enfant/.test(t)) return "bebe";
  if (/bijou|joaill|collier|bague|bracelet|boucle|montre/.test(t)) return "bijoux";
  if (/mode|vêtement|vetement|fashion|prêt-à-porter|robe|t-?shirt|jean|textile/.test(t)) return "mode";
  if (/sport|fitness|musculation|yoga|running|gym/.test(t)) return "sport";
  if (/anim|chien|chat|animalerie|\bpet\b|croquette/.test(t)) return "animalerie";
  if (/tech|électro|electro|gadget|smartphone|écouteur|ecouteur|connecté|connecte|high-?tech/.test(t)) return "hightech";
  if (/déco|deco|maison|mobilier|meuble|intérieur|interieur|design/.test(t)) return "maison";
  return "generic";
}

export function getPreset(ctx: NicheCtx): { key: NicheKey; preset: NichePreset } {
  const key = detectNiche(`${ctx.niche ?? ""} ${ctx.brandName ?? ""}`);
  return { key, preset: NICHES[key] };
}

export function brandLabel(ctx: NicheCtx): string {
  return ctx.brandName?.trim() || "votre boutique";
}

/** Synthèse « Ce qu'Orkestra a compris ». Dynamique, basée sur les entrées. */
export function buildUnderstanding(ctx: NicheCtx): string {
  const { preset } = getPreset(ctx);
  const name = brandLabel(ctx);
  const country = ctx.country?.trim();
  const nicheLabel = ctx.niche?.trim() || preset.label;
  const pos = ctx.positioning || "premium";
  return `${name} est une boutique${country ? ` (${country})` : ""} qui semble spécialisée dans ${nicheLabel.toLowerCase()}. Le positionnement détecté est « ${pos} ». Les opportunités principales se situent sur le SEO des pages collections, des fiches produits, les meta descriptions, les FAQ et le maillage interne. Les contenus doivent rester cohérents avec ce positionnement, orientés bénéfices et adaptés aux recherches en ${ctx.language || "français"}.`;
}

// ── Scores & métriques simulés (déterministes par boutique) ─────────────────

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h || 7;
}
function seeded(seed: number, min: number, max: number): number {
  return min + (seed % (max - min + 1));
}

export function buildScores(ctx: NicheCtx): StoreScores {
  const h = hashStr(`${ctx.brandName ?? ""}|${ctx.niche ?? ""}`);
  return {
    seo: seeded(h, 48, 72),
    merchant: seeded(h >> 2, 45, 70),
    conversion: seeded(h >> 4, 52, 78),
    content: seeded(h >> 6, 42, 68),
  };
}

export function buildMetrics(ctx: NicheCtx): DashboardMetrics {
  const h = hashStr(`${ctx.niche ?? ""}|${ctx.brandName ?? ""}`);
  return {
    productsToOptimize: seeded(h, 8, 40),
    collectionsWithoutSeo: seeded(h >> 3, 1, 6),
    englishTextsDetected: seeded(h >> 5, 0, 18),
    missingMetaDescriptions: seeded(h >> 7, 5, 45),
    imagesWithoutAlt: seeded(h >> 9, 6, 60),
  };
}

// ── Problèmes détectés (review) adaptés à la niche ──────────────────────────

export function buildReviewIssues(ctx: NicheCtx): ReviewIssue[] {
  const { preset } = getPreset(ctx);
  const cols = ctx.collections?.length ? ctx.collections : preset.collections;
  const prods = ctx.productTypes?.length ? ctx.productTypes : preset.productTypes;
  const kws = ctx.primaryKeywords?.length ? ctx.primaryKeywords : preset.primaryKeywords;
  const lang = ctx.language || "français";

  return [
    {
      area: `Pages collections (${cols.slice(0, 2).join(", ")})`,
      severity: "important",
      explanation: `Les collections ${cols.slice(0, 3).join(", ")} manquent de texte SEO unique et de structure Hn.`,
      impact: "Faible visibilité sur des requêtes commerciales à fort volume.",
      fix: `Générer 150–300 mots + FAQ par collection dans le SEO Studio, ciblés sur « ${kws[0]} ».`,
      module: "seo",
    },
    {
      area: `Fiches produits (${prods[0]}, ${prods[1] || prods[0]})`,
      severity: "important",
      explanation: "Descriptions trop courtes, peu de bénéfices et pas de FAQ produit.",
      impact: "Conversion et longue traîne sous-exploitées.",
      fix: "Générer des fiches SEO complètes (200+ mots, bénéfices, FAQ, alt text) dans le SEO Studio.",
      module: "seo",
    },
    {
      area: "Meta titles & descriptions",
      severity: "important",
      explanation: "Meta manquantes ou dupliquées sur de nombreuses pages.",
      impact: "Taux de clic (CTR) réduit dans les résultats Google.",
      fix: "Générer une meta unique par page (≤ 60 / ≤ 155 car.) avec un CTA.",
      module: "seo",
    },
    {
      area: "Cohérence de langue",
      severity: "critique",
      explanation: `Des libellés du thème en anglais peuvent subsister sur une boutique en ${lang} (« Add to cart », « Sold out »).`,
      impact: "Confiance dégradée et risque de signal négatif Merchant Center.",
      fix: "Traduire les libellés et détecter les textes EN restants via Merchant Shield.",
      module: "merchant",
    },
    {
      area: "Pages légales & livraison/retours",
      severity: "critique",
      explanation: "Politique de retour et de livraison peu visibles ; mentions légales à vérifier.",
      impact: "Cause fréquente de suspension Merchant Center et frein à l'achat.",
      fix: "Compléter les pages légales et les lier au footer ; afficher la réassurance sur les fiches.",
      module: "merchant",
    },
    {
      area: "Réassurance & UX page d'accueil",
      severity: "important",
      explanation: "Ordre des sections à optimiser : réassurance et preuve sociale souvent trop bas.",
      impact: "Conversion plus faible, surtout sur mobile.",
      fix: "Réordonner la home (voir l'ordre recommandé) et ajouter un bloc réassurance via le Section Builder.",
      module: "sections",
    },
    {
      area: "Maillage interne",
      severity: "mineur",
      explanation: "Peu de liens entre blog, collections et produits complémentaires.",
      impact: "Autorité SEO mal distribuée, pages profondes peu indexées.",
      fix: "Mettre en place un maillage blog → collections → produits.",
      module: "seo",
    },
    {
      area: "Cohérence de marque",
      severity: "mineur",
      explanation: `Le ton n'est pas toujours homogène ; le positionnement ${ctx.positioning || "premium"} de ${brandLabel(ctx)} pourrait être davantage incarné.`,
      impact: "Image de marque diluée, moins de désir.",
      fix: "Aligner tous les contenus sur la mémoire boutique (ton, bénéfices, ambiance).",
      module: "memory",
    },
  ];
}

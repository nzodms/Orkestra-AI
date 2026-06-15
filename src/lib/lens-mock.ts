// ──────────────────────────────────────────────────────────────────────────
// Données de DÉMONSTRATION pour la refonte UI (Command Center / Data Lens /
// Product Studio / Growth Actions).
//
// ⚠️ Aucune donnée réelle : ce module sert uniquement à habiller la première
// version visuelle premium. Le backend (tracking, réconciliation, Shopify)
// branchera ces mêmes formes de données plus tard. On garde donc des types
// stables que l'API pourra remplir tels quels.
// ──────────────────────────────────────────────────────────────────────────

export type Severity = "critique" | "eleve" | "moyen" | "info";
export type TrustStatus = "fiable" | "partiel" | "incoherent";

export interface FunnelStep {
  key: string;
  label: string;
  /** Valeur brute mesurée (avant réconciliation). */
  raw: number;
  /** Valeur fiabilisée après nettoyage des incohérences. */
  reliable: number;
}

export interface RevenueLeak {
  id: string;
  title: string;
  where: string;
  /** Perte mensuelle estimée (€), fourchette basse. */
  amount: number;
  severity: Severity;
  cause: string;
  action: string;
  /** Section vers laquelle pointe l'action. */
  target: "product-studio" | "growth-actions" | "data-lens";
}

export interface TrustSource {
  id: string;
  label: string;
  status: TrustStatus;
  /** Couverture du tracking (%). */
  coverage: number;
  note: string;
}

export interface ProductOpportunity {
  id: string;
  title: string;
  handle: string;
  seoScore: number;
  convScore: number;
  /** Gain de revenu estimé si optimisé (€/mois). */
  uplift: number;
  issues: string[];
  before: { title: string; meta: string };
  after: { title: string; meta: string };
}

export interface GrowthAction {
  id: string;
  title: string;
  detail: string;
  count: number;
  impact: "haut" | "moyen" | "bas";
  effort: "rapide" | "moyen" | "long";
  minutes: number;
  target: string;
  status: "a_faire" | "en_cours" | "fait";
}

// ── Santé boutique ────────────────────────────────────────────────────────
export const STORE_HEALTH = {
  score: 68,
  trend: +6,
  breakdown: [
    { key: "seo", label: "SEO", value: 61 },
    { key: "conversion", label: "Conversion", value: 64 },
    { key: "data", label: "Fiabilité data", value: 72 },
    { key: "merchant", label: "Merchant Center", value: 75 },
  ],
};

// Pertes potentielles mensuelles (estimation prudente, fourchette basse)
export const MONTHLY_LEAK_TOTAL = 2840;

export const FUNNEL: FunnelStep[] = [
  { key: "sessions", label: "Sessions", raw: 18420, reliable: 16950 },
  { key: "product_views", label: "Vues produit", raw: 9310, reliable: 8720 },
  { key: "add_to_cart", label: "Ajouts panier", raw: 2140, reliable: 1980 },
  { key: "checkout", label: "Checkouts", raw: 1020, reliable: 910 },
  { key: "orders", label: "Commandes", raw: 612, reliable: 588 },
];

export const LEAKS: RevenueLeak[] = [
  {
    id: "lk1",
    title: "Chute panier → checkout supérieure à la normale",
    where: "Tunnel · étape paiement",
    amount: 1180,
    severity: "critique",
    cause: "52 % d'abandon entre panier et checkout. Frais de port affichés tard et 2 produits sans réassurance visible.",
    action: "Clarifier les frais de port et ajouter la réassurance sur 2 fiches",
    target: "product-studio",
  },
  {
    id: "lk2",
    title: "12 fiches produit faibles captent du trafic sans convertir",
    where: "Catalogue · fiches à fort trafic",
    amount: 920,
    severity: "eleve",
    cause: "Titres génériques, meta absentes, descriptions < 60 mots. Bon trafic SEO mais conversion 2× sous la moyenne.",
    action: "Réécrire 12 fiches prioritaires (titre, meta, description)",
    target: "product-studio",
  },
  {
    id: "lk3",
    title: "Écart de tracking sur la source « Meta »",
    where: "Data · attribution",
    amount: 740,
    severity: "moyen",
    cause: "18 % des sessions Meta non réconciliées avec les commandes. Budget potentiellement mal arbitré.",
    action: "Vérifier le tracking Meta et réconcilier les sessions",
    target: "data-lens",
  },
];

export const TRUST_SOURCES: TrustSource[] = [
  { id: "t1", label: "Sessions Shopify", status: "fiable", coverage: 98, note: "Mesure native cohérente sur 30 j." },
  { id: "t2", label: "Source Meta", status: "incoherent", coverage: 82, note: "18 % de sessions non réconciliées." },
  { id: "t3", label: "Source Google", status: "partiel", coverage: 91, note: "UTM manquants sur 9 % du trafic." },
  { id: "t4", label: "Commandes", status: "fiable", coverage: 100, note: "Réconciliées avec Shopify Orders." },
];

export const DATA_TRUST_SCORE = 79;

export const PRODUCTS: ProductOpportunity[] = [
  {
    id: "p1",
    title: "Tapis de yoga antidérapant 6 mm",
    handle: "tapis-yoga-antiderapant-6mm",
    seoScore: 42,
    convScore: 38,
    uplift: 380,
    issues: ["Meta description absente", "Titre générique", "Description 48 mots", "3 images sans alt"],
    before: {
      title: "Tapis de yoga - boutique",
      meta: "(aucune meta description)",
    },
    after: {
      title: "Tapis de yoga antidérapant 6 mm | Reform&Co",
      meta: "Tapis de yoga 6 mm antidérapant, idéal débutant comme confirmé. Amorti confortable, surface stable. Livraison 48 h, retour 30 jours.",
    },
  },
  {
    id: "p2",
    title: "Brique de yoga liège naturel",
    handle: "brique-yoga-liege",
    seoScore: 55,
    convScore: 49,
    uplift: 210,
    issues: ["Texte anglais détecté", "FAQ manquante", "Meta trop longue (192 car.)"],
    before: {
      title: "Yoga cork block - premium quality",
      meta: "The best premium cork yoga block for your daily practice and balance training sessions every single day.",
    },
    after: {
      title: "Brique de yoga en liège naturel | Reform&Co",
      meta: "Brique de yoga en liège naturel, stable et légère pour soutenir vos postures. Surface antidérapante. Livraison 48 h.",
    },
  },
  {
    id: "p3",
    title: "Sangle de yoga coton bio 2,5 m",
    handle: "sangle-yoga-coton-bio",
    seoScore: 60,
    convScore: 58,
    uplift: 160,
    issues: ["Handle peu lisible", "1 image sans alt", "Maillage collection absent"],
    before: {
      title: "Sangle yoga 250cm coton",
      meta: "Sangle de yoga en coton pour étirements et postures.",
    },
    after: {
      title: "Sangle de yoga coton bio 2,5 m | Reform&Co",
      meta: "Sangle de yoga en coton bio de 2,5 m pour approfondir vos étirements en sécurité. Boucle réglable solide. Livraison 48 h.",
    },
  },
];

export const ACTIONS: GrowthAction[] = [
  { id: "a1", title: "Corriger 12 fiches produit faibles", detail: "Titre, meta et description sous le seuil de qualité.", count: 12, impact: "haut", effort: "moyen", minutes: 25, target: "product-studio", status: "a_faire" },
  { id: "a2", title: "Générer 8 meta descriptions manquantes", detail: "Pages produit sans meta indexées par Google.", count: 8, impact: "haut", effort: "rapide", minutes: 8, target: "product-studio", status: "a_faire" },
  { id: "a3", title: "Réparer 6 handles non lisibles", detail: "URLs avec caractères ou numéros parasites.", count: 6, impact: "moyen", effort: "rapide", minutes: 6, target: "product-studio", status: "a_faire" },
  { id: "a4", title: "Traduire 4 textes anglais détectés", detail: "Boutons et descriptions encore en anglais.", count: 4, impact: "moyen", effort: "rapide", minutes: 5, target: "product-studio", status: "a_faire" },
  { id: "a5", title: "Optimiser la collection « Accessoires »", detail: "Description vide, aucun maillage interne.", count: 1, impact: "moyen", effort: "moyen", minutes: 12, target: "growth-actions", status: "a_faire" },
  { id: "a6", title: "Créer 3 FAQ produit", detail: "Réassurance manquante sur les meilleures ventes.", count: 3, impact: "moyen", effort: "moyen", minutes: 10, target: "product-studio", status: "en_cours" },
  { id: "a7", title: "Corriger 2 risques Merchant Center", detail: "Promesses non vérifiables détectées.", count: 2, impact: "haut", effort: "rapide", minutes: 7, target: "growth-actions", status: "a_faire" },
  { id: "a8", title: "Réconcilier la source Meta", detail: "18 % des sessions non attribuées.", count: 1, impact: "moyen", effort: "long", minutes: 20, target: "data-lens", status: "a_faire" },
];

export function euro(n: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

export function compact(n: number): string {
  return new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

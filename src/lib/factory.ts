import type { StoreAnalysis, BrandMemory } from "./types";
import { SHOPIFY_PATHS } from "./shopify";

// ──────────────────────────────────────────────────────────────────────────
// Import Factory — modèle « atelier de production ».
//
// À partir du scan public + de la mémoire boutique, on dérive une FILE DE
// PRODUCTION de contenus concrets (meta, collections, fiches, alt, articles),
// chacun avec un statut de production persistable (à produire → publié).
// Pur (aucune dépendance serveur) → importable côté client.
// ──────────────────────────────────────────────────────────────────────────

/** Format de contenu produit (aligné sur les workflows existants). */
export type FactoryType = "meta" | "collection" | "product" | "alt" | "blog";

/** Statut de production d'un contenu (persisté en localStorage). */
export type FactoryStatus =
  | "todo"        // à produire
  | "doing"       // en cours
  | "generated"   // généré
  | "copied"      // copié
  | "to_publish"  // à publier
  | "published"   // publié
  | "ignored";    // ignoré

export type FactoryPriority = "haute" | "moyenne" | "basse";

/** Une tâche de production concrète (page / produit / collection nommé). */
export interface FactoryTask {
  id: string;
  type: FactoryType;
  title: string;
  subtitle: string;
  priority: FactoryPriority;
  impact: string;
  eta: string;
  where: string;
  count?: number;
  /** Pré-remplissage. */
  collection?: string;
  metaType?: "produit" | "collection" | "accueil";
}

/** Une catégorie de la file de production (vue synthétique). */
export interface FactoryCategory {
  type: FactoryType;
  label: string;
  desc: string;
  count: number;
  where: string;
  priority: FactoryPriority;
  impact: string;
}

/** Une sortie produite (feed « Sorties récentes », persisté). */
export interface FactoryOutput {
  id: string;
  taskId?: string;
  type: FactoryType;
  title: string;
  copyText: string;
  status: FactoryStatus;
  createdAt: string;
}

export const STATUS_META: Record<FactoryStatus, { label: string; tone: "neutral" | "brand" | "good" | "warn" | "bad" }> = {
  todo: { label: "À produire", tone: "neutral" },
  doing: { label: "En cours", tone: "warn" },
  generated: { label: "Généré", tone: "brand" },
  copied: { label: "Copié", tone: "brand" },
  to_publish: { label: "À publier", tone: "warn" },
  published: { label: "Publié", tone: "good" },
  ignored: { label: "Ignoré", tone: "neutral" },
};

export const PRIORITY_META: Record<FactoryPriority, { label: string; tone: "bad" | "warn" | "neutral" }> = {
  haute: { label: "Priorité haute", tone: "bad" },
  moyenne: { label: "Priorité moyenne", tone: "warn" },
  basse: { label: "Priorité basse", tone: "neutral" },
};

/** Statuts comptés comme « produit » (progression). */
export const PRODUCED_STATUSES: FactoryStatus[] = ["generated", "copied", "to_publish", "published"];

const PRIORITY_RANK: Record<FactoryPriority, number> = { haute: 0, moyenne: 1, basse: 2 };

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "x"
  );
}
function singular(s: string): string {
  const w = s.trim();
  return /s$/i.test(w) && w.length > 3 ? w.replace(/s$/i, "") : w;
}
function prioFromScore(score: number): FactoryPriority {
  return score < 40 ? "haute" : score < 70 ? "moyenne" : "basse";
}

/** Construit la file de production complète depuis l'analyse + la marque. */
export function buildFactoryQueue(
  analysis: StoreAnalysis | null,
  brand: BrandMemory
): { categories: FactoryCategory[]; tasks: FactoryTask[] } {
  const cs = analysis?.catalogStats;
  const missingMeta = analysis?.metrics?.missingMetaDescriptions ?? 0;
  const imagesNoAlt = cs?.imagesNoAlt ?? analysis?.metrics?.imagesWithoutAlt ?? 0;
  const collsWithoutSeo = analysis?.metrics?.collectionsWithoutSeo ?? 0;
  const productsToOptimize = analysis?.metrics?.productsToOptimize ?? 0;
  const cols = (brand.collections.length ? brand.collections : []).slice(0, 8);
  const pp = analysis?.priorityProducts ?? [];

  const tasks: FactoryTask[] = [];

  // ── Meta : page d'accueil + collections (pages fréquemment sans meta) ──
  tasks.push({ id: "meta:home", type: "meta", title: "Page d'accueil", subtitle: "Meta title + description", priority: "haute", impact: "Améliore le taux de clic de la home dans Google.", eta: "≈ 3 min", where: SHOPIFY_PATHS.meta, metaType: "accueil" });
  cols.slice(0, 5).forEach((c) =>
    tasks.push({ id: `meta:${slug(c)}`, type: "meta", title: c, subtitle: "Meta — Collection", priority: "haute", impact: "Meta naturelle = plus de clics à position égale.", eta: "≈ 3 min", where: SHOPIFY_PATHS.meta, metaType: "collection", collection: c })
  );

  // ── Collections à enrichir ──
  cols.forEach((c) =>
    tasks.push({ id: `collection:${slug(c)}`, type: "collection", title: c, subtitle: "Page collection", priority: "moyenne", impact: "Capte des requêtes commerciales (« acheter / choisir »).", eta: "≈ 15 min", where: SHOPIFY_PATHS.collections, collection: c })
  );

  // ── Fiches produits à renforcer ──
  pp.slice(0, 10).forEach((p) =>
    tasks.push({ id: `product:${p.handle || slug(p.title)}`, type: "product", title: p.title, subtitle: "Fiche produit", priority: prioFromScore(p.contentScore), impact: p.reason || "Renforce conversion, longue traîne et flux Merchant.", eta: "≈ 10 min", where: "Shopify → Produits → fiche produit", collection: brand.collections[0] })
  );

  // ── Alt text (tâche groupée) ──
  if (imagesNoAlt > 0)
    tasks.push({ id: "alt:global", type: "alt", title: `${imagesNoAlt} image${imagesNoAlt > 1 ? "s" : ""} à compléter`, subtitle: "Alt text", priority: "basse", impact: "SEO images + accessibilité (mineur Merchant).", eta: "≈ 1 min / image", where: SHOPIFY_PATHS.alt, count: imagesNoAlt });

  // ── Articles recommandés ──
  (cols.length ? cols : ["votre collection"]).slice(0, 3).forEach((c) =>
    tasks.push({ id: `blog:${slug(c)}`, type: "blog", title: `Guide d'achat : ${c}`, subtitle: "Article de blog", priority: "moyenne", impact: "Trafic longue traîne + maillage vers la collection.", eta: "≈ 20 min", where: SHOPIFY_PATHS.blog, collection: c })
  );

  const metaTaskCount = tasks.filter((t) => t.type === "meta").length;
  const blogTaskCount = tasks.filter((t) => t.type === "blog").length;

  const categories: FactoryCategory[] = [
    { type: "meta", label: "Meta à produire", desc: "Titles + meta descriptions pour les pages détectées sans meta.", count: missingMeta > 0 ? missingMeta : metaTaskCount, where: SHOPIFY_PATHS.meta, priority: "haute", impact: "Taux de clic dans Google." },
    { type: "collection", label: "Collections à enrichir", desc: "Description, FAQ, structure Hn et maillage.", count: collsWithoutSeo > 0 ? collsWithoutSeo : cols.length, where: SHOPIFY_PATHS.collections, priority: "moyenne", impact: "Requêtes commerciales." },
    { type: "product", label: "Fiches produits à renforcer", desc: "Description, FAQ, alt text, tags, product_type.", count: pp.length || productsToOptimize, where: "Produits → fiche produit", priority: "haute", impact: "Conversion + Merchant." },
    { type: "alt", label: "Images sans alt text", desc: "Textes alternatifs descriptifs et sobres.", count: imagesNoAlt, where: SHOPIFY_PATHS.alt, priority: "basse", impact: "SEO images + accessibilité." },
    { type: "blog", label: "Articles recommandés", desc: "Plans d'articles longue traîne maillés aux collections.", count: blogTaskCount, where: SHOPIFY_PATHS.blog, priority: "moyenne", impact: "Trafic informationnel." },
  ];

  return { categories, tasks };
}

/** Tri par priorité puis ordre naturel (file « À produire maintenant »). */
export function prioritizeTasks(tasks: FactoryTask[], status: Record<string, FactoryStatus>): FactoryTask[] {
  return [...tasks]
    .map((t, i) => ({ t, i, s: status[t.id] ?? "todo" }))
    .filter(({ s }) => s === "todo" || s === "doing")
    .sort((a, b) => PRIORITY_RANK[a.t.priority] - PRIORITY_RANK[b.t.priority] || a.i - b.i)
    .map(({ t }) => t);
}

export interface FactoryProgress {
  total: number;
  produced: number;
  published: number;
  remaining: number;
  percent: number;
  byType: Record<FactoryType, { total: number; produced: number; remaining: number }>;
}

/** Progression de production (tâches non ignorées). */
export function computeProgress(tasks: FactoryTask[], status: Record<string, FactoryStatus>): FactoryProgress {
  const types: FactoryType[] = ["meta", "collection", "product", "alt", "blog"];
  const byType = Object.fromEntries(types.map((t) => [t, { total: 0, produced: 0, remaining: 0 }])) as FactoryProgress["byType"];
  let total = 0;
  let produced = 0;
  let published = 0;
  let remaining = 0;
  for (const t of tasks) {
    const s = status[t.id] ?? "todo";
    if (s === "ignored") continue;
    total++;
    byType[t.type].total++;
    if (PRODUCED_STATUSES.includes(s)) {
      produced++;
      byType[t.type].produced++;
    }
    if (s === "published") published++;
    if (s === "todo") {
      remaining++;
      byType[t.type].remaining++;
    }
  }
  return { total, produced, published, remaining, percent: total ? Math.round((produced / total) * 100) : 0, byType };
}

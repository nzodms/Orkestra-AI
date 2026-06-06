// ──────────────────────────────────────────────────────────────────────────
// Couche PROVIDERS fournisseurs (extensible). Chaque provider renvoie des items
// DESCRIPTIFS normalisés (`SupplierItem`) ; le scoring/risque est ajouté ensuite
// par l'orchestrateur (supplier-search.ts). Ajouter une source = ajouter un
// provider + une entrée dans le registre — le reste de l'app ne change pas.
//
// Réel branché par variables d'environnement (côté serveur uniquement) :
//   - Apify   : APIFY_TOKEN + APIFY_ALIEXPRESS_ACTOR / APIFY_ALIBABA_ACTOR
//   - Custom  : LENS_CUSTOM_SEARCH_URL (template {query}/{limit}), + _HEADERS, _ITEMS_PATH
//   - Défaut  : LENS_SUPPLIER_PROVIDER (sinon 1ʳᵉ source réelle dispo, sinon simulé)
// ──────────────────────────────────────────────────────────────────────────

import type { SupplierResult, SupplierSearchProvider } from "./lens-types";

/** Item descriptif d'un fournisseur AVANT scoring (le scoring est ajouté après). */
export type SupplierItem = Pick<
  SupplierResult,
  "id" | "source" | "title" | "imageUrl" | "productUrl" | "price" | "minPrice" | "maxPrice" |
  "currency" | "moq" | "supplierName" | "supplierRating" | "reviewCount" | "shippingInfo" |
  "location" | "variants" | "raw"
>;

export interface SupplierQuery {
  keywords: string[];
  productType: string;
  niche: string;
  maxItems: number;
  platform?: "alibaba" | "aliexpress";
}

export interface SupplierProvider {
  id: SupplierSearchProvider;
  label: string;
  /** Source réelle (true) ou simulée (false). */
  real: boolean;
  available: () => boolean;
  search: (q: SupplierQuery) => Promise<SupplierItem[]>;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
const env = (k: string): string => (process.env[k] || "").trim();
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}
function hash(s: string): number { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
function pickStr(o: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) { const v = o[k]; if (typeof v === "string" && v.trim()) return v.trim(); if (typeof v === "number") return String(v); }
  return undefined;
}
function pickNum(o: Record<string, unknown>, keys: string[]): number | undefined {
  for (const k of keys) { const v = o[k]; const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v.replace(/[^\d.]/g, "")) : NaN; if (isFinite(n)) return n; }
  return undefined;
}
function normSource(s?: string): SupplierResult["source"] {
  const v = (s || "").toLowerCase();
  if (v.includes("aliexpress")) return "AliExpress";
  if (v.includes("alibaba")) return "Alibaba";
  if (v.includes("1688")) return "1688";
  return "Other";
}
function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, k) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined), obj);
}

// Mapping défensif d'un objet brut quelconque (RapidAPI, SerpApi, scraping…) → SupplierItem.
function guessItem(o: Record<string, unknown>, i: number, fallbackSource: SupplierResult["source"]): SupplierItem | null {
  const title = pickStr(o, ["title", "name", "product_title", "productTitle", "subject", "product_name"]);
  const productUrl = pickStr(o, ["productUrl", "product_url", "url", "link", "detail_url", "productDetailUrl", "item_url"]);
  if (!title || !productUrl) return null;
  const min = pickNum(o, ["minPrice", "min_price", "salePrice", "sale_price", "price", "app_sale_price", "target_sale_price"]);
  const max = pickNum(o, ["maxPrice", "max_price", "original_price", "originalPrice"]);
  const currency = pickStr(o, ["currency", "currency_code"]) || "$";
  const priceStr = pickStr(o, ["price_display", "priceStr", "price"]) || (min ? (max && max > min ? `${min} – ${max} ${currency}` : `${min} ${currency}`) : undefined);
  return {
    id: pickStr(o, ["id", "productId", "product_id", "itemId", "item_id"]) || `it_${i}_${hash(title).toString(36)}`,
    source: normSource(pickStr(o, ["source", "platform"]) || fallbackSource),
    title: title.slice(0, 90),
    imageUrl: pickStr(o, ["imageUrl", "image_url", "image", "thumbnail", "main_image", "imgUrl", "pic_url", "productImage"]),
    productUrl,
    price: priceStr,
    minPrice: min,
    maxPrice: max,
    currency,
    moq: pickStr(o, ["moq", "minOrder", "min_order", "minOrderQuantity", "minimum_order"]),
    supplierName: pickStr(o, ["supplierName", "supplier", "storeName", "store_name", "shopName", "shop_name", "seller", "company"]),
    supplierRating: pickNum(o, ["supplierRating", "rating", "store_rating", "evaluateScore", "seller_rating"]),
    reviewCount: pickNum(o, ["reviewCount", "reviews", "review_count", "orders", "tradeCount", "sales"]),
    shippingInfo: pickStr(o, ["shipping", "shippingInfo", "shipping_info", "logistics", "delivery"]),
    location: pickStr(o, ["location", "country", "shipFrom", "ship_from"]),
    variants: Array.isArray(o.variants) ? (o.variants as unknown[]).map(String).slice(0, 6) : undefined,
    raw: o,
  };
}

// ── Provider : SIMULÉ (toujours disponible) ──────────────────────────────────
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function titleCase(s: string): string { return s.split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" "); }

const simulatedProvider: SupplierProvider = {
  id: "simulated", label: "Simulé", real: false, available: () => true,
  async search(q) {
    const enKw = q.keywords.length ? q.keywords : [q.productType || "product"];
    const base = (enKw[0] || "product").toLowerCase();
    const rnd = seeded(hash(base + q.niche));
    const variantWords = ["Pro", "Premium", "Deluxe", "Set", "2024", "Upgraded", "Factory", "OEM", "Wholesale", "New"];
    const sources: SupplierResult["source"][] = ["Alibaba", "AliExpress", "Alibaba", "AliExpress", "Alibaba", "AliExpress"];
    const out: SupplierItem[] = [];
    for (let i = 0; i < Math.min(q.maxItems, 6); i++) {
      const kw = enKw[i % enKw.length] || base;
      const lo = Math.round((4 + rnd() * 30) * 100) / 100;
      const hi = Math.round((lo + 3 + rnd() * 18) * 100) / 100;
      const moqUnits = [1, 1, 2, 5, 10, 10, 20][Math.floor(rnd() * 7)];
      out.push({
        id: `sim_${i}_${hash(kw + i).toString(36)}`,
        source: sources[i % sources.length],
        title: titleCase(`${kw} ${variantWords[Math.floor(rnd() * variantWords.length)]}`).slice(0, 70),
        productUrl: `https://www.${sources[i % sources.length].toLowerCase()}.com/wholesale/${encodeURIComponent(kw.replace(/\s+/g, "-"))}.html`,
        price: `${lo.toFixed(2)} – ${hi.toFixed(2)} $`,
        minPrice: lo, maxPrice: hi, currency: "$",
        moq: moqUnits === 1 ? "1 pièce" : `${moqUnits} pièces`,
        supplierName: `${titleCase(q.niche || "Global")} Supplier Co.`,
        supplierRating: Math.round((3.9 + rnd() * 1.1) * 10) / 10,
        reviewCount: Math.floor(20 + rnd() * 900),
        shippingInfo: rnd() > 0.5 ? "Express 7-12 j" : "Standard 15-25 j",
        location: "CN",
        variants: Array.from({ length: Math.floor(rnd() * 4) }, (_, k) => `Variante ${k + 1}`),
      });
    }
    return out;
  },
};

// ── Provider : APIFY (Alibaba / AliExpress via actor) ────────────────────────
const apifyProvider: SupplierProvider = {
  id: "apify", label: "Apify", real: true,
  available: () => !!env("APIFY_TOKEN") && !!(env("APIFY_ALIEXPRESS_ACTOR") || env("APIFY_ALIBABA_ACTOR")),
  async search(q) {
    const token = env("APIFY_TOKEN");
    const actor = q.platform === "alibaba"
      ? (env("APIFY_ALIBABA_ACTOR") || env("APIFY_ALIEXPRESS_ACTOR"))
      : (env("APIFY_ALIEXPRESS_ACTOR") || env("APIFY_ALIBABA_ACTOR"));
    if (!token || !actor) throw new Error("apify not configured");
    const url = `https://api.apify.com/v2/acts/${encodeURIComponent(actor)}/run-sync-get-dataset-items?token=${token}&timeout=60`;
    const res = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ search: q.keywords.join(" "), query: q.keywords.join(" "), maxItems: q.maxItems, maxResults: q.maxItems }),
    });
    if (!res.ok) throw new Error(`apify ${res.status}`);
    const data = await res.json();
    const items = Array.isArray(data) ? data : Array.isArray((data as { items?: unknown[] })?.items) ? (data as { items: unknown[] }).items : [];
    const fallback: SupplierResult["source"] = q.platform === "alibaba" ? "Alibaba" : "AliExpress";
    return items.map((it, i) => guessItem(it as Record<string, unknown>, i, fallback)).filter((x): x is SupplierItem => !!x).slice(0, q.maxItems);
  },
};

// ── Provider : CUSTOM (HTTP JSON générique, ex. RapidAPI / SerpApi) ──────────
const customProvider: SupplierProvider = {
  id: "custom", label: "Custom", real: true,
  available: () => !!env("LENS_CUSTOM_SEARCH_URL"),
  async search(q) {
    const tpl = env("LENS_CUSTOM_SEARCH_URL");
    if (!tpl) throw new Error("custom not configured");
    const url = tpl.replace(/\{query\}/g, encodeURIComponent(q.keywords.join(" "))).replace(/\{limit\}/g, String(q.maxItems));
    let headers: Record<string, string> = { Accept: "application/json" };
    try { const h = env("LENS_CUSTOM_SEARCH_HEADERS"); if (h) headers = { ...headers, ...JSON.parse(h) }; } catch { /* en-têtes invalides ignorés */ }
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`custom ${res.status}`);
    const data = await res.json();
    const path = env("LENS_CUSTOM_ITEMS_PATH");
    const arr = path ? getPath(data, path) : (Array.isArray(data) ? data : (data as { data?: unknown }).data ?? (data as { results?: unknown }).results ?? (data as { products?: unknown }).products);
    const items = Array.isArray(arr) ? arr : [];
    return items.map((it, i) => guessItem(it as Record<string, unknown>, i, "Other")).filter((x): x is SupplierItem => !!x).slice(0, q.maxItems);
  },
};

// ── Registre + résolution ────────────────────────────────────────────────────
const REGISTRY: Record<string, SupplierProvider> = {
  simulated: simulatedProvider,
  apify: apifyProvider,
  custom: customProvider,
};
const REAL_ORDER: SupplierSearchProvider[] = ["apify", "custom"];

/** Providers réels actuellement configurés (env présentes). */
export function availableRealProviders(): SupplierSearchProvider[] {
  return REAL_ORDER.filter((id) => REGISTRY[id]?.available());
}

/** Résout le provider à utiliser + la plateforme (alibaba/aliexpress = alias réels). */
export function resolveProvider(requested?: SupplierSearchProvider): { provider: SupplierProvider; platform?: "alibaba" | "aliexpress" } {
  const def = (env("LENS_SUPPLIER_PROVIDER") as SupplierSearchProvider) || undefined;
  const want = requested || def;

  if (want === "simulated") return { provider: simulatedProvider };
  if (want === "alibaba" || want === "aliexpress") {
    const real = availableRealProviders();
    if (real.length) return { provider: REGISTRY[real[0]], platform: want };
    return { provider: simulatedProvider };
  }
  if (want && REGISTRY[want] && REGISTRY[want].real && REGISTRY[want].available()) return { provider: REGISTRY[want] };

  // Auto : première source réelle dispo, sinon simulé.
  const real = availableRealProviders();
  return real.length ? { provider: REGISTRY[real[0]] } : { provider: simulatedProvider };
}

export { withTimeout };

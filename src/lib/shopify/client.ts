// ──────────────────────────────────────────────────────────────────────────
// Client API Admin Shopify (GraphQL) — BYOK : domaine boutique + Admin API
// access token (custom app). Aucun OAuth en V1, cohérent avec le modèle BYOK.
// Le token n'est jamais loggé ; il transite chiffré côté serveur.
// ──────────────────────────────────────────────────────────────────────────

import type { ShopAccount, ShopifyProduct, ShopifyImage, ShopifyVariant } from "./types";

const API_VERSION = "2024-10";

/** Normalise un domaine boutique en *.myshopify.com (domaine admin requis). */
export function normalizeShop(input: string): string {
  let s = input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!s) return "";
  if (!s.includes(".")) s = `${s}.myshopify.com`;
  return s;
}

function endpoint(shop: string): string {
  return `https://${shop}/admin/api/${API_VERSION}/graphql.json`;
}

async function gql<T>(shop: string, token: string, query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(endpoint(shop), {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query, variables }),
  });
  if (res.status === 401 || res.status === 403) throw new Error("Token Admin API refusé (droits ou token invalide).");
  if (!res.ok) throw new Error(`Shopify a répondu ${res.status}.`);
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors[0].message);
  if (!json.data) throw new Error("Réponse Shopify vide.");
  return json.data;
}

/** Teste la connexion et renvoie les infos boutique. */
export async function testShop(shop: string, token: string): Promise<ShopAccount> {
  const data = await gql<{ shop: { name: string; currencyCode: string }; productsCount?: { count: number } }>(
    shop,
    token,
    `{ shop { name currencyCode } productsCount { count } }`
  );
  return { shop, name: data.shop.name, currency: data.shop.currencyCode, productCount: data.productsCount?.count };
}

interface RawProduct {
  id: string; handle: string; title: string; descriptionHtml: string; vendor: string;
  productType: string; tags: string[]; status: string;
  seo: { title: string | null; description: string | null } | null;
  options: { name: string; values: string[] }[];
  images: { edges: { node: { url: string; altText: string | null } }[] };
  variants: { edges: { node: { id: string; sku: string | null; price: string; compareAtPrice: string | null; inventoryQuantity: number | null; selectedOptions: { name: string; value: string }[]; image: { url: string } | null } }[] };
  collections: { edges: { node: { title: string } }[] };
}

const PRODUCTS_QUERY = `
query Products($cursor: String) {
  products(first: 50, after: $cursor, sortKey: UPDATED_AT, reverse: true) {
    edges { node {
      id handle title descriptionHtml vendor productType tags status
      seo { title description }
      options { name values }
      images(first: 20) { edges { node { url altText } } }
      variants(first: 20) { edges { node { id sku price compareAtPrice inventoryQuantity selectedOptions { name value } image { url } } } }
      collections(first: 10) { edges { node { title } } }
    } }
    pageInfo { hasNextPage endCursor }
  }
}`;

function mapProduct(n: RawProduct): ShopifyProduct {
  const images: ShopifyImage[] = n.images.edges.map((e) => ({ src: e.node.url, alt: e.node.altText }));
  const variants: ShopifyVariant[] = n.variants.edges.map((e) => {
    const v = e.node;
    const so = v.selectedOptions;
    return {
      id: v.id,
      sku: v.sku,
      price: v.price,
      compareAtPrice: v.compareAtPrice,
      inventoryQty: v.inventoryQuantity,
      option1: so[0]?.value ?? null,
      option2: so[1]?.value ?? null,
      option3: so[2]?.value ?? null,
      imageSrc: v.image?.url ?? null,
    };
  });
  const inventoryKnown = variants.some((v) => v.inventoryQty != null);
  return {
    id: n.id,
    handle: n.handle,
    title: n.title,
    bodyHtml: n.descriptionHtml || "",
    vendor: n.vendor || "",
    productType: n.productType || "",
    tags: n.tags || [],
    status: n.status,
    images,
    variants,
    options: n.options || [],
    seoTitle: n.seo?.title ?? null,
    seoDescription: n.seo?.description ?? null,
    collections: n.collections.edges.map((e) => e.node.title),
    available: { seo: n.seo != null, inventory: inventoryKnown, collections: n.collections.edges.length > 0 },
  };
}

/** Récupère les produits (paginé), plafonné pour une sync V1 raisonnable. */
export async function fetchProducts(shop: string, token: string, max = 250): Promise<ShopifyProduct[]> {
  const out: ShopifyProduct[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 10 && out.length < max; page++) {
    const data: { products: { edges: { node: RawProduct }[]; pageInfo: { hasNextPage: boolean; endCursor: string } } } =
      await gql(shop, token, PRODUCTS_QUERY, { cursor });
    for (const e of data.products.edges) out.push(mapProduct(e.node));
    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.pageInfo.endCursor;
  }
  return out.slice(0, max);
}

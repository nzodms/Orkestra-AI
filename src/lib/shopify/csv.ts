// ──────────────────────────────────────────────────────────────────────────
// Export CSV Shopify propre (V1, pur). Reconstruit un CSV produit complet
// (1 ligne produit + lignes variantes/images supplémentaires) en appliquant
// UNIQUEMENT les champs optimisés fournis. Les IDs/handles/variants/images
// d'origine sont préservés sauf override explicite.
// ──────────────────────────────────────────────────────────────────────────

import { serializeCsv } from "../import-factory";
import type { ShopifyProduct, ProductOverride } from "./types";

const HEADERS = [
  "Handle", "Title", "Body (HTML)", "Vendor", "Product Category", "Type", "Tags", "Published",
  "Option1 Name", "Option1 Value", "Option2 Name", "Option2 Value", "Option3 Name", "Option3 Value",
  "Variant SKU", "Variant Inventory Qty", "Variant Price", "Variant Compare At Price",
  "Image Src", "Image Position", "Image Alt Text", "Variant Image", "SEO Title", "SEO Description", "Status",
] as const;

type Col = (typeof HEADERS)[number];

function blankRow(): Record<Col, string> {
  return Object.fromEntries(HEADERS.map((h) => [h, ""])) as Record<Col, string>;
}

function toArray(row: Record<Col, string>): string[] {
  return HEADERS.map((h) => row[h] ?? "");
}

export interface ExportItem {
  product: ShopifyProduct;
  override?: ProductOverride;
}

export function productsToShopifyCsv(items: ExportItem[]): string {
  const rows: string[][] = [];

  for (const { product: p, override } of items) {
    const handle = override?.handle?.trim() || p.handle;
    const title = override?.title ?? p.title;
    const body = override?.bodyHtml ?? p.bodyHtml;
    const type = override?.productType ?? p.productType;
    const tags = (override?.tags ?? p.tags).join(", ");
    const seoTitle = override?.seoTitle ?? p.seoTitle ?? "";
    const seoDesc = override?.seoDescription ?? p.seoDescription ?? "";
    const published = p.status === "ACTIVE" ? "TRUE" : "FALSE";
    const status = (p.status || "active").toLowerCase();
    const opt = p.options;
    const v0 = p.variants[0];
    const img0 = p.images[0];
    const altOf = (i: number, fallback: string | null) =>
      override?.imageAlts && override.imageAlts[i] !== undefined ? override.imageAlts[i] ?? "" : fallback ?? "";

    // Ligne principale (produit + 1ère variante + 1ère image)
    const main = blankRow();
    main["Handle"] = handle;
    main["Title"] = title;
    main["Body (HTML)"] = body;
    main["Vendor"] = p.vendor;
    main["Type"] = type;
    main["Tags"] = tags;
    main["Published"] = published;
    main["Option1 Name"] = opt[0]?.name || "Title";
    main["Option1 Value"] = v0?.option1 || "Default Title";
    main["Option2 Name"] = opt[1]?.name || "";
    main["Option2 Value"] = v0?.option2 || "";
    main["Option3 Name"] = opt[2]?.name || "";
    main["Option3 Value"] = v0?.option3 || "";
    main["Variant SKU"] = v0?.sku || "";
    main["Variant Inventory Qty"] = v0?.inventoryQty != null ? String(v0.inventoryQty) : "";
    main["Variant Price"] = v0?.price || "";
    main["Variant Compare At Price"] = v0?.compareAtPrice || "";
    main["Image Src"] = img0?.src || "";
    main["Image Position"] = img0 ? "1" : "";
    main["Image Alt Text"] = img0 ? altOf(0, img0.alt) : "";
    main["SEO Title"] = seoTitle;
    main["SEO Description"] = seoDesc;
    main["Status"] = status;
    rows.push(toArray(main));

    // Variantes supplémentaires (préservées telles quelles, jamais cassées)
    for (let i = 1; i < p.variants.length; i++) {
      const v = p.variants[i];
      const r = blankRow();
      r["Handle"] = handle;
      r["Option1 Value"] = v.option1 || "";
      r["Option2 Value"] = v.option2 || "";
      r["Option3 Value"] = v.option3 || "";
      r["Variant SKU"] = v.sku || "";
      r["Variant Inventory Qty"] = v.inventoryQty != null ? String(v.inventoryQty) : "";
      r["Variant Price"] = v.price || "";
      r["Variant Compare At Price"] = v.compareAtPrice || "";
      r["Variant Image"] = v.imageSrc || "";
      rows.push(toArray(r));
    }

    // Images supplémentaires (préservées ; seul l'alt peut être optimisé)
    for (let j = 1; j < p.images.length; j++) {
      const img = p.images[j];
      const r = blankRow();
      r["Handle"] = handle;
      r["Image Src"] = img.src;
      r["Image Position"] = String(j + 1);
      r["Image Alt Text"] = altOf(j, img.alt);
      rows.push(toArray(r));
    }
  }

  return serializeCsv([...HEADERS], rows);
}

/** Déclenche le téléchargement du CSV côté navigateur. */
export function downloadShopifyCsv(items: ExportItem[], filename = "orkestra-produits-shopify.csv") {
  const csv = productsToShopifyCsv(items);
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ──────────────────────────────────────────────────────────────────────────
// Orkestra Lens — liens de recherche fournisseur (PUR, client + serveur).
// Toujours disponibles, même si Gemini / Claude échouent : Lens reste utile.
// ──────────────────────────────────────────────────────────────────────────

import type { SearchLink } from "./lens-types";

/** Construit les 4 recherches fournisseur prêtes à ouvrir pour un nom produit. */
export function buildSearchLinks(query: string): SearchLink[] {
  const q = encodeURIComponent((query || "").trim());
  return [
    {
      source: "AliExpress",
      url: `https://fr.aliexpress.com/wholesale?SearchText=${q}&SortType=total_tranpro_desc`,
      advantage: "Petites quantités, idéal test & dropshipping",
      limit: "Qualité variable — vérifier le vendeur et les avis",
    },
    {
      source: "Alibaba",
      url: `https://www.alibaba.com/trade/search?SearchText=${q}&IndexArea=product_en`,
      advantage: "Fournisseurs et usines, MOQ négociable",
      limit: "Souvent en gros — MOQ parfois élevé",
    },
    {
      source: "1688",
      url: `https://s.1688.com/selloffer/offerlist.htm?keywords=${q}`,
      advantage: "Prix usine Chine, souvent le moins cher",
      limit: "En chinois — sourcing avancé / agent utile",
    },
    {
      source: "Google",
      url: `https://www.google.com/search?q=${q}+supplier+manufacturer`,
      advantage: "Large : fabricants, marques, comparateurs",
      limit: "Résultats non filtrés — à trier",
    },
  ];
}

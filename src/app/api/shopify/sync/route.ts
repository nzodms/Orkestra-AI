import { NextResponse } from "next/server";
import { decryptSecret } from "@/lib/crypto";
import { getEncrypted } from "@/lib/server/keyStore";
import { normalizeShop, fetchProducts } from "@/lib/shopify/client";
import { analyzeProduct, catalogSummary } from "@/lib/shopify/analyze";

// ──────────────────────────────────────────────────────────────────────────
// POST /api/shopify/sync  { shop, keyId?, token? }
// Récupère les vrais produits Shopify, lance l'analyse qualité Orkestra et
// renvoie les produits analysés + une synthèse catalogue.
// ──────────────────────────────────────────────────────────────────────────

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const shop = normalizeShop(String(body.shop || ""));
    if (!shop) return NextResponse.json({ ok: false, error: "Boutique non spécifiée." }, { status: 400 });

    // Token : depuis le keyId chiffré (préféré) sinon fourni directement.
    let token = "";
    if (body.keyId) {
      const stored = await getEncrypted(String(body.keyId));
      if (stored) token = decryptSecret(stored.encrypted);
    }
    if (!token && body.token) token = String(body.token);
    if (!token) return NextResponse.json({ ok: false, error: "Connexion Shopify introuvable. Reconnectez la boutique." }, { status: 401 });

    let products;
    try {
      products = await fetchProducts(shop, token);
    } catch (e) {
      return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Récupération des produits échouée." }, { status: 400 });
    }

    const analyzed = products.map(analyzeProduct);
    return NextResponse.json({
      ok: true,
      syncedAt: new Date().toISOString(),
      count: analyzed.length,
      summary: catalogSummary(analyzed),
      products: analyzed,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Requête invalide." }, { status: 400 });
  }
}

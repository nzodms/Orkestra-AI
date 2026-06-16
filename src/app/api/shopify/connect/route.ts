import { NextResponse } from "next/server";
import { encryptSecret, maskApiKey, hasMasterKey } from "@/lib/crypto";
import { saveKey, keyStoreBackend } from "@/lib/server/keyStore";
import { normalizeShop, testShop } from "@/lib/shopify/client";

// ──────────────────────────────────────────────────────────────────────────
// POST /api/shopify/connect  { shop, token }
// Teste le token Admin API, stocke le token CHIFFRÉ (keyId opaque) et renvoie
// les infos boutique. Le token n'est jamais renvoyé ni loggé en clair.
// ──────────────────────────────────────────────────────────────────────────

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const shop = normalizeShop(String(body.shop || ""));
    const token = String(body.token || "").trim();
    if (!shop || !shop.includes(".myshopify.com")) {
      return NextResponse.json({ ok: false, error: "Domaine boutique invalide (attendu : votre-boutique.myshopify.com)." }, { status: 400 });
    }
    if (!token) {
      return NextResponse.json({ ok: false, error: "Token Admin API manquant." }, { status: 400 });
    }

    let account;
    try {
      account = await testShop(shop, token);
    } catch (e) {
      return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Connexion Shopify échouée." }, { status: 400 });
    }

    // Stockage chiffré (si master key dispo) — sinon connexion en clair impossible.
    let keyId: string | null = null;
    if (hasMasterKey()) {
      const meta = await saveKey({
        provider: "shopify",
        encrypted: encryptSecret(token),
        maskedKey: maskApiKey(token),
        model: shop,
        status: "connected",
      });
      keyId = meta.id;
    }

    return NextResponse.json({
      ok: true,
      shop: account.shop,
      name: account.name,
      currency: account.currency,
      productCount: account.productCount ?? null,
      maskedToken: maskApiKey(token),
      keyId,
      keyStore: keyStoreBackend(),
      encrypted: hasMasterKey(),
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Requête invalide." }, { status: 400 });
  }
}

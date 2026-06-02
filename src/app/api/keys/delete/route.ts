import { NextResponse } from "next/server";
import { deleteKey } from "@/lib/server/keyStore";

// POST /api/keys/delete — supprime une clé stockée côté serveur.
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { keyId } = (await req.json()) as { keyId?: string };
    if (keyId) await deleteKey(keyId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}

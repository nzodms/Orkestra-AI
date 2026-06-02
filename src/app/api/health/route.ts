import { NextResponse } from "next/server";
import { hasMasterKey } from "@/lib/crypto";
import { keyStoreBackend } from "@/lib/server/keyStore";

// ──────────────────────────────────────────────────────────────────────────
// GET /api/health — diagnostic de configuration (AUCUN secret exposé).
// Permet de vérifier en un coup d'œil si la prod est prête pour OpenAI live.
// ──────────────────────────────────────────────────────────────────────────

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const mockMode = process.env.ORKESTRA_MOCK_MODE !== "false";
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
  const hasEncryptionMasterKey = hasMasterKey();
  const backend = keyStoreBackend();
  const environment =
    process.env.VERCEL_ENV || process.env.NODE_ENV || "development";

  // Prêt pour OpenAI live : mode live activé + clé de chiffrement présente.
  const openAiLiveReady = !mockMode && hasEncryptionMasterKey;

  // Avertissements actionnables (sans secrets).
  const warnings: string[] = [];
  if (mockMode) warnings.push("ORKESTRA_MOCK_MODE n'est pas 'false' : toutes les générations restent en mode démo (mock).");
  if (!hasEncryptionMasterKey) warnings.push("ENCRYPTION_MASTER_KEY manquante : définissez-la (openssl rand -base64 32) pour chiffrer les clés API de façon sécurisée.");
  if (!hasDatabaseUrl) warnings.push("DATABASE_URL absent : stockage des clés en mémoire (non persistant). En serverless/Vercel, la clé peut être perdue entre requêtes — définissez DATABASE_URL + 'prisma db push'.");

  const status = openAiLiveReady && hasDatabaseUrl ? "ready" : openAiLiveReady ? "ready-no-persistence" : "not-ready";

  return NextResponse.json({
    status,
    mockMode,
    hasDatabaseUrl,
    keyStore: backend,
    hasEncryptionMasterKey,
    openAiLiveReady,
    environment,
    warnings,
    timestamp: new Date().toISOString(),
  });
}

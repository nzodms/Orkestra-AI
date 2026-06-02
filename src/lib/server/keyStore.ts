import type { EncryptedSecret } from "../crypto";

// ──────────────────────────────────────────────────────────────────────────
// Stockage serveur des clés API BYOK (chiffrées).
//
// Backends :
//  - Prisma/Postgres si DATABASE_URL est défini (persistance prod, Vercel).
//  - In-memory sinon (dev / preview sans base) — non persistant entre
//    redémarrages, mais suffisant pour valider le pipeline.
//
// Le client ne reçoit JAMAIS la clé en clair : seulement un `id` opaque + la
// version masquée. Le déchiffrement se fait via crypto.decryptSecret au moment
// de l'appel IA, côté serveur uniquement.
// ──────────────────────────────────────────────────────────────────────────

export interface StoredKeyMeta {
  id: string;
  provider: string;
  maskedKey: string;
  model: string;
  status: string;
  lastTestedAt: string | null;
  createdAt: string;
}

export interface SaveKeyInput {
  provider: string;
  encrypted: EncryptedSecret;
  maskedKey: string;
  model: string;
  status?: string;
}

const usePrisma = () => Boolean(process.env.DATABASE_URL);

// ── Backend in-memory ───────────────────────────────────────────────────────
type MemRow = StoredKeyMeta & { enc: EncryptedSecret };
const mem: Map<string, MemRow> = (globalThis as any).__orkestraKeys ?? new Map();
(globalThis as any).__orkestraKeys = mem;

function randomId(): string {
  return "key_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ── Backend Prisma (lazy) ───────────────────────────────────────────────────
let prismaClient: any = null;
async function prisma(): Promise<any> {
  if (prismaClient) return prismaClient;
  const { PrismaClient } = await import("@prisma/client");
  prismaClient = (globalThis as any).__orkestraPrisma ?? new PrismaClient();
  (globalThis as any).__orkestraPrisma = prismaClient;
  return prismaClient;
}

// ── API publique ────────────────────────────────────────────────────────────

export async function saveKey(input: SaveKeyInput): Promise<StoredKeyMeta> {
  const now = new Date();
  if (usePrisma()) {
    const db = await prisma();
    const row = await db.apiKeyStore.create({
      data: {
        provider: input.provider,
        encIv: input.encrypted.iv,
        encTag: input.encrypted.tag,
        encData: input.encrypted.data,
        maskedKey: input.maskedKey,
        model: input.model,
        status: input.status ?? "connected",
        lastTestedAt: now,
      },
    });
    return toMeta(row);
  }
  const id = randomId();
  const meta: StoredKeyMeta = {
    id,
    provider: input.provider,
    maskedKey: input.maskedKey,
    model: input.model,
    status: input.status ?? "connected",
    lastTestedAt: now.toISOString(),
    createdAt: now.toISOString(),
  };
  mem.set(id, { ...meta, enc: input.encrypted });
  return meta;
}

export async function getEncrypted(id: string): Promise<{ encrypted: EncryptedSecret; meta: StoredKeyMeta } | null> {
  if (usePrisma()) {
    const db = await prisma();
    const row = await db.apiKeyStore.findUnique({ where: { id } });
    if (!row) return null;
    return { encrypted: { iv: row.encIv, tag: row.encTag, data: row.encData }, meta: toMeta(row) };
  }
  const row = mem.get(id);
  if (!row) return null;
  return { encrypted: row.enc, meta: row };
}

export async function deleteKey(id: string): Promise<void> {
  if (usePrisma()) {
    const db = await prisma();
    await db.apiKeyStore.delete({ where: { id } }).catch(() => {});
    return;
  }
  mem.delete(id);
}

function toMeta(row: any): StoredKeyMeta {
  return {
    id: row.id,
    provider: row.provider,
    maskedKey: row.maskedKey,
    model: row.model,
    status: row.status,
    lastTestedAt: row.lastTestedAt ? new Date(row.lastTestedAt).toISOString() : null,
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

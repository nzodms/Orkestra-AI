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

/** Backend actif : "prisma" (persistant) ou "memory" (non persistant). */
export function keyStoreBackend(): "prisma" | "memory" {
  return usePrisma() ? "prisma" : "memory";
}

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

function memSave(input: SaveKeyInput): StoredKeyMeta {
  const now = new Date();
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

export async function saveKey(input: SaveKeyInput): Promise<StoredKeyMeta> {
  if (usePrisma()) {
    try {
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
          lastTestedAt: new Date(),
        },
      });
      return toMeta(row);
    } catch (e: any) {
      // Ex : table ApiKeyStore absente (db push non lancé). On ne casse pas la
      // connexion : repli in-memory + avertissement clair côté serveur.
      console.warn(
        "[Orkestra] Sauvegarde Prisma impossible (" +
          (e?.code || e?.name || "erreur") +
          ") → repli in-memory. Lancez `prisma db push` pour une persistance fiable."
      );
      return memSave(input);
    }
  }
  return memSave(input);
}

export async function getEncrypted(id: string): Promise<{ encrypted: EncryptedSecret; meta: StoredKeyMeta } | null> {
  if (usePrisma() && !id.startsWith("key_")) {
    try {
      const db = await prisma();
      const row = await db.apiKeyStore.findUnique({ where: { id } });
      if (row) return { encrypted: { iv: row.encIv, tag: row.encTag, data: row.encData }, meta: toMeta(row) };
    } catch (e: any) {
      console.warn("[Orkestra] Lecture Prisma impossible (" + (e?.code || e?.name || "erreur") + ") → repli in-memory.");
    }
  }
  const row = mem.get(id);
  if (!row) return null;
  return { encrypted: row.enc, meta: row };
}

export async function deleteKey(id: string): Promise<void> {
  mem.delete(id);
  if (usePrisma() && !id.startsWith("key_")) {
    try {
      const db = await prisma();
      await db.apiKeyStore.delete({ where: { id } }).catch(() => {});
    } catch {
      /* déjà supprimé du memory store */
    }
  }
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

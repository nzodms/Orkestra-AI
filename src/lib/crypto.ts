import crypto from "crypto";

// ──────────────────────────────────────────────────────────────────────────
// Chiffrement des clés API clients (BYOK) — AES-256-GCM
//
// Les clés API des clients ne sont JAMAIS stockées en clair ni renvoyées au
// navigateur. On stocke uniquement le blob chiffré + une version masquée pour
// l'affichage (ex: "sk-...AB12"). Le déchiffrement se fait côté serveur, au
// moment d'appeler le provider IA.
// ──────────────────────────────────────────────────────────────────────────

const ALGO = "aes-256-gcm";

function getMasterKey(): Buffer {
  const raw = process.env.ENCRYPTION_MASTER_KEY;
  if (!raw) {
    // Fallback dev uniquement — en prod ENCRYPTION_MASTER_KEY est obligatoire.
    return crypto.createHash("sha256").update("orkestra-dev-master-key").digest();
  }
  return crypto.createHash("sha256").update(raw).digest();
}

export interface EncryptedSecret {
  iv: string;
  tag: string;
  data: string;
}

export function encryptSecret(plaintext: string): EncryptedSecret {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getMasterKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: encrypted.toString("base64"),
  };
}

export function decryptSecret(secret: EncryptedSecret): string {
  const decipher = crypto.createDecipheriv(
    ALGO,
    getMasterKey(),
    Buffer.from(secret.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(secret.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(secret.data, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

/** Version masquée pour l'affichage UI — ne révèle jamais la clé complète. */
export function maskApiKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.length <= 8) return "••••••••";
  return `${trimmed.slice(0, 3)}•••${trimmed.slice(-4)}`;
}

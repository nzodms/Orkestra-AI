// Crée/synchronise les tables Prisma au build UNIQUEMENT si DATABASE_URL est
// défini (ex. Vercel). En local sans base, on saute proprement — le keyStore
// retombe en in-memory. Un échec de push ne casse pas le build.
import { execSync } from "node:child_process";

if (process.env.DATABASE_URL) {
  try {
    console.log("[Orkestra] DATABASE_URL détecté → prisma db push…");
    execSync("prisma db push --skip-generate --accept-data-loss", { stdio: "inherit" });
  } catch {
    console.warn("[Orkestra] prisma db push a échoué — le keyStore retombera en in-memory si besoin.");
  }
} else {
  console.log("[Orkestra] DATABASE_URL absent → db push ignoré (in-memory).");
}

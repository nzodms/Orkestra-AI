import type { ImportRules } from "../import-factory";

// ──────────────────────────────────────────────────────────────────────────
// Import Factory — routing multi-modèle (architecture préparée).
//   • OpenAI : transformation structurée OBLIGATOIRE (parsing, JSON, titres,
//     meta, tags, variantes, alt, export).
//   • Claude : relecture éditoriale PREMIUM des champs texte uniquement
//     (Body HTML, FAQ, titre, meta) — activée pour les modes avancés / Ultra
//     SI une clé Claude est connectée. Sinon, OpenAI seul.
//   • QC déterministe : arbitre final (emoji, suffixe, cm, anglais, longueur,
//     anti-invention, sécurité Shopify) — TOUJOURS.
// Claude ne voit qu'une représentation produit structurée, jamais le CSV brut :
// le CSV final est toujours reconstruit par le builder déterministe.
// ──────────────────────────────────────────────────────────────────────────

export interface ImportModelPlan {
  /** Génération structurée — toujours OpenAI (obligatoire). */
  transform: "openai";
  /** Relecture éditoriale premium — Claude si disponible et mode avancé, sinon null. */
  editorial: "claude" | null;
  /** Contrôle qualité final — toujours déterministe. */
  qc: "deterministic";
  /** Badge UX discret (ex. « OpenAI + Claude · QC déterministe »). */
  badge: string;
  /** Le mode justifie-t-il une passe éditoriale premium ? (indépendant de la dispo Claude) */
  wantsEditorial: boolean;
}

/** Un mode/niveau « avancé » bénéficie de la relecture éditoriale premium. */
export function isAdvanced(rules: ImportRules): boolean {
  return (
    rules.level === "poussé" ||
    rules.level === "ultra complet" ||
    rules.transform === "rename_optimize" ||
    rules.transform === "recreate" ||
    rules.transform === "supplier_to_brand"
  );
}

/** Décide quels modèles interviennent pour une transformation donnée. */
export function planImportModels(rules: ImportRules, opts?: { claudeAvailable?: boolean }): ImportModelPlan {
  const wantsEditorial = isAdvanced(rules);
  const editorial: "claude" | null = wantsEditorial && opts?.claudeAvailable ? "claude" : null;
  const badge = editorial ? "OpenAI + Claude · QC déterministe" : "OpenAI · QC déterministe";
  return { transform: "openai", editorial, qc: "deterministic", badge, wantsEditorial };
}

// ──────────────────────────────────────────────────────────────────────────
// Classification d'intention vocale (V1 déterministe : mots-clés / regex).
// Rapide, sans clé, stable. La V2 pourra brancher un LLM pour les cas ambigus.
// ──────────────────────────────────────────────────────────────────────────

import type { VoiceIntent, VoiceIntentId, VoiceModule } from "./voice-types";

function norm(s: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const MODULE_OF: Record<VoiceIntentId, VoiceModule> = {
  "import.analyze": "import", "import.issues": "import",
  "lens.search": "lens", "lens.compare": "lens", "lens.send": "import",
  "merchant.status": "merchant", "shopify.path": "assistant",
  "dashboard.status": "dashboard", unknown: "none",
};

// Extrait la cible d'une recherche fournisseur (« pour un Pilates Reformer »…).
function extractQuery(t: string): string | undefined {
  const m = t.match(/(?:fournisseurs?|fournisseur|sourcing|cherche[rz]?|trouve[rz]?|recherche[rz]?)\s+(?:moi\s+)?(?:des?\s+|un\s+|une\s+|sur\s+\w+\s+(?:pour\s+)?)?(?:fournisseurs?\s+)?(?:pour\s+(?:un\s+|une\s+|des\s+)?)?(.+)$/i);
  let q = (m && m[1] ? m[1] : "").trim();
  q = q.replace(/\b(s'il te plait|stp|merci|orkestra)\b/gi, "").replace(/[?.!]+$/, "").trim();
  return q.length >= 2 ? q : undefined;
}

interface Rule { id: VoiceIntentId; re: RegExp; action?: string }
// Ordre = priorité (spécifique → générique).
const RULES: Rule[] = [
  // Orkestra Lens
  { id: "lens.compare", re: /compare(r|z)?\s+(les\s+)?fournisseurs|comparer? les resultats|meilleur fournisseur/i },
  { id: "lens.search", re: /fournisseur|sourcing|alibaba|aliexpress|1688|trouve.{0,8}(produit|machine)|cherche.{0,8}sur/i },
  // Import Factory
  { id: "import.issues", re: /(produits?|fiches?).{0,12}(a corriger|corriger|probleme)|resume.{0,6}(les )?probleme|quels probleme|a corriger/i },
  { id: "import.analyze", re: /(analyse|analyser|verifie|verifier|etat|status|statut).{0,18}(import|csv|catalogue)|mon dernier import|import.{0,6}pret|csv.{0,6}pret/i },
  // Merchant Shield
  { id: "merchant.status", re: /merchant|google shopping|boutique.{0,12}prete|risques?\s+(merchant|google)|prete? pour google/i },
  // Assistant Shopify (chemins)
  { id: "shopify.path", re: /\bou\b.{0,30}(shopify|importer|modifier|changer|corriger|meta|page|csv)|comment.{0,20}(importer|modifier|dans shopify)|dans shopify/i },
  // Dashboard
  { id: "dashboard.status", re: /resume.{0,8}(ma )?boutique|qu.?est.?ce que je dois faire|que dois.je faire|etat de ma boutique|mes priorites|maintenant/i },
];

function shopifyAction(t: string): string {
  if (/\bmeta\b|description|referencement|seo/.test(t)) return "edit-meta";
  if (/\bpage\b|mentions|cgv|politique|legal/.test(t)) return "edit-page";
  if (/\bcsv\b|importer|import/.test(t)) return "import-csv";
  if (/produit|fiche|corriger/.test(t)) return "fix-product";
  return "general";
}

/** Classe une commande vocale en intention + module + outil. */
export function classifyVoiceIntent(text: string): VoiceIntent {
  const t = norm(text);
  for (const r of RULES) {
    if (r.re.test(t)) {
      const params: VoiceIntent["params"] = {};
      if (r.id === "lens.search") params.query = extractQuery(t);
      if (r.id === "shopify.path") params.action = shopifyAction(t);
      return { id: r.id, module: MODULE_OF[r.id], tool: r.id, params, confidence: 0.8 };
    }
  }
  return { id: "unknown", module: "none", tool: "unknown", params: {}, confidence: 0.2 };
}

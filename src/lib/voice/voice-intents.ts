// ──────────────────────────────────────────────────────────────────────────
// Classification d'intention vocale (V1 déterministe, NATURELLE).
// Tolère synonymes, formulations orales, phrases courtes / familières / incomplètes.
// Rapide, sans clé, stable. La V2 pourra brancher un LLM pour les cas ambigus.
// ──────────────────────────────────────────────────────────────────────────

import type { VoiceIntent, VoiceIntentId, VoiceModule } from "./voice-types";

function norm(s: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/['’]/g, " ").replace(/\s+/g, " ").trim();
}

const MODULE_OF: Record<VoiceIntentId, VoiceModule> = {
  "import.analyze": "import", "import.issues": "import", "import.ready": "import", "import.next": "import",
  "lens.search": "lens", "lens.compare": "lens", "lens.send": "import", "lens.open": "lens",
  "merchant.status": "merchant", "merchant.risks": "merchant", "merchant.checklist": "merchant", "merchant.monitor": "merchant",
  "shopify.path": "assistant",
  "dashboard.status": "dashboard", "dashboard.priority": "dashboard", "dashboard.metric": "dashboard",
  "council.ask": "none", "connect.status": "none",
  unknown: "none",
};

// ── Extracteurs de paramètres ────────────────────────────────────────────────
function extractQuery(t: string): string | undefined {
  // « … pour un Pilates Reformer », « cherche fournisseur pilates reformer », « sur alibaba … »
  const m = t.match(/(?:pour|sur\s+\w+\s+(?:pour\s+)?|de|du|des|un|une)\s+([a-z0-9 ]{3,})$/i)
    || t.match(/(?:fournisseurs?|sourcing|cherche[rz]?|trouve[rz]?|recherche[rz]?)\s+(?:moi\s+)?(?:des?\s+|un\s+|une\s+|fournisseurs?\s+(?:pour\s+)?)?([a-z0-9 ]{3,})$/i);
  let q = (m && m[1] ? m[1] : "").trim();
  q = q.replace(/\b(stp|s il te plait|merci|orkestra|ca|cela|ce produit|le produit|fournisseurs?|fournisseur|alibaba|aliexpress|1688|sur|pour|avec|moi|des|un|une|les?|la|mon|ma|mes|ce|cette|moq|faible|bas|europe|europeen|rapide|express|petite|petites|quantite|quantites)\b/gi, "").replace(/\s+/g, " ").trim();
  return q.length >= 3 ? q : undefined;
}
function extractPlatform(t: string): string | undefined {
  if (/aliexpress/.test(t)) return "AliExpress";
  if (/alibaba/.test(t)) return "Alibaba";
  if (/1688/.test(t)) return "1688";
  return undefined;
}
function extractConstraint(t: string): string | undefined {
  if (/moq\s*(faible|bas|petit)|petite quantite|petites quantites|faible quantite|sans gros stock/.test(t)) return "moq";
  if (/europe|europeen|ue\b|union europeenne|local|france|fr\b/.test(t)) return "europe";
  if (/rapide|express|livraison rapide|vite/.test(t)) return "fast";
  return undefined;
}
function extractMetric(t: string): string | undefined {
  if (/confiance|trust|reassurance/.test(t)) return "trust";
  if (/conversion|vente|achat/.test(t)) return "conversion";
  if (/merchant|gmc|shopping/.test(t)) return "merchant";
  if (/seo|referencement|google/.test(t)) return "seo";
  if (/contenu|content|fiches?/.test(t)) return "content";
  return undefined;
}
function shopifyAction(t: string): string {
  if (/redirection|rediriger|url cassee|404/.test(t)) return "redirect";
  if (/menu|navigation/.test(t)) return "menu";
  if (/liquid|section|code|theme/.test(t)) return "liquid";
  if (/alt\b|texte alternatif|image alt/.test(t)) return "edit-alt";
  if (/meta\s*title|titre seo|balise titre/.test(t)) return "edit-meta-title";
  if (/meta|description seo|referencement/.test(t)) return "edit-meta-desc";
  if (/vendor|fournisseur|marque/.test(t)) return "change-vendor";
  if (/collection|categorie/.test(t)) return "edit-collection";
  if (/livraison|shipping|expedition/.test(t)) return "edit-shipping";
  if (/contact|page contact/.test(t)) return "edit-contact";
  if (/description.{0,10}(produit|fiche)|texte produit/.test(t)) return "edit-desc";
  if (/csv|importer|import/.test(t)) return "import-csv";
  if (/produit|fiche|corriger/.test(t)) return "fix-product";
  return "general";
}

interface Rule { id: VoiceIntentId; re: RegExp }
// Ordre = priorité : du plus SPÉCIFIQUE au plus générique.
const RULES: Rule[] = [
  // ── Orkestra Lens ──
  { id: "lens.open", re: /\b(ouvre|ouvrir|montre|affiche)\b.{0,16}\b(meilleur|premier|1er|2eme|deuxieme|3eme|top)\b|ouvre le (meilleur|premier|top)/ },
  { id: "lens.send", re: /\b(envoie|envoyer|exporte|importe|ajoute)\b.{0,24}(import factory|vers import|ce produit|le produit|fournisseur)/ },
  { id: "lens.compare", re: /\bcompare(r|z)?\b.{0,24}(fournisseurs?|resultats?|les \d|\d meilleurs|produits)|comparer les|meilleur fournisseur/ },
  { id: "lens.search", re: /\bfournisseur|sourcing\b|alibaba|aliexpress|1688|moq|wholesale|grossiste|cherche.{0,16}(fournisseur|produit|sur|pour)|trouve.{0,16}(fournisseur|produit|pour)|cherche ca|trouve ca/ },
  // ── Merchant Shield ──
  { id: "merchant.monitor", re: /deja valide|deja validee|validee|apres validation|surveiller|surveillance|post.?import|que dois.?je surveiller|maintenir.{0,12}(boutique|conformite)/ },
  { id: "merchant.checklist", re: /(checklist|liste).{0,20}(avant|merchant|gmc|google)|(\d+|trois|quels?).{0,18}(trucs?|points?|choses?|corrections?|elements?).{0,14}(avant|gmc|merchant|google)|a corriger avant (google|gmc|merchant)|quoi corriger avant/ },
  { id: "merchant.risks", re: /risques?|refus|refuser|refuse|suspension|suspendre|bloquer.{0,12}(boutique|merchant)|qu.?est.?ce qui (peut|pourrait).{0,16}(refuser|suspendre|bloquer|poser probleme)|pourquoi.{0,16}refus/ },
  { id: "merchant.status", re: /\bmerchant\b|\bgmc\b|google shopping|google merchant|prete? pour google|je peux (lancer|demarrer).{0,12}(google|gmc|shopping)|gmc.{0,8}(ok|bon|pret)/ },
  // ── Import Factory ── (issues avant ready : « pourquoi pas publiable » = problèmes)
  { id: "import.issues", re: /probleme|souci|erreur|bloque|bloquant|cloche|va pas|pas publiable|pourquoi.{0,22}(pas|n est pas).{0,12}(pret|publiable)|qu.?est.?ce qui (cloche|bloque|va pas)|marques? fournisseur|metas? (faibles?|courtes?)|descriptions? (courtes?|faibles?)|titres? (mauvais|faibles?)|quels? produits?.{0,14}(corriger|probleme)|(produits?|fiches?) a corriger|a corriger/ },
  { id: "import.ready", re: /(c est|est ce que|est il|elle est)\b.{0,18}(pret|publiable|fini|ok)|(import|csv|fichier|catalogue).{0,14}(pret|fini|ok)\b|pret ou pas|combien.{0,16}(prets?|produits? prets?|produits)|combien de produits/ },
  { id: "import.next", re: /(prochaine action|quoi faire (ensuite|apres|maintenant).{0,12}(import|csv)|que faire (avec|de).{0,10}(mon )?(import|csv)|next.{0,8}(import|etape))/ },
  { id: "import.analyze", re: /(analyse|analyser|regarde|regarder|verifie|verifier|montre|montrer|resume|resumer|etat|statut|status).{0,20}(import|csv|fichier|catalogue)|mon (dernier )?(import|csv|fichier|catalogue)|dernier import/ },
  // ── Assistant Shopify (chemins) ──
  { id: "shopify.path", re: /\bou\b.{0,44}(shopify|importer|modifier|changer|creer|coller|mettre|met|csv|meta|alt|description|collection|redirection|menu|liquid|section|theme|code|vendor|fournisseur|livraison|contact|page)|comment.{0,26}(importer|modifier|creer|coller|dans shopify)|dans shopify|chemin shopify|ou je (met|mets|modifie|change)/ },
  // ── Dashboard ──
  { id: "dashboard.metric", re: /\b(mon|le|la|l)\b.{0,8}(seo|confiance|trust|conversion|merchant|contenu).{0,12}(est|bon|bas|faible|mauvais|nul)?|score (seo|confiance|conversion|global|merchant|contenu)|pourquoi.{0,18}(score|seo|confiance|conversion).{0,12}(bas|faible|mauvais)|est ce que mon (seo|confiance) est/ },
  { id: "dashboard.priority", re: /(le )?plus urgent|priorite|prioritaire|quoi faire maintenant|que dois.?je faire|qu.?est.?ce que je dois faire|qu.?est.?ce qui bloque le plus|prochaines? actions?|par quoi (je )?commence|aujourd hui/ },
  { id: "dashboard.status", re: /resume.{0,14}(ma )?boutique|resume.?moi|fais le point|vue d ensemble|etat (de )?(ma )?boutique|comment va (ma )?boutique|vite fait/ },
  // ── AI Council / connecteurs ──
  { id: "council.ask", re: /avis (expert|des ia|multi)|conseil.{0,8}(expert|ia)|ai council|council|demande (aux|a) (ia|experts?)|qu en pensent les ia/ },
  { id: "connect.status", re: /(mes? )?(ia|cles?|api|connecteurs?|providers?) (connectees?|connectes?|branchees?)|connecter (une|ma|mes) (cle|ia)|combien d ia/ },
];

/** Classe une commande vocale en intention + module + outil + paramètres. */
export function classifyVoiceIntent(text: string): VoiceIntent {
  const t = norm(text);
  for (const r of RULES) {
    if (r.re.test(t)) {
      const params: VoiceIntent["params"] = {};
      if (r.id === "lens.search") { params.query = extractQuery(t); params.platform = extractPlatform(t); params.constraint = extractConstraint(t); }
      if (r.id === "shopify.path") params.action = shopifyAction(t);
      if (r.id === "dashboard.metric") params.metric = extractMetric(t);
      return { id: r.id, module: MODULE_OF[r.id], tool: r.id, params, confidence: 0.82 };
    }
  }
  return { id: "unknown", module: "none", tool: "unknown", params: {}, confidence: 0.2 };
}

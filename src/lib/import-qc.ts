import { FORBIDDEN_JARGON, stripHtml, normName, serializeCsv, stripEmoji, hasEmoji, type TransformedProduct, type ProductGroup, type ApplyResult } from "./import-factory";

// ──────────────────────────────────────────────────────────────────────────
// Import Factory — contrôle qualité DÉTERMINISTE (côté code, pas seulement IA).
// Corrige et signale : suffixe meta, longueur meta, jargon interne, titres
// mal terminés, doublons de noms brandés / handles, descriptions trop courtes.
// ──────────────────────────────────────────────────────────────────────────

export type QCStatus = "ok" | "warning" | "risk" | "failed";

export interface QCContext {
  metaSuffix?: string;
  vendor?: string;
  level?: string;
  oldTerms?: string[];
  /** Les noms brandés produit sont-ils activés ? (sinon vendor ≠ brand). */
  brandNames?: boolean;
  /** Langue cible (ex : « Français ») pour les contrôles linguistiques. */
  language?: string;
  tagsType?: boolean;
  /** Texte source du produit (titre + description + tags + variantes) pour vérifier
   *  qu'une affirmation technique n'est pas inventée (anti-invention). */
  sourceText?: string;
  /** Sets mutables partagés sur tout le lot (dédoublonnage / répétition). */
  usedBrand: Set<string>;
  usedHandle: Set<string>;
  usedMetaOpenings: Set<string>;
  /** Clés de titres déjà utilisés (anti-doublon flou des noms produits). */
  usedTitles?: Set<string>;
}

export interface QCReport {
  status: QCStatus;
  issues: string[];
  fixed: TransformedProduct;
}

const ORDER: Record<QCStatus, number> = { ok: 0, warning: 1, risk: 2, failed: 3 };
function escapeRe(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
const collapse = (s: string) => s.replace(/[ \t]{2,}/g, " ").replace(/\s+([,.;:!?])/g, "$1");

function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 2) return 3;
  const dp = Array.from({ length: m + 1 }, (_, i) => i);
  for (let j = 1; j <= n; j++) {
    let prev = dp[0]; dp[0] = j;
    for (let i = 1; i <= m; i++) {
      const tmp = dp[i];
      dp[i] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[i], dp[i - 1]);
      prev = tmp;
    }
  }
  return dp[m];
}
// ── Anti-doublon flou des titres produit (§13/§14) ──────────────────────────
const TITLE_STOP = new Set(["en", "de", "du", "des", "la", "le", "les", "au", "aux", "et", "ou", "pour", "avec", "sur", "sans", "a", "d", "l"]);
/** Clé normalisée d'un titre : minuscules, sans accents, sans mots vides, mots triés. */
export function titleKey(t: string): string {
  return (t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/).filter((w) => w && !TITLE_STOP.has(w)).sort().join(" ");
}
/** Vrai si le titre est exact ou trop proche d'un titre déjà utilisé (mots communs à 1 lettre près). */
function tooCloseTitle(t: string, set: Set<string>): boolean {
  const a = titleKey(t);
  if (!a) return false;
  if (set.has(a)) return true;
  const aw = a.split(" ");
  for (const b of set) {
    const bw = b.split(" ");
    if (Math.abs(aw.length - bw.length) > 1) continue;
    const common = aw.filter((w) => bw.some((x) => x === w || editDistance(w, x) <= 1)).length;
    if (common >= Math.max(aw.length, bw.length) - 0.001 || common >= Math.ceil(Math.max(aw.length, bw.length) * 0.8)) return true;
  }
  return false;
}

/** Détecte un nom déjà pris : exact, accent-insensible, ou trop similaire. */
function similarTo(n: string, set: Set<string>): { match: string; exact: boolean } | null {
  if (!n) return null;
  if (set.has(n)) return { match: n, exact: true };
  for (const m of set) {
    if (Math.min(n.length, m.length) >= 4 && n.slice(0, 4) === m.slice(0, 4)) return { match: m, exact: false };
    if (Math.abs(n.length - m.length) <= 1 && editDistance(n, m) <= 1) return { match: m, exact: false };
  }
  return null;
}

// ── Meta : ne jamais couper au milieu d'une expression (§3) ─────────────────
const META_PREP_END = new Set(["et", "ou", "en", "de", "du", "des", "la", "le", "les", "a", "au", "aux", "avec", "pour", "sur", "sans", "dans", "par", "d", "l", "comme", "que", "qu", "ideal", "ideale", "ideals", "ideales", "compatible", "disponible", "tel", "telle", "tels", "telles", "ainsi", "soit"]);
function bareW(w: string): string { return w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, ""); }
function ensureSentenceEnd(t: string): string { const x = t.trim(); return /[.!?]$/.test(x) ? x : (x ? x + "." : x); }
/** Nettoie une fin de meta incomplète : coupe une énumération pendante après
 *  la dernière virgule, puis retire les mots faibles finaux. */
function cleanDanglingEnd(s: string): string {
  let out = s.trim().replace(/[\s,;:–—-]+$/, "");
  const lc = out.lastIndexOf(",");
  if (lc > 0) {
    const tail = out.slice(lc + 1).trim().split(/\s+/).filter(Boolean);
    if (tail.length && tail.length <= 3 && META_PREP_END.has(bareW(tail[tail.length - 1]))) out = out.slice(0, lc);
  }
  const words = out.replace(/[\s,;:–—-]+$/, "").split(/\s+/);
  while (words.length > 1 && META_PREP_END.has(bareW(words[words.length - 1]))) words.pop();
  return words.join(" ").replace(/[\s,;:–—-]+$/, "");
}
/** Renvoie un corps de meta = phrase(s) COMPLÈTE(S) tenant dans `room`, jamais coupé sur un mot faible. */
function trimMetaBody(body: string, room: number): string {
  const s = body.trim();
  if (s.length <= room) return /[.!?]$/.test(s) ? s : ensureSentenceEnd(cleanDanglingEnd(s));
  // 1) Garder le maximum de phrases complètes.
  const sentences = s.split(/(?<=[.!?])\s+/);
  let acc = "";
  for (const sen of sentences) { const c = acc ? `${acc} ${sen}` : sen; if (c.length <= room) acc = c; else break; }
  if (acc) return acc.trim();
  // 2) Première phrase trop longue → couper à la meilleure frontière de clause.
  const head = s.slice(0, room);
  let cutAt = -1;
  for (const b of [", ", " ou ", " et ", " mais "]) { const i = head.lastIndexOf(b); if (i > cutAt) cutAt = i; }
  const piece = cutAt >= room * 0.35 ? head.slice(0, cutAt) : head.replace(/\s+\S*$/, "");
  return ensureSentenceEnd(cleanDanglingEnd(piece));
}

function enforceMeta(md: string, suffix?: string): { md: string; changed: boolean; issue?: string } {
  const s = (md || "").trim();
  if (!suffix) {
    const cleaned = trimMetaBody(s, 160);
    return cleaned !== s ? { md: cleaned, changed: true, issue: "Meta description recadrée (phrase complète)" } : { md: s, changed: false };
  }
  // Retire TOUTES les occurrences finales du suffixe (exactes, doublées ou mal écrites).
  const core = escapeRe(suffix.replace(/[.!]+$/, "").replace(/^[\s✓✔•·\-–—]+/, "").trim()).replace(/ /g, "\\s+");
  const tailRe = new RegExp(`[\\s✓✔•·\\-–—]*${core}\\s*[.!]*\\s*$`, "i");
  const marker = (suffix.match(/^[✓✔•·]/) || [])[0]; // ex : « ✓ »
  let body = s;
  let count = 0;
  let exactLast = false;
  let truncatedFrag = false;
  while (body) {
    const m = body.match(tailRe);
    if (!m) break;
    if (count === 0) exactLast = m[0].trim() === suffix;
    count++;
    body = body.slice(0, body.length - m[0].length).replace(/\s+$/, ""); // garde la ponctuation de fin de phrase
  }
  // Retire un suffixe TRONQUÉ en fin (ex : « ✓ Livraiso ») : tout depuis le dernier marqueur proche de la fin.
  if (marker) {
    const mi = body.lastIndexOf(marker);
    if (mi >= 0 && body.length - mi <= suffix.length + 4) { body = body.slice(0, mi).replace(/\s+$/, ""); truncatedFrag = true; }
  }
  // Recadre le corps : phrase COMPLÈTE qui tient avant le suffixe (jamais coupée).
  const room = Math.max(0, 160 - suffix.length - 1);
  const cleanedBody = trimMetaBody(body, room);
  const truncated = cleanedBody !== body.trim();
  body = cleanedBody;
  const out = body ? `${body} ${suffix}` : suffix;
  let issue: string | undefined;
  if (truncatedFrag) issue = "Suffixe meta tronqué corrigé";
  else if (count === 0) issue = "Suffixe meta ajouté";
  else if (count > 1) issue = "Suffixe meta doublé corrigé";
  else if (!exactLast) issue = "Suffixe meta normalisé (casse / espace)";
  if (truncated) issue = "Meta description recadrée (phrase complète + suffixe)";
  return { md: out, changed: out !== s, issue };
}

function fixTitle(t: string): string {
  let s = (t || "").trim();
  s = s.replace(/[\s,;:–—-]+$/, "");
  s = s.replace(/\s+(et|ou|en|de|à|the|and|or|with|pour)$/i, "");
  return s.trim();
}

/** Normalise un suffixe meta présent dans un texte (conclusion bodyHtml) : ancré sur
 *  le marqueur (✓), corrige tronqué / sans point / mauvaise casse, ne touche pas la prose. */
function normalizeSuffixInText(text: string, suffix?: string): { out: string; changed: boolean } {
  const sfx = (suffix || "").trim();
  if (!text || !sfx) return { out: text, changed: false };
  const marker = (sfx.match(/^[✓✔•·]/) || [])[0];
  if (!marker) return { out: text, changed: false }; // sans marqueur on ne touche pas au corps
  const firstWord = sfx.replace(/^[\s✓✔•·\-–—]+/, "").trim().split(/\s+/)[0] || "";
  const probe = firstWord.slice(0, Math.min(5, firstWord.length));
  let changed = false;
  const re = new RegExp(`${escapeRe(marker)}[^.!<>]*[.!]?`, "g");
  const out = text.replace(re, (m) => {
    if (!probe || !new RegExp(escapeRe(probe), "i").test(m)) return m; // pas une tentative de suffixe
    if (m.trim() === sfx) return m;
    changed = true; return sfx;
  });
  return { out, changed };
}

/** « foyer » au sens de pièce = anglicisme → entrée / hall / escalier (langue FR),
 *  sauf contexte cheminée / foyer de combustion. */
function replaceFoyer(s: string): { out: string; changed: boolean } {
  if (!s || !/\bfoyers?\b/i.test(s)) return { out: s, changed: false };
  let changed = false;
  let out = s;
  out = out.replace(/\bfoyers\s+et\s+(escaliers?)\b/gi, (_m, esc: string) => { changed = true; return `entrées et ${esc}`; });
  out = out.replace(/\b(luminaires?|[ée]clairages?|lustres?|suspensions?|appliques?|plafonniers?|lampes?)\s+foyers?\b/gi, (_m, w: string) => { changed = true; return `${w} entrée`; });
  out = out.replace(/\bfoyers?\b/gi, (m: string, offset: number, str: string) => {
    const around = str.slice(Math.max(0, offset - 24), offset + m.length + 24).toLowerCase();
    if (/chemin|combust|insert|po[êe]le|\bbois\b|ferm[ée]|ouvert|\bfeu\b/.test(around)) return m; // vrai foyer (feu)
    changed = true;
    return preserveCase(m, /s$/i.test(m) ? "entrées" : "entrée");
  });
  out = out.replace(/\b(entrées?)\s+et\s+\1\b/gi, "$1"); // « entrée et entrée » → « entrée »
  return { out, changed };
}

/** Corrige l'accord / la préposition autour de « entrée » (souvent issu de
 *  « foyer » → « entrée » : « un entrée » → « une entrée », « du/au entrée »…). */
function fixEntreeGrammar(input: string): { out: string; changed: boolean } {
  if (!input || !/entrées?\b|\d\s*(?:cm|mm|m)\s+de\s+(?:grand|gros)/i.test(input)) return { out: input, changed: false };
  let out = input, changed = false;
  const sub = (re: RegExp, repl: string) => { const n = out.replace(re, repl); if (n !== out) { changed = true; out = n; } };
  sub(/\bun\s+(entrées?)\b/gi, "une $1");           // un entrée → une entrée
  sub(/\bdu\s+(entrées?)\b/gi, "de l'$1");          // du entrée → de l'entrée
  sub(/\bau\s+(entrées?)\b/gi, "à l'$1");           // au entrée → à l'entrée
  sub(/\bà\s+(entrées?)\b/gi, "à l'$1");            // à entrée → à l'entrée
  sub(/\b(pour|dans|vers)\s+(entrées?)\b/gi, "$1 une $2"); // pour entrée → pour une entrée
  sub(/\b([Ll]e)\s+(entrées?)\b/g, "l'$2");         // le entrée → l'entrée
  sub(/\bce\s+(entrées?)\b/gi, "cette $1");         // ce entrée → cette entrée
  sub(/\b(entrées?)\s+(ou|et)\s+(escalier)\b/gi, "$1 $2 un $3"); // entrée ou escalier → entrée ou un escalier
  sub(/(\d+(?:[.,]\d+)?\s*(?:cm|mm|m))\s+de\s+(?:grands?|gros)\b/gi, "$1"); // « 15,7 cm de grand » → « 15,7 cm »
  return { out, changed };
}

// ── Anti-invention : affirmations souvent hallucinées (vérifiées vs source) ──
interface ClaimDef { re: RegExp; label: string; src: RegExp; remove: boolean }
const CLAIM_DEFS: ClaimDef[] = [
  { re: /garantie\s+(?:de\s+)?\d+\s*(?:an|ans|mois)/i, label: "garantie", src: /garantie|warranty/i, remove: true },
  { re: /livr\w*\s+(?:en|sous)\s+\d+(?:\s*[-à]\s*\d+)?\s*jours?(?:\s+ouvr[ée]s?)?/i, label: "délai de livraison", src: /livr|shipping|delivery|jours?\s+ouvr/i, remove: true },
  { re: /(?:manuel|notice)\b[^.<>]{0,40}\b(?:inclus\w*|fourni\w*|livr[ée]\w*|compris\w*)/i, label: "manuel / notice inclus", src: /manuel|notice|manual|instruction/i, remove: true },
  { re: /ampoules?\b[^.<>]{0,30}\b(?:inclus\w*|fournies?|comprises?|livr[ée]\w*)/i, label: "ampoules incluses", src: /ampoule|bulb/i, remove: true },
  { re: /dur[ée]e\s+de\s+vie\s+(?:de\s+)?\d+|>?\s?\d{2,}\s*0{3}\s*h(?:eures?)?\b/i, label: "durée de vie", src: /dur[ée]e\s+de\s+vie|lifespan|\bh(?:eures?)?\s+de\s+vie/i, remove: true },
  { re: /\b(?:non[\s-]?)?dimmable\b|intensit[ée]\s+variable|variateur|gradable/i, label: "dimmable / intensité variable", src: /dimmable|intensit[ée]\s+variable|variateur|gradable/i, remove: true },
  { re: /\bled[s]?\s+int[ée]gr[ée]e?s?/i, label: "LED intégrées", src: /\bled\b/i, remove: true },
  { re: /\bcertifi[ée]\w*|\bcertification\b|\bnorme\s+[A-Za-z]|\bIP\s?\d{2}\b/i, label: "certification / norme", src: /certifi|certification|\bnorme\b|\bIP\s?\d{2}\b|\bCE\b/i, remove: true },
  { re: /\b(?:GU\s?10|E\s?27|E\s?26|E\s?14|E\s?12|B\s?22|MR\s?16)\b/i, label: "compatibilité d'ampoule (culot)", src: /\b(?:GU\s?10|E\s?27|E\s?26|E\s?14|E\s?12|B\s?22|MR\s?16|culot)\b/i, remove: true },
  { re: /\bcristal\s+k9\b/i, label: "cristal K9", src: /cristal\s+k9|\bk9\b/i, remove: true },
  { re: /\bacier\s+(?:inoxydable|inox|poli|bross[ée]e?s?)|\blaiton\s+massif/i, label: "matériau précis (acier / laiton)", src: /acier|inox|laiton|steel|brass/i, remove: true },
  { re: /\bfer\s+dor[ée]e?s?/i, label: "matériau précis (fer doré)", src: /fer\s+dor|\bfer\b|iron/i, remove: true },
  { re: /\bverre\s+souffl[ée]e?s?/i, label: "matériau précis (verre soufflé)", src: /verre\s+souffl|blown\s+glass/i, remove: true },
  { re: /\b(?:souffl[ée]s?|fabriqu[ée]s?|faits?)\s+(?:à\s+la\s+)?main\b/i, label: "fabrication à la main", src: /\bmain\b|artisan|hand[\s-]?(?:made|blown)/i, remove: true },
  { re: /\bpoids\s+(?:de\s+)?\d|\b\d+([.,]\d+)?\s?(?:kg|kilos?|grammes?)\b/i, label: "poids", src: /poids|\bkg\b|kilo|gramme|weight/i, remove: true },
  { re: /\b\d{1,4}\s?watts?\b|\b\d{1,4}\s?W\b(?!\s*[x×])|puissance\s*:?\s*\d/i, label: "puissance", src: /puissance|watt|\bW\b|wattage/i, remove: true },
  { re: /\bgants?\b[^.<>]{0,20}\b(?:fournis?|inclus\w*|livr[ée]\w*)/i, label: "gants fournis", src: /gants?/i, remove: true },
  { re: /\btemp[ée]rature\s+(?:de\s+)?couleur|\b\d{3,5}\s?k(?:elvin)?\b|blanc\s+(?:chaud|froid|neutre)/i, label: "température de couleur", src: /temp[ée]rature|kelvin|\b\d{3,5}\s?k\b|blanc\s+(?:chaud|froid|neutre)/i, remove: true },
  // ── Bébé / puériculture ──
  { re: /\bsans\s+bpa\b/i, label: "sans BPA", src: /bpa/i, remove: true },
  { re: /\bd[èe]s\s+(?:la\s+naissance|\d+\s*(?:mois|ans))|\bà\s+partir\s+de\s+\d+\s*(?:mois|ans)|\bpour\s+(?:nouveau-n[ée]s?|nourrissons?)\b/i, label: "âge conseillé (non sourcé)", src: /naissance|\bmois\b|\bans\b|nourrisson|nouveau-n/i, remove: true },
  // ── Beauté / cosmétique ──
  { re: /\bdermatolog\w*\s+test[ée]\w*|\btest[ée]\w*\s+dermatolog\w*/i, label: "test dermatologique", src: /dermatolog/i, remove: true },
  { re: /\banti[\s-]?(?:[âa]ge|rides?|acn[ée]|t[âa]ches?)\b/i, label: "promesse anti-âge / anti-acné", src: /anti[\s-]?(?:[âa]ge|rides?|acn[ée]|t[âa]ches?)/i, remove: true },
  { re: /\bhypoallerg[ée]nique\b|\bnon\s+com[ée]dog[èe]ne\b|\bsans\s+(?:parab[èe]ne?s?|sulfates?)\b/i, label: "claim cosmétique (hypoallergénique / sans paraben…)", src: /hypoallerg|com[ée]dog|parab|sulfate/i, remove: true },
  { re: /\bpour\s+(?:les\s+)?peaux?\s+(?:sensibles?|grasses?|s[èe]ches?|mixtes?|matures?)\b/i, label: "type de peau (non sourcé)", src: /peaux?\s+(?:sensibles?|grasses?|s[èe]ches?|mixtes?|matures?)/i, remove: true },
  // ── Mode / textile ──
  { re: /\ben\s+(?:pur\s+)?(?:coton|lin|soie|laine|cuir|cachemire|polyester|velours|jean|denim)\b/i, label: "matière textile (non sourcée)", src: /coton|\blin\b|soie|laine|cuir|cachemire|polyester|velours|jean|denim/i, remove: true },
  { re: /\bimperm[ée]able\b|\brespirant\b|\blavable\s+(?:en|à)\s+machine\b/i, label: "propriété textile (non sourcée)", src: /imperm[ée]able|respirant|lavable/i, remove: true },
  // ── Sport / fitness ──
  { re: /\bcharge\s+max\w*|\bjusqu'à\s+\d+\s*kg\b|\busage\s+(?:professionnel|intensif)\b|\bniveau\s+(?:professionnel|pro)\b/i, label: "performance / charge (non sourcée)", src: /charge|\bkg\b|professionnel|intensif/i, remove: true },
  // ── Cuisine / électronique ──
  { re: /\bcompatible\s+(?:induction|lave[\s-]vaisselle|tous?\s+feux)|\bsans\s+pfoa\b/i, label: "compatibilité cuisine (non sourcée)", src: /induction|lave[\s-]vaisselle|pfoa|tous?\s+feux/i, remove: true },
  { re: /\bautonomie\s+(?:de\s+)?\d+\s*(?:h|heures?|jours?)|\bbluetooth\s?\d|\bcompatible\s+(?:iphone|android|samsung)\b/i, label: "spec électronique (non sourcée)", src: /autonomie|bluetooth|iphone|android|samsung/i, remove: true },
];

/** Retire d'un HTML les phrases contenant une affirmation, sans casser les balises. */
function removeSentencesMatching(html: string, re: RegExp): string {
  let out = html.replace(/>([^<]+)</g, (_full, text: string) => {
    const kept = text.split(/(?<=[.!?])\s+/).filter((seg) => !re.test(seg));
    return `>${kept.join(" ")}<`;
  });
  // Nettoie les conteneurs vidés + une question FAQ dont la réponse a disparu.
  out = out.replace(/<li>\s*<\/li>/gi, "").replace(/<p>\s*<\/p>/gi, "");
  out = out.replace(/<h4>[^<]*<\/h4>\s*(?=<h[1-4]|<\/|$)/gi, "");
  out = out.replace(/<ul>\s*<\/ul>/gi, "");
  return out;
}

// ── Qualité française (corrections sûres + détection) ───────────────────────
// Corrections d'accents / fautes fréquentes (mot entier, casse préservée).
const FR_FIX: Record<string, string> = {
  ronf: "rond", carree: "carrée", carre: "carré", dore: "doré", doree: "dorée", dores: "dorés",
  craquele: "craquelé", craquelee: "craquelée", metal: "métal", metallique: "métallique",
  decoratif: "décoratif", decorative: "décorative", elegant: "élégant", elegante: "élégante",
  interieur: "intérieur", exterieur: "extérieur", lumiere: "lumière", electrique: "électrique",
  reglable: "réglable", tete: "tête", fenetre: "fenêtre", etagere: "étagère", chene: "chêne",
  modele: "modèle", matiere: "matière", piece: "pièce", coute: "coûte", cote: "côté",
  eclairage: "éclairage", eclaire: "éclaire", decor: "décor", decoration: "décoration",
  geometrique: "géométrique", etoile: "étoile", materiau: "matériau", materiaux: "matériaux",
  cable: "câble", demontable: "démontable", resistant: "résistant", resistante: "résistante",
  diametre: "diamètre", entree: "entrée", qualite: "qualité", securite: "sécurité", bebe: "bébé",
  argente: "argenté", cuivre: "cuivré", suspendue: "suspendue", reglages: "réglages",
};
// Anglais → français (remplacement 1:1 sûr).
const EN_FIX: Record<string, string> = {
  round: "rond", square: "carré", rectangular: "rectangulaire", gold: "doré", golden: "doré",
  black: "noir", white: "blanc", silver: "argenté", copper: "cuivré", modern: "moderne",
  contemporary: "contemporain", "ceiling light": "plafonnier", "ceiling lamp": "plafonnier",
  pendant: "suspension", chandelier: "lustre", lamp: "lampe", glass: "verre", crystal: "cristal",
  indoor: "intérieur", outdoor: "extérieur", bedroom: "chambre", kitchen: "cuisine",
  "living room": "salon", "dining room": "salle à manger", large: "grand", small: "petit",
  for: "pour", with: "avec", your: "votre", our: "notre", and: "et", adjustable: "réglable",
};
// Mots anglais à SIGNALER (RISK) s'ils restent après correction.
const EN_FLAG = ["raindrop", "ceiling", "pendant", "chandelier", "lamp", "light", "glass", "crystal", "indoor", "outdoor", "bedroom", "kitchen", "luxury", "premium", "minimalist", "nordic", "vintage", "modern", "contemporary", "round", "square", "gold", "black", "white"];
// Collections : anglais/incorrect → français naturel (clé = nom normalisé).
const COLLECTION_FIX: Record<string, string> = {
  foyer: "Entrée", entrance: "Entrée", entryway: "Entrée", hallway: "Couloir", staircase: "Escalier",
  luminairefoyer: "Luminaire entrée", luminairesfoyer: "Luminaires entrée", eclairagefoyer: "Éclairage entrée",
  livingroom: "Salon", diningroom: "Salle à manger", kitchen: "Cuisine", bedroom: "Chambre",
  bathroom: "Salle de bain", office: "Bureau", outdoor: "Extérieur", indoor: "Intérieur",
  ceilinglights: "Plafonniers", ceilinglight: "Plafonnier", pendantlights: "Suspensions", pendantlight: "Suspension",
  pendants: "Suspensions", pendant: "Suspensions", chandeliers: "Lustres", chandelier: "Lustres",
  walllights: "Appliques murales", walllight: "Applique murale", tablelamps: "Lampes à poser", tablelamp: "Lampe à poser",
  bedsidelamps: "Lampes de chevet", bedsidelamp: "Lampe de chevet", floorlamps: "Lampadaires", floorlamp: "Lampadaire",
};

function preserveCase(orig: string, repl: string): string {
  if (orig === orig.toUpperCase()) return repl.toUpperCase();
  if (orig[0] && orig[0] === orig[0].toUpperCase()) return repl[0].toUpperCase() + repl.slice(1);
  return repl;
}
function applyWordMap(s: string, map: Record<string, string>): { out: string; hits: string[] } {
  let out = s;
  const hits: string[] = [];
  for (const [bad, good] of Object.entries(map)) {
    const re = new RegExp(`\\b${escapeRe(bad)}\\b`, "gi");
    if (re.test(out)) { hits.push(bad); out = out.replace(re, (m) => preserveCase(m, good)); }
  }
  return { out, hits };
}
function fixBrandCase(s: string, vendor: string): string {
  if (!vendor) return s;
  return s.replace(new RegExp(`\\b${escapeRe(vendor)}\\b`, "gi"), vendor);
}
function capFirst(s: string): string { return s ? s[0].toUpperCase() + s.slice(1) : s; }
function isFrench(lang?: string): boolean { return /fran[çc]ais/i.test(lang || ""); }

// Connecteurs français en minuscule (sauf en 1er mot du titre).
const FR_LOWER = new Set(["en", "de", "du", "des", "au", "aux", "à", "et", "ou", "le", "la", "les", "avec", "pour", "sur", "sans", "dans", "par"]);
/** Capitalisation française : minuscule après apostrophe + connecteurs en minuscule. */
function fixFrenchCaps(s: string): string {
  if (!s) return s;
  let out = s.replace(/([A-Za-zÀ-ÿ]['’])([A-ZÀ-Ÿ])/g, (_m, p: string, c: string) => p + c.toLowerCase());
  let wordIdx = 0;
  out = out.split(/(\s+)/).map((tok) => {
    if (!tok || /^\s+$/.test(tok)) return tok;
    wordIdx++;
    if (wordIdx === 1) return tok;
    const bare = tok.toLowerCase().replace(/[^a-zàâäéèêëîïôöûüç]/g, "");
    if (FR_LOWER.has(bare) && tok[0] === tok[0].toUpperCase()) return tok.toLowerCase();
    return tok;
  }).join("");
  return out;
}
// Tags trop génériques (à compléter par du type + longue traîne).
const GENERIC_TAGS = new Set(["moderne", "interieur", "design", "elegant", "salon", "deco", "decoration", "contemporain", "chic", "tendance", "maison", "nouveau", "qualite", "luxe", "minimaliste"]);
// Formules passe-partout à éviter dans la description (richesse éditoriale).
const FILLER_PHRASES = ["touche moderne et élégante", "touche moderne et elegante", "ambiance chaleureuse", "style contemporain", "idéal pour votre intérieur", "ideal pour votre interieur", "touche d'élégance", "touche d'elegance", "alliant style et fonctionnalité", "apporte une touche", "élégance intemporelle"];

// ── Moteur de naming (§1/§2/§3) ─────────────────────────────────────────────
// Noms brandés premium génériques (inventés, aucune marque réelle). Repli
// déterministe quand l'IA n'en fournit pas ou propose un doublon.
const BRAND_POOL = [
  "Oravia", "Velora", "Elvoria", "Novelia", "Lumera", "Soravel", "Aravia", "Velmora", "Noralis", "Esveria",
  "Olvera", "Calenza", "Mirova", "Solvana", "Velaris", "Oranza", "Nuvelia", "Lorvena", "Auvelia", "Sevelia",
  "Mariva", "Oriane", "Velina", "Norvia", "Eldora", "Soreva", "Avelis", "Ombria", "Levira", "Calvia",
  "Vesoria", "Nolvia", "Eravia", "Solnea", "Lunavia", "Orvane", "Velsea", "Nerina", "Aliora", "Sorvane",
  "Elunia", "Castia", "Norelia", "Ovira", "Lumavia", "Selora", "Andovia", "Velura", "Orinea", "Maelis",
  "Amoria", "Celoria", "Eloria", "Noravia", "Aurelia", "Orelia", "Meliora", "Lioria", "Selenia", "Valoria",
  "Elvina", "Novara", "Aloria", "Virelia", "Amélia", "Solaria", "Ostara", "Nivora", "Elaria", "Caloria",
];
/** Normalise un nom brandé : retire chiffres/caractères SKU, force le Title Case (jamais full caps). */
export function normalizeBrandName(name: string): string {
  let n = (name || "").trim().replace(/[^A-Za-zÀ-ÿ' -]/g, "").trim(); // retire chiffres & symboles type SKU
  if (!n) return "";
  n = n.split(/[\s-]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(" ").trim();
  return n;
}
function isValidBrand(name: string, used: Set<string>, vendor: string): boolean {
  const raw = (name || "").trim();
  if (/\d/.test(raw)) return false;                       // chiffres → SKU
  const n = normName(name);
  if (!n || n.length < 4 || n.length > 12) return false;  // ni trop court ni trop long
  if (vendor && n === normName(vendor)) return false;      // jamais le vendor
  if ((n.match(/[aeiouy]/g) || []).length < 2) return false; // ressemble à un code
  if (/[bcdfghjklmnpqrstvwxz]{4,}/.test(n)) return false;  // amas de consonnes = code
  return !similarTo(n, used);
}
/** Repli déterministe : nom brandé UNIQUE du pool (indexé par le handle). */
function generateBrandName(seed: string, used: Set<string>, vendor: string): string {
  let h = 0; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  for (let i = 0; i < BRAND_POOL.length; i++) {
    const cand = BRAND_POOL[(h + i) % BRAND_POOL.length];
    if (isValidBrand(cand, used, vendor)) { used.add(normName(cand)); return cand; }
  }
  const base = BRAND_POOL[h % BRAND_POOL.length];
  used.add(normName(base));
  return base;
}
// Détails techniques / fournisseur à NE PAS garder dans un titre.
const TITLE_FILLER: RegExp[] = [
  /\bsouffl[ée]s?\s+à\s+la\s+main\b/gi,
  /\bfaits?\s+(?:à\s+la\s+)?main\b/gi,
  /\b[ée]clairage\s+led(?:\s+(?:contemporain|moderne))?\b/gi,
  /\bled\s+(?:contemporain|moderne|int[ée]gr[ée]e?s?)\b/gi,
  /\bfinition\s+(?:chrom[ée]e?|dor[ée]e?|noire?|argent[ée]e?|laiton|bross[ée]e?|mate?)\b/gi,
  /\bhauteur\s+(?:ajustable|r[ée]glable)\b/gi,
  /\br[ée]glable\s+en\s+hauteur\b/gi,
  /\bbase\s+ronde\b/gi,
  /\bdesign\s+(?:contemporain|moderne|aérien)\b/gi,
];
/** Nettoie le titre : retire suffixe brandé, clauses après tiret et détails techniques, cap ~6 mots. */
function cleanProductTitle(title: string): { product: string; brandFromTitle: string } {
  const t = (title || "").trim();
  const pipe = t.indexOf("|");
  const brandFromTitle = pipe >= 0 ? t.slice(pipe + 1).trim() : "";
  let product = (pipe >= 0 ? t.slice(0, pipe) : t).trim();
  product = product.replace(/\s+[–—]\s+.*$/u, "").replace(/\s+-\s+\S.*$/u, "");
  for (const re of TITLE_FILLER) product = product.replace(re, " ");
  // « Luminaire » redondant si un vrai type produit est déjà présent.
  if (/\b(suspension|lustre|plafonnier|lampe|applique|lampadaire|spot|guirlande)\b/i.test(product)) {
    product = product.replace(/\bluminaires?\b/gi, " ");
  }
  product = collapse(product).replace(/[\s,–—-]+$/u, "").trim();
  let words = product.split(/\s+/).filter(Boolean);
  if (words.length > 7) words = words.slice(0, 7);
  while (words.length > 3 && META_PREP_END.has(bareW(words[words.length - 1]))) words.pop();
  return { product: words.join(" "), brandFromTitle };
}

/** Contrôle qualité + corrections déterministes d'un produit transformé. */
export function qualityControl(r: TransformedProduct, ctx: QCContext): QCReport {
  const issues: string[] = [];
  let status: QCStatus = "ok";
  const bump = (s: QCStatus) => { if (ORDER[s] > ORDER[status]) status = s; };
  const fixed: TransformedProduct = { ...r };
  const fr = isFrench(ctx.language);
  const vendor = ctx.vendor || "";

  // Vendor = marque saisie, casse EXACTE.
  if (vendor) fixed.vendor = vendor;

  // Vendor ≠ nom brandé : si noms brandés désactivés, on ignore totalement le
  // brandName ; s'il est activé mais égal au vendor, ce n'est pas un nom brandé.
  if (!ctx.brandNames) {
    fixed.brandName = undefined;
  } else if (fixed.brandName && vendor && normName(fixed.brandName) === normName(vendor)) {
    fixed.brandName = undefined; // le vendor n'est pas un nom brandé produit
  }

  // Emojis : aucun pictogramme dans un champ Shopify (✓ marqueur de suffixe préservé).
  {
    let em = false;
    const noEmoji = (s: string) => { if (s && hasEmoji(s)) { em = true; return stripEmoji(s); } return s; };
    fixed.title = noEmoji(fixed.title);
    fixed.metaTitle = noEmoji(fixed.metaTitle);
    fixed.metaDescription = noEmoji(fixed.metaDescription);
    fixed.tags = noEmoji(fixed.tags);
    fixed.productType = noEmoji(fixed.productType);
    fixed.bodyHtml = noEmoji(fixed.bodyHtml);
    if (fixed.brandName) fixed.brandName = noEmoji(fixed.brandName);
    fixed.collections = fixed.collections.map(noEmoji);
    fixed.imageAlts = fixed.imageAlts.map(noEmoji);
    if (em) { issues.push("Emoji retiré d'un champ Shopify"); bump("warning"); }
    if ([fixed.title, fixed.metaTitle, fixed.metaDescription, fixed.tags, fixed.productType, stripHtml(fixed.bodyHtml), ...fixed.collections].some(hasEmoji)) { issues.push("Emoji encore présent après nettoyage"); bump("risk"); }
  }

  // Titre : pas vide, ne finit pas par un mot/séparateur vide.
  fixed.title = fixTitle(fixed.title);
  if (!fixed.title.trim()) { issues.push("Titre vide"); bump("failed"); }

  // Jargon interne dans le texte public → strip + RISK.
  const hay = `${fixed.title} ${fixed.metaTitle} ${fixed.metaDescription} ${stripHtml(fixed.bodyHtml)}`.toLowerCase();
  const found = FORBIDDEN_JARGON.filter((f) => hay.includes(f));
  if (found.length) {
    issues.push(`Jargon interne retiré : ${Array.from(new Set(found)).join(", ")}`);
    bump("risk");
    for (const f of found) {
      const re = new RegExp(escapeRe(f), "gi");
      fixed.bodyHtml = fixed.bodyHtml.replace(re, "");
      fixed.metaDescription = fixed.metaDescription.replace(re, "");
      fixed.title = fixed.title.replace(re, "");
    }
    fixed.bodyHtml = collapse(fixed.bodyHtml);
    fixed.title = fixTitle(collapse(fixed.title));
  }

  // Anciens termes / domaines à supprimer.
  if (ctx.oldTerms?.length) {
    for (const term of ctx.oldTerms) {
      if (!term) continue;
      const re = new RegExp(escapeRe(term), "gi");
      if (re.test(`${fixed.title} ${fixed.bodyHtml} ${fixed.metaDescription}`)) {
        issues.push(`Terme à supprimer retiré : ${term}`);
        bump("risk");
        fixed.title = fixed.title.replace(re, "").trim();
        fixed.bodyHtml = collapse(fixed.bodyHtml.replace(re, ""));
        fixed.metaDescription = fixed.metaDescription.replace(re, "").trim();
      }
    }
  }

  // ── Qualité française : accents/typos + anglais résiduel (titre, meta, tags) ──
  if (fr) {
    const clean = (s: string) => { const a = applyWordMap(s, FR_FIX); const b = applyWordMap(a.out, EN_FIX); return { out: b.out, fr: a.hits, en: b.hits }; };
    const t = clean(fixed.title); fixed.title = t.out;
    const m = clean(fixed.metaTitle); fixed.metaTitle = m.out;
    const d = clean(fixed.metaDescription); fixed.metaDescription = d.out;
    const g = clean(fixed.tags); fixed.tags = g.out;
    const fixHits = Array.from(new Set([...t.fr, ...m.fr, ...d.fr, ...g.fr]));
    const enHits = Array.from(new Set([...t.en, ...m.en, ...d.en, ...g.en]));
    if (fixHits.length) { issues.push(`Accents / fautes corrigés : ${fixHits.slice(0, 5).join(", ")}`); bump("warning"); }
    if (enHits.length) { issues.push(`Mots anglais traduits : ${enHits.slice(0, 5).join(", ")}`); bump("warning"); }
    // Anglais résiduel non corrigé dans titre / meta title → RISK.
    const remain = EN_FLAG.filter((w) => new RegExp(`\\b${escapeRe(w)}\\b`, "i").test(`${fixed.title} ${fixed.metaTitle}`));
    if (remain.length) { issues.push(`Mot anglais résiduel : ${Array.from(new Set(remain)).slice(0, 4).join(", ")}`); bump("risk"); }
    // « foyer » (anglicisme pièce) → entrée / hall / escalier, puis accord FR.
    let foyerHit = false, grammarHit = false;
    for (const k of ["title", "metaTitle", "metaDescription", "tags", "bodyHtml"] as const) {
      const f = replaceFoyer(fixed[k] || "");
      if (f.changed) { fixed[k] = f.out; foyerHit = true; }
      const gr = fixEntreeGrammar(fixed[k] || "");
      if (gr.changed) { fixed[k] = gr.out; grammarHit = true; }
    }
    if (foyerHit) { issues.push("« foyer » remplacé (entrée / hall / escalier)"); bump("warning"); }
    if (grammarHit) { issues.push("Accord / préposition corrigé autour de « entrée »"); bump("warning"); }
  }

  // ── Casse marque / vendor dans titre + meta title + meta description ──
  if (vendor) { fixed.title = fixBrandCase(fixed.title, vendor); fixed.metaTitle = fixBrandCase(fixed.metaTitle, vendor); fixed.metaDescription = fixBrandCase(fixed.metaDescription, vendor); }
  // Capitalisation française : majuscule en début, minuscule après apostrophe (Goutte d'Eau → Goutte d'eau).
  if (fr) { fixed.title = fixFrenchCaps(fixed.title); fixed.metaTitle = fixFrenchCaps(fixed.metaTitle); }
  fixed.metaTitle = capFirst(fixed.metaTitle.trim());

  // ── Anti-invention : retire / signale les affirmations non présentes dans la source ──
  {
    const src = (ctx.sourceText || "").toLowerCase();
    const hay = `${stripHtml(fixed.bodyHtml)} ${fixed.metaDescription}`;
    for (const c of CLAIM_DEFS) {
      if (!c.re.test(hay)) continue;
      if (src && c.src.test(src)) continue; // l'info est dans la source → on garde
      if (c.remove) {
        const g = new RegExp(c.re.source, "gi");
        fixed.bodyHtml = removeSentencesMatching(fixed.bodyHtml, c.re);
        // meta : retire les phrases concernées, puis tout résidu inline.
        let md = fixed.metaDescription.split(/(?<=[.!?])\s+/).filter((s) => !c.re.test(s)).join(" ").trim();
        if (c.re.test(md)) md = collapse(md.replace(g, "")).replace(/\s*,\s*,/g, ",").replace(/,\s*([.!?])/g, "$1").replace(/\s+,/g, ",").trim();
        fixed.metaDescription = md;
        fixed.tags = fixed.tags.split(",").map((t) => t.trim()).filter((t) => t && !c.re.test(t)).join(", ");
        if (c.re.test(fixed.title)) fixed.title = collapse(fixed.title.replace(g, "")).replace(/\s*[|–-]\s*$/, "").trim();
        fixed.imageAlts = fixed.imageAlts.map((a) => (c.re.test(a) ? collapse(a.replace(g, "")).trim() : a));
        issues.push(`Information non sourcée retirée : ${c.label}`); bump("warning");
      } else {
        issues.push(`Information non sourcée à vérifier : ${c.label}`); bump("risk");
      }
    }
  }

  // Meta description : suffixe exact (gère absent / doublé / mal écrit / tronqué) + ≤ 160.
  const me = enforceMeta(fixed.metaDescription, ctx.metaSuffix);
  if (me.changed) { if (me.issue) issues.push(me.issue); bump("warning"); }
  fixed.metaDescription = me.md;
  // Suffixe éventuellement injecté dans la conclusion du bodyHtml : exact aussi.
  const bodySfx = normalizeSuffixInText(fixed.bodyHtml, ctx.metaSuffix);
  if (bodySfx.changed) { issues.push("Suffixe normalisé dans la description"); bump("warning"); fixed.bodyHtml = bodySfx.out; }
  // §7 — tripwire : suffixe configuré avec point final mais absent en fin de meta.
  const sfx = (ctx.metaSuffix || "").trim();
  if (sfx && !fixed.metaDescription.trim().endsWith(sfx)) { issues.push("Suffixe meta non conforme (point / casse)"); bump("risk"); }

  // Meta description : générique / répétitive ?
  const mdNorm = normName(fixed.metaDescription).replace(/[0-9]/g, "");
  if (/(elegancemoderne|decouvreznotre|elegancecontemporaine|ambiancechaleureuse|interieurelegant|apporteraunetouche|touchemoderne|touchederaffinement)/.test(mdNorm)) { issues.push("Meta description générique (formule passe-partout)"); bump("warning"); }
  const opening = fixed.metaDescription.toLowerCase().replace(/[^a-zàâäéèêëîïôöûüç ]/g, "").split(/\s+/).filter(Boolean).slice(0, 6).join(" ");
  if (opening.length > 8) {
    if (ctx.usedMetaOpenings.has(opening)) { issues.push("Meta description répétitive (même structure qu'un autre produit)"); bump("warning"); }
    else ctx.usedMetaOpenings.add(opening);
  }

  // ── NAMING PASS (§1/§2/§3) : titre propre + nom brandé cohérent et unique ──
  {
    const { product, brandFromTitle } = cleanProductTitle(fixed.title);
    if (ctx.brandNames) {
      let brand = normalizeBrandName((fixed.brandName || "").trim() || brandFromTitle.trim());
      if (!isValidBrand(brand, ctx.usedBrand, vendor)) {
        const had = !!brand;
        brand = generateBrandName(fixed.newHandle || fixed.handle || product, ctx.usedBrand, vendor);
        issues.push(had ? "Nom brandé régénéré (faible, doublon ou vendor)" : "Nom brandé généré"); bump("warning");
      } else {
        ctx.usedBrand.add(normName(brand));
      }
      fixed.brandName = brand;
      fixed.title = product ? `${product} | ${brand}` : brand;
      // SEO Title cohérent : « mot-clé | NomBrandé » (jamais le vendor seul).
      if (fixed.metaTitle) {
        const mp = fixed.metaTitle.indexOf("|");
        const kw = (mp >= 0 ? fixed.metaTitle.slice(0, mp) : fixed.metaTitle).trim();
        if (kw) fixed.metaTitle = `${kw} | ${brand}`;
      }
    } else {
      fixed.brandName = undefined;
      if (fixed.title !== product) { fixed.title = product; }
    }
    if (product && product.split(/\s+/).length > 7) { issues.push("Titre produit trop long (raccourci)"); bump("warning"); }
    // §10 — règle de sortie : si noms brandés activés, le titre DOIT contenir « | NomBrandé ».
    if (ctx.brandNames && !fixed.title.includes("|")) { issues.push("Nom brandé manquant dans le titre"); bump("risk"); }
  }

  // Handle : doublon (exact ou après normalisation) ?
  const h = (fixed.newHandle || "").trim().toLowerCase();
  if (h) {
    if (ctx.usedHandle.has(h)) { issues.push(`Handle déjà utilisé : ${h}`); bump("warning"); }
    else ctx.usedHandle.add(h);
  }

  // Titre : doublon / trop proche d'un produit existant (sur le NOM produit, hors nom brandé).
  if (ctx.usedTitles && fixed.title) {
    const productPart = fixed.title.split("|")[0].trim();
    const tk = titleKey(productPart);
    if (tk) {
      if (tooCloseTitle(productPart, ctx.usedTitles)) { issues.push("Titre trop proche d'un autre produit (à distinguer)"); bump("warning"); }
      ctx.usedTitles.add(tk);
    }
  }

  // Titre : naturel, pas télégraphique (sur le NOM produit, hors nom brandé).
  {
    const productPart = fixed.title.split("|")[0].trim();
    const words = productPart.split(/\s+/).filter(Boolean);
    const hasConnector = words.some((w) => FR_LOWER.has(w.toLowerCase().replace(/[^a-zàâäéèêëîïôöûüç]/g, "")));
    if (words.length >= 6 && !hasConnector) { issues.push("Titre télégraphique (ajouter un connecteur « en / à »)"); bump("warning"); }
    if (/[\s,;:–—-]+$|\b(et|ou|en|de|à|du|des|avec|pour)$/i.test(productPart)) { issues.push("Titre finissant par un connecteur"); bump("warning"); }
  }

  // Tags : richesse + longue traîne + type produit + anglais.
  if (ctx.tagsType) {
    const tagList = fixed.tags.split(",").map((t) => t.trim()).filter(Boolean);
    if (tagList.length < 4) { issues.push(`Tags trop pauvres (${tagList.length})`); bump("warning"); }
    else {
      const longTail = tagList.filter((t) => t.split(/\s+/).length >= 2).length;
      const generic = tagList.filter((t) => GENERIC_TAGS.has(normName(t))).length;
      if (longTail === 0) { issues.push("Tags sans longue traîne (ajouter « type + pièce / matière », ex. « luminaire salon »)"); bump("warning"); }
      else if (generic > tagList.length / 2) { issues.push("Tags trop génériques"); bump("warning"); }
    }
    if (fixed.productType) {
      const pt = normName(fixed.productType.split(/\s+/)[0]);
      if (pt && pt.length > 2 && !tagList.some((t) => normName(t).includes(pt))) { issues.push("Type de produit absent des tags"); bump("warning"); }
    }
    if (fr) { const enTag = tagList.find((t) => EN_FLAG.some((w) => new RegExp(`\\b${escapeRe(w)}\\b`, "i").test(t))); if (enTag) { issues.push(`Tag en anglais : ${enTag}`); bump("warning"); } }
  }

  // Description : structure attendue en mode Poussé / Ultra.
  if (ctx.level === "poussé" || ctx.level === "ultra complet") {
    if (!/<h[23]\b/i.test(fixed.bodyHtml)) { issues.push("Description sans structure H2/H3 (mode avancé)"); bump("warning"); }
  }

  // Collections : français naturel (Foyer → Entrée, Living Room → Salon…) + accents + anglais.
  if (fr && fixed.collections.length) {
    fixed.collections = fixed.collections.map((c) => {
      const key = normName(c);
      if (COLLECTION_FIX[key]) { issues.push(`Collection « ${c} » → « ${COLLECTION_FIX[key]} »`); bump("warning"); return COLLECTION_FIX[key]; }
      // accents / mots anglais dans le nom de collection
      const a = applyWordMap(c, FR_FIX); const b = applyWordMap(a.out, EN_FIX);
      if (b.out !== c) { issues.push(`Collection corrigée : « ${c} » → « ${b.out} »`); bump("warning"); }
      return b.out;
    });
    const enCol = fixed.collections.find((c) => EN_FLAG.some((w) => new RegExp(`\\b${escapeRe(w)}\\b`, "i").test(c)));
    if (enCol) { issues.push(`Collection en anglais : ${enCol}`); bump("warning"); }
  }

  // ── Longueur & richesse de description selon le niveau (en CARACTÈRES de texte) ──
  const bodyText = stripHtml(fixed.bodyHtml);
  const bodyChars = bodyText.length;
  const hasDims = /\b\d+([.,]\d+)?\s?(cm|mm|m)\b|dimension|\btaille\b|\bø\b/i.test(ctx.sourceText || "");
  if (ctx.level === "ultra complet") {
    const thinSource = (ctx.sourceText || "").replace(/\s+/g, " ").trim().length < 300;
    if (bodyChars < 2000) {
      if (thinSource) { issues.push("Données source insuffisantes pour une description Ultra complète"); bump("warning"); }
      else { issues.push(`Description Ultra trop courte (${bodyChars} car. < 2000)`); bump("risk"); }
    } else if (bodyChars < 3000) { issues.push(`Description courte pour le mode Ultra (${bodyChars} car., viser 3000–4000)`); bump("warning"); }
    const faq = (fixed.bodyHtml.match(/<h4\b/gi) || []).length;
    if (faq < 3) { issues.push(`FAQ insuffisante en mode Ultra (${faq}/3 minimum)`); bump("warning"); }
    const bullets = (fixed.bodyHtml.match(/<li\b/gi) || []).length;
    if (bullets < 4) { issues.push(`Trop peu de bénéfices/détails en mode Ultra (${bullets} puce(s))`); bump("warning"); }
  } else if (ctx.level === "poussé" && bodyChars < 1500) {
    issues.push(`Description courte pour le mode Poussé (${bodyChars} car., viser 1800–2800)`); bump("warning");
  }
  // Section « Dimensions » absente alors que des tailles existent dans la source.
  if ((ctx.level === "poussé" || ctx.level === "ultra complet") && hasDims && !/dimension/i.test(bodyText)) {
    issues.push("Section « Dimensions » absente alors que des tailles existent"); bump("warning");
  }
  // Formules passe-partout (richesse éditoriale) en mode avancé.
  if (ctx.level === "poussé" || ctx.level === "ultra complet") {
    const low = bodyText.toLowerCase();
    const fillerHits = FILLER_PHRASES.filter((f) => low.includes(f)).length;
    if (fillerHits >= 2) { issues.push(`Description avec formules génériques (${fillerHits})`); bump("warning"); }
  }

  // Doute IA signalé.
  if (r.status === "review") { if (r.notes?.length) issues.push(...r.notes); bump("warning"); }

  return { status, issues, fixed };
}

/** Rapport CSV des produits à vérifier / corrigés (téléchargeable). */
export function buildIssueReportCsv(groups: ProductGroup[], reports: Record<string, QCReport>): string {
  const headers = ["Handle", "Ancien titre", "Nouveau titre", "Statut", "Problèmes / corrections"];
  const rows: string[][] = [];
  for (const g of groups) {
    const rep = reports[g.handle];
    if (!rep || (rep.status === "ok" && rep.issues.length === 0)) continue;
    rows.push([g.handle, g.title, rep.fixed.title, rep.status.toUpperCase(), rep.issues.join(" · ")]);
  }
  return serializeCsv(headers, rows);
}

/** Rapport de modifications complet (résumé export + détail par produit). */
// ── Rapport naming (§21) : titres / noms brandés / handles vérifiés ─────────
export interface NamingSummary { titles: number; titlesClose: number; brandNames: number; brandDups: number; handleDups: number }
export function namingSummary(results: TransformedProduct[], reports: Record<string, QCReport>): NamingSummary {
  let titlesClose = 0, brandNames = 0, brandDups = 0, handleDups = 0;
  for (const r of results) {
    if (r.brandName) brandNames++;
    const j = (reports[r.handle]?.issues ?? []).join(" ").toLowerCase();
    if (/titre trop proche/.test(j)) titlesClose++;
    if (/nom brandé déjà|nom brandé trop similaire/.test(j)) brandDups++;
    if (/handle déjà utilisé/.test(j)) handleDups++;
  }
  return { titles: results.length, titlesClose, brandNames, brandDups, handleDups };
}

export function buildExportReport(groups: ProductGroup[], finalResults: TransformedProduct[], applied: ApplyResult, reports: Record<string, QCReport>): string {
  const qcCount = { ok: 0, warning: 0, risk: 0, failed: 0 };
  for (const g of groups) qcCount[reports[g.handle]?.status ?? "ok"]++;
  const reasons = applied.checks.filter((c) => c.status !== "ok").map((c) => `${c.label}${c.detail ? ` (${c.detail})` : ""}`);
  const nm = namingSummary(finalResults, reports);
  const summary: string[][] = [
    ["Produits exportés", String(applied.stats.products)],
    ["Variantes", String(applied.stats.variants)],
    ["Images", String(applied.stats.images)],
    ["Statut export global", applied.status.toUpperCase()],
    ["Produits OK / Warning / Risk / Failed", `${qcCount.ok} / ${qcCount.warning} / ${qcCount.risk} / ${qcCount.failed}`],
    ["Naming — noms vérifiés / titres trop proches / noms brandés / doublons brandés / doublons handle", `${nm.titles} / ${nm.titlesClose} / ${nm.brandNames} / ${nm.brandDups} / ${nm.handleDups}`],
    ["Colonnes ajoutées", applied.stats.added.join(" | ") || "aucune"],
    ["Colonnes conservées", applied.stats.preserved.join(" | ") || "aucune"],
    ["Colonnes vidées (sécurité)", applied.stats.cleared.join(" | ") || "aucune"],
    ["Raisons export", reasons.join(" ; ") || "aucune"],
    ["", ""],
    ["Handle", "Ancien titre", "Nouveau titre", "Meta title", "product_type", "Statut QC", "Problèmes"],
  ];
  const detail = groups.map((g) => {
    const r = finalResults.find((x) => x.handle === g.handle);
    const rep = reports[g.handle];
    return [g.handle, g.title, r?.title ?? "", r?.metaTitle ?? "", r?.productType ?? "", (rep?.status ?? "ok").toUpperCase(), (rep?.issues ?? []).join(" · ")];
  });
  return serializeCsv(["Rapport Import Factory — résumé export", ""], [...summary, ...detail]);
}

// ── Score « prêt à publier » par produit (§4) + verdict CSV (§3) ────────────
export interface ProductScore {
  score: number;                       // 0–100
  status: "ready" | "improve" | "risk";
  weak: string[];                      // points faibles lisibles
}

/** Score déterministe d'une fiche transformée, à partir de son rapport QC. */
export function scoreProduct(rep: QCReport, ctx: { imageCount: number }): ProductScore {
  const issues = rep.issues.map((s) => s.toLowerCase());
  const has = (re: RegExp) => issues.some((s) => re.test(s));
  const weak: string[] = [];
  let score = 0;
  // (points, problème détecté, libellé du point faible)
  const cat = (pts: number, problem: boolean, label: string) => {
    if (problem) { score += Math.round(pts * 0.4); weak.push(label); } else score += pts;
  };
  cat(15, has(/titre/), "titre à revoir");
  cat(25, has(/description courte|sans structure|dimensions absente|faq insuffisante|bénéfices|formules génériques/), "description faible");
  cat(15, has(/meta|suffixe/), "meta à améliorer");
  cat(10, has(/tags/), "tags à enrichir");
  // alt : pénalisé uniquement si le produit a des images mais des alts manquants
  cat(10, ctx.imageCount > 0 && (has(/alt/) || rep.fixed.imageAlts.length === 0), "alt text manquants");
  cat(10, has(/option|variante|pouce|anglais résiduel|emoji/), "variantes/options à nettoyer");
  cat(10, !rep.fixed.productType || rep.fixed.collections.length === 0, "product_type / collections");
  cat(5, has(/sourc|invention|à vérifier \(non sourc/), "affirmation à vérifier");
  if (rep.status === "failed") score = Math.min(score, 55);
  if (rep.status === "risk") score = Math.min(score, 80);
  score = Math.max(0, Math.min(100, score));
  const status = score >= 85 ? "ready" : score >= 65 ? "improve" : "risk";
  return { score, status, weak };
}

export type CsvVerdictStatus = "ready" | "verify" | "risky" | "partial";
export interface CsvVerdict {
  status: CsvVerdictStatus;
  headline: string;
  reasons: string[];
  counts: { ok: number; warning: number; risk: number; failed: number };
}

/** Verdict global du CSV avant export, à partir des rapports QC. */
export function csvVerdict(reports: Record<string, QCReport>): CsvVerdict {
  const list = Object.values(reports);
  const counts = { ok: 0, warning: 0, risk: 0, failed: 0 };
  for (const r of list) counts[r.status]++;
  // Agrégation des catégories de problèmes les plus parlantes.
  const all = list.flatMap((r) => r.issues.map((s) => s.toLowerCase()));
  const tally = (re: RegExp) => list.filter((r) => r.issues.some((s) => re.test(s.toLowerCase()))).length;
  const reasons: string[] = [];
  const add = (n: number, label: string) => { if (n > 0) reasons.push(`${n} ${label}`); };
  add(tally(/description courte|description faible/), "produit(s) à description trop courte");
  add(tally(/à vérifier \(non sourc|invention|affirmation/), "produit(s) avec une affirmation technique à vérifier");
  add(tally(/option|variante|pouce/), "produit(s) avec variantes/unités à nettoyer");
  add(tally(/meta|suffixe/), "produit(s) avec une meta à améliorer");
  add(tally(/tags/), "produit(s) avec des tags trop pauvres");
  add(tally(/doublé|déjà utilisé|trop similaire/), "doublon(s) de nom/handle détecté(s)");
  add(tally(/alt/), "produit(s) avec alt text à compléter");
  void all;

  // §7 — « risk » = qualité perfectible (téléchargeable) → « verify » ; seul un
  // « failed » (produit non exportable) déclenche « correction requise ».
  let status: CsvVerdictStatus;
  if (counts.failed > 0 && counts.ok + counts.warning + counts.risk > 0) status = "partial";
  else if (counts.failed > 0) status = "risky";
  else if (counts.warning > 0 || counts.risk > 0) status = "verify";
  else status = "ready";

  const verifyN = counts.warning + counts.risk;
  const headline =
    status === "ready" ? `Catalogue prêt à télécharger : ${counts.ok} produit(s) OK, aucune vérification requise.`
    : status === "verify" ? `Catalogue prêt à télécharger — ${verifyN} vérification(s) recommandée(s).`
    : status === "partial" ? `${counts.ok + verifyN} produit(s) prêt(s) à télécharger · ${counts.failed} produit(s) non exportable(s).`
    : `Correction requise avant export : ${counts.failed} produit(s) non exportable(s).`;
  return { status, headline, reasons: reasons.slice(0, 6), counts };
}

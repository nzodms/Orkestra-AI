"use client";

import { useState, useRef, useMemo, useEffect, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import { useOrkestra } from "@/lib/store";
import { assistantLink, councilLink } from "@/lib/shopify";
import {
  parseCsv, detectColumns, autoMapColumns, groupProducts, mappingStats, MAP_TARGETS, toProductInput,
  presetRules, applyTransform, serializeCsv, chunk, downloadCsv, normName, PRESETS,
  type ImportRules, type ShopifyField, type TransformedProduct, type ProductGroup,
  type TransformMode, type TitleStyle, type DescriptionLevel, type HandleMode, type Level,
} from "@/lib/import-factory";
import { PROFILES, CUSTOM_PROFILE, profileById, profileRuleOverrides, profileContext, effectiveProfile, type ProfileConfig } from "@/lib/import-profiles";
import { emptyProfileMemory } from "@/lib/store";
import { qualityControl, buildIssueReportCsv, buildExportReport, scoreProduct, csvVerdict, titleKey, namingSummary, type QCReport, type QCStatus, type ProductScore, type CsvVerdict } from "@/lib/import-qc";
import { useRouter } from "next/navigation";
import { planImportModels } from "@/lib/ai/import-models";
import type { EditorialFocus } from "@/lib/ai/import-editorial";
import { ImportTabsNav, PresetsTab, RecentImportsTab, CreateProfileTab, SavePresetModal, type ImportTab, type UsePresetPayload } from "./_tabs";
import type { ImportPreset, RecentImport } from "@/lib/store";
import { PageHeader, Card, Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import {
  Upload, FileSpreadsheet, Sparkles, Wand2, Languages, Tag, ImageIcon, Link2, Download, Check,
  CheckCircle2, AlertTriangle, RefreshCw, ChevronDown, Globe, FileText, ArrowRight, Plug, Eye,
  ListChecks, ShieldCheck, Layers, Boxes, Type as TypeIcon, X, Columns3, ListFilter, Store, Lock, Plus, CheckCheck, Database, Ban, Star, MessagesSquare,
} from "lucide-react";
import { relativeDate } from "@/lib/utils";

// Statuts non anxiogènes (§10) : « risk » (qualité) reste en ton « warn » ;
// seul « failed » (CSV qui casserait l'import) garde le ton « bad ».
const QC_TONE: Record<QCStatus, "good" | "warn" | "bad" | "neutral"> = { ok: "good", warning: "warn", risk: "warn", failed: "bad" };
const QC_LABEL: Record<QCStatus, string> = { ok: "Prêt", warning: "À améliorer", risk: "À vérifier", failed: "À corriger" };

// Collections au format « Nom | URL » (URL optionnelle, pour le maillage).
function parseCollections(text: string): { name: string; url: string }[] {
  return text.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const [name, url] = l.split("|").map((s) => s.trim()); return { name, url: url || "" }; });
}
function colsToText(cols: { name: string; url: string }[]): string {
  return cols.map((c) => (c.url ? `${c.name} | ${c.url}` : c.name)).join("\n");
}
function slugify(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "produit";
}
// En-têtes + mapping d'une fiche produit manuelle (structure Shopify multi-lignes).
const MANUAL_HEADERS = ["Handle", "Title", "Body (HTML)", "Vendor", "Product Category", "Type", "Tags", "Collection", "Option1 Name", "Option1 Value", "Variant SKU", "Variant Price", "Variant Inventory Qty", "Image Src", "Image Position", "Image Alt Text", "Variant Image", "Status"];
const MANUAL_MAP: Partial<Record<ShopifyField, number>> = { Handle: 0, Title: 1, Body: 2, Vendor: 3, Category: 4, Type: 5, Tags: 6, Collection: 7, Option1Name: 8, Option1Value: 9, VariantSKU: 10, VariantPrice: 11, VariantInventoryQty: 12, ImageSrc: 13, ImagePosition: 14, ImageAlt: 15, VariantImage: 16, Status: 17 };
type ManualState = { title: string; description: string; features: string; dimensions: string; materials: string; colors: string; price: string; sku: string; images: string; sourceUrl: string; notes: string; collection: string; productType: string; tags: string };
type ManualVariant = { value: string; price: string; sku: string; image: string; stock: string };

const MAX_PRODUCTS = 50;
const BATCH = 4;

// Lot adaptatif selon le mode/niveau (cf. §3) : Ultra = 1 produit/appel pour
// garder tout le budget de tokens ; modes simples = lots plus larges (rapidité).
function batchSizeFor(rules: ImportRules): number {
  if (rules.level === "ultra complet") return 1;
  if (rules.level === "poussé" || rules.transform === "recreate" || rules.transform === "supplier_to_brand") return 2;
  if (rules.transform === "translate" || rules.transform === "clean_translate") return 8;
  if (rules.transform === "migration") return 5;
  return BATCH;
}
function stepLabelFor(rules: ImportRules, claude: boolean): string {
  const base = rules.level === "ultra complet" ? "Génération des descriptions Ultra (produit par produit)"
    : rules.level === "poussé" ? "Génération des descriptions"
    : rules.transform === "translate" || rules.transform === "clean_translate" ? "Traduction et nettoyage"
    : "Optimisation des fiches";
  return claude ? `${base} + relecture premium` : base;
}
// Statut par produit pendant le traitement (§10).
type ProductStatus = "wait" | "processing" | "claude" | "done" | "qc" | "review" | "error";
const PSTATUS: Record<ProductStatus, { label: string; tone: string; icon: "wait" | "spin" | "check" | "warn" | "error" | "claude" }> = {
  wait: { label: "En attente", tone: "text-[var(--text-muted)]", icon: "wait" },
  processing: { label: "En cours", tone: "text-brand-600", icon: "spin" },
  claude: { label: "Relu par Claude", tone: "text-brand-600", icon: "claude" },
  done: { label: "Transformé", tone: "text-emerald-600", icon: "check" },
  qc: { label: "Contrôle qualité OK", tone: "text-emerald-600", icon: "check" },
  review: { label: "À vérifier", tone: "text-amber-600", icon: "warn" },
  error: { label: "Erreur", tone: "text-red-600", icon: "error" },
};
function fmtTime(s: number): string { const m = Math.floor(s / 60); const sec = s % 60; return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`; }
// §6 — Menu « Perfectionner avec Claude » : chaque option cible un sous-ensemble + un focus.
const CLAUDE_SCOPES: { id: string; label: string; focus: EditorialFocus; pick: (issues: string, st: QCStatus) => boolean }[] = [
  { id: "warn", label: "Toutes les fiches en warning", focus: "all", pick: (_i, s) => s === "warning" || s === "risk" || s === "failed" },
  { id: "desc", label: "Descriptions courtes", focus: "descriptions", pick: (i) => /description courte|faq insuffisante|bénéfices|dimensions absente|structure|formules génériques/.test(i) },
  { id: "meta", label: "Meta faibles", focus: "meta", pick: (i) => /meta|suffixe/.test(i) },
  { id: "title", label: "Titres mécaniques", focus: "titres", pick: (i) => /titre/.test(i) },
  { id: "tags", label: "Enrichir les tags", focus: "tags", pick: (i) => /tags/.test(i) },
  { id: "invent", label: "Vérifier les inventions potentielles", focus: "inventions", pick: (i) => /sourc|invention|à vérifier/.test(i) },
  { id: "tone", label: "Harmoniser le ton du catalogue", focus: "ton", pick: () => true },
  { id: "brand", label: "Noms brandés trop proches", focus: "brand", pick: (i) => /brandé/.test(i) },
  { id: "risk", label: "Relire uniquement les produits risqués", focus: "all", pick: (_i, s) => s === "risk" || s === "failed" },
];
function focusForIssues(issues: string): EditorialFocus {
  const i = issues.toLowerCase();
  if (/description|faq|bénéfices|dimensions|structure|formules/.test(i)) return "descriptions";
  if (/meta|suffixe/.test(i)) return "meta";
  if (/titre/.test(i)) return "titres";
  if (/tags/.test(i)) return "tags";
  if (/sourc|invention|à vérifier/.test(i)) return "inventions";
  if (/brandé/.test(i)) return "brand";
  return "all";
}

const LANGS = ["Français", "Anglais", "Espagnol", "Allemand", "Italien"];
const COUNTRIES = ["France", "Belgique", "Suisse", "Canada", "USA", "Autre"];
const TONES = ["naturel", "premium discret", "expert", "direct", "chaleureux"];
const TRANSFORMS: { v: TransformMode; l: string; sub: string }[] = [
  { v: "translate", l: "Traduire uniquement", sub: "Traduit les textes visibles sans réécrire entièrement les fiches." },
  { v: "clean_translate", l: "Nettoyer le CSV", sub: "Corrige textes sales, fautes, restes fournisseur, champs Shopify et handles." },
  { v: "rename_optimize", l: "Optimiser les fiches produits", sub: "Améliore titres, descriptions, meta, alt, tags et product_type — prêtes à publier." },
  { v: "recreate", l: "Recréer les contenus produit", sub: "Réécrit entièrement à partir des données fiables, sans casser variantes/prix/SKU/images." },
  { v: "migration", l: "Préparer une migration Shopify", sub: "Nettoie un export Shopify sans casser handles, variantes, images ou associations." },
  { v: "supplier_to_brand", l: "Transformer fournisseur → marque", sub: "Supprime l'aspect fournisseur et recrée un catalogue cohérent avec votre marque." },
];
const MODE_MODIFIES: Record<TransformMode, string[]> = {
  translate: ["Titres si nécessaire", "Descriptions", "Options", "Tags (si activé)", "Alt text (si activé)"],
  clean_translate: ["Fautes & accents", "Anglais résiduel", "Titres bruts", "Handles sales", "Tags fournisseur", "product_type", "Meta (si activé)"],
  rename_optimize: ["Titres", "Descriptions HTML", "Meta", "Alt text", "Tags", "product_type", "Collections recommandées"],
  recreate: ["Titres", "Descriptions", "Meta", "Tags", "Alt text", "product_type", "Maillage (si activé)", "Collections"],
  migration: ["Descriptions", "Meta", "Alt text", "Tags", "product_type", "Textes anglais", "Vendor (si activé)"],
  supplier_to_brand: ["Titres fournisseur", "Descriptions", "Tags inutiles", "Anciens noms / domaines", "Meta", "Alt text", "product_type", "Handles", "Ton de marque"],
};
const MODE_PRESERVES = ["Prix", "SKU", "Images", "Variantes", "Stock", "URLs images", "Variant Image", "Image Position"];
const TITLES: { v: TitleStyle; l: string }[] = [
  { v: "keep", l: "Garder" }, { v: "rewrite_seo", l: "Réécrire pour Google" }, { v: "short", l: "Courts (3–6 mots)" }, { v: "descriptive_long", l: "Descriptifs longs" },
];
const BRAND_STYLES = ["italien", "nordique", "luxe discret", "français", "court", "neutre"];
const DESC_LEVELS: { v: DescriptionLevel; l: string }[] = [
  { v: "short", l: "Courte" }, { v: "standard", l: "Standard" }, { v: "long", l: "Longue" }, { v: "html_rich", l: "HTML riche" },
];
const DESC_PARTS: { v: string; l: string }[] = [
  { v: "h2h3", l: "H2/H3" }, { v: "benefits", l: "Bénéfices" }, { v: "features", l: "Caractéristiques" },
  { v: "faq", l: "FAQ" }, { v: "usage", l: "Conseils d'usage" }, { v: "reassurance", l: "Réassurance" },
];
const HANDLES: { v: HandleMode; l: string }[] = [
  { v: "keep", l: "Garder" }, { v: "clean", l: "Nettoyer" }, { v: "fr", l: "Français" }, { v: "short", l: "Courts" },
];
const LEVELS: Level[] = ["léger", "standard", "poussé", "ultra complet"];

const VALUE = [
  { icon: TypeIcon, t: "Renommer les produits", d: "Titres naturels, noms brandés uniques ou style classique." },
  { icon: Languages, t: "Traduire et nettoyer", d: "Textes anglais, unités, descriptions, handles et champs Shopify." },
  { icon: Sparkles, t: "Optimiser pour Shopify", d: "Descriptions HTML, meta, alt text, tags, product_type et collections." },
  { icon: Layers, t: "Éviter les doublons", d: "Mémoire des noms, brand names, ancres et produits déjà traités." },
];

export default function ImportFactoryPage() {
  const { connections, brand, importProfiles, rememberImportFor, setProfileConfig, addForbidden, resetProfileMemory, selectedProfileId, setImportProfile, importPresets, recentImports, addImportPreset, addRecentImport, setPendingCouncil } = useOrkestra();
  const router = useRouter();
  const openaiConnected = !!connections.openai?.connected;
  const claudeConnected = !!connections.anthropic?.connected;
  const profile = profileById(selectedProfileId);
  const mem = importProfiles[selectedProfileId] ?? emptyProfileMemory();
  function effOf(id: string) {
    const m = importProfiles[id] ?? emptyProfileMemory();
    const cfg: ProfileConfig = { brand: m.brand, metaSuffix: m.metaSuffix, collections: m.configCollections, forbiddenTerms: m.forbiddenTerms, forbiddenDomains: m.forbiddenDomains };
    return effectiveProfile(profileById(id), cfg);
  }
  const eff = effOf(selectedProfileId);

  const [parsed, setParsed] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<ShopifyField, number>>>({});
  const [mapOpen, setMapOpen] = useState(false);
  const [fileInfo, setFileInfo] = useState<{ name: string; sizeKb: number } | null>(null);
  const [presetId, setPresetId] = useState("migration");
  const [rules, setRules] = useState<ImportRules>(() => ({ ...presetRules("migration"), collections: brand.collections, ...profileRuleOverrides(effOf(selectedProfileId)) }));
  const [collectionsText, setCollectionsText] = useState(() => colsToText(effOf(selectedProfileId).collections));
  const [phase, setPhase] = useState<"idle" | "configure" | "working" | "preview">("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  // Traitement : minuteur, étape, statut par produit, sélection (>50).
  const [procStart, setProcStart] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [procStep, setProcStep] = useState("");
  const [productStatus, setProductStatus] = useState<Record<string, ProductStatus>>({});
  const [workingList, setWorkingList] = useState<{ handle: string; title: string }[]>([]);
  const [selectedHandles, setSelectedHandles] = useState<string[] | null>(null);
  const [selectOpen, setSelectOpen] = useState(false);
  const [results, setResults] = useState<TransformedProduct[] | null>(null);
  const [qcReports, setQcReports] = useState<Record<string, QCReport>>({});
  const [edits, setEdits] = useState<Record<string, Partial<TransformedProduct>>>({});
  const [validated, setValidated] = useState<string[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const [locked, setLocked] = useState<string[]>([]);
  const [confirmExport, setConfirmExport] = useState(false);
  const [approvePanel, setApprovePanel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [showExample, setShowExample] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  // Mode d'entrée : CSV ou produit manuel.
  const [source, setSource] = useState<"csv" | "manual">("csv");
  const [manual, setManual] = useState({ title: "", description: "", features: "", dimensions: "", materials: "", colors: "", price: "", sku: "", images: "", sourceUrl: "", notes: "", collection: "", productType: "", tags: "" });
  const [optionName, setOptionName] = useState("");
  const [variants, setVariants] = useState<{ value: string; price: string; sku: string; image: string; stock: string }[]>([]);
  // Navigation par onglets + presets/derniers imports.
  const [tab, setTab] = useState<ImportTab>("import");
  const [savePresetOpen, setSavePresetOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<{ id?: string; name?: string }>({});
  const [perfecting, setPerfecting] = useState(false);
  const [perfectMenuOpen, setPerfectMenuOpen] = useState(false);
  const [editorialApplied, setEditorialApplied] = useState(false);
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const [cardMore, setCardMore] = useState<string[]>([]);
  const [autoFixSummary, setAutoFixSummary] = useState<{ fixed: number; improved: number; remaining: number } | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const configRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const isShopify = useMemo(() => (parsed ? detectColumns(parsed.headers).isShopify : false), [parsed]);
  const groups = useMemo(() => (parsed ? groupProducts(parsed.rows, mapping) : []), [parsed, mapping]);
  const stats = useMemo(() => (parsed ? mappingStats(parsed.headers, parsed.rows, mapping, groups) : null), [parsed, mapping, groups]);
  // CSV Shopify final (colonnes complètes + contrôle qualité export).
  const applied = useMemo(() => {
    if (!parsed || !results) return null;
    const fr = results.map((r) => ({ ...r, ...(edits[r.handle] || {}) }));
    return applyTransform(parsed.headers, parsed.rows, mapping, groups, fr, rules);
  }, [parsed, results, edits, mapping, groups, rules]);

  // Minuteur de traitement (temps écoulé) pendant la phase « working ».
  useEffect(() => {
    if (phase !== "working" || !procStart) return;
    const id = setInterval(() => setElapsed(Math.max(0, Math.round((Date.now() - procStart) / 1000))), 250);
    return () => clearInterval(id);
  }, [phase, procStart]);

  // Produits à transformer : sélection explicite (>50) ou les 50 premiers.
  function selectedForTransform(): ProductGroup[] {
    if (selectedHandles && selectedHandles.length) {
      const set = new Set(selectedHandles);
      return groups.filter((g) => set.has(g.handle)).slice(0, MAX_PRODUCTS);
    }
    return groups.slice(0, MAX_PRODUCTS);
  }

  function updateRule(patch: Partial<ImportRules>) { setRules((r) => ({ ...r, ...patch })); }
  function applyPreset(id: string) {
    setPresetId(id);
    setRules((r) => ({ ...presetRules(id), collections: r.collections, ...profileRuleOverrides(eff) }));
  }
  function goToImport() { setTab("import"); setTimeout(() => fileRef.current?.focus?.(), 50); }
  // Utiliser un preset recommandé → applique ses règles + bascule sur l'import.
  function onUseBuiltin(id: string) {
    applyPreset(id);
    setActivePreset({ id, name: PRESETS.find((p) => p.id === id)?.label });
    goToImport();
  }
  // Utiliser un preset privé / analysé → applique ses réglages complets.
  function applySavedRules(rules: ImportRules, opts: { collectionsText?: string; profileId?: string; presetId?: string; presetName?: string }) {
    if (opts.profileId) setImportProfile(opts.profileId);
    setRules(rules);
    if (opts.collectionsText !== undefined) setCollectionsText(opts.collectionsText);
    setPresetId("custom");
    setActivePreset({ id: opts.presetId, name: opts.presetName });
    goToImport();
  }
  function onUsePreset(p: ImportPreset) { applySavedRules(p.rules, { collectionsText: p.collectionsText, profileId: p.profileId, presetId: p.id, presetName: p.name }); }
  function onUseRules(payload: UsePresetPayload) { applySavedRules(payload.rules, { collectionsText: payload.collectionsText, profileId: payload.profileId, presetId: payload.presetId, presetName: payload.presetName }); }
  function onReuse(r: RecentImport) { applySavedRules(r.rules, { collectionsText: r.collectionsText, profileId: r.profileId, presetId: r.presetId, presetName: r.presetName }); }
  function saveCurrentAsPreset(name: string, description: string) {
    addImportPreset({ id: `pr_${Date.now().toString(36)}`, name, description: description || undefined, origin: "user", profileId: selectedProfileId, isDefault: false, createdAt: new Date().toISOString(), rules, collectionsText });
    setSavePresetOpen(false);
  }
  function selectProfile(id: string) {
    setImportProfile(id);
    const e = effOf(id);
    setRules((r) => ({ ...r, ...profileRuleOverrides(e) }));
    setCollectionsText(colsToText(e.collections));
  }
  function syncCollections(text: string) {
    setCollectionsText(text);
    const cu = parseCollections(text);
    updateRule({ collections: cu.map((c) => c.name), collectionsUrls: cu });
    setProfileConfig(selectedProfileId, { collections: cu });
  }
  function setBrandConfig(v: string) { updateRule({ vendor: v }); setProfileConfig(selectedProfileId, { brand: v }); }
  function setMetaSuffixConfig(v: string) { updateRule({ metaSuffix: v }); setProfileConfig(selectedProfileId, { metaSuffix: v }); }
  // Contrôle qualité déterministe (dédoublonnage amorcé par la mémoire du profil).
  function runQc(list: TransformedProduct[]): { fixed: TransformedProduct[]; reports: Record<string, QCReport> } {
    const usedBrand = new Set(mem.brandNames.map(normName));
    const usedHandle = new Set(mem.handles.map((h) => h.toLowerCase()));
    const usedMetaOpenings = new Set<string>();
    // Anti-doublon des titres : amorcé par les titres déjà générés (mémoire profil).
    const usedTitles = new Set(mem.titles.map(titleKey).filter(Boolean));
    const reports: Record<string, QCReport> = {};
    const fixed = list.map((r) => {
      const g = groups.find((x) => x.handle === r.handle);
      const sourceText = g ? `${g.title} ${g.body} ${g.tags} ${g.type} ${g.variants.map((v) => v.option1).join(" ")}` : "";
      const rep = qualityControl(r, {
        metaSuffix: eff.metaSuffix || rules.metaSuffix, vendor: eff.vendor || rules.vendor, level: rules.level, oldTerms: eff.oldTerms,
        brandNames: rules.brandNames, language: rules.language, tagsType: rules.tagsType, sourceText,
        usedBrand, usedHandle, usedMetaOpenings, usedTitles,
      });
      reports[r.handle] = rep;
      return rep.fixed;
    });
    return { fixed, reports };
  }
  function setMap(field: ShopifyField, idx: number | null) {
    setMapping((m) => { const n = { ...m }; if (idx === null) delete n[field]; else n[field] = idx; return n; });
  }

  async function readFile(file: File) {
    setParseError(null);
    if (!/\.csv$/i.test(file.name)) { setParseError("Format non supporté : importez un fichier .csv."); return; }
    const text = await file.text();
    const all = parseCsv(text);
    if (all.length < 2) { setParseError("CSV vide ou illisible (au moins une ligne d'en-tête + une ligne produit)."); return; }
    const headers = all[0];
    const rows = all.slice(1);
    const det = detectColumns(headers);
    setParsed({ headers, rows });
    setMapping(det.isShopify ? det.map : autoMapColumns(headers));
    setMapOpen(!det.isShopify);
    setFileInfo({ name: file.name, sizeKb: Math.max(1, Math.round(file.size / 1024)) });
    setResults(null);
    setQcReports({});
    setEdits({});
    setValidated([]); setRejected([]); setLocked([]);
    setError(null);
    setPhase("configure");
    setTimeout(() => configRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

  // Fusionne de nouveaux résultats (relance) dans les existants, par handle.
  function mergeResults(prev: TransformedProduct[], next: TransformedProduct[]): TransformedProduct[] {
    const byHandle = new Map(next.map((r) => [r.handle, r]));
    const merged = prev.map((r) => byHandle.get(r.handle) ?? r);
    for (const r of next) if (!prev.some((p) => p.handle === r.handle)) merged.push(r);
    return merged;
  }
  function toggleSelected(h: string) {
    setSelectedHandles((cur) => {
      const list = cur ?? groups.slice(0, MAX_PRODUCTS).map((g) => g.handle);
      if (list.includes(h)) return list.filter((x) => x !== h);
      if (list.length >= MAX_PRODUCTS) return list;
      return [...list, h];
    });
  }
  function runClaudeScope(scope: typeof CLAUDE_SCOPES[number]) {
    const handles = (results || []).filter((r) => scope.pick((qcReports[r.handle]?.issues || []).join(" ").toLowerCase(), qcReports[r.handle]?.status ?? "ok")).map((r) => r.handle);
    if (!handles.length) { setError("Aucune fiche concernée pour cette relecture."); setPerfectMenuOpen(false); return; }
    perfectWithClaude({ handles, focus: scope.focus });
  }
  function transform() { runTransform(selectedForTransform(), false); }
  function retryErrors() {
    const errs = groups.filter((g) => productStatus[g.handle] === "error");
    if (errs.length) runTransform(errs, true);
  }

  // Cœur du moteur : traite `target` par lots adaptatifs, avec sauvegarde
  // progressive (§10). `append` = relance des produits en erreur uniquement.
  async function runTransform(target: ProductGroup[], append: boolean) {
    if (!parsed || !stats?.hasTitle || !target.length) return;
    if (!openaiConnected) { setError("Connectez OpenAI pour lancer la transformation."); return; }
    setError(null);
    if (!append) { setAutoFixSummary(null); setFilter("all"); setEditorialApplied(false); setMoreActionsOpen(false); setCardMore([]); }
    const claudeOn = !!connections.anthropic?.connected;
    const ps: Record<string, ProductStatus> = append ? { ...productStatus } : {};
    for (const g of target) ps[g.handle] = "wait";
    setProductStatus({ ...ps });
    setWorkingList(target.map((g) => ({ handle: g.handle, title: g.title || g.handle })));
    setPhase("working");
    setProcStart(Date.now()); setElapsed(0); setProcStep(stepLabelFor(rules, claudeOn));
    setProgress({ done: 0, total: target.length });

    const batchSize = batchSizeFor(rules);
    const batches = chunk(target, batchSize);
    const acc: TransformedProduct[] = [];
    const errored: ProductGroup[] = [];
    const brandAcc = [...mem.brandNames];
    const anchorAcc = [...mem.anchors];
    let processed = 0;
    for (let b = 0; b < batches.length; b++) {
      const batch = batches[b];
      for (const g of batch) ps[g.handle] = "processing";
      setProductStatus({ ...ps });
      const inputs = batch.map(toProductInput);
      let data: { ok: boolean; results?: TransformedProduct[]; error?: string; editorial?: boolean };
      try {
        const res = await fetch("/api/import", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            products: inputs, rules, memory: { brandNames: brandAcc, anchors: anchorAcc, handles: mem.handles, titles: mem.titles },
            context: { ...profileContext(eff), brandName: eff.brand || brand.storeName || undefined, niche: eff.niche || brand.niche || undefined, positioning: brand.positioning },
            keyRefs: { openai: connections.openai?.keyId, claude: connections.anthropic?.keyId },
          }),
        });
        data = await res.json();
      } catch {
        data = { ok: false, error: "Connexion interrompue." };
      }
      processed += batch.length;
      if (!data.ok || !data.results) {
        for (const g of batch) { ps[g.handle] = "error"; errored.push(g); } // §10 : on garde les autres
        setProductStatus({ ...ps });
      } else {
        acc.push(...data.results);
        for (const r of data.results) if (r.brandName) brandAcc.push(r.brandName);
        if (data.editorial) setEditorialApplied(true);
        for (const g of batch) ps[g.handle] = data.editorial ? "claude" : "done";
        setProductStatus({ ...ps });
      }
      setProgress({ done: processed, total: target.length });
    }

    if (!acc.length) {
      setError(append ? "La relance a échoué. Réessayez." : "Échec de la transformation. Vérifiez votre clé OpenAI et réessayez.");
      setPhase(append ? "preview" : "configure");
      return;
    }

    // Contrôle qualité déterministe (arbitre final) sur les produits réussis.
    setProcStep("Contrôle qualité");
    const { fixed, reports } = runQc(acc);
    for (const r of fixed) { const st = reports[r.handle]?.status; ps[r.handle] = st === "failed" || st === "risk" ? "review" : "qc"; }
    setProductStatus({ ...ps });

    // Fusion (append) ou remplacement des résultats.
    const merged = append ? mergeResults(results ?? [], fixed) : fixed;
    const mergedReports = append ? { ...qcReports, ...reports } : reports;
    setResults(merged);
    setQcReports(mergedReports);
    if (!append) { setValidated([]); setRejected([]); setLocked([]); setApprovePanel(false); }

    rememberImportFor(selectedProfileId, {
      brandNames: fixed.map((r) => r.brandName).filter(Boolean) as string[],
      titles: fixed.map((r) => r.title).filter(Boolean),
      handles: fixed.map((r) => r.newHandle).filter(Boolean) as string[],
      anchors: rules.collections, collections: rules.collections,
      productTypes: fixed.map((r) => r.productType).filter(Boolean),
      tags: fixed.flatMap((r) => r.tags.split(",").map((t) => t.trim())).filter(Boolean),
      rules, count: fixed.length,
    });

    // Enregistre l'import (uniquement lors d'un import complet, pas d'une relance).
    if (!append) {
      const agg = { warning: 0, risk: 0, failed: 0 };
      for (const h of Object.keys(reports)) { const st = reports[h].status; if (st === "warning" || st === "risk" || st === "failed") agg[st]++; }
      const overall: RecentImport["status"] = errored.length || agg.failed ? "failed" : agg.risk ? "risk" : agg.warning ? "warning" : "ok";
      const v = csvVerdict(reports);
      const imgByHandle = new Map(target.map((g) => [g.handle, g.images.length]));
      const avgScore = fixed.length ? Math.round(fixed.reduce((a, r) => a + (reports[r.handle] ? scoreProduct(reports[r.handle], { imageCount: imgByHandle.get(r.handle) ?? 0 }).score : 100), 0) / fixed.length) : 0;
      addRecentImport({
        id: `imp_${Date.now().toString(36)}`, date: new Date().toISOString(), fileName: fileInfo?.name ?? "Catalogue",
        products: target.length, variants: target.reduce((a, g) => a + g.variants.length, 0), images: target.reduce((a, g) => a + g.images.length, 0),
        presetId: activePreset.id, presetName: activePreset.name ?? PRESETS.find((p) => p.id === presetId)?.label,
        profileId: selectedProfileId, status: overall, warnings: agg.warning, risks: agg.risk, failed: agg.failed, rules, collectionsText,
        verdict: v.status, riskReasons: v.reasons, avgScore,
      });
    }
    if (errored.length) setError(`${errored.length} produit(s) en erreur. Les autres sont prêts — vous pouvez relancer les produits en erreur.`);
    setPhase("preview");
    setTimeout(() => previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

  // §6/§18 — « Perfectionner avec Claude » : relit un SOUS-ENSEMBLE ciblé de
  // fiches (champs éditoriaux uniquement) avec un focus, puis repasse le QC.
  async function perfectWithClaude(opts?: { handles?: string[]; focus?: EditorialFocus }) {
    if (!results || perfecting) return;
    const focus = opts?.focus ?? "all";
    let list: TransformedProduct[];
    if (opts?.handles) { const set = new Set(opts.handles); list = results.filter((r) => set.has(r.handle)); }
    else { const weak = results.filter((r) => { const s = qcReports[r.handle]?.status; return s === "warning" || s === "risk" || s === "failed"; }); list = weak.length ? weak : results; }
    if (!list.length) { setError("Aucune fiche concernée pour cette relecture."); return; }
    setPerfectMenuOpen(false);
    const withEdits = list.map((r) => ({ ...r, ...(edits[r.handle] || {}) }));
    const handleSet = new Set(list.map((r) => r.handle));
    const sources = groups.filter((g) => handleSet.has(g.handle)).map(toProductInput);
    setPerfecting(true); setError(null);
    try {
      const res = await fetch("/api/import/refine", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          products: withEdits, sources, rules, focus,
          context: { ...profileContext(eff), brandName: eff.brand || brand.storeName || undefined, niche: eff.niche || brand.niche || undefined, positioning: brand.positioning },
          memory: { brandNames: mem.brandNames, anchors: mem.anchors, handles: mem.handles, titles: mem.titles },
          keyRefs: { claude: connections.anthropic?.keyId },
        }),
      });
      const data = await res.json();
      if (!data.ok || !data.results) { setError(data.error || "Relecture Claude impossible."); setPerfecting(false); return; }
      const { fixed, reports } = runQc(data.results as TransformedProduct[]);
      setResults((rs) => mergeResults(rs ?? [], fixed));
      setQcReports((q) => ({ ...q, ...reports }));
      setEdits((e) => { const n = { ...e }; for (const r of fixed) delete n[r.handle]; return n; });
      setProductStatus((ps) => { const n = { ...ps }; for (const r of fixed) { const s = reports[r.handle]?.status; n[r.handle] = s === "risk" || s === "failed" ? "review" : "qc"; } return n; });
    } catch { setError("Relecture Claude interrompue. Réessayez."); }
    setPerfecting(false);
  }

  async function regenerateOne(handle: string) {
    const g = groups.find((x) => x.handle === handle);
    if (!g || !results) return;
    try {
      const res = await fetch("/api/import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          products: [toProductInput(g)], rules, memory: { brandNames: mem.brandNames, anchors: mem.anchors },
          context: { ...profileContext(eff), brandName: eff.brand || brand.storeName || undefined, niche: eff.niche || brand.niche || undefined, positioning: brand.positioning },
          keyRefs: { openai: connections.openai?.keyId },
        }),
      });
      const data = await res.json();
      if (data.ok && data.results?.[0]) {
        const { fixed, reports } = runQc([data.results[0] as TransformedProduct]);
        setResults((rs) => (rs ? rs.map((r) => (r.handle === handle ? fixed[0] : r)) : rs));
        setQcReports((q) => ({ ...q, [handle]: reports[handle] }));
        setEdits((e) => { const n = { ...e }; delete n[handle]; return n; });
      }
    } catch { /* silencieux */ }
  }

  // §6 — Lien ciblé vers AI Council : résumé QC, sans ré-audit complet.
  function councilReviewLink(): string {
    const q =
      `Contexte : import « ${fileInfo?.name ?? "catalogue"} » · ${results?.length ?? 0} produit(s) transformé(s) · ` +
      `${qcCounts.warning} à améliorer · ${qcCounts.risk} à risque · ${qcCounts.failed} bloqué(s) · ` +
      `mode ${rules.transform} / niveau ${rules.level}${activePreset.name ? ` · preset « ${activePreset.name} »` : ""}.\n` +
      `Question : d'après ce résumé de contrôle qualité, qu'est-ce qui est vraiment bloquant avant l'export Shopify, ` +
      `qu'est-ce qui est acceptable, quelles fiches relancer, et le CSV semble-t-il prêt à importer ? ` +
      `Réponds de façon ciblée, sans refaire un audit complet du site.`;
    return councilLink("free", q);
  }

  // §1/§2 — Demande CIBLÉE envoyée à AI Council (format court actionnable).
  function askCouncil(question: string) { setPendingCouncil({ mode: "free", question }); router.push("/council"); }
  const COUNCIL_FMT = "\n\nRéponds UNIQUEMENT à cette demande, sans refaire d'audit, au format : ## Réponse directe ## Correction recommandée (version prête à copier) ## Pourquoi c'est mieux ## Risque éventuel (SEO / Merchant / invention) ## Action suivante.";
  function cLine(r: TransformedProduct): string {
    const v = eff.vendor || rules.vendor; const sfx = eff.metaSuffix || rules.metaSuffix;
    return `Produit : ${r.title}${v ? ` · Marque : ${v}` : ""} · Langue : ${rules.language} · Niveau : ${rules.level}${sfx ? ` · Suffixe meta imposé : ${sfx}` : ""}`;
  }
  function cIssues(handle: string): string { const rep = qcReports[handle]; return rep?.issues.length ? `Warnings QC : ${rep.issues.join(" · ")}` : "Warnings QC : aucun"; }
  function qMeta(r: TransformedProduct) { return `Contexte ciblé Import Factory — Corriger la meta description.\n${cLine(r)}\nMeta title : ${r.metaTitle}\nMeta description actuelle (${r.metaDescription.length} car.) : ${r.metaDescription}\n${cIssues(r.handle)}\nDonne 3 propositions de meta description (≤160 car., finissant par le suffixe si imposé), indique la meilleure recommandée, le nombre de caractères et le risque SEO/Merchant.${COUNCIL_FMT}`; }
  function qDesc(r: TransformedProduct) { const ed = edits[r.handle] || {}; return `Contexte ciblé Import Factory — Améliorer la description produit (sans rien inventer au-delà des données fournies).\n${cLine(r)}\n${cIssues(r.handle)}\nDescription HTML actuelle :\n${ed.bodyHtml ?? r.bodyHtml}\nIndique la version améliorée, ce qui a été renforcé et ce qui ne doit pas être inventé.${COUNCIL_FMT}`; }
  function qVerify(r: TransformedProduct) { const ed = edits[r.handle] || {}; return `Contexte ciblé Import Factory — Vérifier ce produit avant export Shopify.\n${cLine(r)}\nTitle : ${ed.title ?? r.title}\nMeta : ${r.metaDescription}\nTags : ${ed.tags ?? r.tags}\n${cIssues(r.handle)}\nDis ce qui est bloquant avant export, ce qui est acceptable, et les corrections prioritaires.${COUNCIL_FMT}`; }

  function finalResults(): TransformedProduct[] {
    return (results || []).map((r) => ({ ...r, ...(edits[r.handle] || {}) }));
  }
  function exportCsv(treatedOnly = false) {
    if (!applied) return;
    if (!treatedOnly && applied.status === "failed" && !confirmExport) { setConfirmExport(true); return; }
    let rows = applied.rows;
    if (treatedOnly && results) {
      // §11 : n'exporter que les lignes des produits réellement transformés.
      const treated = new Set(results.map((r) => r.handle));
      const idxSet = new Set(groups.filter((g) => treated.has(g.handle)).flatMap((g) => g.rowIndices));
      rows = applied.rows.filter((_, i) => idxSet.has(i));
    }
    downloadCsv(`orkestra-import-${Date.now()}.csv`, serializeCsv(applied.headers, rows));
  }
  const erroredHandles = groups.filter((g) => productStatus[g.handle] === "error");
  function exportReport() {
    if (!applied || !results) return;
    downloadCsv(`orkestra-rapport-${Date.now()}.csv`, buildExportReport(groups, finalResults(), applied, qcReports));
  }
  // Règle de lot : applique une collection ou un product_type aux produits dont
  // le titre / la collection source contient un mot-clé.
  function applyBatchRule(keyword: string, field: "collections" | "productType", value: string) {
    const kw = keyword.trim().toLowerCase();
    if (!kw || !value.trim() || !results) return 0;
    let n = 0;
    setEdits((prev) => {
      const next = { ...prev };
      for (const r of results) {
        const g = groups.find((x) => x.handle === r.handle);
        const hay = `${edits[r.handle]?.title ?? r.title} ${g?.title ?? ""} ${g?.collection ?? ""}`.toLowerCase();
        if (hay.includes(kw)) {
          next[r.handle] = { ...next[r.handle], [field]: field === "collections" ? [value.trim()] : value.trim() };
          n++;
        }
      }
      return next;
    });
    return n;
  }
  function batchMatchCount(keyword: string): number {
    const kw = keyword.trim().toLowerCase();
    if (!kw || !results) return 0;
    return results.filter((r) => {
      const g = groups.find((x) => x.handle === r.handle);
      return `${edits[r.handle]?.title ?? r.title} ${g?.title ?? ""} ${g?.collection ?? ""}`.toLowerCase().includes(kw);
    }).length;
  }
  function exportIssues() {
    if (!results) return;
    downloadCsv(`orkestra-a-verifier-${Date.now()}.csv`, buildIssueReportCsv(groups, qcReports));
  }
  function toggle(set: string[], setter: (v: string[]) => void, h: string) { setter(set.includes(h) ? set.filter((x) => x !== h) : [...set, h]); }
  const statusOf = (h: string): QCStatus => qcReports[h]?.status ?? "ok";
  // §12 — Approbation intelligente : les produits « bloqués » (failed) ne sont
  // jamais approuvés en masse. `includeWarnings` ajoute warning + risk aux OK.
  function approveByStatus(includeWarnings: boolean) {
    const next = (results || [])
      .filter((r) => (includeWarnings ? statusOf(r.handle) !== "failed" : statusOf(r.handle) === "ok"))
      .map((r) => r.handle);
    setValidated(next);
    setRejected((x) => x.filter((h) => !next.includes(h)));
    setApprovePanel(false);
  }
  function onApproveAllClick() {
    // Tout est OK → on approuve directement ; sinon on demande quoi faire.
    if (qcCounts.warning + qcCounts.risk + qcCounts.failed === 0) approveByStatus(true);
    else setApprovePanel((v) => !v);
  }
  function scrollToFirstIssue() {
    setApprovePanel(false);
    const first = (results || []).find((r) => statusOf(r.handle) !== "ok");
    if (first) setTimeout(() => document.getElementById(`qc-${first.handle}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
  }
  // §13 — Re-applique le contrôle qualité déterministe (français, accents, casse,
  // suffixe meta, doublons) sur le contenu courant, en incluant les éditions
  // manuelles. Corrige automatiquement ce qui est corrigeable sans OpenAI.
  function autoFixWarnings() {
    if (!results) return;
    const beforeByHandle: Record<string, number> = {};
    for (const r of results) beforeByHandle[r.handle] = qcReports[r.handle]?.issues.length ?? 0;
    const { fixed, reports } = runQc(finalResults());
    let improved = 0, afterTotal = 0, beforeTotal = 0;
    for (const r of fixed) {
      const after = reports[r.handle]?.issues.length ?? 0;
      const before = beforeByHandle[r.handle] ?? 0;
      afterTotal += after; beforeTotal += before;
      if (after < before) improved++;
    }
    setResults(fixed); setQcReports(reports); setEdits({});
    setAutoFixSummary({ fixed: Math.max(0, beforeTotal - afterTotal), improved, remaining: afterTotal });
  }
  function reset() {
    setParsed(null); setMapping({}); setMapOpen(false); setFileInfo(null); setResults(null);
    setQcReports({}); setEdits({}); setValidated([]); setRejected([]); setLocked([]); setConfirmExport(false); setApprovePanel(false); setError(null); setParseError(null); setPhase("idle");
    setProductStatus({}); setProcStart(null); setElapsed(0); setProcStep(""); setSelectedHandles(null); setSelectOpen(false);
    setAutoFixSummary(null); setFilter("all"); setEditorialApplied(false); setMoreActionsOpen(false); setCardMore([]);
  }
  // Construit une fiche produit synthétique (mêmes headers/mapping qu'un CSV Shopify).
  function buildManualParsed(): { headers: string[]; rows: string[][] } | null {
    const title = manual.title.trim();
    if (!title) return null;
    const handle = slugify(title);
    const imgs = manual.images.split("\n").map((s) => s.trim()).filter(Boolean);
    const vsRaw = variants.filter((v) => v.value.trim() || v.price.trim() || v.sku.trim() || v.image.trim());
    const vRows = vsRaw.length ? vsRaw : [{ value: "", price: manual.price, sku: manual.sku, image: "", stock: "" }];
    const body = [manual.description.trim(), manual.features.trim() && `Caractéristiques : ${manual.features.trim()}`, manual.dimensions.trim() && `Dimensions : ${manual.dimensions.trim()}`, manual.materials.trim() && `Matériaux : ${manual.materials.trim()}`, manual.colors.trim() && `Couleurs : ${manual.colors.trim()}`, manual.sourceUrl.trim() && `Source : ${manual.sourceUrl.trim()}`, manual.notes.trim() && `Notes internes : ${manual.notes.trim()}`].filter(Boolean).join("\n");
    const blank = () => new Array(MANUAL_HEADERS.length).fill("");
    const rows: string[][] = [];
    vRows.forEach((v, i) => {
      const r = blank();
      r[0] = handle;
      if (optionName.trim() && v.value.trim()) { r[8] = optionName.trim(); r[9] = v.value.trim(); }
      r[10] = v.sku.trim() || (i === 0 ? manual.sku.trim() : "");
      r[11] = v.price.trim() || (i === 0 ? manual.price.trim() : "");
      r[12] = v.stock.trim();
      if (v.image.trim()) r[16] = v.image.trim();
      if (i === 0) {
        r[1] = title; r[2] = body; r[5] = manual.productType.trim(); r[6] = manual.tags.trim(); r[7] = manual.collection.trim(); r[17] = "active";
        if (imgs[0]) { r[13] = imgs[0]; r[14] = "1"; }
      }
      rows.push(r);
    });
    imgs.slice(1).forEach((src, i) => { const r = blank(); r[0] = handle; r[13] = src; r[14] = String(i + 2); rows.push(r); });
    return { headers: MANUAL_HEADERS, rows };
  }
  function onContinueManual() {
    const built = buildManualParsed();
    if (!built) { setError("Le titre du produit est obligatoire."); return; }
    setParsed(built);
    setMapping({ ...MANUAL_MAP });
    setMapOpen(false);
    setResults(null); setQcReports({}); setEdits({}); setValidated([]); setRejected([]); setLocked([]); setConfirmExport(false); setApprovePanel(false);
    setFileInfo({ name: `Produit manuel — ${manual.title.trim()}`, sizeKb: 1 });
    setError(null);
    setPhase("configure");
    setTimeout(() => configRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }
  const qcCounts = (() => {
    const c = { ok: 0, warning: 0, risk: 0, failed: 0 };
    for (const r of results || []) c[(qcReports[r.handle]?.status ?? "ok")]++;
    return c;
  })();
  // §4 — score « prêt à publier » par produit + §3 verdict CSV.
  const scores = useMemo(() => {
    const m: Record<string, ProductScore> = {};
    for (const r of results || []) {
      const rep = qcReports[r.handle];
      if (!rep) continue;
      const g = groups.find((x) => x.handle === r.handle);
      m[r.handle] = scoreProduct(rep, { imageCount: g?.images.length ?? 0 });
    }
    return m;
  }, [results, qcReports, groups]);
  const verdict: CsvVerdict | null = useMemo(() => (results && results.length ? csvVerdict(qcReports) : null), [results, qcReports]);
  const naming = useMemo(() => (results && results.length ? namingSummary(results, qcReports) : null), [results, qcReports]);
  // §5 — filtre « À corriger ».
  const [filter, setFilter] = useState<"all" | "verify" | "ready" | "risk" | "error">("all");
  const visibleResults = (results || []).filter((r) => {
    if (filter === "all") return true;
    if (filter === "error") return productStatus[r.handle] === "error";
    const st = qcReports[r.handle]?.status ?? "ok";
    const sc = scores[r.handle]?.status;
    if (filter === "ready") return sc === "ready" && st === "ok";
    if (filter === "risk") return sc === "risk" || st === "risk" || st === "failed";
    if (filter === "verify") return st === "warning" || st === "risk" || sc === "improve" || sc === "risk";
    return true;
  });

  const tooMany = groups.length > MAX_PRODUCTS;
  // Routing multi-modèle : Orkestra choisit les modèles selon le niveau ;
  // l'utilisateur ne choisit que le niveau. Claude n'intervient que s'il est connecté.
  const modelPlan = planImportModels(rules, { claudeAvailable: !!connections.anthropic?.connected });

  return (
    <>
      <PageHeader
        title="Transformez vos catalogues produits en CSV Shopify prêts à publier"
        description="Importez un catalogue, appliquez un preset ou créez votre propre profil d'import à partir d'un fichier exemple."
        actions={<span className="flex flex-wrap items-center gap-1.5">
          {openaiConnected ? <Badge tone="good"><ShieldCheck className="h-3 w-3" /> OpenAI connecté</Badge> : <Badge tone="warn"><Plug className="h-3 w-3" /> OpenAI requis pour transformer</Badge>}
          {claudeConnected && <Badge tone="brand"><Sparkles className="h-3 w-3" /> Claude — relecture premium</Badge>}
        </span>}
      />

      {!openaiConnected && (
        <Card className="ork-rise mb-5 flex flex-col items-start gap-3 border-amber-200 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/20 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500 text-white"><Plug className="h-5 w-5" /></span>
            <div>
              <h3 className="text-sm font-semibold">OpenAI requis pour transformer le catalogue</h3>
              <p className="mt-0.5 max-w-xl text-sm text-[var(--text-muted)]">Vous pouvez préparer votre import, mapper vos colonnes, ajouter un produit manuel et configurer vos règles. Connectez OpenAI pour lancer la transformation IA.</p>
            </div>
          </div>
          <Link href="/connect" className="shrink-0"><Button icon={<Plug className="h-4 w-4" />}>Connecter OpenAI</Button></Link>
        </Card>
      )}

      <ImportTabsNav tab={tab} setTab={setTab} presetCount={importPresets.length} recentCount={recentImports.length} />

      <div className="ork-stagger space-y-5">
        {tab === "import" && (
          <>
        {/* ── Hero ── */}
        {phase === "idle" && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-1">
                <button onClick={() => setSource("csv")} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 ease-out ${source === "csv" ? "bg-[var(--card)] text-brand-700 shadow-sm dark:text-brand-300" : "text-[var(--text-muted)] hover:text-[var(--text)]"}`}><FileSpreadsheet className="h-4 w-4" /> Importer un CSV</button>
                <button onClick={() => setSource("manual")} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 ease-out ${source === "manual" ? "bg-[var(--card)] text-brand-700 shadow-sm dark:text-brand-300" : "text-[var(--text-muted)] hover:text-[var(--text)]"}`}><Plus className="h-4 w-4" /> Produit manuel</button>
              </div>
              <span className="text-[11px] text-[var(--text-muted)]">Bientôt : URL produit · XLSX</span>
            </div>

            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = ""; }} />

            {source === "csv" ? (
              <>
                <Card className="ork-rise overflow-hidden border-brand-200 bg-gradient-to-br from-brand-50 to-transparent dark:border-brand-900 dark:from-brand-950/40">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-4">
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-600 text-white"><Boxes className="h-6 w-6" /></span>
                      <div>
                        <h2 className="text-base font-bold">Importez votre catalogue</h2>
                        <p className="mt-1 max-w-xl text-sm text-[var(--text-muted)]">CSV fournisseur, ancienne boutique, concurrent ou export Shopify : Orkestra nettoie, traduit, optimise et prépare un fichier prêt à réimporter — sans casser vos variantes ni vos images.</p>
                        <div className="mt-3"><Pipeline /></div>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2">
                      <Button className="ork-glow" onClick={() => fileRef.current?.click()} icon={<Upload className="h-4 w-4" />}>Importer un CSV</Button>
                      <Button variant="outline" size="sm" onClick={() => setShowExample((v) => !v)} icon={<Eye className="h-3.5 w-3.5" />}>Voir un exemple</Button>
                    </div>
                  </div>
                </Card>

                {showExample && <ExampleCard />}

                {/* §6 — « Ce que fait Orkestra » : bloc discret et compact */}
                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-400">Ce que fait Orkestra</div>
                  <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                    {VALUE.map((v) => { const I = v.icon; return (
                      <div key={v.t} className="flex items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2">
                        <I className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                        <div className="min-w-0"><div className="text-xs font-semibold">{v.t}</div><div className="text-[11px] text-[var(--text-muted)]">{v.d}</div></div>
                      </div>
                    ); })}
                  </div>
                </div>

                <Card>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) readFile(f); }}
                    onClick={() => fileRef.current?.click()}
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition ${dragOver ? "border-brand-500 bg-brand-50/60 dark:bg-brand-950/30" : "border-[var(--border)] hover:border-brand-300"}`}
                  >
                    <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300"><Upload className="h-7 w-7" /></span>
                    <h3 className="mt-4 text-sm font-semibold">Glissez-déposez votre CSV ici</h3>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">ou cliquez pour choisir un fichier · format CSV · export Shopify ou CSV fournisseur</p>
                    <Button className="mt-4" size="sm" icon={<FileSpreadsheet className="h-3.5 w-3.5" />}>Choisir un fichier</Button>
                    {parseError && <p className="mt-3 text-xs text-red-500">{parseError}</p>}
                  </div>
                  {recentImports.length > 0 && (
                    <button onClick={(e) => { e.stopPropagation(); setTab("recent"); }} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
                      <RefreshCw className="h-3.5 w-3.5" /> Reprendre un import récent
                    </button>
                  )}
                </Card>
              </>
            ) : (
              <ManualForm manual={manual} setManual={setManual} optionName={optionName} setOptionName={setOptionName} variants={variants} setVariants={setVariants} onContinue={onContinueManual} error={error} />
            )}
          </>
        )}

        {/* ── Configuration (fichier détecté + preset + questionnaire) ── */}
        {(phase === "configure" || phase === "working") && parsed && stats && (
          <div ref={configRef} className="space-y-5">
            {/* Résumé fichier */}
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50"><FileSpreadsheet className="h-5 w-5" /></span>
                  <div>
                    <div className="text-sm font-semibold">{fileInfo?.name}</div>
                    <div className="text-xs text-[var(--text-muted)]">{fileInfo?.sizeKb} Ko · {parsed.rows.length} lignes · {isShopify ? "export Shopify détecté" : "CSV générique — mapping manuel recommandé"}</div>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={reset} icon={<X className="h-3.5 w-3.5" />}>{source === "manual" ? "Modifier le produit" : "Changer de fichier"}</Button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat icon={Boxes} label="Produits" value={stats.products} />
                <Stat icon={Layers} label="Variantes" value={stats.variants} />
                <Stat icon={ImageIcon} label="Images" value={stats.images} />
                <Stat icon={FileText} label="Colonnes" value={parsed.headers.length} />
              </div>
            </Card>

            {/* Mapping des colonnes */}
            <Card>
              <button onClick={() => setMapOpen((v) => !v)} className="flex w-full items-center justify-between gap-2 text-left">
                <span className="flex items-center gap-1.5 text-sm font-bold"><Columns3 className="h-4 w-4 text-brand-600" /> Mapping des colonnes {!isShopify && <Badge tone="warn">à vérifier</Badge>}</span>
                <ChevronDown className={`h-4 w-4 text-[var(--text-muted)] transition ${mapOpen ? "rotate-180" : ""}`} />
              </button>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Dites à Orkestra quelle colonne de votre CSV correspond à quoi. {isShopify ? "Détecté automatiquement — ajustez si besoin." : "Votre CSV n'est pas un export Shopify : vérifiez le mapping ci-dessous."}</p>
              {mapOpen && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {MAP_TARGETS.map((t) => (
                    <div key={t.field}>
                      <div className="mb-1 flex items-center gap-1 text-[11px] font-medium">{t.label}{t.required && <span className="text-red-500">*</span>}{mapping[t.field] !== undefined && <Check className="h-3 w-3 text-emerald-500" />}</div>
                      <select value={mapping[t.field] ?? -1} onChange={(e) => setMap(t.field, e.target.value === "-1" ? null : Number(e.target.value))} className={`input h-9 py-0 text-xs ${t.required && mapping[t.field] === undefined ? "border-red-300" : ""}`}>
                        <option value={-1}>— (ignorer)</option>
                        {parsed.headers.map((h, i) => <option key={i} value={i}>{h || `Colonne ${i + 1}`}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[var(--border)] pt-3">
                <span className="text-[11px] font-medium text-[var(--text-muted)]">Colonnes utilisées :</span>
                {stats.used.map((u) => <Badge key={u.field} tone="neutral">{u.label} ← {u.header || "?"}</Badge>)}
              </div>
              {stats.ignored.length > 0 && <div className="mt-1.5 text-[11px] text-[var(--text-muted)]"><span className="font-medium">Ignorées :</span> {stats.ignored.slice(0, 12).join(", ")}{stats.ignored.length > 12 ? "…" : ""}</div>}
              {stats.warnings.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {stats.warnings.map((w, i) => <div key={i} className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800 dark:bg-amber-950/30 dark:text-amber-200"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {w}</div>)}
                </div>
              )}
            </Card>

            {/* Reprendre les règles du dernier import (par profil) */}
            {mem.lastRules && phase === "configure" && (
              <Card className="flex flex-col items-start gap-3 border-brand-200 bg-brand-50/50 dark:border-brand-900 dark:bg-brand-950/30 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-sm"><RefreshCw className="h-4 w-4 text-brand-600" /> Reprendre les règles du dernier import sur ce profil ? <span className="text-xs text-[var(--text-muted)]">({mem.transformedCount} produits déjà traités)</span></div>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => { const lr = mem.lastRules!; setRules({ ...lr }); setCollectionsText(lr.collectionsUrls?.length ? colsToText(lr.collectionsUrls) : lr.collections.join("\n")); }}>Reprendre les mêmes règles</Button>
                  <Button size="sm" variant="ghost" onClick={() => applyPreset("migration")}>Repartir d&apos;un preset</Button>
                </div>
              </Card>
            )}

            {/* Boutique cible + réglages privés (locaux) + mémoire du profil */}
            <Card>
              <div className="mb-1 flex items-center gap-1.5 text-sm font-bold"><Store className="h-4 w-4 text-brand-600" /> Boutique cible</div>
              <p className="mb-3 text-xs text-[var(--text-muted)]">Profil = comportement (noms brandés, format de titre, style). Vos infos privées (marque, suffixe, collections) restent <strong>locales</strong> et ne sont injectées dans l&apos;IA que si vous les saisissez.</p>
              <div className="ork-stagger grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {[...PROFILES, CUSTOM_PROFILE].map((p) => {
                  const on = selectedProfileId === p.id;
                  return (
                    <button key={p.id} onClick={() => selectProfile(p.id)} className={`ork-interactive flex flex-col rounded-xl border p-3 text-left hover:border-brand-300 ${on ? "border-brand-500 bg-brand-50 dark:bg-brand-950" : "border-[var(--border)]"}`}>
                      <div className="flex items-center justify-between"><span className="text-xs font-semibold">{p.label}</span>{on && <Check className="h-3.5 w-3.5 text-brand-600" />}</div>
                      <p className="mt-1 text-[10px] leading-tight text-[var(--text-muted)]">{p.id === "custom" ? "Vos propres règles." : `${p.niche.split("&")[0].trim()} · ${p.brandNames ? "noms brandés" : "sans nom brandé"}`}</p>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="Nom de marque / vendor" icon={Store}><input className="input h-9 py-0 text-xs" value={mem.brand} onChange={(e) => setBrandConfig(e.target.value)} placeholder="Ex : nom de marque" /></Field>
                <Field label="Suffixe meta (fin de meta description)"><input className="input h-9 py-0 text-xs" value={mem.metaSuffix} onChange={(e) => setMetaSuffixConfig(e.target.value)} placeholder="Ex : ✓ Livraison gratuite." /></Field>
              </div>
              <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-semibold"><Database className="h-3.5 w-3.5 text-brand-600" /> Mémoire du profil — {profile.label}</span>
                  <button onClick={() => resetProfileMemory(selectedProfileId)} className="text-[11px] text-[var(--text-muted)] transition hover:text-red-500">Réinitialiser</button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge tone="neutral">{mem.brandNames.length} noms brandés</Badge>
                  <Badge tone="neutral">{mem.handles.length} handles</Badge>
                  <Badge tone="neutral">{mem.anchors.length} ancres</Badge>
                  <Badge tone="neutral">{mem.transformedCount} produits</Badge>
                  {mem.lastImportAt && <Badge tone="neutral">dernier : {relativeDate(mem.lastImportAt)}</Badge>}
                  {mem.forbiddenTerms.length + mem.forbiddenDomains.length > 0 && <Badge tone="warn">{mem.forbiddenTerms.length + mem.forbiddenDomains.length} termes interdits</Badge>}
                </div>
                <ForbiddenAdder onAdd={(type, v) => addForbidden(selectedProfileId, type === "term" ? { term: v } : { domain: v })} />
              </div>
            </Card>

            {/* Presets */}
            <Card>
              <div className="mb-1 flex items-center gap-1.5 text-sm font-bold"><Wand2 className="h-4 w-4 text-brand-600" /> Choisissez un preset de transformation</div>
              <p className="mb-3 text-xs text-[var(--text-muted)]">Un point de départ ; ajustez ensuite les règles ci-dessous.</p>
              <div className="ork-stagger grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {PRESETS.map((p) => {
                  const on = presetId === p.id;
                  return (
                    <button key={p.id} onClick={() => applyPreset(p.id)} className={`ork-interactive flex flex-col rounded-xl border p-3 text-left hover:border-brand-300 ${on ? "border-brand-500 bg-brand-50 dark:bg-brand-950" : "border-[var(--border)]"}`}>
                      <div className="flex items-center justify-between"><span className="text-xs font-semibold">{p.label}</span>{on && <Check className="h-3.5 w-3.5 text-brand-600" />}</div>
                      <p className="mt-1 text-[10px] leading-tight text-[var(--text-muted)]">{p.desc}</p>
                    </button>
                  );
                })}
              </div>
            </Card>

            {/* Questionnaire */}
            <Card>
              <div className="mb-3 flex items-center gap-1.5 text-sm font-bold"><ListChecks className="h-4 w-4 text-brand-600" /> Règles de transformation</div>

              {/* A. Langue & marché */}
              <div className="space-y-3">
                <Field label="Langue cible" icon={Globe}><Seg value={rules.language} options={LANGS} onChange={(v) => updateRule({ language: v })} /></Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Pays cible"><Seg value={rules.country} options={COUNTRIES} onChange={(v) => updateRule({ country: v })} /></Field>
                  <Field label="Ton"><Seg value={rules.tone} options={TONES} onChange={(v) => updateRule({ tone: v })} /></Field>
                </div>
                <div>
                  <div className="mb-1 text-sm font-semibold">Que voulez-vous faire avec ce catalogue ?</div>
                  <p className="mb-2 text-xs text-[var(--text-muted)]">Choisissez le niveau de modification. Orkestra conserve les données sensibles (variantes, prix, SKU, stocks, images).</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {TRANSFORMS.map((t) => {
                      const on = rules.transform === t.v;
                      return (
                        <button key={t.v} onClick={() => updateRule({ transform: t.v })} className={`ork-interactive flex flex-col rounded-xl border p-3 text-left hover:border-brand-300 ${on ? "border-brand-500 bg-brand-50 dark:bg-brand-950" : "border-[var(--border)]"}`}>
                          <div className="flex items-center justify-between gap-1"><span className="text-xs font-semibold">{t.l}</span>{on && <Check className="h-3.5 w-3.5 shrink-0 text-brand-600" />}</div>
                          <p className="mt-1 text-[10px] leading-tight text-[var(--text-muted)]">{t.sub}</p>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
                      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-brand-700 dark:text-brand-300"><Wand2 className="h-3.5 w-3.5" /> Ce mode va modifier</div>
                      <div className="flex flex-wrap gap-1">{MODE_MODIFIES[rules.transform].map((m) => <span key={m} className="rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] text-brand-700 dark:bg-brand-950 dark:text-brand-300">{m}</span>)}</div>
                    </div>
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/20">
                      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300"><ShieldCheck className="h-3.5 w-3.5" /> Ne touchera jamais</div>
                      <div className="flex flex-wrap gap-1">{MODE_PRESERVES.map((m) => <span key={m} className="rounded-md bg-emerald-100/70 px-1.5 py-0.5 text-[10px] text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">{m}</span>)}</div>
                    </div>
                  </div>
                </div>
              </div>

              <Section title="Titres & noms brandés" icon={TypeIcon} defaultOpen>
                <Field label="Style de titre"><Seg value={TITLES.find((t) => t.v === rules.titleStyle)!.l} options={TITLES.map((t) => t.l)} onChange={(l) => updateRule({ titleStyle: TITLES.find((t) => t.l === l)!.v })} /></Field>
                <Toggle label="Générer des noms brandés uniques" hint="Ex : « Nom du produit | Marque » — jamais deux fois le même nom." checked={rules.brandNames} onChange={(v) => updateRule({ brandNames: v })} />
                {rules.brandNames && <Field label="Style de nom brandé"><Seg value={rules.brandNameStyle} options={BRAND_STYLES} onChange={(v) => updateRule({ brandNameStyle: v })} /></Field>}
                <p className="rounded-lg bg-[var(--bg)] px-3 py-2 text-[11px] text-[var(--text-muted)]">Règle : ne jamais inventer de caractéristique (LED, télécommande…), éviter les superlatifs, titres adaptés Shopify / Google Merchant.</p>
              </Section>

              <Section title="Description & contenu" icon={FileText}>
                <Field label="Niveau de description"><Seg value={DESC_LEVELS.find((d) => d.v === rules.description)!.l} options={DESC_LEVELS.map((d) => d.l)} onChange={(l) => updateRule({ description: DESC_LEVELS.find((d) => d.l === l)!.v })} /></Field>
                <Field label="Éléments à inclure">
                  <div className="flex flex-wrap gap-1.5">{DESC_PARTS.map((p) => { const on = rules.descriptionParts.includes(p.v); return <button key={p.v} onClick={() => updateRule({ descriptionParts: on ? rules.descriptionParts.filter((x) => x !== p.v) : [...rules.descriptionParts, p.v] })} className={`rounded-lg border px-2.5 py-1 text-xs transition ${on ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300" : "border-[var(--border)] text-[var(--text-muted)]"}`}>{p.l}</button>; })}</div>
                </Field>
                <Toggle label="Convertir les pouces en cm" hint="Garde les tailles de variantes, ajoute la conversion si pertinent." checked={rules.convertUnits} onChange={(v) => updateRule({ convertUnits: v })} />
              </Section>

              <Section title="Collections & maillage interne" icon={Link2}>
                <Field label="Vos collections (une par ligne, pour le maillage)">
                  <textarea className="input min-h-[80px] font-mono text-xs" value={collectionsText} onChange={(e) => syncCollections(e.target.value)} placeholder={"Collection principale | https://votreboutique.com/collections/principale\nNouveautés\nBest-sellers"} />
                </Field>
                <Toggle label="Ajouter un maillage interne dans les descriptions" hint="Ancres naturelles et variées, sans répéter toujours les mêmes." checked={rules.internalLinking} onChange={(v) => updateRule({ internalLinking: v })} />
              </Section>

              <Section title="SEO & images" icon={Tag}>
                <Toggle label="Générer meta title + meta description" checked={rules.meta} onChange={(v) => updateRule({ meta: v })} />
                <Toggle label="Générer les alt text des images" hint="Même nom produit sur toutes les images, différencié par la vue." checked={rules.altText} onChange={(v) => updateRule({ altText: v })} />
                <Toggle label="Proposer tags + product_type" checked={rules.tagsType} onChange={(v) => updateRule({ tagsType: v })} />
              </Section>

              <Section title="Handles & niveau d'intervention" icon={Layers}>
                <Field label="Handles (URL produit)"><Seg value={HANDLES.find((h) => h.v === rules.handleMode)!.l} options={HANDLES.map((h) => h.l)} onChange={(l) => updateRule({ handleMode: HANDLES.find((h) => h.l === l)!.v })} /></Field>
                {rules.handleMode !== "keep" && <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:bg-amber-950/30 dark:text-amber-200"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Changer les handles peut casser certaines associations ou URLs existantes selon votre import.</p>}
                <Field label="Niveau"><Seg value={rules.level} options={LEVELS} onChange={(v) => updateRule({ level: v as Level })} /></Field>
              </Section>
            </Card>

            {error && <Card className="flex items-start gap-2 border-red-200 text-sm text-red-600 dark:border-red-900/60"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}</Card>}

            {/* Transformer */}
            {/* §1 — Limite 50 produits : message + sélection */}
            {phase === "configure" && tooMany && (
              <Card className="border-amber-200 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/20">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-500 text-white"><ListFilter className="h-[18px] w-[18px]" /></span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold">Votre fichier contient {groups.length} produits</h3>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">Pour garantir une qualité optimale, Import Factory traite jusqu&apos;à <strong>{MAX_PRODUCTS} produits par import</strong> en V1. Sélectionnez les produits à traiter ou découpez votre catalogue en plusieurs imports.</p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <Button size="sm" variant={!selectedHandles ? "secondary" : "outline"} onClick={() => { setSelectedHandles(null); setSelectOpen(false); }}>Traiter les {MAX_PRODUCTS} premiers</Button>
                      <Button size="sm" variant="outline" icon={<ListChecks className="h-3.5 w-3.5" />} onClick={() => { if (!selectedHandles) setSelectedHandles(groups.slice(0, MAX_PRODUCTS).map((g) => g.handle)); setSelectOpen((v) => !v); }}>Sélectionner les produits</Button>
                      <Button size="sm" variant="ghost" onClick={reset}>Annuler</Button>
                    </div>
                    {selectOpen && (
                      <div className="mt-3">
                        <div className="mb-1.5 text-[11px] font-semibold text-amber-800 dark:text-amber-200">{selectedHandles?.length ?? 0} / {MAX_PRODUCTS} sélectionné(s)</div>
                        <div className="max-h-64 space-y-0.5 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--card)] p-2">
                          {groups.map((g) => {
                            const checked = selectedHandles?.includes(g.handle) ?? false;
                            const full = (selectedHandles?.length ?? 0) >= MAX_PRODUCTS;
                            return (
                              <label key={g.handle} className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs ${checked ? "bg-brand-50 dark:bg-brand-950/30" : ""} ${!checked && full ? "opacity-40" : ""}`}>
                                <input type="checkbox" checked={checked} disabled={!checked && full} onChange={() => toggleSelected(g.handle)} className="accent-brand-600" />
                                <span className="truncate">{g.title || g.handle}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )}

            {phase === "configure" && (
              <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
                <div className="space-y-1.5">
                  <p className="text-xs text-[var(--text-muted)]">{!openaiConnected ? "Connectez OpenAI pour lancer la transformation IA." : stats.hasTitle ? `${selectedForTransform().length} produit(s) seront transformés via OpenAI. Vous validez l'aperçu avant l'export.` : "Mappez d'abord la colonne « Titre produit » pour activer la transformation."}</p>
                  {openaiConnected && stats.hasTitle && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-[var(--bg)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]" title="Orkestra choisit les modèles selon le niveau. Claude n'intervient que s'il est connecté.">
                      <Sparkles className="h-3 w-3 text-brand-500" /> {modelPlan.badge}{modelPlan.wantsEditorial && !modelPlan.editorial ? " (Claude bientôt)" : ""}
                    </span>
                  )}
                  {openaiConnected && stats.hasTitle && rules.level === "ultra complet" && !modelPlan.editorial && (
                    <p className="text-[11px] text-[var(--text-muted)]">Claude peut améliorer la relecture premium des descriptions Ultra.</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSavePresetOpen(true)} icon={<Star className="h-3.5 w-3.5" />}>Sauvegarder ces réglages</Button>
                  {openaiConnected ? (
                    <Button className="ork-glow" size="lg" onClick={() => transform()} disabled={!stats.hasTitle} icon={<Wand2 className="h-4 w-4" />}>{source === "manual" ? "Transformer ce produit" : `Transformer ${selectedForTransform().length} produit(s)`}</Button>
                  ) : (
                    <Link href="/connect"><Button size="lg" icon={<Plug className="h-4 w-4" />}>Connecter OpenAI pour transformer</Button></Link>
                  )}
                </div>
              </div>
            )}

            {/* Working */}
            {phase === "working" && <Working list={workingList} status={productStatus} elapsed={elapsed} step={procStep} badge={modelPlan.badge} ultra={rules.level === "ultra complet"} />}
          </div>
        )}

        {/* ── Aperçu avant export ── */}
        {phase === "preview" && results && (
          <div ref={previewRef} className="space-y-5">
            {erroredHandles.length > 0 && (
              <Card className="flex flex-col gap-3 border-red-200 bg-red-50/60 dark:border-red-900/60 dark:bg-red-950/20 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-red-500 text-white"><AlertTriangle className="h-[18px] w-[18px]" /></span>
                  <div>
                    <h3 className="text-sm font-semibold">{erroredHandles.length} produit(s) en erreur</h3>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">Les autres produits sont prêts. Relancez uniquement les produits en erreur — les résultats déjà générés sont conservés.</p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button size="sm" onClick={retryErrors} icon={<RefreshCw className="h-3.5 w-3.5" />}>Relancer les produits en erreur</Button>
                  <Button size="sm" variant="outline" onClick={() => exportCsv(true)} icon={<Download className="h-3.5 w-3.5" />}>Exporter les produits traités</Button>
                </div>
              </Card>
            )}
            {/* §7 — Bloc résultat unique : verdict + action principale + « Plus d'actions » */}
            <Card className={`ork-rise ${verdict?.status === "ready" ? "border-emerald-200 bg-emerald-50/30 dark:border-emerald-900/60 dark:bg-emerald-950/15" : verdict?.status === "risky" ? "border-amber-200 bg-amber-50/30 dark:border-amber-900/60 dark:bg-amber-950/15" : "border-brand-200 bg-gradient-to-br from-brand-50 to-transparent dark:border-brand-900 dark:from-brand-950/40"}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2 className="flex items-center gap-1.5 text-base font-bold">{verdict?.status === "ready" || verdict?.status === "verify" ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertTriangle className="h-5 w-5 text-amber-500" />} {verdict?.status === "ready" ? "Catalogue prêt à télécharger" : verdict?.status === "partial" ? "Catalogue prêt (export partiel)" : verdict?.status === "risky" ? "Correction requise avant export complet" : "Catalogue prêt avec vérifications recommandées"}</h2>
                  <p className="mt-0.5 text-sm text-[var(--text-muted)]">{results.length} produit(s) transformé(s) · {applied?.stats.variants ?? 0} variante(s) conservée(s) · {applied?.stats.images ?? 0} image(s) préservée(s){qcCounts.warning + qcCounts.risk + qcCounts.failed > 0 ? ` · ${qcCounts.warning + qcCounts.risk + qcCounts.failed} vérification(s) recommandée(s)` : ""}.</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Badge tone="good">{qcCounts.ok} prêt(s)</Badge>
                    {qcCounts.warning > 0 && <Badge tone="warn">{qcCounts.warning} à améliorer</Badge>}
                    {qcCounts.risk > 0 && <Badge tone="warn">{qcCounts.risk} à vérifier</Badge>}
                    {qcCounts.failed > 0 && <Badge tone="bad">{qcCounts.failed} à corriger</Badge>}
                    {editorialApplied && <Badge tone="brand"><Sparkles className="h-3 w-3" /> Relecture premium appliquée</Badge>}
                  </div>
                  {naming && <div className="mt-1 text-[11px] text-[var(--text-muted)]">{naming.titles} noms vérifiés{naming.brandNames > 0 ? ` · ${naming.brandNames} nom(s) brandé(s)` : ""} · {naming.titlesClose + naming.brandDups + naming.handleDups} doublon(s) évité(s) · relecture qualité appliquée.</div>}
                </div>
                <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                  <Button className="ork-glow" onClick={() => exportCsv()} icon={<Download className="h-4 w-4" />}>Télécharger le CSV Shopify</Button>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    {qcCounts.warning + qcCounts.risk > 0 && <Button variant="outline" size="sm" onClick={autoFixWarnings} icon={<Wand2 className="h-3.5 w-3.5" />} title="Corrige : suffixes meta, accents, emojis, options anglaises, pouces→cm, collections anglaises, alt sans image, doublons simples.">Corriger automatiquement</Button>}
                    {qcCounts.warning + qcCounts.risk + qcCounts.failed > 0 && <Button variant="ghost" size="sm" onClick={() => { setFilter("verify"); setTimeout(scrollToFirstIssue, 40); }} icon={<ListFilter className="h-3.5 w-3.5" />}>Voir les vérifications</Button>}
                    <Button variant="ghost" size="sm" onClick={() => setMoreActionsOpen((v) => !v)} icon={<ChevronDown className="h-3.5 w-3.5" />}>Plus d'actions</Button>
                  </div>
                </div>
              </div>
              {moreActionsOpen && (
                <div className="ork-fade mt-3 flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
                  <Button variant="outline" size="sm" onClick={exportReport} icon={<FileText className="h-3.5 w-3.5" />}>Rapport qualité</Button>
                  <Button variant="ghost" size="sm" onClick={exportIssues} icon={<AlertTriangle className="h-3.5 w-3.5" />}>Export « à vérifier »</Button>
                  <Link href={councilReviewLink()}><Button variant="ghost" size="sm" icon={<MessagesSquare className="h-3.5 w-3.5" />}>Faire vérifier par AI Council</Button></Link>
                  <Link href="/merchant"><Button variant="ghost" size="sm" icon={<ShieldCheck className="h-3.5 w-3.5" />}>Relancer Merchant Shield</Button></Link>
                  <Button variant="ghost" size="sm" onClick={reset} icon={<Upload className="h-3.5 w-3.5" />}>Nouvel import</Button>
                  {claudeConnected && <Button variant="ghost" size="sm" onClick={() => perfectWithClaude()} disabled={perfecting} icon={<Sparkles className="h-3.5 w-3.5" />}>{perfecting ? "Relecture…" : "Relecture Claude ciblée"}</Button>}
                  {claudeConnected && CLAUDE_SCOPES.slice(1).map((s) => <button key={s.id} onClick={() => runClaudeScope(s)} disabled={perfecting} className="rounded-full border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-muted)] transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-50 dark:hover:text-brand-300">{s.label}</button>)}
                  {!claudeConnected && <span className="self-center text-[11px] text-[var(--text-muted)]">Connectez Claude pour la relecture premium.</span>}
                </div>
              )}
            </Card>

            {/* Contrôle qualité export Shopify */}
            {applied && (
              <Card>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-sm font-bold"><ShieldCheck className="h-4 w-4 text-brand-600" /> Contrôle qualité export Shopify</span>
                  <Badge tone={QC_TONE[applied.status]}>{QC_LABEL[applied.status]}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Stat icon={Boxes} label="Produits" value={applied.stats.products} />
                  <Stat icon={Layers} label="Variantes" value={applied.stats.variants} />
                  <Stat icon={ImageIcon} label="Images" value={applied.stats.images} />
                  <Stat icon={Columns3} label="Colonnes" value={applied.headers.length} />
                </div>
                <div className="mt-3 space-y-1.5">
                  {applied.checks.map((c, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-[11px]">
                      {c.status === "ok" ? <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" /> : <AlertTriangle className={`mt-0.5 h-3 w-3 shrink-0 ${c.status === "warning" ? "text-amber-500" : "text-red-500"}`} />}
                      <span className={c.status === "ok" ? "text-[var(--text-muted)]" : ""}><span className="font-medium">{c.label}</span>{c.detail ? ` — ${c.detail}` : ""}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[var(--border)] pt-3 text-[11px]">
                  {applied.stats.added.length > 0 && <Badge tone="brand">+{applied.stats.added.length} colonne(s) ajoutée(s)</Badge>}
                  {applied.stats.cleared.length > 0 && <Badge tone="warn">{applied.stats.cleared.length} vidée(s) (sécurité)</Badge>}
                  <span className="text-[var(--text-muted)]">Variantes, prix, SKU, images et positions préservés ; lignes images non transformées en produits.</span>
                </div>
                {applied.status === "failed" && (
                  <div className="mt-3 flex flex-col gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300 sm:flex-row sm:items-center sm:justify-between">
                    <span className="flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Erreur(s) critique(s) export — corrigez ou confirmez explicitement.</span>
                    <Button size="sm" variant="danger" onClick={() => { setConfirmExport(true); downloadCsv(`orkestra-import-${Date.now()}.csv`, serializeCsv(applied.headers, applied.rows)); }}>Exporter quand même</Button>
                  </div>
                )}
              </Card>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Link href={councilLink("seo", "Contexte : Import Factory a transformé un catalogue produit (titres, descriptions, meta, alt, tags). Réponds uniquement : vérifie ce qui est risqué ou faible (titres trop agressifs, claims, descriptions pauvres, meta) et propose des corrections, sans refaire d'audit complet.")}><Button variant="secondary" size="sm" icon={<Sparkles className="h-3.5 w-3.5" />}>Faire vérifier par AI Council</Button></Link>
              <Link href={assistantLink("Où importer un fichier CSV de produits dans Shopify, et quelles précautions prendre (variantes, collections, test sur petit lot) ?")}><Button variant="outline" size="sm" icon={<ArrowRight className="h-3.5 w-3.5" />}>Où importer ce CSV dans Shopify ?</Button></Link>
              <Link href="/merchant"><Button variant="ghost" size="sm" icon={<ShieldCheck className="h-3.5 w-3.5" />}>Relancer Merchant Shield après import</Button></Link>
              <Button variant="ghost" size="sm" onClick={reset} icon={<Upload className="h-3.5 w-3.5" />}>Nouvel import</Button>
            </div>

            {/* §6 — Résumé du correcteur automatique */}
            {autoFixSummary && (
              <div className="ork-fade rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs">
                <span className="font-semibold text-[var(--text)]">{autoFixSummary.fixed} correction(s) appliquée(s)</span> · {autoFixSummary.improved} produit(s) amélioré(s) · {autoFixSummary.remaining} point(s) restant(s).
                {autoFixSummary.remaining > 0 && <button onClick={() => { setFilter("verify"); setTimeout(scrollToFirstIssue, 40); }} className="ml-2 font-medium text-brand-600 hover:underline">Voir les problèmes restants</button>}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <BatchRules onApply={applyBatchRule} matchCount={batchMatchCount} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-sm font-bold"><ListChecks className="h-4 w-4 text-brand-600" /> Diff avant / après ({visibleResults.length}{filter !== "all" ? `/${results.length}` : ""})</span>
              <div className="flex flex-wrap items-center gap-2">
                {qcCounts.warning + qcCounts.risk > 0 && (
                  <Button variant="ghost" size="sm" icon={<Wand2 className="h-3.5 w-3.5" />} onClick={autoFixWarnings}>Corriger automatiquement</Button>
                )}
                <Button variant="outline" size="sm" icon={<CheckCheck className="h-3.5 w-3.5" />} onClick={onApproveAllClick}>Tout approuver</Button>
              </div>
            </div>

            {/* §5 — Filtre « À corriger » */}
            {results.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {([
                  ["all", "Tous", results.length],
                  ["verify", "À vérifier", qcCounts.warning + qcCounts.risk],
                  ["ready", "Prêts", (results || []).filter((r) => scores[r.handle]?.status === "ready" && (qcReports[r.handle]?.status ?? "ok") === "ok").length],
                  ["risk", "Risqués", qcCounts.risk + qcCounts.failed],
                  ["error", "Erreurs", erroredHandles.length],
                ] as const).filter(([id, , n]) => id === "all" || n > 0).map(([id, label, n]) => (
                  <button key={id} onClick={() => setFilter(id)} className={`rounded-full px-2.5 py-1 font-medium transition ${filter === id ? "bg-brand-600 text-white" : "bg-[var(--bg)] text-[var(--text-muted)] hover:text-[var(--text)]"}`}>{label} ({n})</button>
                ))}
              </div>
            )}

            {approvePanel && (
              <div className="ork-rise rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3.5 text-sm">
                <div className="font-semibold">Comment voulez-vous approuver ?</div>
                <p className="mt-1 text-[var(--text-muted)]">
                  {qcCounts.ok} produit(s) prêt(s) à publier
                  {qcCounts.warning > 0 && ` · ${qcCounts.warning} à améliorer`}
                  {qcCounts.risk > 0 && ` · ${qcCounts.risk} à risque`}
                  {qcCounts.failed > 0 && ` · ${qcCounts.failed} bloqué(s) (non approuvables)`}.
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <Button size="sm" icon={<Check className="h-3.5 w-3.5" />} onClick={() => approveByStatus(false)} disabled={qcCounts.ok === 0}>Approuver uniquement les OK ({qcCounts.ok})</Button>
                  {qcCounts.warning + qcCounts.risk > 0 && (
                    <Button size="sm" variant="outline" icon={<CheckCheck className="h-3.5 w-3.5" />} onClick={() => approveByStatus(true)}>Tout approuver avec warnings ({qcCounts.ok + qcCounts.warning + qcCounts.risk})</Button>
                  )}
                  {qcCounts.warning + qcCounts.risk + qcCounts.failed > 0 && (
                    <Button size="sm" variant="ghost" icon={<AlertTriangle className="h-3.5 w-3.5" />} onClick={scrollToFirstIssue}>Voir les problèmes</Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setApprovePanel(false)}>Annuler</Button>
                </div>
                {qcCounts.failed > 0 && <p className="mt-2 text-[11px] text-[var(--text-muted)]">Les produits bloqués ne sont jamais approuvés automatiquement : corrigez-les (régénérer / éditer) ou utilisez « Exporter quand même » en bas.</p>}
              </div>
            )}

            {visibleResults.length === 0 && (
              <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">Aucun produit dans ce filtre. <button onClick={() => setFilter("all")} className="font-medium text-brand-600 hover:underline">Voir tous les produits</button></div>
            )}
            <div className="ork-stagger space-y-3">
              {visibleResults.map((r) => {
                const g = groups.find((x) => x.handle === r.handle);
                const rep = qcReports[r.handle];
                const st: QCStatus = rep?.status ?? "ok";
                const sc = scores[r.handle];
                const isVal = validated.includes(r.handle);
                const isRej = rejected.includes(r.handle);
                const isLock = locked.includes(r.handle);
                const ed = edits[r.handle] || {};
                const collections = ed.collections ?? r.collections;
                const productType = ed.productType ?? r.productType;
                const newHandle = r.newHandle || g?.handle || "";
                const issuesText = (rep?.issues || []).join(" ").toLowerCase();
                return (
                  <Card key={r.handle} id={`qc-${r.handle}`} className={`ork-rise scroll-mt-24 ${isVal ? "border-emerald-200 dark:border-emerald-900/60" : isRej ? "border-red-200 opacity-70 dark:border-red-900/60" : ""}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] text-[var(--text-muted)] line-through">{g?.title || r.handle}</div>
                        <input disabled={isLock} value={ed.title ?? r.title} onChange={(e) => setEdits((prev) => ({ ...prev, [r.handle]: { ...prev[r.handle], title: e.target.value } }))} className="mt-0.5 w-full rounded-lg border border-transparent bg-transparent text-sm font-semibold outline-none transition focus:border-brand-300 focus:bg-[var(--bg)] focus:px-2 focus:py-1 disabled:opacity-60" />
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {isLock && <Lock className="h-3.5 w-3.5 text-[var(--text-muted)]" />}
                        {sc && <span title={sc.weak.length ? `Points faibles : ${sc.weak.join(", ")}` : "Fiche solide"}><Badge tone={sc.status === "ready" ? "good" : sc.status === "improve" ? "warn" : "bad"}>{sc.score}/100</Badge></span>}
                        <Badge tone={QC_TONE[st]}>{QC_LABEL[st]}</Badge>
                      </div>
                    </div>
                    {sc && sc.weak.length > 0 && <div className="mt-1 text-[11px] text-[var(--text-muted)]">À améliorer : {sc.weak.join(" · ")}</div>}
                    <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                      <Mini label="Handle" value={newHandle} />
                      <Mini label="product_type" value={productType} />
                      <Mini label="Meta title" value={r.metaTitle} />
                      {r.vendor && <Mini label="Vendor" value={r.vendor} />}
                      <Mini label="Meta description" value={r.metaDescription} full />
                      {collections.length > 0 && <Mini label="Collections" value={collections.join(", ")} />}
                      {r.tags && <Mini label="Tags" value={r.tags} />}
                    </div>
                    {r.imageAlts.length > 0 && (
                      <div className="mt-2"><div className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Alt text ({r.imageAlts.length})</div><div className="mt-1 flex flex-wrap gap-1">{r.imageAlts.slice(0, 4).map((a, i) => <span key={i} className="rounded bg-[var(--bg)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">{a}</span>)}{r.imageAlts.length > 4 && <span className="text-[10px] text-[var(--text-muted)]">+{r.imageAlts.length - 4}</span>}</div></div>
                    )}
                    {rep && rep.issues.length > 0 && <div className={`mt-2 flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] ${st === "failed" ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300" : "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200"}`}><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> <span>{rep.issues.slice(0, 3).join(" · ")}{rep.issues.length > 3 ? ` · +${rep.issues.length - 3}` : ""}</span></div>}
                    {/* §1 — actions visibles : Approuver · Régénérer · ⋯ */}
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-3">
                      <Button size="sm" variant={isVal ? "secondary" : "ghost"} icon={<Check className="h-3.5 w-3.5" />} onClick={() => { toggle(validated, setValidated, r.handle); setRejected((x) => x.filter((h) => h !== r.handle)); }}>{isVal ? "Approuvé" : "Approuver"}</Button>
                      <Button size="sm" variant="ghost" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => regenerateOne(r.handle)} disabled={isLock}>Régénérer</Button>
                      <button onClick={() => setCardMore((c) => (c.includes(r.handle) ? c.filter((h) => h !== r.handle) : [...c, r.handle]))} className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-ink-100 dark:hover:bg-ink-900" aria-label="Plus d'actions">⋯</button>
                    </div>
                    {cardMore.includes(r.handle) && (
                      <div className="ork-fade mt-2 flex flex-wrap items-center gap-1.5 border-t border-dashed border-[var(--border)] pt-2">
                        <Button size="sm" variant="ghost" icon={<X className="h-3.5 w-3.5" />} onClick={() => { toggle(rejected, setRejected, r.handle); setValidated((x) => x.filter((h) => h !== r.handle)); }}>{isRej ? "Rejeté" : "Rejeter"}</Button>
                        <Button size="sm" variant="ghost" icon={<Lock className="h-3.5 w-3.5" />} onClick={() => toggle(locked, setLocked, r.handle)}>{isLock ? "Déverrouiller" : "Verrouiller"}</Button>
                        {claudeConnected && <CouncilChip label="Perfectionner avec Claude" icon="claude" onClick={() => perfectWithClaude({ handles: [r.handle], focus: focusForIssues(issuesText) })} />}
                        {openaiConnected && <CouncilChip label="Demander à AI Council" onClick={() => askCouncil(/(meta|suffixe)/.test(issuesText) ? qMeta(r) : /(description|faq|bénéfices|dimensions|structure|formules)/.test(issuesText) ? qDesc(r) : qVerify(r))} />}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        )}
          </>
        )}

        {tab === "create" && <CreateProfileTab onSaved={() => setTab("presets")} onUseRules={onUseRules} profileId={selectedProfileId} />}
        {tab === "presets" && <PresetsTab onUseBuiltin={onUseBuiltin} onUsePreset={onUsePreset} />}
        {tab === "recent" && <RecentImportsTab onReuse={onReuse} setTab={setTab} />}
      </div>

      <SavePresetModal open={savePresetOpen} onClose={() => setSavePresetOpen(false)} onSave={saveCurrentAsPreset} />
    </>
  );
}

// ── Sous-composants ─────────────────────────────────────────────────────────
function ManualForm({ manual, setManual, optionName, setOptionName, variants, setVariants, onContinue, error }: {
  manual: ManualState; setManual: Dispatch<SetStateAction<ManualState>>;
  optionName: string; setOptionName: Dispatch<SetStateAction<string>>;
  variants: ManualVariant[]; setVariants: Dispatch<SetStateAction<ManualVariant[]>>;
  onContinue: () => void; error: string | null;
}) {
  const set = (k: keyof ManualState, v: string) => setManual((m) => ({ ...m, [k]: v }));
  const setVar = (i: number, k: keyof ManualVariant, v: string) => setVariants((vs) => vs.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return (
    <div className="ork-stagger space-y-5">
      <Card>
        <div className="mb-1 flex items-center gap-1.5 text-sm font-bold"><Plus className="h-4 w-4 text-brand-600" /> Ajouter un produit manuel</div>
        <p className="mb-3 text-xs text-[var(--text-muted)]">Collez les infos brutes d&apos;un produit — Orkestra en fait une fiche Shopify propre (mêmes profil, règles, mémoire, contrôle qualité et export que l&apos;import CSV). Rien n&apos;est inventé : ce qui manque reste prudent ou « à vérifier ».</p>
        <div className="space-y-3">
          <Field label="Titre source"><input className="input" value={manual.title} onChange={(e) => set("title", e.target.value)} placeholder="Ex : titre source du produit" /></Field>
          <Field label="Description source"><textarea className="input min-h-[80px]" value={manual.description} onChange={(e) => set("description", e.target.value)} placeholder="Collez la description fournisseur / source" /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Caractéristiques"><input className="input" value={manual.features} onChange={(e) => set("features", e.target.value)} placeholder="Ex : fonctions, options" /></Field>
            <Field label="Dimensions"><input className="input" value={manual.dimensions} onChange={(e) => set("dimensions", e.target.value)} placeholder="Ex : 40 × 35 cm" /></Field>
            <Field label="Matériaux"><input className="input" value={manual.materials} onChange={(e) => set("materials", e.target.value)} placeholder="Ex : coton, métal" /></Field>
            <Field label="Couleurs"><input className="input" value={manual.colors} onChange={(e) => set("colors", e.target.value)} placeholder="Ex : noir, blanc" /></Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Prix"><input className="input" value={manual.price} onChange={(e) => set("price", e.target.value)} placeholder="Ex : 29.90" /></Field>
            <Field label="SKU"><input className="input" value={manual.sku} onChange={(e) => set("sku", e.target.value)} placeholder="Ex : REF-001" /></Field>
            <Field label="product_type souhaité"><input className="input" value={manual.productType} onChange={(e) => set("productType", e.target.value)} placeholder="Ex : catégorie" /></Field>
          </div>
          <Field label="URLs images (une par ligne)"><textarea className="input min-h-[60px] font-mono text-xs" value={manual.images} onChange={(e) => set("images", e.target.value)} placeholder={"https://.../image-1.jpg\nhttps://.../image-2.jpg"} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Collection souhaitée"><input className="input" value={manual.collection} onChange={(e) => set("collection", e.target.value)} placeholder="Ex : collection principale" /></Field>
            <Field label="Tags existants"><input className="input" value={manual.tags} onChange={(e) => set("tags", e.target.value)} placeholder="Ex : tag1, tag2" /></Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="URL source (optionnelle)"><input className="input" value={manual.sourceUrl} onChange={(e) => set("sourceUrl", e.target.value)} placeholder="https://…" /></Field>
            <Field label="Notes internes (non publiées)"><input className="input" value={manual.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Contexte interne" /></Field>
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-1 flex items-center gap-1.5 text-sm font-bold"><Layers className="h-4 w-4 text-brand-600" /> Variantes <span className="text-[11px] font-normal text-[var(--text-muted)]">(optionnel)</span></div>
        <p className="mb-3 text-xs text-[var(--text-muted)]">Une option (ex : Taille ou Couleur) + ses valeurs. Laissez vide pour un produit sans variante.</p>
        <Field label="Nom de l'option"><input className="input h-9 py-0 text-sm" value={optionName} onChange={(e) => setOptionName(e.target.value)} placeholder="Ex : Taille / Couleur / Lot" /></Field>
        <div className="mt-2 space-y-2">
          {variants.map((v, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_repeat(3,minmax(0,0.8fr))_auto] sm:items-center">
              <input className="input h-9 py-0 text-xs" value={v.value} onChange={(e) => setVar(i, "value", e.target.value)} placeholder="Valeur (ex : M)" />
              <input className="input h-9 py-0 text-xs" value={v.price} onChange={(e) => setVar(i, "price", e.target.value)} placeholder="Prix" />
              <input className="input h-9 py-0 text-xs" value={v.sku} onChange={(e) => setVar(i, "sku", e.target.value)} placeholder="SKU" />
              <input className="input h-9 py-0 text-xs" value={v.stock} onChange={(e) => setVar(i, "stock", e.target.value)} placeholder="Stock" />
              <button onClick={() => setVariants((vs) => vs.filter((_, j) => j !== i))} className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] transition hover:text-red-500"><X className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
        <Button variant="ghost" size="sm" className="mt-2" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setVariants((vs) => [...vs, { value: "", price: "", sku: "", image: "", stock: "" }])}>Ajouter une variante</Button>
      </Card>

      {error && <Card className="flex items-start gap-2 border-red-200 text-sm text-red-600 dark:border-red-900/60"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}</Card>}

      <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
        <p className="text-xs text-[var(--text-muted)]">Étape suivante : choisir la boutique cible et les règles, puis transformer via OpenAI.</p>
        <Button size="lg" onClick={onContinue} disabled={!manual.title.trim()} icon={<ArrowRight className="h-4 w-4" />}>Continuer</Button>
      </div>
    </div>
  );
}
function ForbiddenAdder({ onAdd }: { onAdd: (type: "term" | "domain", v: string) => void }) {
  const [type, setType] = useState<"term" | "domain">("term");
  const [v, setV] = useState("");
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]"><Ban className="h-3 w-3" /> À supprimer du contenu :</span>
      <select className="input h-8 py-0 text-[11px]" value={type} onChange={(e) => setType(e.target.value as "term" | "domain")}><option value="term">Terme / marque</option><option value="domain">Domaine</option></select>
      <input className="input h-8 py-0 text-[11px]" value={v} onChange={(e) => setV(e.target.value)} placeholder={type === "domain" ? "ancien-domaine.com" : "ancien nom / marque"} />
      <Button size="sm" variant="ghost" icon={<Plus className="h-3.5 w-3.5" />} disabled={!v.trim()} onClick={() => { onAdd(type, v.trim()); setV(""); }}>Ajouter</Button>
    </div>
  );
}
function BatchRules({ onApply, matchCount }: { onApply: (kw: string, field: "collections" | "productType", value: string) => number; matchCount: (kw: string) => number }) {
  const [kw, setKw] = useState("");
  const [field, setField] = useState<"collections" | "productType">("collections");
  const [value, setValue] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const n = matchCount(kw);
  return (
    <Card>
      <div className="mb-1 flex items-center gap-1.5 text-sm font-bold"><ListFilter className="h-4 w-4 text-brand-600" /> Règles de lot</div>
      <p className="mb-3 text-xs text-[var(--text-muted)]">Corrigez une catégorie d&apos;un coup. Ex : tous les produits contenant « coton » → collection « Nouveautés ».</p>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-end">
        <div><div className="mb-1 text-[11px] font-medium">Produits contenant</div><input className="input h-9 py-0 text-xs" value={kw} onChange={(e) => { setKw(e.target.value); setDone(null); }} placeholder="mot-clé" /></div>
        <div><div className="mb-1 text-[11px] font-medium">Affecter à</div><select className="input h-9 py-0 text-xs" value={field} onChange={(e) => setField(e.target.value as "collections" | "productType")}><option value="collections">Collection</option><option value="productType">product_type</option></select></div>
        <div><div className="mb-1 text-[11px] font-medium">Valeur</div><input className="input h-9 py-0 text-xs" value={value} onChange={(e) => setValue(e.target.value)} placeholder={field === "collections" ? "Nouveautés" : "Catégorie"} /></div>
        <Button size="sm" disabled={!kw.trim() || !value.trim() || n === 0} onClick={() => { const c = onApply(kw, field, value); setDone(`${c} produit(s) modifié(s)`); }}>Appliquer{kw.trim() ? ` (${n})` : ""}</Button>
      </div>
      {done && <p className="mt-2 flex items-center gap-1 text-[11px] text-emerald-600"><Check className="h-3 w-3" /> {done}</p>}
    </Card>
  );
}
function Stat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
      <Icon className="h-5 w-5 text-brand-500" />
      <div><div className="text-lg font-bold leading-none">{value}</div><div className="mt-0.5 text-[11px] text-[var(--text-muted)]">{label}</div></div>
    </div>
  );
}
function Field({ label, icon: Icon, children }: { label: string; icon?: React.ElementType; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--text)]">{Icon && <Icon className="h-3.5 w-3.5 text-brand-500" />}{label}</div>
      {children}
    </div>
  );
}
function Seg({ value, options, onChange, valueLabel }: { value: string; options: string[]; onChange: (v: string) => void; valueLabel?: string }) {
  const current = valueLabel ?? value;
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => { const on = o === current; return <button key={o} onClick={() => onChange(o)} className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium capitalize transition ${on ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300" : "border-[var(--border)] text-[var(--text-muted)] hover:border-brand-300"}`}>{o}</button>; })}
    </div>
  );
}
function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} className="flex w-full items-start gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-2.5 text-left transition hover:border-brand-300">
      <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border transition ${checked ? "border-brand-600 bg-brand-600 text-white" : "border-[var(--border)]"}`}>{checked && <Check className="h-3 w-3" />}</span>
      <span className="min-w-0"><span className="text-xs font-medium">{label}</span>{hint && <span className="mt-0.5 block text-[11px] text-[var(--text-muted)]">{hint}</span>}</span>
    </button>
  );
}
function Section({ title, icon: Icon, defaultOpen, children }: { title: string; icon: React.ElementType; defaultOpen?: boolean; children: React.ReactNode }) {
  return (
    <details open={defaultOpen} className="group mt-3 rounded-xl border border-[var(--border)] [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer select-none items-center justify-between gap-2 px-3.5 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-1.5"><Icon className="h-4 w-4 text-brand-600" /> {title}</span>
        <ChevronDown className="h-4 w-4 text-[var(--text-muted)] transition group-open:rotate-180" />
      </summary>
      <div className="space-y-3 border-t border-[var(--border)] px-3.5 py-3">{children}</div>
    </details>
  );
}
function Mini({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={`rounded-lg bg-[var(--bg)] px-2.5 py-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">{label}</div>
      <div className="mt-0.5 break-words text-[var(--text)]">{value || <span className="text-[var(--text-muted)]">—</span>}</div>
    </div>
  );
}
// Petite pastille d'action ciblée (AI Council ou relecture Claude) par produit.
function CouncilChip({ label, onClick, icon = "council" }: { label: string; onClick: () => void; icon?: "council" | "claude" }) {
  return <button onClick={onClick} className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-muted)] transition hover:border-brand-300 hover:text-brand-700 dark:hover:text-brand-300">{icon === "claude" ? <Sparkles className="h-3 w-3 text-brand-500" /> : <MessagesSquare className="h-3 w-3" />} {label}</button>;
}

// Visualisation premium du pipeline : CSV → IA → QC → Shopify (§3).
function Pipeline() {
  const steps: { icon: typeof FileSpreadsheet; label: string }[] = [
    { icon: FileSpreadsheet, label: "CSV" }, { icon: Wand2, label: "IA" }, { icon: ShieldCheck, label: "QC" }, { icon: Download, label: "Shopify" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-[var(--text-muted)]">
      {steps.map((s, i) => { const I = s.icon; return (
        <span key={s.label} className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--card)] px-2 py-1 ring-1 ring-[var(--border)]"><I className="h-3 w-3 text-brand-600" /> {s.label}</span>
          {i < steps.length - 1 && <ArrowRight className="h-3 w-3 text-brand-400" />}
        </span>
      ); })}
    </div>
  );
}
function ProcIcon({ kind }: { kind: ProductStatus }) {
  const i = PSTATUS[kind].icon;
  if (i === "check") return <Check className="h-3.5 w-3.5 text-emerald-500" />;
  if (i === "spin") return <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-300 border-t-brand-600" />;
  if (i === "claude") return <Sparkles className="h-3.5 w-3.5 text-brand-500" />;
  if (i === "warn") return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />;
  if (i === "error") return <X className="h-3.5 w-3.5 text-red-500" />;
  return <span className="h-3.5 w-3.5 rounded-full border border-[var(--border)]" />;
}
function Working({ list, status, elapsed, step, badge, ultra }: { list: { handle: string; title: string }[]; status: Record<string, ProductStatus>; elapsed: number; step: string; badge: string; ultra: boolean }) {
  const total = list.length || 1;
  const done = list.filter((x) => ["done", "claude", "qc", "review", "error"].includes(status[x.handle])).length;
  const pct = Math.round((done / total) * 100);
  const eta = done > 0 && elapsed > 0 ? Math.round((elapsed / done) * (total - done)) : null;
  return (
    <Card className="ork-rise">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm font-semibold">
        <span className="flex items-center gap-1.5"><Wand2 className="h-4 w-4 animate-pulse text-brand-600" /> Transformation en cours…</span>
        <span className="text-xs text-[var(--text-muted)]">Produit {Math.min(total, done + 1)} / {total}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-900"><div className="h-full rounded-full bg-brand-600 transition-all duration-500" style={{ width: `${Math.max(4, pct)}%` }} /></div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--text-muted)]">
        <span>Temps écoulé : <strong className="font-mono text-[var(--text)]">{fmtTime(elapsed)}</strong></span>
        {eta !== null && <span>Temps estimé restant : <strong className="font-mono text-[var(--text)]">~{fmtTime(eta)}</strong></span>}
        <span className="inline-flex items-center gap-1"><Sparkles className="h-3 w-3 text-brand-500" /> {badge}</span>
      </div>
      {step && <div className="mt-2 flex items-center gap-2 text-xs font-medium text-brand-700 dark:text-brand-300"><span className="h-3 w-3 animate-spin rounded-full border-2 border-brand-300 border-t-brand-600" /> {step}</div>}
      <div className="mt-3 max-h-64 space-y-1 overflow-auto rounded-lg border border-[var(--border)] p-2">
        {list.map((x) => { const st = status[x.handle] ?? "wait"; return (
          <div key={x.handle} className="flex items-center gap-2 text-xs">
            <ProcIcon kind={st} />
            <span className={`truncate ${st === "wait" ? "text-[var(--text-muted)]" : "text-[var(--text)]"}`}>{x.title}</span>
            <span className={`ml-auto shrink-0 text-[10px] ${PSTATUS[st].tone}`}>{PSTATUS[st].label}</span>
          </div>
        ); })}
      </div>
      <p className="mt-3 text-[11px] text-[var(--text-muted)]">{ultra ? "Le mode Ultra privilégie la qualité : Orkestra travaille produit par produit, le traitement peut prendre plus longtemps. " : ""}Orkestra conserve vos variantes, tailles, prix, SKU et images. Aucune donnée n&apos;est inventée — les points incertains seront marqués « à vérifier ».</p>
    </Card>
  );
}

const EXAMPLE_BEFORE = "blue cotton tote bag large reusable 16inch";
const EXAMPLE_AFTER_TITLE = "Sac cabas en coton bleu — Marque";
function ExampleCard() {
  return (
    <Card className="ork-rise">
      <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold"><Eye className="h-4 w-4 text-brand-600" /> Exemple de transformation <Badge tone="neutral">données fictives</Badge></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-400">Avant (CSV brut)</div>
          <div className="text-sm font-medium text-[var(--text-muted)]">{EXAMPLE_BEFORE}</div>
          <div className="mt-2 text-xs text-[var(--text-muted)]">Texte anglais · titre fournisseur · pas de meta · alt vides · unités en pouces.</div>
        </div>
        <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-3 dark:border-brand-900 dark:bg-brand-950/30">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-brand-600">Après (Orkestra)</div>
          <div className="text-sm font-semibold">{EXAMPLE_AFTER_TITLE}</div>
          <div className="mt-1.5 space-y-1 text-xs text-[var(--text-muted)]">
            <div><span className="font-medium text-[var(--text)]">Meta :</span> Sac cabas en coton bleu, grande contenance — Marque</div>
            <div><span className="font-medium text-[var(--text)]">Alt :</span> Sac cabas en coton bleu Marque vue de face</div>
            <div><span className="font-medium text-[var(--text)]">Taille :</span> 40 × 35 cm (16 po) · variante préservée</div>
            <div><span className="font-medium text-[var(--text)]">product_type :</span> Sac</div>
          </div>
        </div>
      </div>
    </Card>
  );
}


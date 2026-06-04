"use client";

import { useState, useRef, useMemo, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import { useOrkestra } from "@/lib/store";
import { assistantLink, councilLink } from "@/lib/shopify";
import {
  parseCsv, detectColumns, autoMapColumns, groupProducts, mappingStats, MAP_TARGETS, toProductInput,
  presetRules, applyTransform, serializeCsv, chunk, downloadCsv, normName, PRESETS,
  type ImportRules, type ShopifyField, type TransformedProduct,
  type TransformMode, type TitleStyle, type DescriptionLevel, type HandleMode, type Level,
} from "@/lib/import-factory";
import { PROFILES, CUSTOM_PROFILE, profileById, profileRuleOverrides, profileContext, effectiveProfile, type ProfileConfig } from "@/lib/import-profiles";
import { emptyProfileMemory } from "@/lib/store";
import { qualityControl, buildIssueReportCsv, buildExportReport, type QCReport, type QCStatus } from "@/lib/import-qc";
import { PageHeader, Card, Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import {
  Upload, FileSpreadsheet, Sparkles, Wand2, Languages, Tag, ImageIcon, Link2, Download, Check,
  CheckCircle2, AlertTriangle, RefreshCw, ChevronDown, Globe, FileText, ArrowRight, Plug, Eye,
  ListChecks, ShieldCheck, Layers, Boxes, Type as TypeIcon, X, Columns3, ListFilter, Store, Lock, Plus, CheckCheck, Database, Ban,
} from "lucide-react";
import { relativeDate } from "@/lib/utils";

const QC_TONE: Record<QCStatus, "good" | "warn" | "bad" | "neutral"> = { ok: "good", warning: "warn", risk: "bad", failed: "bad" };
const QC_LABEL: Record<QCStatus, string> = { ok: "OK", warning: "Warning", risk: "Risk", failed: "Failed" };

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

const MAX_PRODUCTS = 24;
const BATCH = 3;

const LANGS = ["Français", "Anglais", "Espagnol", "Allemand", "Italien"];
const COUNTRIES = ["France", "Belgique", "Suisse", "Canada", "USA", "Autre"];
const TONES = ["naturel", "premium discret", "expert", "direct", "chaleureux"];
const TRANSFORMS: { v: TransformMode; l: string }[] = [
  { v: "translate", l: "Traduire" }, { v: "clean_translate", l: "Nettoyer + traduire" },
  { v: "rename_optimize", l: "Renommer + optimiser" }, { v: "recreate", l: "Recréer le contenu" },
  { v: "migration", l: "Migration Shopify" }, { v: "supplier_to_brand", l: "Fournisseur → marque" },
];
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
const STEPS = ["Importez votre CSV", "Choisissez vos règles", "Orkestra transforme les produits", "Vérifiez l'aperçu", "Téléchargez le CSV Shopify final"];
const WORK_STEPS = ["Analyse du CSV", "Détection des produits", "Lecture des variantes", "Application des règles", "Génération titres & descriptions", "Génération meta & alt text", "Vérification des doublons", "Préparation de l'export"];

export default function ImportFactoryPage() {
  const { connections, brand, importProfiles, rememberImportFor, setProfileConfig, addForbidden, resetProfileMemory, selectedProfileId, setImportProfile } = useOrkestra();
  const openaiConnected = !!connections.openai?.connected;
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
  const [results, setResults] = useState<TransformedProduct[] | null>(null);
  const [qcReports, setQcReports] = useState<Record<string, QCReport>>({});
  const [edits, setEdits] = useState<Record<string, Partial<TransformedProduct>>>({});
  const [validated, setValidated] = useState<string[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const [locked, setLocked] = useState<string[]>([]);
  const [confirmExport, setConfirmExport] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [showExample, setShowExample] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  // Mode d'entrée : CSV ou produit manuel.
  const [source, setSource] = useState<"csv" | "manual">("csv");
  const [manual, setManual] = useState({ title: "", description: "", features: "", dimensions: "", materials: "", colors: "", price: "", sku: "", images: "", sourceUrl: "", notes: "", collection: "", productType: "", tags: "" });
  const [optionName, setOptionName] = useState("");
  const [variants, setVariants] = useState<{ value: string; price: string; sku: string; image: string; stock: string }[]>([]);

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

  function updateRule(patch: Partial<ImportRules>) { setRules((r) => ({ ...r, ...patch })); }
  function applyPreset(id: string) {
    setPresetId(id);
    setRules((r) => ({ ...presetRules(id), collections: r.collections, ...profileRuleOverrides(eff) }));
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
    const reports: Record<string, QCReport> = {};
    const fixed = list.map((r) => {
      const rep = qualityControl(r, { metaSuffix: eff.metaSuffix || rules.metaSuffix, vendor: eff.vendor || rules.vendor, level: rules.level, oldTerms: eff.oldTerms, usedBrand, usedHandle });
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

  async function transform() {
    if (!parsed || !stats?.hasTitle) return;
    setError(null);
    const all = groups.slice(0, MAX_PRODUCTS);
    setPhase("working");
    setProgress({ done: 0, total: all.length });
    const batches = chunk(all, BATCH);
    const acc: TransformedProduct[] = [];
    const brandAcc = [...mem.brandNames];
    const anchorAcc = [...mem.anchors];
    for (let b = 0; b < batches.length; b++) {
      const inputs = batches[b].map(toProductInput);
      let data: { ok: boolean; results?: TransformedProduct[]; error?: string };
      try {
        const res = await fetch("/api/import", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            products: inputs, rules, memory: { brandNames: brandAcc, anchors: anchorAcc },
            context: { ...profileContext(eff), brandName: eff.brand || brand.storeName || undefined, niche: eff.niche || brand.niche || undefined, positioning: brand.positioning },
            keyRefs: { openai: connections.openai?.keyId },
          }),
        });
        data = await res.json();
      } catch {
        data = { ok: false, error: "Connexion interrompue. Réessayez." };
      }
      if (!data.ok || !data.results) { setError(data.error || "Échec de la transformation."); setPhase("configure"); return; }
      acc.push(...data.results);
      for (const r of data.results) if (r.brandName) brandAcc.push(r.brandName);
      setProgress({ done: Math.min(all.length, (b + 1) * BATCH), total: all.length });
    }
    // Contrôle qualité déterministe + corrections.
    const { fixed, reports } = runQc(acc);
    setResults(fixed);
    setQcReports(reports);
    setValidated([]); setRejected([]); setLocked([]);
    rememberImportFor(selectedProfileId, {
      brandNames: fixed.map((r) => r.brandName).filter(Boolean) as string[],
      titles: fixed.map((r) => r.title).filter(Boolean),
      handles: fixed.map((r) => r.newHandle).filter(Boolean) as string[],
      anchors: rules.collections,
      collections: rules.collections,
      productTypes: fixed.map((r) => r.productType).filter(Boolean),
      tags: fixed.flatMap((r) => r.tags.split(",").map((t) => t.trim())).filter(Boolean),
      rules,
      count: fixed.length,
    });
    setPhase("preview");
    setTimeout(() => previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
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

  function finalResults(): TransformedProduct[] {
    return (results || []).map((r) => ({ ...r, ...(edits[r.handle] || {}) }));
  }
  function exportCsv() {
    if (!applied) return;
    if (applied.status === "failed" && !confirmExport) { setConfirmExport(true); return; }
    downloadCsv(`orkestra-import-${Date.now()}.csv`, serializeCsv(applied.headers, applied.rows));
  }
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
  function approveAll() { setValidated((results || []).map((r) => r.handle)); setRejected([]); }
  function reset() {
    setParsed(null); setMapping({}); setMapOpen(false); setFileInfo(null); setResults(null);
    setQcReports({}); setEdits({}); setValidated([]); setRejected([]); setLocked([]); setConfirmExport(false); setError(null); setParseError(null); setPhase("idle");
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
    setResults(null); setQcReports({}); setEdits({}); setValidated([]); setRejected([]); setLocked([]); setConfirmExport(false);
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

  // ── OpenAI requis ──
  if (!openaiConnected) {
    return (
      <>
        <PageHeader title="Import Factory" description="Transformez vos CSV produits en catalogues Shopify propres, traduits et prêts à importer." />
        <OpenAIRequired showExample={showExample} onToggleExample={() => setShowExample((v) => !v)} />
      </>
    );
  }

  const tooMany = groups.length > MAX_PRODUCTS;

  return (
    <>
      <PageHeader
        title="Import Factory"
        description="Importez un CSV produit, choisissez vos règles, et laissez Orkestra transformer le catalogue en fichier Shopify prêt à publier."
        actions={<Badge tone="good"><ShieldCheck className="h-3 w-3" /> OpenAI connecté</Badge>}
      />

      <div className="ork-stagger space-y-5">
        {/* ── Hero ── */}
        {phase === "idle" && (
          <>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setSource("csv")} className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition ${source === "csv" ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300" : "border-[var(--border)] text-[var(--text-muted)] hover:border-brand-300"}`}><FileSpreadsheet className="h-4 w-4" /> Importer un CSV</button>
              <button onClick={() => setSource("manual")} className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition ${source === "manual" ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300" : "border-[var(--border)] text-[var(--text-muted)] hover:border-brand-300"}`}><Plus className="h-4 w-4" /> Ajouter un produit manuel</button>
              <span className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border border-[var(--border)] px-3.5 py-2 text-sm font-medium text-[var(--text-muted)] opacity-70"><Link2 className="h-4 w-4" /> Depuis une URL <Badge tone="neutral">bientôt</Badge></span>
              <span className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border border-[var(--border)] px-3.5 py-2 text-sm font-medium text-[var(--text-muted)] opacity-70"><FileSpreadsheet className="h-4 w-4" /> XLSX <Badge tone="neutral">bientôt</Badge></span>
            </div>

            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = ""; }} />

            {source === "csv" ? (
              <>
                <Card className="ork-rise overflow-hidden border-brand-200 bg-gradient-to-br from-brand-50 to-transparent dark:border-brand-900 dark:from-brand-950/40">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-4">
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-600 text-white"><Boxes className="h-6 w-6" /></span>
                      <div>
                        <h2 className="text-base font-bold">Transformez un catalogue entier en quelques minutes</h2>
                        <p className="mt-1 max-w-xl text-sm text-[var(--text-muted)]">CSV fournisseur, ancienne boutique, concurrent ou export Shopify : Orkestra nettoie, traduit, renomme, optimise et prépare un fichier prêt à réimporter — sans casser vos variantes ni vos images.</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2">
                      <Button onClick={() => fileRef.current?.click()} icon={<Upload className="h-4 w-4" />}>Importer un CSV</Button>
                      <Button variant="outline" size="sm" onClick={() => setShowExample((v) => !v)} icon={<Eye className="h-3.5 w-3.5" />}>Voir un exemple</Button>
                    </div>
                  </div>
                </Card>

                {showExample && <ExampleCard />}

                <div className="ork-stagger grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {VALUE.map((v) => { const I = v.icon; return (
                    <Card key={v.t} className="ork-interactive">
                      <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300"><I className="h-[18px] w-[18px]" /></div>
                      <h3 className="mt-3 text-sm font-semibold">{v.t}</h3>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">{v.d}</p>
                    </Card>
                  ); })}
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
              {tooMany && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">Catalogue volumineux : cette V1 transforme les <strong>{MAX_PRODUCTS} premiers produits</strong> par lot. Relancez pour traiter les suivants.</p>}
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
                <Field label="Type de transformation"><Seg value={rules.transform} options={TRANSFORMS.map((t) => t.l)} onChange={(l) => updateRule({ transform: TRANSFORMS.find((t) => t.l === l)!.v })} valueLabel={TRANSFORMS.find((t) => t.v === rules.transform)?.l} /></Field>
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
            {phase === "configure" && (
              <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
                <p className="text-xs text-[var(--text-muted)]">{stats.hasTitle ? `${Math.min(groups.length, MAX_PRODUCTS)} produit(s) seront transformés via OpenAI. Vous validez l'aperçu avant l'export.` : "Mappez d'abord la colonne « Titre produit » pour activer la transformation."}</p>
                <Button size="lg" onClick={() => transform()} disabled={!stats.hasTitle} icon={<Wand2 className="h-4 w-4" />}>{source === "manual" ? "Transformer ce produit" : "Transformer le catalogue"}</Button>
              </div>
            )}

            {/* Working */}
            {phase === "working" && <Working progress={progress} />}
          </div>
        )}

        {/* ── Aperçu avant export ── */}
        {phase === "preview" && results && (
          <div ref={previewRef} className="space-y-5">
            <Card className="flex flex-col gap-3 border-brand-200 bg-gradient-to-br from-brand-50 to-transparent dark:border-brand-900 dark:from-brand-950/40 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="flex items-center gap-1.5 text-base font-bold"><CheckCircle2 className="h-5 w-5 text-emerald-600" /> Catalogue transformé</h2>
                <p className="mt-0.5 text-sm text-[var(--text-muted)]">{results.length} produit(s) · variantes, prix, SKU et images préservés. Contrôle qualité appliqué.</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Badge tone="good">{qcCounts.ok} OK</Badge>
                  {qcCounts.warning > 0 && <Badge tone="warn">{qcCounts.warning} warning</Badge>}
                  {qcCounts.risk > 0 && <Badge tone="bad">{qcCounts.risk} risk</Badge>}
                  {qcCounts.failed > 0 && <Badge tone="bad">{qcCounts.failed} failed</Badge>}
                  {validated.length > 0 && <Badge tone="brand">{validated.length} approuvé(s)</Badge>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={exportCsv} icon={<Download className="h-4 w-4" />}>Télécharger le CSV Shopify</Button>
                <Button variant="outline" onClick={exportReport} icon={<FileText className="h-4 w-4" />}>Rapport</Button>
                <Button variant="ghost" onClick={exportIssues} icon={<AlertTriangle className="h-4 w-4" />}>À vérifier</Button>
              </div>
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

            <div className="flex flex-wrap items-center gap-2">
              <BatchRules onApply={applyBatchRule} matchCount={batchMatchCount} />
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm font-bold"><ListChecks className="h-4 w-4 text-brand-600" /> Diff avant / après ({results.length})</span>
              <Button variant="outline" size="sm" icon={<CheckCheck className="h-3.5 w-3.5" />} onClick={approveAll}>Tout approuver</Button>
            </div>

            <div className="ork-stagger space-y-3">
              {results.map((r) => {
                const g = groups.find((x) => x.handle === r.handle);
                const rep = qcReports[r.handle];
                const st: QCStatus = rep?.status ?? "ok";
                const isVal = validated.includes(r.handle);
                const isRej = rejected.includes(r.handle);
                const isLock = locked.includes(r.handle);
                const ed = edits[r.handle] || {};
                const collections = ed.collections ?? r.collections;
                const productType = ed.productType ?? r.productType;
                const newHandle = r.newHandle || g?.handle || "";
                return (
                  <Card key={r.handle} className={`ork-rise ${isVal ? "border-emerald-200 dark:border-emerald-900/60" : isRej ? "border-red-200 opacity-70 dark:border-red-900/60" : ""}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] text-[var(--text-muted)] line-through">{g?.title || r.handle}</div>
                        <input disabled={isLock} value={ed.title ?? r.title} onChange={(e) => setEdits((prev) => ({ ...prev, [r.handle]: { ...prev[r.handle], title: e.target.value } }))} className="mt-0.5 w-full rounded-lg border border-transparent bg-transparent text-sm font-semibold outline-none transition focus:border-brand-300 focus:bg-[var(--bg)] focus:px-2 focus:py-1 disabled:opacity-60" />
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {isLock && <Lock className="h-3.5 w-3.5 text-[var(--text-muted)]" />}
                        <Badge tone={QC_TONE[st]}>{QC_LABEL[st]}</Badge>
                      </div>
                    </div>
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
                    {rep && rep.issues.length > 0 && <div className={`mt-2 flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] ${st === "risk" || st === "failed" ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300" : "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200"}`}><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {rep.issues.join(" · ")}</div>}
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
                      <Button size="sm" variant={isVal ? "secondary" : "ghost"} icon={<Check className="h-3.5 w-3.5" />} onClick={() => { toggle(validated, setValidated, r.handle); setRejected((x) => x.filter((h) => h !== r.handle)); }}>{isVal ? "Approuvé" : "Approuver"}</Button>
                      <Button size="sm" variant="ghost" icon={<X className="h-3.5 w-3.5" />} onClick={() => { toggle(rejected, setRejected, r.handle); setValidated((x) => x.filter((h) => h !== r.handle)); }}>{isRej ? "Rejeté" : "Rejeter"}</Button>
                      <Button size="sm" variant="ghost" icon={<Lock className="h-3.5 w-3.5" />} onClick={() => toggle(locked, setLocked, r.handle)}>{isLock ? "Déverrouiller" : "Verrouiller"}</Button>
                      <Button size="sm" variant="ghost" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => regenerateOne(r.handle)} disabled={isLock}>Régénérer</Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
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
function Working({ progress }: { progress: { done: number; total: number } }) {
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  const active = Math.min(WORK_STEPS.length - 1, Math.floor((pct / 100) * WORK_STEPS.length));
  return (
    <Card className="ork-rise">
      <div className="mb-2 flex items-center justify-between text-sm font-semibold"><span className="flex items-center gap-1.5"><Wand2 className="h-4 w-4 animate-pulse text-brand-600" /> Transformation en cours…</span><span className="text-xs text-[var(--text-muted)]">{progress.done}/{progress.total} produits</span></div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-900"><div className="h-full rounded-full bg-brand-600 transition-all duration-500" style={{ width: `${Math.max(6, pct)}%` }} /></div>
      <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {WORK_STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2 text-xs">
            {i < active ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : i === active ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-300 border-t-brand-600" /> : <span className="h-3.5 w-3.5 rounded-full border border-[var(--border)]" />}
            <span className={i <= active ? "text-[var(--text)]" : "text-[var(--text-muted)]"}>{s}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-[var(--text-muted)]">Orkestra conserve vos variantes, tailles, prix, SKU et images. Aucune donnée n&apos;est inventée — les points incertains seront marqués « à vérifier ».</p>
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

function OpenAIRequired({ showExample, onToggleExample }: { showExample: boolean; onToggleExample: () => void }) {
  return (
    <div className="ork-stagger space-y-5">
      <Card className="ork-rise overflow-hidden border-brand-200 bg-gradient-to-br from-brand-50 to-transparent text-center dark:border-brand-900 dark:from-brand-950/40">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand-600 text-white"><Boxes className="h-8 w-8" /></div>
        <h2 className="mt-4 text-lg font-bold">Connectez OpenAI pour transformer vos imports produit avec l&apos;IA</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-[var(--text-muted)]">Import Factory utilise OpenAI pour comprendre les produits, conserver les données importantes (variantes, tailles, prix), réécrire et traduire les textes, et générer les meta, alt text et recommandations de collection. Cet outil ne fonctionne pas en mode démo.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href="/connect"><Button icon={<Plug className="h-4 w-4" />}>Connecter OpenAI</Button></Link>
          <Button variant="outline" onClick={onToggleExample} icon={<Eye className="h-4 w-4" />}>Voir un exemple de résultat</Button>
        </div>
      </Card>

      {showExample && <ExampleCard />}

      <div className="ork-stagger grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {VALUE.map((v) => { const I = v.icon; return (
          <Card key={v.t} className="ork-interactive">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300"><I className="h-[18px] w-[18px]" /></div>
            <h3 className="mt-3 text-sm font-semibold">{v.t}</h3>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{v.d}</p>
          </Card>
        ); })}
      </div>

      <Card>
        <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold"><ListChecks className="h-4 w-4 text-brand-600" /> Comment ça marche</div>
        <div className="ork-stagger grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {STEPS.map((s, i) => (
            <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3.5">
              <span className="grid h-6 w-6 place-items-center rounded-lg bg-brand-50 text-[11px] font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">{i + 1}</span>
              <p className="mt-2 text-xs leading-snug">{s}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

"use client";

import { useState, useRef, useMemo } from "react";
import Link from "next/link";
import { useOrkestra } from "@/lib/store";
import { assistantLink, councilLink } from "@/lib/shopify";
import {
  parseCsv, detectColumns, groupProducts, toProductInput, presetRules, applyTransform, serializeCsv,
  buildReportCsv, chunk, downloadCsv, PRESETS,
  type ImportRules, type DetectedColumns, type ProductGroup, type TransformedProduct,
  type TransformMode, type TitleStyle, type DescriptionLevel, type HandleMode, type Level,
} from "@/lib/import-factory";
import { PageHeader, Card, Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import {
  Upload, FileSpreadsheet, Sparkles, Wand2, Languages, Tag, ImageIcon, Link2, Download, Check,
  CheckCircle2, AlertTriangle, RefreshCw, ChevronDown, Globe, FileText, ArrowRight, Plug, Eye,
  ListChecks, ShieldCheck, Layers, Boxes, Type as TypeIcon, X,
} from "lucide-react";

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
  const { connections, brand, importMemory, rememberImport } = useOrkestra();
  const openaiConnected = !!connections.openai?.connected;

  const [parsed, setParsed] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [detected, setDetected] = useState<DetectedColumns | null>(null);
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [fileInfo, setFileInfo] = useState<{ name: string; sizeKb: number } | null>(null);
  const [presetId, setPresetId] = useState("migration");
  const [rules, setRules] = useState<ImportRules>(() => ({ ...presetRules("migration"), collections: brand.collections }));
  const [collectionsText, setCollectionsText] = useState(brand.collections.join("\n"));
  const [phase, setPhase] = useState<"idle" | "configure" | "working" | "preview">("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<TransformedProduct[] | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [validated, setValidated] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [showExample, setShowExample] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const configRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const imageCount = useMemo(() => groups.reduce((a, g) => a + g.images.length, 0), [groups]);
  const variantCount = useMemo(() => groups.reduce((a, g) => a + g.variants.length, 0), [groups]);

  function updateRule(patch: Partial<ImportRules>) { setRules((r) => ({ ...r, ...patch })); }
  function applyPreset(id: string) { setPresetId(id); setRules((r) => ({ ...presetRules(id), collections: r.collections })); }
  function syncCollections(text: string) { setCollectionsText(text); updateRule({ collections: text.split("\n").map((s) => s.trim()).filter(Boolean) }); }

  async function readFile(file: File) {
    setParseError(null);
    if (!/\.csv$/i.test(file.name)) { setParseError("Format non supporté : importez un fichier .csv."); return; }
    const text = await file.text();
    const all = parseCsv(text);
    if (all.length < 2) { setParseError("CSV vide ou illisible (au moins une ligne d'en-tête + une ligne produit)."); return; }
    const headers = all[0];
    const rows = all.slice(1);
    const det = detectColumns(headers);
    const grp = groupProducts(rows, det.map);
    setParsed({ headers, rows });
    setDetected(det);
    setGroups(grp);
    setFileInfo({ name: file.name, sizeKb: Math.max(1, Math.round(file.size / 1024)) });
    setResults(null);
    setEdits({});
    setValidated([]);
    setError(null);
    setPhase("configure");
    setTimeout(() => configRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

  async function transform() {
    if (!parsed || !detected) return;
    setError(null);
    const all = groups.slice(0, MAX_PRODUCTS);
    setPhase("working");
    setProgress({ done: 0, total: all.length });
    const batches = chunk(all, BATCH);
    const acc: TransformedProduct[] = [];
    const brandAcc = [...importMemory.brandNames];
    const anchorAcc = [...importMemory.anchors];
    for (let b = 0; b < batches.length; b++) {
      const inputs = batches[b].map(toProductInput);
      let data: { ok: boolean; results?: TransformedProduct[]; error?: string };
      try {
        const res = await fetch("/api/import", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            products: inputs, rules, memory: { brandNames: brandAcc, anchors: anchorAcc },
            context: { brandName: brand.storeName || undefined, niche: brand.niche || undefined, positioning: brand.positioning },
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
    setResults(acc);
    rememberImport({
      brandNames: acc.map((r) => r.brandName).filter(Boolean) as string[],
      handles: acc.map((r) => r.newHandle).filter(Boolean) as string[],
      collections: rules.collections,
      rules,
      count: acc.length,
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
          products: [toProductInput(g)], rules, memory: { brandNames: importMemory.brandNames, anchors: importMemory.anchors },
          context: { brandName: brand.storeName || undefined, niche: brand.niche || undefined, positioning: brand.positioning },
          keyRefs: { openai: connections.openai?.keyId },
        }),
      });
      const data = await res.json();
      if (data.ok && data.results?.[0]) {
        setResults((rs) => (rs ? rs.map((r) => (r.handle === handle ? data.results[0] : r)) : rs));
        setEdits((e) => { const n = { ...e }; delete n[handle]; return n; });
      }
    } catch { /* silencieux */ }
  }

  function finalResults(): TransformedProduct[] {
    return (results || []).map((r) => (edits[r.handle] ? { ...r, title: edits[r.handle] } : r));
  }
  function exportCsv() {
    if (!parsed || !detected || !results) return;
    const { headers, rows } = applyTransform(parsed.headers, parsed.rows, detected, groups, finalResults(), rules);
    downloadCsv(`orkestra-import-${Date.now()}.csv`, serializeCsv(headers, rows));
  }
  function exportReport() {
    if (!results) return;
    downloadCsv(`orkestra-rapport-${Date.now()}.csv`, buildReportCsv(groups, finalResults()));
  }
  function reset() {
    setParsed(null); setDetected(null); setGroups([]); setFileInfo(null); setResults(null);
    setEdits({}); setValidated([]); setError(null); setParseError(null); setPhase("idle");
  }

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
  const reviewCount = (results || []).filter((r) => r.status === "review").length;

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
          </>
        )}

        {/* ── Zone d'upload ── */}
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = ""; }} />
        {phase === "idle" && (
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
        )}

        {/* ── Configuration (fichier détecté + preset + questionnaire) ── */}
        {(phase === "configure" || phase === "working") && parsed && detected && (
          <div ref={configRef} className="space-y-5">
            {/* Résumé fichier */}
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50"><FileSpreadsheet className="h-5 w-5" /></span>
                  <div>
                    <div className="text-sm font-semibold">{fileInfo?.name}</div>
                    <div className="text-xs text-[var(--text-muted)]">{fileInfo?.sizeKb} Ko · {parsed.rows.length} lignes · {detected.isShopify ? "export Shopify détecté" : "CSV générique"}</div>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={reset} icon={<X className="h-3.5 w-3.5" />}>Changer de fichier</Button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat icon={Boxes} label="Produits" value={groups.length} />
                <Stat icon={Layers} label="Variantes" value={variantCount} />
                <Stat icon={ImageIcon} label="Images" value={imageCount} />
                <Stat icon={FileText} label="Colonnes" value={parsed.headers.length} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium text-[var(--text-muted)]">Colonnes reconnues :</span>
                {(Object.keys(detected.map) as string[]).slice(0, 14).map((k) => <Badge key={k} tone="neutral">{k}</Badge>)}
                {detected.recognized === 0 && <span className="text-[11px] text-amber-600">Aucune colonne Shopify standard — un mapping minimal sera appliqué (titre/description/images).</span>}
              </div>
              {tooMany && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">Catalogue volumineux : cette V1 transforme les <strong>{MAX_PRODUCTS} premiers produits</strong> par lot. Relancez pour traiter les suivants.</p>}
            </Card>

            {/* Reprendre les règles du dernier import */}
            {importMemory.lastRules && phase === "configure" && (
              <Card className="flex flex-col items-start gap-3 border-brand-200 bg-brand-50/50 dark:border-brand-900 dark:bg-brand-950/30 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-sm"><RefreshCw className="h-4 w-4 text-brand-600" /> Reprendre les règles de votre dernier import ? <span className="text-xs text-[var(--text-muted)]">({importMemory.transformedCount} produits déjà traités)</span></div>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => { const lr = importMemory.lastRules!; setRules({ ...lr, collections: rules.collections }); setCollectionsText(lr.collections.join("\n") || collectionsText); }}>Reprendre les mêmes règles</Button>
                </div>
              </Card>
            )}

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
                <Toggle label="Générer des noms brandés uniques" hint="Ex : « Suspension en verre fumé | Oriva » — jamais deux fois le même nom." checked={rules.brandNames} onChange={(v) => updateRule({ brandNames: v })} />
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
                  <textarea className="input min-h-[80px] font-mono text-xs" value={collectionsText} onChange={(e) => syncCollections(e.target.value)} placeholder={"Lustres\nSuspensions\nPlafonniers\nLampes de chevet"} />
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
                <p className="text-xs text-[var(--text-muted)]">{Math.min(groups.length, MAX_PRODUCTS)} produit(s) seront transformés via OpenAI. Vous validez l&apos;aperçu avant l&apos;export.</p>
                <Button size="lg" onClick={transform} icon={<Wand2 className="h-4 w-4" />}>Transformer le catalogue</Button>
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
                <p className="mt-0.5 text-sm text-[var(--text-muted)]">{results.length} produit(s) prêts · {reviewCount > 0 ? `${reviewCount} à vérifier` : "aucun point bloquant"} · variantes, prix et SKU préservés.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={exportCsv} icon={<Download className="h-4 w-4" />}>Télécharger le CSV Shopify</Button>
                <Button variant="outline" onClick={exportReport} icon={<FileText className="h-4 w-4" />}>Rapport</Button>
              </div>
            </Card>

            <div className="flex flex-wrap items-center gap-2">
              <Link href={councilLink("seo", "Contexte : Import Factory a transformé un catalogue produit (titres, descriptions, meta, alt, tags). Réponds uniquement : vérifie ce qui est risqué ou faible (titres trop agressifs, claims, descriptions pauvres, meta) et propose des corrections, sans refaire d'audit complet.")}><Button variant="secondary" size="sm" icon={<Sparkles className="h-3.5 w-3.5" />}>Faire vérifier par AI Council</Button></Link>
              <Link href={assistantLink("Où importer un fichier CSV de produits dans Shopify, et quelles précautions prendre (variantes, collections, test sur petit lot) ?")}><Button variant="outline" size="sm" icon={<ArrowRight className="h-3.5 w-3.5" />}>Où importer ce CSV dans Shopify ?</Button></Link>
              <Link href="/merchant"><Button variant="ghost" size="sm" icon={<ShieldCheck className="h-3.5 w-3.5" />}>Relancer Merchant Shield après import</Button></Link>
              <Button variant="ghost" size="sm" onClick={reset} icon={<Upload className="h-3.5 w-3.5" />}>Nouvel import</Button>
            </div>

            <div className="ork-stagger space-y-3">
              {results.map((r) => {
                const g = groups.find((x) => x.handle === r.handle);
                const isVal = validated.includes(r.handle);
                return (
                  <Card key={r.handle} className={`ork-rise ${isVal ? "border-emerald-200 dark:border-emerald-900/60" : ""}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] text-[var(--text-muted)] line-through">{g?.title || r.handle}</div>
                        <input value={edits[r.handle] ?? r.title} onChange={(e) => setEdits((prev) => ({ ...prev, [r.handle]: e.target.value }))} className="mt-0.5 w-full rounded-lg border border-transparent bg-transparent text-sm font-semibold outline-none transition focus:border-brand-300 focus:bg-[var(--bg)] focus:px-2 focus:py-1" />
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Badge tone={r.status === "review" ? "warn" : "good"}>{r.status === "review" ? "À vérifier" : "Validé IA"}</Badge>
                      </div>
                    </div>
                    <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                      <Mini label="Meta title" value={r.metaTitle} />
                      <Mini label="product_type" value={r.productType} />
                      <Mini label="Meta description" value={r.metaDescription} full />
                      {r.collections.length > 0 && <Mini label="Collections" value={r.collections.join(", ")} />}
                      {r.tags && <Mini label="Tags" value={r.tags} />}
                    </div>
                    {r.imageAlts.length > 0 && (
                      <div className="mt-2"><div className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Alt text ({r.imageAlts.length})</div><div className="mt-1 flex flex-wrap gap-1">{r.imageAlts.slice(0, 4).map((a, i) => <span key={i} className="rounded bg-[var(--bg)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">{a}</span>)}{r.imageAlts.length > 4 && <span className="text-[10px] text-[var(--text-muted)]">+{r.imageAlts.length - 4}</span>}</div></div>
                    )}
                    {r.notes && r.notes.length > 0 && <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800 dark:bg-amber-950/30 dark:text-amber-200"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {r.notes.join(" · ")}</div>}
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
                      <Button size="sm" variant={isVal ? "secondary" : "ghost"} icon={<Check className="h-3.5 w-3.5" />} onClick={() => setValidated((v) => (v.includes(r.handle) ? v.filter((x) => x !== r.handle) : [...v, r.handle]))}>{isVal ? "Validé" : "Marquer validé"}</Button>
                      <Button size="sm" variant="ghost" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => regenerateOne(r.handle)}>Régénérer</Button>
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

const EXAMPLE_BEFORE = "modern glass pendant light gold E27 lamp 8inch";
const EXAMPLE_AFTER_TITLE = "Suspension en verre fumé doré — Oriva";
function ExampleCard() {
  return (
    <Card className="ork-rise">
      <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold"><Eye className="h-4 w-4 text-brand-600" /> Exemple de transformation <Badge tone="neutral">illustration</Badge></div>
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
            <div><span className="font-medium text-[var(--text)]">Meta :</span> Suspension en verre fumé doré, E27 — Oriva</div>
            <div><span className="font-medium text-[var(--text)]">Alt :</span> Suspension en verre fumé doré Oriva vue de face</div>
            <div><span className="font-medium text-[var(--text)]">Taille :</span> Ø 20 cm (8 po) · variante préservée</div>
            <div><span className="font-medium text-[var(--text)]">product_type :</span> Suspension</div>
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

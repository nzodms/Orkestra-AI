"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useOrkestra } from "@/lib/store";
import { useLens, type LensAnalysis, type SupplierResult, type LensInputKind, type SupplierSearchProvider, type SupplierSearchMethod, type AssistedQuery } from "@/lib/lens-store";
import { draftFromSupplier } from "@/lib/send-to-import-factory";
import { PageHeader, Card, Badge, EmptyState } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { LensUploader, LensUrlInput, LensClipperGuide, LensAnalysisCard, SupplierResults, SupplierComparison, AssistedQueries } from "./_components";
import { ScanSearch, Loader2, RotateCcw, Plug, Bookmark, ArrowRight, RefreshCw, Pencil, Check, X, Sparkles } from "lucide-react";

type Step = "input" | "analyzing" | "results";
interface SearchMeta { method: SupplierSearchMethod; provider: SupplierSearchProvider; real: boolean; keywords: string[]; models?: string[]; assistedQueries?: AssistedQuery[]; error?: string }

const METHOD_BADGE: Record<SupplierSearchMethod, { label: string; tone: "good" | "warn" | "brand" | "neutral" }> = {
  structured: { label: "Fournisseurs structurés", tone: "good" },
  "multi-ai-search": { label: "Recherche multi-IA", tone: "brand" },
  assisted: { label: "Recherche assistée", tone: "warn" },
  simulated: { label: "Résultats simulés", tone: "warn" },
};

export default function OrkestraLensPage() {
  const { connections } = useOrkestra();
  const { saveLens, lensSaved, setImportDraft } = useLens();
  const router = useRouter();
  const anyAiConnected = !!(connections.openai?.connected || connections.anthropic?.connected || connections.gemini?.connected);

  const [step, setStep] = useState<Step>("input");
  const [analysis, setAnalysis] = useState<LensAnalysis | null>(null);
  const [results, setResults] = useState<SupplierResult[]>([]);
  const [meta, setMeta] = useState<SearchMeta | null>(null);
  const [searching, setSearching] = useState(false);
  const [preview, setPreview] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string>("");
  const [editKw, setEditKw] = useState(false);
  const [kwText, setKwText] = useState("");
  const started = useRef(false);

  const savedIds = useMemo(() => new Set(lensSaved.map((s) => s.supplier.id)), [lensSaved]);
  const compareList = useMemo(() => results.filter((r) => selected.has(r.id)).slice(0, 4), [results, selected]);

  async function runSearch(a: LensAnalysis, opts: { provider?: SupplierSearchProvider; keywords?: string[] } = {}) {
    setSearching(true);
    try {
      const res = await fetch("/api/lens/search", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis: a, provider: opts.provider, keywords: opts.keywords, keyRefs: { openai: connections.openai?.keyId, claude: connections.anthropic?.keyId, gemini: connections.gemini?.keyId } }),
      });
      const data = await res.json();
      setResults(data.results || []);
      setMeta({ method: data.method || "simulated", provider: data.provider || "simulated", real: !!data.real, keywords: data.keywords || [], models: data.models, assistedQueries: data.assistedQueries, error: data.error });
    } catch {
      setResults([]);
      setMeta({ method: "simulated", provider: "simulated", real: false, keywords: [], error: "Impossible de joindre la recherche fournisseurs. Réessayez." });
    } finally { setSearching(false); }
  }

  async function analyze(input: { kind: LensInputKind; image?: string; url?: string }, previewSrc: string) {
    setStep("analyzing"); setError(""); setPreview(previewSrc); setSelected(new Set()); setMeta(null); setEditKw(false);
    try {
      const res = await fetch("/api/lens/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, keyRefs: { openai: connections.openai?.keyId, claude: connections.anthropic?.keyId, gemini: connections.gemini?.keyId } }),
      });
      const data = await res.json();
      if (!data.ok || !data.analysis) { setError(data.error || "Analyse impossible."); setStep("input"); return; }
      const a = data.analysis as LensAnalysis; a.preview = previewSrc;
      setAnalysis(a);
      setKwText([...a.keywordsSupplier, ...a.keywordsEn].slice(0, 6).join(", "));
      await runSearch(a);
      setStep("results");
    } catch {
      setError("Impossible de joindre Orkestra Lens (réseau)."); setStep("input");
    }
  }

  // Entrée via clipper / bookmarklet : ?imageUrl= / ?productUrl=
  useEffect(() => {
    if (started.current) return; started.current = true;
    const p = new URLSearchParams(window.location.search);
    const img = p.get("imageUrl"); const prod = p.get("productUrl");
    if (img) analyze({ kind: "clipper", image: img, url: prod || undefined }, img);
    else if (prod) analyze({ kind: "product_url", url: prod }, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Polish : coller une image depuis le presse-papier (étape d'entrée).
  useEffect(() => {
    if (step !== "input") return;
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items || []).find((it) => it.type.startsWith("image/"));
      const file = item?.getAsFile();
      if (file) { const r = new FileReader(); r.onload = () => analyze({ kind: "upload", image: String(r.result) }, String(r.result)); r.readAsDataURL(file); }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function toggle(id: string) {
    setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else if (n.size < 4) n.add(id); return n; });
  }
  function send(r: SupplierResult) { if (analysis) { setImportDraft(draftFromSupplier(analysis, r)); router.push("/seo"); } }
  function save(r: SupplierResult) { if (analysis) saveLens({ id: r.id, date: new Date().toISOString(), analysis, supplier: r }); }
  function reset() {
    setStep("input"); setAnalysis(null); setResults([]); setMeta(null); setPreview(""); setSelected(new Set()); setError(""); setEditKw(false);
    if (typeof window !== "undefined" && window.location.search) router.replace("/lens");
  }
  function relaunchKeywords() {
    if (!analysis) return;
    const kws = kwText.split(",").map((s) => s.trim()).filter(Boolean);
    setEditKw(false);
    runSearch(analysis, { keywords: kws.length ? kws : undefined });
  }

  return (
    <div>
      <PageHeader
        title="Orkestra Lens"
        description="Sourcez un produit à partir d'une image. Importez une photo ou collez une URL : Orkestra analyse le produit, trouve des fournisseurs similaires et prépare l'envoi vers Import Factory."
        actions={step === "results" ? <Button variant="outline" onClick={reset} icon={<RotateCcw className="h-4 w-4" />}>Nouvelle recherche</Button> : undefined}
      />

      {!anyAiConnected && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-gradient-to-br from-brand-50 to-transparent p-4 dark:from-brand-950/40">
          <div className="flex items-center gap-2 text-sm text-[var(--text)]">
            <Plug className="h-4 w-4 text-brand-600" /> Connectez OpenAI, Claude ou Gemini pour l'analyse d'image réelle et la recherche multi-IA. Sans clé, l'analyse est simulée et l'outil propose des recherches préremplies.
          </div>
          <Link href="/connect"><Button size="sm" variant="secondary">Connecter mes IA</Button></Link>
        </div>
      )}

      {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">{error}</div>}

      {step === "input" && (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <LensUploader onImage={(d) => analyze({ kind: "upload", image: d }, d)} busy={false} />
            <p className="mt-2 text-center text-xs text-[var(--text-muted)]">Astuce : vous pouvez aussi coller une image (Ctrl/Cmd+V).</p>
          </div>
          <div className="space-y-5">
            <LensUrlInput
              onImageUrl={(u) => analyze({ kind: "image_url", image: u }, u)}
              onProductUrl={(u) => analyze({ kind: "product_url", url: u }, "")}
              busy={false}
            />
            <LensClipperGuide origin={typeof window !== "undefined" ? window.location.origin : ""} />
          </div>
        </div>
      )}

      {step === "analyzing" && (
        <div className="grid place-items-center rounded-3xl border border-[var(--border)] bg-[var(--surface)] px-6 py-20 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
          <h2 className="mt-5 text-lg font-semibold text-[var(--text)]">Analyse du produit et recherche de fournisseurs…</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Identification du produit, des mots-clés et des sources fournisseurs.</p>
        </div>
      )}

      {step === "results" && analysis && (
        <div className="space-y-5">
          <LensAnalysisCard analysis={analysis} preview={preview} />

          {/* Bandeau source + mots-clés utilisés (modifiables) */}
          <Card className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {meta && <Badge tone={METHOD_BADGE[meta.method].tone}>{METHOD_BADGE[meta.method].label}{meta.method === "structured" && meta.provider ? ` · ${meta.provider}` : ""}</Badge>}
                {meta?.models?.length ? <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]"><Sparkles className="h-3 w-3 text-brand-600" /> {meta.models.join(" + ")}</span> : null}
                <span className="text-xs text-[var(--text-muted)]">{results.length} résultat(s)</span>
              </div>
              {!editKw && <Button size="sm" variant="ghost" onClick={() => setEditKw(true)} icon={<Pencil className="h-3.5 w-3.5" />}>Modifier les mots-clés</Button>}
            </div>
            {editKw ? (
              <div className="flex flex-wrap items-center gap-2">
                <input className="input flex-1 min-w-[220px]" value={kwText} onChange={(e) => setKwText(e.target.value)} placeholder="mots-clés séparés par des virgules" onKeyDown={(e) => { if (e.key === "Enter") relaunchKeywords(); }} />
                <Button size="sm" loading={searching} onClick={relaunchKeywords} icon={<RefreshCw className="h-3.5 w-3.5" />}>Relancer</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditKw(false)} icon={<X className="h-3.5 w-3.5" />}>Annuler</Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {(meta?.keywords || []).map((k, i) => <Badge key={i} tone="neutral">{k}</Badge>)}
              </div>
            )}
            {meta?.error && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                <span className="flex-1">{meta.error}</span>
                <Button size="sm" variant="outline" loading={searching} onClick={() => runSearch(analysis)} icon={<RefreshCw className="h-3.5 w-3.5" />}>Réessayer</Button>
                <Button size="sm" variant="ghost" onClick={() => runSearch(analysis, { provider: "simulated" })}>Résultats simulés</Button>
              </div>
            )}
          </Card>

          {meta?.assistedQueries?.length ? <AssistedQueries queries={meta.assistedQueries} /> : null}

          {compareList.length >= 2 && <SupplierComparison results={compareList} onSend={send} />}

          <div>
            <div className="mb-3 flex items-center gap-2">
              <ScanSearch className="h-4 w-4 text-brand-600" />
              <h3 className="text-sm font-semibold text-[var(--text)]">Fournisseurs similaires</h3>
              {selected.size > 0 && <span className="text-xs text-[var(--text-muted)]">· {selected.size} sélectionné(s) pour comparer (max 4)</span>}
              {searching && <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-600" />}
            </div>
            <SupplierResults results={results} selected={selected} onToggle={toggle} onSend={send} onSave={save} savedIds={savedIds} method={meta?.method || "simulated"} />
          </div>
        </div>
      )}

      {step === "input" && lensSaved.length > 0 && (
        <Card className="mt-6">
          <div className="mb-3 flex items-center gap-2">
            <Bookmark className="h-4 w-4 text-brand-600" />
            <h3 className="text-sm font-semibold text-[var(--text)]">Fournisseurs sauvegardés</h3>
            <Badge tone="neutral">{lensSaved.length}</Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {lensSaved.slice(0, 6).map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border)] p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--text)]">{s.supplier.title}</p>
                  <p className="text-xs text-[var(--text-muted)]">{s.supplier.source} · {s.analysis.productType} · {s.supplier.supplierScore}/100</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => { setImportDraft(draftFromSupplier(s.analysis, s.supplier)); router.push("/seo"); }} icon={<ArrowRight className="h-3.5 w-3.5" />}>Importer</Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {step === "input" && lensSaved.length === 0 && (
        <div className="mt-6">
          <EmptyState
            icon={<ScanSearch className="h-6 w-6" />}
            title="Comment ça marche"
            description="1. Importez une image ou collez une URL produit. 2. Orkestra identifie le produit et liste des fournisseurs similaires avec un score. 3. Comparez, puis envoyez le meilleur vers Import Factory pour créer la fiche Shopify."
          />
        </div>
      )}
    </div>
  );
}

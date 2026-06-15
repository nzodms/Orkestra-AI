"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useOrkestra } from "@/lib/store";
import { useLens, type LensAnalysis, type SupplierResult, type LensInputKind, type SupplierSearchProvider, type SupplierSearchMethod } from "@/lib/lens-store";
import { draftFromSupplier, draftFromAnalysis } from "@/lib/send-to-import-factory";
import { buildSearchLinks } from "@/lib/lens-links";
import { PageHeader, Card, Badge, EmptyState } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { LensUploader, LensUrlInput, LensAnalysisCard, SupplierResults, SupplierComparison, SearchLinks } from "./_components";
import { ScanSearch, Loader2, RotateCcw, Plug, Bookmark, ArrowRight, RefreshCw, Pencil, X, Sparkles, Info } from "lucide-react";

type Step = "input" | "analyzing" | "results";
interface SearchMeta { method: SupplierSearchMethod; provider: SupplierSearchProvider; real: boolean; keywords: string[]; models?: string[]; error?: string }

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
  const clipSig = useRef("");

  const savedIds = useMemo(() => new Set(lensSaved.map((s) => s.supplier.id)), [lensSaved]);
  const compareList = useMemo(() => results.filter((r) => selected.has(r.id)).slice(0, 4), [results, selected]);
  // Liens de recherche INSTANTANÉS (dès l'analyse, sans attendre Gemini/Claude).
  const searchLinks = useMemo(() => (analysis ? buildSearchLinks(analysis.productName || analysis.productType) : []), [analysis]);

  async function runSearch(a: LensAnalysis, opts: { provider?: SupplierSearchProvider; keywords?: string[] } = {}) {
    setSearching(true);
    try {
      const res = await fetch("/api/lens/search", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis: a, provider: opts.provider, keywords: opts.keywords, keyRefs: { openai: connections.openai?.keyId, claude: connections.anthropic?.keyId, gemini: connections.gemini?.keyId } }),
      });
      const data = await res.json();
      setResults(data.results || []);
      setMeta({ method: data.method || "assisted", provider: data.provider || "simulated", real: !!data.real, keywords: data.keywords || [], models: data.models, error: data.error });
    } catch {
      setResults([]);
      setMeta({ method: "simulated", provider: "simulated", real: false, keywords: [], error: "Impossible de joindre la recherche fournisseurs. Réessayez." });
    } finally { setSearching(false); }
  }

  async function analyze(input: { kind: LensInputKind; image?: string; url?: string; pageContext?: { title?: string; domain?: string; text?: string } }, previewSrc: string) {
    console.log("[Lens]", { event: "lens-start", kind: input.kind });
    setStep("analyzing"); setError(""); setPreview(previewSrc); setSelected(new Set()); setMeta(null); setEditKw(false);
    try {
      const res = await fetch("/api/lens/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, keyRefs: { openai: connections.openai?.keyId, claude: connections.anthropic?.keyId, gemini: connections.gemini?.keyId } }),
      });
      const data = await res.json();
      if (!data.ok || !data.analysis) { setError(data.error || "Analyse impossible."); setStep("input"); return; }
      const a = data.analysis as LensAnalysis; a.preview = previewSrc;
      console.log("[Lens]", { event: "product-detected", engine: a.engine, productName: a.productName });
      setAnalysis(a);
      setKwText(a.productName || [...a.keywordsSupplier, ...a.keywordsEn].slice(0, 5).join(" "));
      setStep("results"); // affichage RAPIDE : produit + liens, sans attendre l'IA web
      runSearch(a);       // enrichissement web en arrière-plan
    } catch {
      setError("Impossible de joindre Orkestra Lens (réseau)."); setStep("input");
    }
  }
  function sendAnalysis() { if (analysis) { setImportDraft(draftFromAnalysis(analysis)); router.push("/seo"); } }

  // Entrée via clipper / bookmarklet : ?imageUrl= / ?productUrl= (+ titre / texte proche)
  useEffect(() => {
    if (started.current) return; started.current = true;
    const p = new URLSearchParams(window.location.search);
    const img = p.get("imageUrl"); const prod = p.get("productUrl");
    const title = p.get("title") || undefined; const text = p.get("text") || undefined;
    let domain: string | undefined; try { domain = prod ? new URL(prod).hostname : undefined; } catch { /* ignore */ }
    const pageContext = (title || text || domain) ? { title, text, domain } : undefined;
    if (img) analyze({ kind: "clipper", image: img, url: prod || undefined, pageContext }, img);
    else if (prod) analyze({ kind: "product_url", url: prod, pageContext }, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Entrée via EXTENSION locale (capture pixel) : window.postMessage (re-posté → dédupe).
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== window) return; // l'extension poste sur la fenêtre courante
      const d = e.data as { source?: string; imageData?: string; imageUrl?: string; productUrl?: string; title?: string } | undefined;
      if (!d || d.source !== "orkestra-clipper") return;
      const sig = (d.imageData || d.imageUrl || d.productUrl || "").slice(0, 80) + (d.imageData?.length || 0);
      if (clipSig.current === sig) return; // ignore les re-posts
      clipSig.current = sig;
      const pageContext = d.title ? { title: d.title } : undefined;
      if (d.imageData) analyze({ kind: "clipper", image: d.imageData, url: d.productUrl, pageContext }, d.imageData);
      else if (d.imageUrl) analyze({ kind: "clipper", image: d.imageUrl, url: d.productUrl, pageContext }, d.imageUrl);
      else if (d.productUrl) analyze({ kind: "product_url", url: d.productUrl, pageContext }, "");
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
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
          {/* Produit détecté + action principale */}
          <LensAnalysisCard analysis={analysis} preview={preview} />
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={sendAnalysis} icon={<ArrowRight className="h-4 w-4" />}>Envoyer vers Import Factory</Button>
            {!editKw && <Button variant="outline" size="sm" onClick={() => setEditKw(true)} icon={<Pencil className="h-3.5 w-3.5" />}>Modifier le nom produit</Button>}
          </div>
          {editKw && (
            <div className="flex flex-wrap items-center gap-2">
              <input className="input flex-1 min-w-[220px]" value={kwText} onChange={(e) => setKwText(e.target.value)} placeholder="nom produit pour la recherche (anglais conseillé)" onKeyDown={(e) => { if (e.key === "Enter") relaunchKeywords(); }} />
              <Button size="sm" loading={searching} onClick={relaunchKeywords} icon={<RefreshCw className="h-3.5 w-3.5" />}>Relancer la recherche</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditKw(false)} icon={<X className="h-3.5 w-3.5" />}>Annuler</Button>
            </div>
          )}

          {/* Recherches prêtes — INSTANTANÉES, toujours présentes */}
          <SearchLinks links={searchLinks} />

          {/* Résultats trouvés par IA (web réel via Gemini, comparés par Claude) */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <ScanSearch className="h-4 w-4 text-brand-600" />
              <h3 className="text-sm font-semibold text-[var(--text)]">Résultats trouvés par IA</h3>
              {meta && results.length > 0 && <Badge tone={METHOD_BADGE[meta.method].tone}>{METHOD_BADGE[meta.method].label}</Badge>}
              {meta?.models?.length ? <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]"><Sparkles className="h-3 w-3 text-brand-600" /> {meta.models.join(" + ")}</span> : null}
              {searching && <span className="inline-flex items-center gap-1 text-xs text-brand-600"><Loader2 className="h-3.5 w-3.5 animate-spin" /> recherche web…</span>}
            </div>

            {searching ? (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">Gemini cherche des liens, Claude compare…</div>
            ) : results.length > 0 ? (
              <>
                {compareList.length >= 2 && <div className="mb-4"><SupplierComparison results={compareList} onSend={send} /></div>}
                <SupplierResults results={results} selected={selected} onToggle={toggle} onSend={send} onSave={save} savedIds={savedIds} method={meta?.method || "multi-ai-search"} />
              </>
            ) : (
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-5 text-sm text-[var(--text-muted)]">
                <Info className="h-4 w-4 shrink-0 text-brand-600" />
                <span className="flex-1">{meta?.error || "Les recherches prêtes sont disponibles ci-dessus. Ouvrez Alibaba, AliExpress ou Google pour vérifier les résultats."}</span>
                {analysis && <Button size="sm" variant="outline" loading={searching} onClick={() => runSearch(analysis)} icon={<RefreshCw className="h-3.5 w-3.5" />}>Réessayer la recherche IA</Button>}
              </div>
            )}
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

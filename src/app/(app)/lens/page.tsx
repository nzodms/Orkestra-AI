"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useOrkestra } from "@/lib/store";
import { useLens, type LensAnalysis, type SupplierResult, type LensInputKind } from "@/lib/lens-store";
import { searchSuppliers } from "@/lib/supplier-search";
import { draftFromSupplier } from "@/lib/send-to-import-factory";
import { PageHeader, Card, Badge, EmptyState } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { LensUploader, LensUrlInput, LensClipperGuide, LensAnalysisCard, SupplierResults, SupplierComparison } from "./_components";
import { ScanSearch, Loader2, RotateCcw, Plug, Bookmark, ArrowRight } from "lucide-react";

type Step = "input" | "analyzing" | "results";

export default function OrkestraLensPage() {
  const { connections } = useOrkestra();
  const { saveLens, lensSaved, setImportDraft } = useLens();
  const router = useRouter();
  const openaiConnected = !!connections.openai?.connected;

  const [step, setStep] = useState<Step>("input");
  const [analysis, setAnalysis] = useState<LensAnalysis | null>(null);
  const [results, setResults] = useState<SupplierResult[]>([]);
  const [preview, setPreview] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string>("");
  const started = useRef(false);

  const savedIds = useMemo(() => new Set(lensSaved.map((s) => s.supplier.id)), [lensSaved]);
  const compareList = useMemo(() => results.filter((r) => selected.has(r.id)).slice(0, 4), [results, selected]);

  async function analyze(input: { kind: LensInputKind; image?: string; url?: string }, previewSrc: string) {
    setStep("analyzing"); setError(""); setPreview(previewSrc); setSelected(new Set());
    try {
      const res = await fetch("/api/lens/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, keyRefs: { openai: connections.openai?.keyId } }),
      });
      const data = await res.json();
      if (!data.ok || !data.analysis) { setError(data.error || "Analyse impossible."); setStep("input"); return; }
      const a = data.analysis as LensAnalysis;
      a.preview = previewSrc;
      setAnalysis(a);
      setResults(searchSuppliers(a));
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

  function toggle(id: string) {
    setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else if (n.size < 4) n.add(id); return n; });
  }
  function send(r: SupplierResult) {
    if (!analysis) return;
    setImportDraft(draftFromSupplier(analysis, r));
    router.push("/seo");
  }
  function save(r: SupplierResult) {
    if (!analysis) return;
    saveLens({ id: r.id, date: new Date().toISOString(), analysis, supplier: r });
  }
  function reset() {
    setStep("input"); setAnalysis(null); setResults([]); setPreview(""); setSelected(new Set()); setError("");
    if (typeof window !== "undefined" && window.location.search) router.replace("/lens");
  }

  return (
    <div>
      <PageHeader
        title="Orkestra Lens"
        description="Sourcez un produit à partir d'une image. Importez une photo ou collez une URL : Orkestra analyse le produit, trouve des fournisseurs similaires et prépare l'envoi vers Import Factory."
        actions={step === "results" ? <Button variant="outline" onClick={reset} icon={<RotateCcw className="h-4 w-4" />}>Nouvelle recherche</Button> : undefined}
      />

      {!openaiConnected && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-gradient-to-br from-brand-50 to-transparent p-4 dark:from-brand-950/40">
          <div className="flex items-center gap-2 text-sm text-[var(--text)]">
            <Plug className="h-4 w-4 text-brand-600" /> Connectez OpenAI pour une analyse d'image réelle. Sans clé, l'analyse est simulée mais l'outil reste utilisable.
          </div>
          <Link href="/connect"><Button size="sm" variant="secondary">Connecter OpenAI</Button></Link>
        </div>
      )}

      {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">{error}</div>}

      {step === "input" && (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <LensUploader onImage={(d) => analyze({ kind: "upload", image: d }, d)} busy={false} />
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
          <h2 className="mt-5 text-lg font-semibold text-[var(--text)]">Analyse du produit…</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Identification du type, de la niche et des mots-clés fournisseurs.</p>
        </div>
      )}

      {step === "results" && analysis && (
        <div className="space-y-5">
          <LensAnalysisCard analysis={analysis} preview={preview} />
          {compareList.length >= 2 && <SupplierComparison results={compareList} onSend={send} />}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <ScanSearch className="h-4 w-4 text-brand-600" />
              <h3 className="text-sm font-semibold text-[var(--text)]">Fournisseurs similaires</h3>
              <Badge tone="neutral">{results.length}</Badge>
              {selected.size > 0 && <span className="text-xs text-[var(--text-muted)]">· {selected.size} sélectionné(s) pour comparer (max 4)</span>}
            </div>
            <SupplierResults results={results} selected={selected} onToggle={toggle} onSend={send} onSave={save} savedIds={savedIds} />
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
                  <p className="text-xs text-[var(--text-muted)]">{s.supplier.source} · {s.analysis.productType} · {s.supplier.score}/100</p>
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

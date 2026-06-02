"use client";

import { useState } from "react";
import { useOrkestra, connectedProviders } from "@/lib/store";
import { PageHeader, Card, Field, Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import type { SectionResult, GenerationRecord } from "@/lib/types";
import { Blocks, Copy, Check, Sparkles, Smartphone, Wand2, Bug, FileCode2 } from "lucide-react";

const SECTION_TYPES = [
  "Hero premium", "FAQ animée", "Comparatif produit", "Section bénéfices",
  "Storytelling", "Avis clients", "Guide des tailles", "Avant/après",
  "Bloc réassurance", "Sticky add-to-cart", "Image + texte", "Collection premium",
];

const ENHANCERS = [
  { label: "Rendre plus premium", icon: Sparkles },
  { label: "Optimiser mobile", icon: Smartphone },
  { label: "Corriger le code", icon: Bug },
  { label: "Version sans JS", icon: FileCode2 },
];

type Tab = "liquid" | "css" | "js" | "schema";

export default function SectionsPage() {
  const { connections, brand, addGeneration } = useOrkestra();
  const providers = connectedProviders(connections);
  const [result, setResult] = useState<SectionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("liquid");
  const [form, setForm] = useState({
    type: "Hero premium",
    goal: "",
    style: "",
    colors: "#6d5ef2",
    content: "",
    animations: true,
    complexity: "standard" as "simple" | "standard" | "avancé",
  });

  async function generate() {
    setLoading(true);
    setResult(null);
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "section", input: form }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.ok) {
      setResult(data.result);
      const rec: GenerationRecord = {
        id: crypto.randomUUID(),
        type: "section",
        title: `Section — ${form.type}`,
        store: brand.storeName || "Boutique",
        createdAt: new Date().toISOString(),
        models: providers.length ? providers : ["anthropic"],
        status: "completed",
        score: 88,
        preview: "Liquid + CSS + schema Shopify 2.0 générés.",
      };
      addGeneration(rec);
    }
  }

  const code = result ? result[tab] : "";

  return (
    <>
      <PageHeader
        title="Section Builder"
        description="Générez des sections Shopify codées (Liquid + CSS + schema 2.0), propres, commentées et responsive."
      />

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Form */}
        <Card className="lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold">Configurer la section</h3>
          <div className="space-y-4">
            <Field label="Type de section">
              <div className="flex flex-wrap gap-1.5">
                {SECTION_TYPES.map((t) => (
                  <button key={t} onClick={() => setForm((f) => ({ ...f, type: t }))} className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${form.type === t ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950" : "border-[var(--border)] text-[var(--text-muted)] hover:border-brand-300"}`}>
                    {t}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Objectif">
              <input className="input" value={form.goal} onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))} placeholder="Mettre en avant la promesse de marque" />
            </Field>
            <Field label="Style visuel souhaité">
              <input className="input" value={form.style} onChange={(e) => setForm((f) => ({ ...f, style: e.target.value }))} placeholder="Minimaliste, premium, beaucoup d'espace" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Couleur d'accent">
                <div className="flex items-center gap-2">
                  <input type="color" value={form.colors} onChange={(e) => setForm((f) => ({ ...f, colors: e.target.value }))} className="h-10 w-12 rounded-lg border border-[var(--border)]" />
                  <input className="input font-mono" value={form.colors} onChange={(e) => setForm((f) => ({ ...f, colors: e.target.value }))} />
                </div>
              </Field>
              <Field label="Complexité">
                <div className="flex gap-1.5">
                  {(["simple", "standard", "avancé"] as const).map((c) => (
                    <button key={c} onClick={() => setForm((f) => ({ ...f, complexity: c }))} className={`flex-1 rounded-lg border px-1 py-2 text-xs font-medium capitalize transition ${form.complexity === c ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950" : "border-[var(--border)] text-[var(--text-muted)]"}`}>
                      {c}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
            <Field label="Contenu">
              <textarea className="input min-h-[80px]" value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} placeholder="Titre, sous-titre, texte du bouton…" />
            </Field>
            <label className="flex items-center gap-2.5 text-sm">
              <input type="checkbox" checked={form.animations} onChange={(e) => setForm((f) => ({ ...f, animations: e.target.checked }))} className="h-4 w-4 rounded border-[var(--border)] text-brand-600" />
              Animations douces (au scroll)
            </label>
            <Button onClick={generate} loading={loading} size="lg" className="w-full" icon={!loading ? <Blocks className="h-4 w-4" /> : undefined}>
              {loading ? "Génération du code…" : "Générer la section"}
            </Button>
          </div>
        </Card>

        {/* Result */}
        <div className="lg:col-span-3">
          {!result && !loading && (
            <Card className="flex h-full min-h-[460px] flex-col items-center justify-center text-center">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950">
                <FileCode2 className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-base font-semibold">Votre code Shopify apparaîtra ici</h3>
              <p className="mt-1.5 max-w-xs text-sm text-[var(--text-muted)]">
                Configurez la section et générez un code Liquid prêt à coller, compatible Online Store 2.0.
              </p>
            </Card>
          )}
          {loading && (
            <Card className="min-h-[460px] space-y-2">
              {Array.from({ length: 14 }).map((_, i) => (
                <div key={i} className="h-3.5 animate-pulse rounded bg-ink-100 dark:bg-ink-900" style={{ width: `${40 + Math.random() * 55}%` }} />
              ))}
            </Card>
          )}
          {result && (
            <Card className="animate-fade-in">
              {/* Enhancer buttons */}
              <div className="mb-4 flex flex-wrap gap-2">
                {ENHANCERS.map((e) => {
                  const Icon = e.icon;
                  return (
                    <Button key={e.label} variant="outline" size="sm" icon={<Icon className="h-3.5 w-3.5" />} onClick={generate}>
                      {e.label}
                    </Button>
                  );
                })}
              </div>

              {/* Code tabs */}
              <div className="overflow-hidden rounded-xl border border-[var(--border)]">
                <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg)] px-2">
                  <div className="flex">
                    {(["liquid", "css", "js", "schema"] as Tab[]).map((t) => (
                      <button key={t} onClick={() => setTab(t)} className={`px-3.5 py-2.5 text-xs font-medium uppercase transition ${tab === t ? "border-b-2 border-brand-600 text-brand-700 dark:text-brand-300" : "text-[var(--text-muted)]"}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                  <CopyBtn text={code} />
                </div>
                <pre className="max-h-80 overflow-auto bg-ink-950 p-4 text-xs text-ink-100"><code>{code || "// vide"}</code></pre>
              </div>

              {/* Install + checklist */}
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">Installation</span>
                  <ol className="mt-2 space-y-1.5 text-xs text-[var(--text-muted)]">
                    {result.installSteps.map((s, i) => (
                      <li key={i} className="flex gap-2"><span className="font-semibold text-brand-600">{i + 1}.</span> {s}</li>
                    ))}
                  </ol>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">Checklist responsive</span>
                  <ul className="mt-2 space-y-1.5">
                    {result.responsiveChecklist.map((c, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs">
                        <Check className="h-3.5 w-3.5 text-emerald-500" /> {c.label}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }} icon={copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}>
      {copied ? "Copié" : "Copier"}
    </Button>
  );
}

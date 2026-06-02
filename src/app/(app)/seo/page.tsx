"use client";

import { useState } from "react";
import { useOrkestra, connectedProviders } from "@/lib/store";
import { PageHeader, Card, Badge, Field, ScoreRing } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import type { ProductSeoResult, SeoLevel, GenerationRecord } from "@/lib/types";
import {
  Sparkles, FileText, FolderOpen, HelpCircle, Tag, ImageIcon, Newspaper, Link2, Search, Copy, Check,
} from "lucide-react";

const WORKFLOWS = [
  { id: "seo-product", label: "Fiche produit SEO", icon: Sparkles, active: true },
  { id: "seo-collection", label: "Page collection", icon: FolderOpen },
  { id: "seo-faq", label: "FAQ niche", icon: HelpCircle },
  { id: "seo-meta", label: "Meta title / description", icon: Tag },
  { id: "seo-alt", label: "Alt text images", icon: ImageIcon },
  { id: "seo-blog", label: "Article de blog", icon: Newspaper },
  { id: "seo-mesh", label: "Maillage interne", icon: Link2 },
  { id: "seo-audit", label: "Audit contenu", icon: Search },
];

export default function SeoStudioPage() {
  const { connections, brand, addGeneration } = useOrkestra();
  const providers = connectedProviders(connections);
  const [active, setActive] = useState("seo-product");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProductSeoResult | null>(null);
  const [form, setForm] = useState({
    productName: "",
    url: "",
    collection: "",
    features: "",
    benefits: "",
    materials: "",
    price: "",
    audience: "",
    keywords: "",
    ton: brand.writingStyle,
    level: "poussé" as SeoLevel,
    format: "html",
  });

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function generate() {
    setLoading(true);
    setResult(null);
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "seo-product", input: form }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.ok) {
      setResult(data.result);
      const rec: GenerationRecord = {
        id: crypto.randomUUID(),
        type: "seo-product",
        title: `Fiche SEO — ${form.productName || "Produit"}`,
        store: brand.storeName || "Boutique",
        createdAt: new Date().toISOString(),
        models: providers.length ? providers : ["openai"],
        status: "completed",
        score: data.result.seoScore,
        preview: "Titre, description HTML, FAQ, meta et mots-clés générés.",
      };
      addGeneration(rec);
    }
  }

  return (
    <>
      <PageHeader
        title="SEO Studio"
        description="Générez des contenus SEO ultra optimisés, alignés sur votre niche et votre ton de marque."
      />

      {/* Workflows */}
      <div className="mb-5 flex flex-wrap gap-2">
        {WORKFLOWS.map((w) => {
          const Icon = w.icon;
          const isActive = active === w.id;
          return (
            <button
              key={w.id}
              onClick={() => setActive(w.id)}
              className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition ${
                isActive
                  ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                  : "border-[var(--border)] text-[var(--text-muted)] hover:border-brand-300"
              }`}
            >
              <Icon className="h-4 w-4" /> {w.label}
              {!w.active && active === w.id && <Badge tone="warn">Bientôt</Badge>}
            </button>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Form */}
        <Card>
          <h3 className="mb-4 text-sm font-semibold">Fiche produit SEO</h3>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom du produit">
                <input className="input" value={form.productName} onChange={(e) => set("productName", e.target.value)} placeholder="Sac à dos urbain imperméable" />
              </Field>
              <Field label="Collection associée">
                <input className="input" value={form.collection} onChange={(e) => set("collection", e.target.value)} placeholder="Sacs à dos" />
              </Field>
            </div>
            <Field label="Caractéristiques" hint="Séparées par des virgules">
              <input className="input" value={form.features} onChange={(e) => set("features", e.target.value)} placeholder="Toile recyclée, 20L, port USB" />
            </Field>
            <Field label="Bénéfices" hint="Séparés par des virgules">
              <input className="input" value={form.benefits} onChange={(e) => set("benefits", e.target.value)} placeholder="Confort, imperméable, durable" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Matériaux / dimensions">
                <input className="input" value={form.materials} onChange={(e) => set("materials", e.target.value)} placeholder="Toile recyclée, 45×30 cm" />
              </Field>
              <Field label="Prix">
                <input className="input" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="89 €" />
              </Field>
              <Field label="Public cible">
                <input className="input" value={form.audience} onChange={(e) => set("audience", e.target.value)} placeholder="Citadins actifs" />
              </Field>
              <Field label="Mots-clés souhaités">
                <input className="input" value={form.keywords} onChange={(e) => set("keywords", e.target.value)} placeholder="sac à dos urbain, sac imperméable" />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Niveau SEO">
                <div className="flex gap-1.5">
                  {(["standard", "poussé", "ultra"] as SeoLevel[]).map((l) => (
                    <button key={l} onClick={() => set("level", l)} className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium capitalize transition ${form.level === l ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950" : "border-[var(--border)] text-[var(--text-muted)]"}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Format de sortie">
                <div className="flex gap-1.5">
                  {(["text", "html", "csv"] as const).map((f) => (
                    <button key={f} onClick={() => set("format", f)} className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium uppercase transition ${form.format === f ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950" : "border-[var(--border)] text-[var(--text-muted)]"}`}>
                      {f}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
            <Button onClick={generate} loading={loading} size="lg" className="w-full" icon={!loading ? <Sparkles className="h-4 w-4" /> : undefined}>
              {loading ? "Génération multi-IA en cours…" : "Générer la fiche SEO"}
            </Button>
            {providers.length === 0 && (
              <p className="text-center text-xs text-amber-600">
                Aucune IA connectée — la démo utilisera le mode simulé.
              </p>
            )}
          </div>
        </Card>

        {/* Result */}
        <div>
          {!result && !loading && (
            <Card className="flex h-full min-h-[400px] flex-col items-center justify-center text-center">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950">
                <FileText className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-base font-semibold">Votre fiche SEO apparaîtra ici</h3>
              <p className="mt-1.5 max-w-xs text-sm text-[var(--text-muted)]">
                Remplissez le formulaire et lancez la génération pour obtenir un contenu prêt à coller dans Shopify.
              </p>
            </Card>
          )}
          {loading && <SkeletonResult />}
          {result && <SeoResult result={result} />}
        </div>
      </div>
    </>
  );
}

function SkeletonResult() {
  return (
    <Card className="min-h-[400px] space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-4 w-full animate-pulse rounded bg-ink-100 dark:bg-ink-900" style={{ width: `${60 + Math.random() * 40}%` }} />
      ))}
    </Card>
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

function SeoResult({ result }: { result: ProductSeoResult }) {
  return (
    <Card className="animate-fade-in space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Résultat généré</h3>
        <div className="flex gap-3">
          <div className="flex items-center gap-1.5 text-xs"><span className="text-[var(--text-muted)]">SEO</span><Badge tone="good">{result.seoScore}</Badge></div>
          <div className="flex items-center gap-1.5 text-xs"><span className="text-[var(--text-muted)]">Conversion</span><Badge tone="good">{result.conversionScore}</Badge></div>
        </div>
      </div>

      <Block title="Titre optimisé" value={result.optimizedTitle} />
      <Block title="Meta title" value={result.metaTitle} />
      <Block title="Meta description" value={result.metaDescription} />
      <Block title="Handle Shopify" value={result.handle} mono />

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">Description longue (HTML Shopify)</span>
          <CopyBtn text={result.longDescriptionHtml} />
        </div>
        <pre className="max-h-52 overflow-auto rounded-xl bg-ink-950 p-3 text-xs text-ink-100"><code>{result.longDescriptionHtml}</code></pre>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ListBlock title="Mots-clés principaux" items={result.primaryKeywords} />
        <ListBlock title="Longue traîne" items={result.longTailKeywords} />
        <ListBlock title="Bénéfices" items={result.benefits} />
        <ListBlock title="Alt text images" items={result.imageAltTexts} />
      </div>

      <div>
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">FAQ</span>
        <div className="mt-2 space-y-2">
          {result.faq.map((f, i) => (
            <div key={i} className="rounded-xl border border-[var(--border)] p-3">
              <div className="text-sm font-medium">{f.q}</div>
              <div className="mt-1 text-sm text-[var(--text-muted)]">{f.a}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-brand-50 p-4 dark:bg-brand-950/40">
        <span className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">Recommandations</span>
        <ul className="mt-2 space-y-1.5">
          {result.recommendations.map((r, i) => (
            <li key={i} className="flex gap-2 text-sm"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> {r}</li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

function Block({ title, value, mono }: { title: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">{title}</span>
        <CopyBtn text={value} />
      </div>
      <div className={`rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">{title}</span>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.map((it, i) => (
          <span key={i} className="rounded-lg bg-ink-100 px-2 py-1 text-xs dark:bg-ink-900">{it}</span>
        ))}
      </div>
    </div>
  );
}

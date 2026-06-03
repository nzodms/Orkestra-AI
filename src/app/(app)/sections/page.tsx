"use client";

import { useState } from "react";
import { useOrkestra, connectedProviders } from "@/lib/store";
import { PageHeader, Card, Field, Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import type { SectionResult, GenMeta, GenerationRecord } from "@/lib/types";
import { routeSection, PROVIDER_NAME } from "@/lib/ai/sectionModelRouter";
import {
  Blocks, Copy, Check, Sparkles, Smartphone, Wand2, Bug, FileCode2, Settings2,
  Scissors, Tag, ShoppingBag, Home, AlertTriangle, Eye, Cpu,
} from "lucide-react";

const SECTION_TYPES = [
  "Hero premium", "FAQ animée", "Comparatif produit", "Section bénéfices",
  "Storytelling", "Avis clients", "Guide des tailles", "Avant/après",
  "Bloc réassurance", "Sticky add-to-cart", "Image + texte", "Collection premium",
];

const STYLES = ["premium", "minimal", "apple", "luxe", "éditorial", "conversion", "glassmorphism"];
const TONES = ["élégant", "rassurant", "direct", "expert", "émotionnel"];
const ANIMATIONS = ["aucune", "fade-in", "slide-up", "hover", "reveal"];
const PAGES = ["home", "produit", "collection", "blog", "page"];

// Actions d'amélioration → directive serveur.
const ENHANCERS: { label: string; icon: React.ElementType; directive: string }[] = [
  { label: "Plus premium", icon: Sparkles, directive: "premium" },
  { label: "Optimiser mobile", icon: Smartphone, directive: "mobile" },
  { label: "Version sans JS", icon: FileCode2, directive: "nojs" },
  { label: "Corriger le code", icon: Bug, directive: "fix" },
  { label: "Plus de settings", icon: Settings2, directive: "settings" },
  { label: "Simplifier", icon: Scissors, directive: "simplify" },
  { label: "Adapter à ma niche", icon: Tag, directive: "niche" },
  { label: "Pour page produit", icon: ShoppingBag, directive: "product" },
  { label: "Pour la home", icon: Home, directive: "home" },
];

type Tab = "apercu" | "liquid" | "css" | "js" | "schema" | "installation";

export default function SectionsPage() {
  const { connections, brand, addGeneration } = useOrkestra();
  const providers = connectedProviders(connections);
  const [result, setResult] = useState<SectionResult | null>(null);
  const [meta, setMeta] = useState<GenMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [improving, setImproving] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("apercu");
  const [form, setForm] = useState({
    type: "Hero premium",
    goal: "",
    page: "home",
    style: "premium",
    tone: "élégant",
    colors: "#6d5ef2",
    animation: "fade-in",
    complexity: "avancé" as "simple" | "avancé" | "ultra premium",
    content: "",
    collection: "",
    mobilePriority: true,
    needsSettings: true,
    allowJs: true,
    noJsVersion: false,
  });

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  // Routing client (pour l'aperçu du modèle recommandé).
  const routing = routeSection({ type: form.type, complexity: form.complexity, action: null, connected: providers });

  function payloadBase() {
    return {
      kind: "section",
      input: { ...form, animations: form.animation !== "aucune", niche: brand.niche, brandName: brand.storeName },
      keyRefs: { openai: connections.openai?.keyId },
      providers,
      context: {
        brandName: brand.storeName || undefined,
        niche: brand.niche || undefined,
        positioning: brand.positioning,
        collections: brand.collections,
        productTypes: brand.productTypes,
      },
    };
  }

  async function generate() {
    setLoading(true);
    setResult(null);
    setMeta(null);
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadBase()),
    });
    const data = await res.json();
    setLoading(false);
    if (data.ok) {
      setResult(data.result);
      setMeta(data.meta || null);
      setTab("apercu");
      const rec: GenerationRecord = {
        id: crypto.randomUUID(),
        type: "section",
        title: `Section — ${form.type}`,
        store: brand.storeName || "Boutique",
        createdAt: new Date().toISOString(),
        models: providers.length ? providers : ["openai"],
        status: "completed",
        score: 90,
        preview: "Liquid + CSS + schema Shopify 2.0 générés.",
      };
      addGeneration(rec);
    }
  }

  async function improve(directive: string) {
    if (!result) return;
    setImproving(directive);
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payloadBase(),
        improve: { directive, existing: { liquid: result.liquid, css: result.css, js: result.js, schema: result.schema } },
      }),
    });
    const data = await res.json();
    setImproving(null);
    if (data.ok) {
      setResult(data.result);
      setMeta(data.meta || null);
    }
  }

  const tabContent: Record<Exclude<Tab, "apercu" | "installation">, string> = {
    liquid: result?.liquid || "",
    css: result?.css || "",
    js: result?.js || "",
    schema: result?.schema || "",
  };

  return (
    <>
      <PageHeader
        title="Section Builder"
        description="Générez des sections Shopify premium (Liquid + CSS + schema 2.0), propres, responsive et installables — adaptées à votre boutique."
        actions={<Badge tone="brand">Modèle : {providers.includes("openai") ? "OpenAI live" : "Mode démo"}</Badge>}
      />

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Form */}
        <Card className="lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold">Configurer la section</h3>
          <div className="space-y-4">
            <Field label="Type de section">
              <div className="flex flex-wrap gap-1.5">
                {SECTION_TYPES.map((t) => (
                  <button key={t} onClick={() => set("type", t)} className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${form.type === t ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950" : "border-[var(--border)] text-[var(--text-muted)] hover:border-brand-300"}`}>
                    {t}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Objectif">
              <input className="input" value={form.goal} onChange={(e) => set("goal", e.target.value)} placeholder="Mettre en avant la promesse de marque" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Page cible">
                <select className="input" value={form.page} onChange={(e) => set("page", e.target.value)}>
                  {PAGES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Style visuel">
                <select className="input" value={form.style} onChange={(e) => set("style", e.target.value)}>
                  {STYLES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Ton">
                <select className="input" value={form.tone} onChange={(e) => set("tone", e.target.value)}>
                  {TONES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Animation">
                <select className="input" value={form.animation} onChange={(e) => set("animation", e.target.value)}>
                  {ANIMATIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Couleur d'accent">
                <div className="flex items-center gap-2">
                  <input type="color" value={form.colors} onChange={(e) => set("colors", e.target.value)} className="h-10 w-12 rounded-lg border border-[var(--border)]" />
                  <input className="input font-mono" value={form.colors} onChange={(e) => set("colors", e.target.value)} />
                </div>
              </Field>
              <Field label="Collection liée">
                <input className="input" value={form.collection} onChange={(e) => set("collection", e.target.value)} placeholder={brand.collections[0] || "Collection"} list="ork-sec-coll" />
                <datalist id="ork-sec-coll">{brand.collections.map((c) => <option key={c} value={c} />)}</datalist>
              </Field>
            </div>
            <Field label="Complexité">
              <div className="flex gap-1.5">
                {(["simple", "avancé", "ultra premium"] as const).map((c) => (
                  <button key={c} onClick={() => set("complexity", c)} className={`flex-1 rounded-lg border px-1 py-2 text-xs font-medium capitalize transition ${form.complexity === c ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950" : "border-[var(--border)] text-[var(--text-muted)]"}`}>
                    {c}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Contenu à intégrer">
              <textarea className="input min-h-[72px]" value={form.content} onChange={(e) => set("content", e.target.value)} placeholder="Titre, sous-titre, points clés, texte du bouton… (sinon placeholders générés)" />
            </Field>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[
                { k: "mobilePriority" as const, label: "Priorité mobile" },
                { k: "needsSettings" as const, label: "Settings customizer" },
                { k: "allowJs" as const, label: "Autoriser le JS" },
                { k: "noJsVersion" as const, label: "Version sans JS" },
              ].map((c) => (
                <label key={c.k} className="flex items-center gap-2.5">
                  <input type="checkbox" checked={form[c.k]} onChange={(e) => set(c.k, e.target.checked)} className="h-4 w-4 rounded border-[var(--border)] text-brand-600" />
                  {c.label}
                </label>
              ))}
            </div>
            <div className="flex items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3 text-xs text-[var(--text-muted)]">
              <Cpu className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
              <div>
                Orkestra choisit le meilleur modèle disponible pour votre section.{" "}
                {routing.recommendedProvider !== "openai" && (
                  <>Recommandé : <strong>{PROVIDER_NAME[routing.recommendedProvider]}</strong> (sections {routing.tier === "ultra" ? "ultra premium" : "complexes"}). </>
                )}
                {routing.usedProvider ? <>Utilisé : <strong>{PROVIDER_NAME[routing.usedProvider]} live</strong>.</> : "Mode démo (connectez OpenAI)."}
              </div>
            </div>
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
              <h3 className="mt-4 text-base font-semibold">Votre section Shopify apparaîtra ici</h3>
              <p className="mt-1.5 max-w-xs text-sm text-[var(--text-muted)]">
                Configurez la section : Orkestra génère Liquid + CSS + JS + schema + installation, prêts à coller (Online Store 2.0).
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
              {/* Meta line */}
              <div className="mb-3 space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {meta?.live ? <Badge tone="good">{meta.provider === "openai" ? "OpenAI live" : "Live"}</Badge> : <Badge tone="neutral">Mode démo</Badge>}
                  {result.complexity && <Badge tone="brand">{result.complexity}</Badge>}
                  <span className="text-[var(--text-muted)]">
                    {meta?.live ? `Généré avec ${meta.model}${meta.tokens ? ` · ${meta.tokens} tokens` : ""}` : `Section simulée${meta?.fallbackReason ? ` · ${meta.fallbackReason}` : ""}`}
                  </span>
                </div>
                {meta?.routingNote && (
                  <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]"><Cpu className="h-3 w-3" /> {meta.routingNote}{meta.reviewer ? ` · relecture : ${meta.reviewer}` : ""}</div>
                )}
              </div>

              {/* Warnings */}
              {result.warnings && result.warnings.length > 0 && (
                <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <div><span className="font-semibold">Vérifications :</span> {result.warnings.join(" · ")}</div>
                </div>
              )}

              {/* Enhancer buttons */}
              <div className="mb-4 flex flex-wrap gap-2">
                {ENHANCERS.map((e) => {
                  const Icon = e.icon;
                  return (
                    <Button key={e.directive} variant="outline" size="sm" loading={improving === e.directive} icon={improving !== e.directive ? <Icon className="h-3.5 w-3.5" /> : undefined} onClick={() => improve(e.directive)}>
                      {e.label}
                    </Button>
                  );
                })}
              </div>

              {/* Tabs */}
              <div className="overflow-hidden rounded-xl border border-[var(--border)]">
                <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg)] px-2">
                  <div className="flex flex-wrap">
                    {(["apercu", "liquid", "css", "js", "schema", "installation"] as Tab[]).map((t) => (
                      <button key={t} onClick={() => setTab(t)} className={`px-3 py-2.5 text-xs font-medium uppercase transition ${tab === t ? "border-b-2 border-brand-600 text-brand-700 dark:text-brand-300" : "text-[var(--text-muted)]"}`}>
                        {t === "apercu" ? "Aperçu" : t}
                      </button>
                    ))}
                  </div>
                  {tab !== "apercu" && tab !== "installation" && <CopyBtn text={tabContent[tab as Exclude<Tab, "apercu" | "installation">]} />}
                </div>

                {tab === "apercu" ? (
                  <div className="space-y-4 p-4">
                    {result.summary && (
                      <div className="rounded-xl bg-brand-50 p-3.5 text-sm dark:bg-brand-950/40">
                        {result.summary.split("\n").map((line, i) => (
                          <p key={i} className="leading-relaxed">{renderInline(line)}</p>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                      <Eye className="h-3.5 w-3.5" /> Aperçu visuel interactif à venir — pour l'instant, copiez le code par onglet.
                    </div>
                  </div>
                ) : tab === "installation" ? (
                  <div className="grid gap-4 p-4 sm:grid-cols-2">
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
                ) : (
                  <pre className="max-h-96 overflow-auto bg-ink-950 p-4 text-xs text-ink-100"><code>{tabContent[tab as Exclude<Tab, "apercu" | "installation">] || "// vide"}</code></pre>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function renderInline(line: string): React.ReactNode {
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>
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

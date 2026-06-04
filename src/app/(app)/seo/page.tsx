"use client";

import { useState } from "react";
import Link from "next/link";
import { useOrkestra, connectedProviders } from "@/lib/store";
import { getPreset } from "@/lib/niche";
import { generateCollectionSeo, generateMetaVariants, generateAltTexts, generateBlogOutline } from "@/lib/ai/engine";
import type { CollectionSeoResult, MetaVariant, BlogOutlineResult, AltTextItem } from "@/lib/ai/engine";
import { assistantLink, councilLink } from "@/lib/shopify";
import { PageHeader, Card, Badge, Field } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import type { ProductSeoResult, SeoLevel, GenerationRecord } from "@/lib/types";
import {
  Sparkles, FileText, FolderOpen, Tag, ImageIcon, Newspaper, Copy, Check, Wand2,
  ArrowRight, Package, MapPin, ListChecks, TrendingUp,
} from "lucide-react";

type WF = "product" | "collection" | "meta" | "alt" | "blog";
const WORKFLOWS: { id: WF; label: string; icon: React.ElementType }[] = [
  { id: "product", label: "Fiche produit", icon: Sparkles },
  { id: "collection", label: "Page collection", icon: FolderOpen },
  { id: "meta", label: "Meta title / desc", icon: Tag },
  { id: "alt", label: "Alt text images", icon: ImageIcon },
  { id: "blog", label: "Article de blog", icon: Newspaper },
];

const RATIONALE: Record<WF, { why: string; impact: string }> = {
  product: { why: "Fiche complète prête à coller, alignée sur votre niche et votre ton.", impact: "Conversion + longue traîne produit + flux Google Merchant." },
  collection: { why: "Page business : capte une requête transactionnelle (« acheter / choisir »).", impact: "Gain de positions sur les requêtes commerciales." },
  meta: { why: "Meta naturelles et bien dimensionnées = meilleur taux de clic.", impact: "Plus de clics à positions égales dans Google." },
  alt: { why: "Alt descriptifs, sans bourrage de mots-clés.", impact: "SEO images + accessibilité." },
  blog: { why: "Cocon de contenu longue traîne, maillé vers vos collections.", impact: "Trafic informationnel + autorité thématique." },
};

const OUTPUT: Record<WF, { items: string; where: string; speed: "Rapide" | "Approfondi" }> = {
  product: { items: "Title, meta, description HTML, bénéfices, FAQ, alt text, mots-clés, tags, product_type, note Merchant", where: "Fiche produit Shopify", speed: "Approfondi" },
  collection: { items: "Title, meta, description 200–300 mots, H2/H3, FAQ, maillage produits & collections", where: "Produits → Collections → Description", speed: "Approfondi" },
  meta: { items: "3 variantes title / meta selon l'intention, longueurs + risque GMC", where: "Aperçu du référencement naturel de la page", speed: "Rapide" },
  alt: { items: "Alt text descriptifs et sobres (type d'image + mot-clé associé)", where: "Produit → Médias → Texte alternatif", speed: "Rapide" },
  blog: { items: "Plan H2/H3, intro, mots-clés, FAQ, CTA, maillage vers collection", where: "Boutique en ligne → Articles de blog", speed: "Approfondi" },
};

export default function SeoStudioPage() {
  const { connections, brand, analysis, addGeneration, seo, setSeo } = useOrkestra();
  const providers = connectedProviders(connections);
  const { preset } = getPreset({ niche: brand.niche, brandName: brand.storeName });
  const cols = brand.collections.length ? brand.collections : preset.collections;
  const [active, setActive] = useState<WF>("product");
  const [loading, setLoading] = useState(false);

  // Fiche produit (live API)
  const [form, setForm] = useState({
    productName: "", url: "", collection: "", features: "", benefits: "", materials: "",
    price: "", audience: "", keywords: "", ton: brand.writingStyle, level: "poussé" as SeoLevel, format: "html",
  });
  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) { setForm((f) => ({ ...f, [k]: v })); }

  // Workflows clients (instantanés)
  const [collInput, setCollInput] = useState(cols[0] || "");
  const [metaSubject, setMetaSubject] = useState("");
  const [metaType, setMetaType] = useState<"produit" | "collection" | "accueil">("collection");
  const [altSubject, setAltSubject] = useState("");
  const [blogTopic, setBlogTopic] = useState("");
  const [blogColl, setBlogColl] = useState(cols[0] || "");

  // Résultats persistés (store)
  const result = seo.product;
  const meta = seo.productMeta;
  const collResult = seo.collection;
  const metaResult = seo.meta;
  const altResult = seo.alt;
  const blogResult = seo.blog;

  const nicheCtx = { niche: brand.niche, brandName: brand.storeName, positioning: brand.positioning, keywords: brand.primaryKeywords.join(", ") };

  async function generate() {
    setLoading(true);
    const res = await fetch("/api/generate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "seo-product", input: form, keyRefs: { openai: connections.openai?.keyId },
        context: { brandName: brand.storeName || undefined, niche: brand.niche || undefined, positioning: brand.positioning, language: brand.language, collections: brand.collections, productTypes: brand.productTypes, primaryKeywords: brand.primaryKeywords, competitors: brand.competitors },
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.ok) {
      setSeo({ product: data.result, productMeta: data.meta || null });
      addGeneration({ id: crypto.randomUUID(), type: "seo-product", title: `Fiche SEO — ${form.productName || "Produit"}`, store: brand.storeName || "Boutique", createdAt: new Date().toISOString(), models: providers.length ? providers : ["openai"], status: "completed", score: data.result.seoScore, preview: "Titre, description HTML, FAQ, meta, tags et mots-clés générés." } as GenerationRecord);
    }
  }

  const queue: { id: WF; icon: React.ElementType; label: string; count: number; what: string; where: string }[] = [
    { id: "meta", icon: Tag, label: "Meta à générer", count: analysis?.metrics?.missingMetaDescriptions ?? 0, what: "3 variantes title / meta selon l'intention", where: "Aperçu du référencement naturel" },
    { id: "collection", icon: FolderOpen, label: "Collections à enrichir", count: brand.collections.length, what: "Description, FAQ, H2/H3 et maillage", where: "Produits → Collections → Description" },
    { id: "product", icon: Sparkles, label: "Fiches produits à renforcer", count: analysis?.priorityProducts?.length ?? 0, what: "Description, FAQ, alt, tags, product_type", where: "Produits → fiche produit" },
    { id: "alt", icon: ImageIcon, label: "Images sans alt text", count: analysis?.catalogStats?.imagesNoAlt ?? analysis?.metrics?.imagesWithoutAlt ?? 0, what: "Alt text descriptifs et sobres", where: "Produit → Médias" },
    { id: "blog", icon: Newspaper, label: "Articles recommandés", count: Math.max(2, Math.min(4, brand.collections.length || 3)), what: "Plan d'article longue traîne + maillage", where: "Blog Shopify" },
  ];

  return (
    <>
      <PageHeader
        title="Content Factory"
        description="Transformez les problèmes détectés par Orkestra en contenus prêts à copier dans Shopify : meta, collections, fiches produits, alt text et articles."
      />

      <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Badge tone="brand"><Sparkles className="h-3 w-3" /> Basé sur votre scan public et la mémoire boutique</Badge>
        <span className="text-xs text-[var(--text-muted)]">Production rapide — à relire avant publication si nécessaire.</span>
      </div>

      {/* File de production */}
      <Card className="ork-rise mb-5">
        <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold"><ListChecks className="h-4 w-4 text-brand-600" /> File de production</div>
        <div className="ork-stagger grid grid-cols-2 gap-3 lg:grid-cols-5">
          {queue.map((q) => {
            const Icon = q.icon;
            const on = active === q.id;
            return (
              <button key={q.id} onClick={() => setActive(q.id)} className={`ork-interactive flex flex-col rounded-xl border p-3 text-left hover:border-brand-300 ${on ? "border-brand-500 bg-brand-50 dark:bg-brand-950" : "border-[var(--border)]"}`}>
                <div className="flex items-center justify-between"><Icon className="h-4 w-4 text-brand-500" /><span className="text-lg font-bold">{q.count}</span></div>
                <div className="mt-1 text-xs font-semibold leading-tight">{q.label}</div>
                <div className="mt-0.5 flex-1 text-[10px] leading-tight text-[var(--text-muted)]">{q.what}</div>
                <div className="mt-1 truncate text-[10px] text-[var(--text-muted)]"><span className="font-medium text-[var(--text)]">Où :</span> {q.where}</div>
                <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-brand-700 dark:text-brand-300">Produire <ArrowRight className="h-3 w-3" /></span>
              </button>
            );
          })}
        </div>
        {!analysis && <p className="mt-3 text-xs text-[var(--text-muted)]">Scannez votre boutique pour des compteurs précis et des produits prioritaires.</p>}
      </Card>

      {/* Workflows */}
      <div className="mb-5 flex flex-wrap gap-2">
        {WORKFLOWS.map((w) => {
          const Icon = w.icon;
          const isActive = active === w.id;
          return (
            <button key={w.id} onClick={() => setActive(w.id)} className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition ${isActive ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300" : "border-[var(--border)] text-[var(--text-muted)] hover:border-brand-300"}`}>
              <Icon className="h-4 w-4" /> {w.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <OutputCard wf={active} />
          {active === "product" && (
            <>
              <h3 className="mb-1 text-sm font-semibold">Fiche produit SEO</h3>
              <p className="mb-4 text-xs text-[var(--text-muted)]">Contenu complet prêt à coller dans Shopify (live OpenAI si connecté).</p>
              {!!analysis?.priorityProducts?.length && (
                <div className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
                  <div className="mb-2 text-xs font-semibold text-[var(--text-muted)]">Produits prioritaires détectés — cliquez pour pré-remplir</div>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.priorityProducts.slice(0, 6).map((p, i) => (
                      <button key={i} onClick={() => setForm((f) => ({ ...f, productName: p.title }))} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs transition hover:border-brand-300 hover:bg-ink-50 dark:hover:bg-ink-900">
                        <Badge tone={p.contentScore < 40 ? "bad" : p.contentScore < 70 ? "warn" : "good"}>{p.contentScore}</Badge><span className="max-w-[160px] truncate">{p.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Nom du produit"><input className="input" value={form.productName} onChange={(e) => set("productName", e.target.value)} placeholder={`Ex : ${preset.sampleProduct}`} /></Field>
                  <Field label="Collection associée">
                    <input className="input" value={form.collection} onChange={(e) => set("collection", e.target.value)} placeholder={cols[0]} list="ork-collections" />
                    <datalist id="ork-collections">{cols.map((c) => <option key={c} value={c} />)}</datalist>
                  </Field>
                </div>
                <Field label="Caractéristiques"><input className="input" value={form.features} onChange={(e) => set("features", e.target.value)} placeholder="Ex : matériau, dimensions, options" /></Field>
                <Field label="Bénéfices"><input className="input" value={form.benefits} onChange={(e) => set("benefits", e.target.value)} placeholder="Ex : gain de place, silencieux, facile à entretenir" /></Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Matériaux / dimensions"><input className="input" value={form.materials} onChange={(e) => set("materials", e.target.value)} placeholder="Ex : bois, 200×60 cm" /></Field>
                  <Field label="Public cible"><input className="input" value={form.audience} onChange={(e) => set("audience", e.target.value)} placeholder="Ex : débutant, maison" /></Field>
                  <Field label="Mots-clés"><input className="input" value={form.keywords} onChange={(e) => set("keywords", e.target.value)} placeholder={(brand.primaryKeywords.length ? brand.primaryKeywords : preset.primaryKeywords).slice(0, 2).join(", ")} /></Field>
                  <Field label="Niveau SEO">
                    <div className="flex gap-1.5">{(["standard", "poussé", "ultra"] as SeoLevel[]).map((l) => (<button key={l} onClick={() => set("level", l)} className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium capitalize transition ${form.level === l ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950" : "border-[var(--border)] text-[var(--text-muted)]"}`}>{l}</button>))}</div>
                  </Field>
                </div>
                <Button onClick={generate} loading={loading} size="lg" className="w-full" icon={!loading ? <Sparkles className="h-4 w-4" /> : undefined}>{loading ? "Génération en cours…" : "Générer la fiche SEO"}</Button>
                {providers.length === 0 && <p className="text-center text-xs text-amber-600">Aucune IA connectée — la démo utilise le mode simulé.</p>}
              </div>
            </>
          )}

          {active === "collection" && (
            <>
              <h3 className="mb-1 text-sm font-semibold">Page collection SEO</h3>
              <p className="mb-4 text-xs text-[var(--text-muted)]">Title, meta, description 200–300 mots, structure, FAQ et maillage.</p>
              <Field label="Collection"><input className="input" value={collInput} onChange={(e) => setCollInput(e.target.value)} placeholder={cols[0]} list="ork-cols2" /><datalist id="ork-cols2">{cols.map((c) => <option key={c} value={c} />)}</datalist></Field>
              <Button onClick={() => setSeo({ collection: generateCollectionSeo({ collection: collInput || cols[0], ...nicheCtx, others: cols }) })} className="mt-4 w-full" icon={<Wand2 className="h-4 w-4" />}>Générer le contenu collection</Button>
            </>
          )}

          {active === "meta" && (
            <>
              <h3 className="mb-1 text-sm font-semibold">Meta title / description</h3>
              <p className="mb-4 text-xs text-[var(--text-muted)]">3 variantes naturelles avec longueurs indiquées.</p>
              <Field label="Type de page"><div className="flex gap-1.5">{(["produit", "collection", "accueil"] as const).map((t) => (<button key={t} onClick={() => setMetaType(t)} className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium capitalize transition ${metaType === t ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950" : "border-[var(--border)] text-[var(--text-muted)]"}`}>{t}</button>))}</div></Field>
              <div className="mt-4"><Field label="Sujet de la page"><input className="input" value={metaSubject} onChange={(e) => setMetaSubject(e.target.value)} placeholder={metaType === "accueil" ? brand.niche || preset.label : cols[0]} /></Field></div>
              <Button onClick={() => setSeo({ meta: generateMetaVariants({ subject: metaSubject || (metaType === "accueil" ? brand.niche || preset.label : cols[0]), type: metaType, ...nicheCtx }) })} className="mt-4 w-full" icon={<Wand2 className="h-4 w-4" />}>Générer 3 variantes</Button>
            </>
          )}

          {active === "alt" && (
            <>
              <h3 className="mb-1 text-sm font-semibold">Alt text images</h3>
              <p className="mb-4 text-xs text-[var(--text-muted)]">Descriptifs, naturels, sans bourrage de mots-clés.</p>
              <Field label="Produit / sujet de l'image"><input className="input" value={altSubject} onChange={(e) => setAltSubject(e.target.value)} placeholder={`Ex : ${preset.sampleProduct}`} /></Field>
              <Button onClick={() => setSeo({ alt: generateAltTexts({ subject: altSubject || preset.sampleProduct, niche: brand.niche, count: 5 }), altSubject: altSubject || preset.sampleProduct })} className="mt-4 w-full" icon={<Wand2 className="h-4 w-4" />}>Générer les alt text</Button>
            </>
          )}

          {active === "blog" && (
            <>
              <h3 className="mb-1 text-sm font-semibold">Article de blog SEO</h3>
              <p className="mb-4 text-xs text-[var(--text-muted)]">Plan H2/H3, intro, mots-clés, FAQ, maillage et CTA.</p>
              <Field label="Sujet (optionnel)"><input className="input" value={blogTopic} onChange={(e) => setBlogTopic(e.target.value)} placeholder="Laisser vide pour une suggestion automatique" /></Field>
              <div className="mt-4"><Field label="Collection à mailler"><input className="input" value={blogColl} onChange={(e) => setBlogColl(e.target.value)} placeholder={cols[0]} list="ork-cols3" /><datalist id="ork-cols3">{cols.map((c) => <option key={c} value={c} />)}</datalist></Field></div>
              <Button onClick={() => setSeo({ blog: generateBlogOutline({ topic: blogTopic, collection: blogColl || cols[0], ...nicheCtx }) })} className="mt-4 w-full" icon={<Wand2 className="h-4 w-4" />}>Générer le plan d&apos;article</Button>
            </>
          )}
        </Card>

        <div>
          {active === "product" && (loading ? <SkeletonResult /> : result ? (
            <>
              <div className="mb-2 flex items-center gap-2 text-xs">{meta?.live ? <Badge tone="good">OpenAI live</Badge> : <Badge tone="neutral">Mode démo</Badge>}<span className="text-[var(--text-muted)]">{meta?.live ? `Généré avec OpenAI · ${meta.model}` : `Fiche simulée${meta?.fallbackReason ? ` · ${meta.fallbackReason}` : ""}`}</span></div>
              <ProductResult result={result} />
            </>
          ) : <EmptyResult label="Votre fiche SEO apparaîtra ici" />)}
          {active === "collection" && (collResult ? <CollectionResult r={collResult} /> : <EmptyResult label="Le contenu de collection apparaîtra ici" />)}
          {active === "meta" && (metaResult ? <MetaResult variants={metaResult} /> : <EmptyResult label="Vos 3 variantes meta apparaîtront ici" />)}
          {active === "alt" && (altResult ? <AltResult alts={altResult} subject={seo.altSubject || preset.sampleProduct} /> : <EmptyResult label="Vos alt text apparaîtront ici" />)}
          {active === "blog" && (blogResult ? <BlogResult r={blogResult} /> : <EmptyResult label="Le plan d'article apparaîtra ici" />)}
        </div>
      </div>
    </>
  );
}

// ── Helpers UI ──────────────────────────────────────────────────────────────
function OutputCard({ wf }: { wf: WF }) {
  const o = OUTPUT[wf];
  return (
    <div className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400"><FileText className="h-3.5 w-3.5 text-brand-500" /> Sortie attendue</span>
        <Badge tone={o.speed === "Rapide" ? "good" : "brand"}>{o.speed}</Badge>
      </div>
      <p className="text-xs text-[var(--text-muted)]">{o.items}</p>
      <p className="mt-1 text-[11px] text-[var(--text-muted)]"><span className="font-medium text-[var(--text)]">Où le publier :</span> {o.where}</p>
    </div>
  );
}
function Rationale({ wf }: { wf: WF }) {
  const r = RATIONALE[wf];
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="rounded-lg bg-[var(--bg)] px-2.5 py-2 text-xs text-[var(--text-muted)]"><span className="font-semibold text-[var(--text)]">Pourquoi : </span>{r.why}</div>
      <div className="flex items-start gap-1.5 rounded-lg bg-brand-50 px-2.5 py-2 text-xs text-brand-900 dark:bg-brand-950/40 dark:text-brand-200"><TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span><span className="font-semibold">Impact SEO : </span>{r.impact}</span></div>
    </div>
  );
}
function EmptyResult({ label }: { label: string }) {
  return (
    <Card className="flex h-full min-h-[360px] flex-col items-center justify-center text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950"><FileText className="h-7 w-7" /></div>
      <h3 className="mt-4 text-base font-semibold">{label}</h3>
      <p className="mt-1.5 max-w-xs text-sm text-[var(--text-muted)]">Remplissez le formulaire et lancez la génération.</p>
    </Card>
  );
}
function SkeletonResult() { return <Card className="min-h-[360px] space-y-3">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-4 rounded ork-skeleton" style={{ width: `${60 + ((i * 13) % 40)}%` }} />)}</Card>; }
function CopyBtn({ text }: { text: string }) {
  const [c, setC] = useState(false);
  return <button onClick={() => { navigator.clipboard.writeText(text); setC(true); setTimeout(() => setC(false), 1400); }} className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--text-muted)] transition hover:text-brand-600">{c ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}{c ? "Copié" : "Copier"}</button>;
}
function Block({ title, value, mono }: { title: string; value: string; mono?: boolean }) {
  return <div><div className="mb-1 flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-ink-400">{title}</span><CopyBtn text={value} /></div><div className={`rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm ${mono ? "font-mono" : ""}`}>{value}</div></div>;
}
function ListBlock({ title, items }: { title: string; items: string[] }) {
  return <div><span className="text-xs font-semibold uppercase tracking-wide text-ink-400">{title}</span><div className="mt-2 flex flex-wrap gap-1.5">{items.map((it, i) => <span key={i} className="rounded-lg bg-ink-100 px-2 py-1 text-xs dark:bg-ink-900">{it}</span>)}</div></div>;
}
function FaqBlock({ faq }: { faq: { q: string; a: string }[] }) {
  return <div><span className="text-xs font-semibold uppercase tracking-wide text-ink-400">FAQ</span><div className="mt-2 space-y-2">{faq.map((f, i) => <div key={i} className="rounded-xl border border-[var(--border)] p-3"><div className="text-sm font-medium">{f.q}</div><div className="mt-1 text-sm text-[var(--text-muted)]">{f.a}</div></div>)}</div></div>;
}
function WhereRow({ where, addQ }: { where: string; addQ: string }) {
  return <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3 text-xs"><MapPin className="h-3.5 w-3.5 shrink-0 text-brand-500" /><span className="font-mono text-[11px] text-[var(--text-muted)]">{where}</span><Link href={assistantLink(addQ)} className="ml-auto"><Button variant="ghost" size="sm" icon={<ArrowRight className="h-3.5 w-3.5" />}>Où l&apos;ajouter ?</Button></Link></div>;
}

function ProductResult({ result }: { result: ProductSeoResult }) {
  return (
    <Card className="animate-fade-in space-y-5">
      <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Fiche générée</h3><div className="flex gap-3 text-xs"><span className="flex items-center gap-1.5"><span className="text-[var(--text-muted)]">SEO</span><Badge tone="good">{result.seoScore}</Badge></span><span className="flex items-center gap-1.5"><span className="text-[var(--text-muted)]">Conversion</span><Badge tone="good">{result.conversionScore}</Badge></span></div></div>
      <Rationale wf="product" />
      <Block title="Titre optimisé" value={result.optimizedTitle} />
      <div className="grid gap-4 sm:grid-cols-2"><Block title="Meta title" value={result.metaTitle} /><Block title="Handle" value={result.handle} mono /></div>
      <Block title="Meta description" value={result.metaDescription} />
      {(result.productType || result.parentCollection) && (<div className="grid gap-4 sm:grid-cols-2">{result.productType && <Block title="Product type" value={result.productType} />}{result.parentCollection && <Block title="Collection parente" value={result.parentCollection} />}</div>)}
      <div><div className="mb-1.5 flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-ink-400">Description longue (HTML Shopify)</span><CopyBtn text={result.longDescriptionHtml} /></div><pre className="max-h-52 overflow-auto rounded-xl bg-ink-950 p-3 text-xs text-ink-100"><code>{result.longDescriptionHtml}</code></pre></div>
      <div className="grid gap-4 sm:grid-cols-2"><ListBlock title="Mots-clés principaux" items={result.primaryKeywords} /><ListBlock title="Longue traîne" items={result.longTailKeywords} />{!!result.tags?.length && <ListBlock title="Tags recommandés" items={result.tags} />}<ListBlock title="Alt text images" items={result.imageAltTexts} /></div>
      <FaqBlock faq={result.faq} />
      {result.merchantNote && <div className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"><span className="font-semibold">Google Merchant : </span>{result.merchantNote}</div>}
      <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-4"><Link href={assistantLink("Où ajouter une fiche produit (description, meta, tags, type) dans Shopify ?")}><Button variant="secondary" size="sm" icon={<MapPin className="h-3.5 w-3.5" />}>Où l&apos;ajouter dans Shopify ?</Button></Link><Link href={councilLink("seo", "Contexte : Content Factory vient de générer une fiche produit. Réponds uniquement : comment l'améliorer (angle éditorial, maillage interne, données Google Merchant), sans refaire d'audit complet.")}><Button variant="outline" size="sm" icon={<Sparkles className="h-3.5 w-3.5" />}>Améliorer avec AI Council</Button></Link></div>
    </Card>
  );
}
function CollectionResult({ r }: { r: CollectionSeoResult }) {
  return (
    <Card className="animate-fade-in space-y-5">
      <h3 className="text-sm font-semibold">Page collection générée</h3>
      <Rationale wf="collection" />
      <div className="grid gap-4 sm:grid-cols-2"><Block title="Meta title" value={r.metaTitle} /><Block title="H1" value={r.h1} /></div>
      <Block title="Meta description" value={r.metaDescription} />
      <div><div className="mb-1.5 flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-ink-400">Description de collection (à coller)</span><CopyBtn text={r.descriptionHtml} /></div><pre className="max-h-52 overflow-auto rounded-xl bg-ink-950 p-3 text-xs text-ink-100"><code>{r.descriptionHtml}</code></pre></div>
      <ListBlock title="Structure" items={r.outline} />
      <div className="grid gap-4 sm:grid-cols-2"><ListBlock title="Mots-clés" items={r.primaryKeywords} /><ListBlock title="Longue traîne" items={r.longTailKeywords} /></div>
      <FaqBlock faq={r.faq} />
      <div className="grid gap-4 sm:grid-cols-2"><ListBlock title="Maillage vers collections" items={r.internalLinks} /><ListBlock title="Maillage vers produits" items={r.productLinks} /></div>
      <div className="rounded-lg bg-[var(--bg)] px-3 py-2 text-xs"><span className="font-semibold">CTA sobre : </span>{r.cta}</div>
      <div className="space-y-1 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3 text-xs text-[var(--text-muted)]">
        <div className="mb-0.5 font-semibold text-[var(--text)]">Où ajouter dans Shopify</div>
        <div><span className="font-medium text-[var(--text)]">Description :</span> {r.where}</div>
        <div><span className="font-medium text-[var(--text)]">Meta :</span> Produit / Collection → Aperçu du référencement naturel → Modifier</div>
        <div><span className="font-medium text-[var(--text)]">FAQ :</span> section dédiée du thème, ou AI Council → Code Shopify si le thème ne le permet pas</div>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
        <Link href={assistantLink("Où ajouter du texte et une FAQ à une collection dans Shopify ?")}><Button variant="secondary" size="sm" icon={<MapPin className="h-3.5 w-3.5" />}>Où l&apos;ajouter ?</Button></Link>
        <Link href={councilLink("seo", `Contexte : Content Factory a généré le SEO de la collection « ${r.h1} ». Réponds uniquement : comment renforcer cette page (maillage vers produits, FAQ, mots-clés longue traîne), sans audit complet.`)}><Button variant="outline" size="sm" icon={<Sparkles className="h-3.5 w-3.5" />}>Approfondir dans AI Council</Button></Link>
      </div>
    </Card>
  );
}
function MetaResult({ variants }: { variants: MetaVariant[] }) {
  return (
    <Card className="animate-fade-in space-y-3">
      <h3 className="text-sm font-semibold">3 variantes meta</h3>
      <Rationale wf="meta" />
      {variants.map((v, i) => (
        <div key={i} className="rounded-xl border border-[var(--border)] p-3.5">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <Badge tone="brand">Variante {i + 1} · {v.angle}</Badge>
            <Badge tone={v.gmcRisk === "faible" ? "good" : "warn"}>Risque GMC : {v.gmcRisk}</Badge>
          </div>
          <div className="flex items-center justify-between gap-2"><span className="min-w-0 break-words text-sm font-medium">{v.title}</span><CopyBtn text={v.title} /></div>
          <div className="mt-1 text-right"><Badge tone={v.titleLen <= 60 ? "good" : "warn"}>{v.titleLen} car.</Badge></div>
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-[var(--border)] pt-2"><span className="min-w-0 break-words text-sm text-[var(--text-muted)]">{v.metaDescription}</span><CopyBtn text={v.metaDescription} /></div>
          <div className="mt-1 flex items-center justify-between gap-2"><span className="text-[11px] text-[var(--text-muted)]">{v.why}</span><Badge tone={v.metaLen <= 155 ? "good" : "warn"}>{v.metaLen} car.</Badge></div>
        </div>
      ))}
      <WhereRow where="Shopify → Produit / Collection / Page → Aperçu du référencement naturel → Modifier" addQ="Où modifier les meta descriptions dans Shopify ?" />
    </Card>
  );
}
function AltResult({ alts, subject }: { alts: AltTextItem[]; subject: string }) {
  return (
    <Card className="animate-fade-in space-y-3">
      <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Alt text</h3><CopyBtn text={alts.map((a) => a.alt).join("\n")} /></div>
      <Rationale wf="alt" />
      <div className="space-y-1.5">{alts.map((a, i) => (
        <div key={i} className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2.5">
          <div className="flex items-center justify-between gap-2"><span className="min-w-0 break-words text-sm font-medium">{a.alt}</span><CopyBtn text={a.alt} /></div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-muted)]"><Badge tone="neutral">{a.type}</Badge><span>mot-clé : <code className="font-mono text-brand-700 dark:text-brand-300">{a.keyword}</code></span></div>
        </div>
      ))}</div>
      <div className="rounded-lg border-l-[3px] border-brand-400 bg-[var(--bg)] py-2 pl-3 pr-2.5 text-xs text-[var(--text-muted)]"><span className="font-semibold text-[var(--text)]">Règle : </span>l&apos;alt text doit décrire l&apos;image avant de viser le mot-clé. Pour « {subject} ».</div>
      <WhereRow where="Shopify → Produit → Médias → Modifier le texte alternatif" addQ="Où ajouter les alt text des images dans Shopify ?" />
    </Card>
  );
}
function BlogResult({ r }: { r: BlogOutlineResult }) {
  return (
    <Card className="animate-fade-in space-y-4">
      <div><div className="mb-1 flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-ink-400">Titre</span><CopyBtn text={r.title} /></div><div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm font-medium">{r.title}</div></div>
      <Rationale wf="blog" />
      <div className="flex flex-wrap items-center gap-2 text-xs"><Badge tone="brand">Mot-clé : {r.keyword}</Badge><Badge tone="neutral">{r.intent}</Badge><Badge tone="warn">{r.priority}</Badge></div>
      <div className="rounded-lg bg-[var(--bg)] px-3 py-2 text-xs text-[var(--text-muted)]"><div><span className="font-semibold text-[var(--text)]">Angle : </span>{r.angle}</div><div className="mt-0.5"><span className="font-semibold text-[var(--text)]">Pourquoi : </span>{r.why}</div></div>
      <ListBlock title="Mots-clés secondaires" items={r.secondaryKeywords} />
      <Block title="Intro" value={r.intro} />
      <ListBlock title="Plan (H2/H3)" items={r.outline} />
      <FaqBlock faq={r.faq} />
      <div className="grid gap-4 sm:grid-cols-2"><Block title="Meta title" value={r.metaTitle} /><Block title="Meta description" value={r.metaDescription} /></div>
      <div className="rounded-xl bg-brand-50 p-3 text-xs dark:bg-brand-950/40"><div className="text-brand-800 dark:text-brand-200"><span className="font-semibold">Maillage : </span>{r.internalLink}</div><div className="mt-1 text-brand-800 dark:text-brand-200"><span className="font-semibold">CTA : </span>{r.cta}</div></div>
      <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-4"><Link href={councilLink("seo", `Contexte : Content Factory a généré le plan de l'article « ${r.title} ». Réponds uniquement : rédige l'article complet en suivant ce plan (intro, H2/H3, FAQ, CTA), prêt à publier.`)}><Button variant="secondary" size="sm" icon={<Sparkles className="h-3.5 w-3.5" />}>Rédiger avec AI Council</Button></Link><Link href={assistantLink("Où publier un article de blog dans Shopify ?")}><Button variant="outline" size="sm" icon={<MapPin className="h-3.5 w-3.5" />}>Où le publier ?</Button></Link></div>
    </Card>
  );
}

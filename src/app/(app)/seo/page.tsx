"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { useOrkestra, connectedProviders } from "@/lib/store";
import { getPreset } from "@/lib/niche";
import { generateCollectionSeo, generateMetaVariants, generateAltTexts, generateBlogOutline } from "@/lib/ai/engine";
import type { CollectionSeoResult, MetaVariant, BlogOutlineResult, AltTextItem } from "@/lib/ai/engine";
import { assistantLink, councilLink } from "@/lib/shopify";
import {
  buildFactoryQueue, prioritizeTasks, computeProgress, STATUS_META, PRIORITY_META, PRODUCED_STATUSES,
  type FactoryType, type FactoryTask,
} from "@/lib/factory";
import { PageHeader, Card, Badge, Field, ScoreRing, Progress } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import type { ProductSeoResult, SeoLevel, GenerationRecord } from "@/lib/types";
import { relativeDate } from "@/lib/utils";
import {
  Sparkles, FileText, FolderOpen, Tag, ImageIcon, Newspaper, Copy, Check, Wand2,
  ArrowRight, Package, MapPin, ListChecks, TrendingUp, Factory, Timer, X, CheckCircle2, Clock, Rocket, ScanSearch,
} from "lucide-react";

// ── Maps de formats de production ────────────────────────────────────────────
const TYPE_ICON: Record<FactoryType, React.ElementType> = { meta: Tag, collection: FolderOpen, product: Package, alt: ImageIcon, blog: Newspaper };
const TYPE_LABEL: Record<FactoryType, string> = { meta: "Meta", collection: "Collection", product: "Fiche produit", alt: "Alt text", blog: "Article" };
const TYPE_SHORT: Record<FactoryType, string> = { meta: "Meta", collection: "Collections", product: "Produits", alt: "Images", blog: "Articles" };

const FORMATS: { id: FactoryType; label: string; icon: React.ElementType; tagline: string }[] = [
  { id: "meta", label: "Produire des meta", icon: Tag, tagline: "Titles et meta descriptions propres pour les pages détectées comme manquantes." },
  { id: "collection", label: "Enrichir une collection", icon: FolderOpen, tagline: "Description, FAQ et maillage pour une collection faible." },
  { id: "product", label: "Renforcer une fiche produit", icon: Package, tagline: "Description, FAQ, alt text, tags et product_type." },
  { id: "alt", label: "Compléter les alt text", icon: ImageIcon, tagline: "Textes alternatifs descriptifs pour les images sans alt." },
  { id: "blog", label: "Préparer un article", icon: Newspaper, tagline: "Plan d'article longue traîne relié à une collection." },
];

const RATIONALE: Record<FactoryType, { why: string; impact: string }> = {
  product: { why: "Fiche complète prête à coller, alignée sur votre niche et votre ton.", impact: "Conversion + longue traîne produit + flux Google Merchant." },
  collection: { why: "Page business : capte une requête transactionnelle (« acheter / choisir »).", impact: "Gain de positions sur les requêtes commerciales." },
  meta: { why: "Meta naturelles et bien dimensionnées = meilleur taux de clic.", impact: "Plus de clics à positions égales dans Google." },
  alt: { why: "Alt descriptifs, sans bourrage de mots-clés.", impact: "SEO images + accessibilité." },
  blog: { why: "Cocon de contenu longue traîne, maillé vers vos collections.", impact: "Trafic informationnel + autorité thématique." },
};

const OUTPUT: Record<FactoryType, { items: string; where: string; speed: "Rapide" | "Approfondi" }> = {
  product: { items: "Title, meta, description HTML, bénéfices, FAQ, alt text, mots-clés, tags, product_type, note Merchant", where: "Fiche produit Shopify", speed: "Approfondi" },
  collection: { items: "Title, meta, description 200–300 mots, H2/H3, FAQ, maillage produits & collections", where: "Produits → Collections → Description", speed: "Approfondi" },
  meta: { items: "3 variantes title / meta selon l'intention, longueurs + risque GMC", where: "Aperçu du référencement naturel de la page", speed: "Rapide" },
  alt: { items: "Alt text descriptifs et sobres (type d'image + mot-clé associé)", where: "Produit → Médias → Texte alternatif", speed: "Rapide" },
  blog: { items: "Plan H2/H3, intro, mots-clés, FAQ, CTA, maillage vers collection", where: "Boutique en ligne → Articles de blog", speed: "Approfondi" },
};

const WHERE_Q: Record<FactoryType, string> = {
  meta: "Où modifier les meta descriptions dans Shopify ?",
  collection: "Où ajouter du texte et une FAQ à une collection dans Shopify ?",
  product: "Où ajouter une fiche produit (description, meta, tags, type) dans Shopify ?",
  alt: "Où ajouter les alt text des images dans Shopify ?",
  blog: "Où publier un article de blog dans Shopify ?",
};
const IMPROVE_Q: Record<FactoryType, string> = {
  meta: "Contexte : Content Factory vient de produire des variantes de meta. Réponds uniquement : comment les affiner (intention, longueur, CTA) sans refaire d'audit.",
  collection: "Contexte : Content Factory vient de produire le contenu d'une collection. Réponds uniquement : comment renforcer cette page (maillage, FAQ, longue traîne) sans audit complet.",
  product: "Contexte : Content Factory vient de produire une fiche produit. Réponds uniquement : comment l'améliorer (angle éditorial, maillage, données Google Merchant) sans refaire d'audit.",
  alt: "Contexte : Content Factory vient de produire des alt text. Réponds uniquement : comment les rendre plus descriptifs et utiles, sans bourrage de mots-clés.",
  blog: "Contexte : Content Factory a produit un plan d'article. Réponds uniquement : rédige l'article complet en suivant ce plan (intro, H2/H3, FAQ, CTA), prêt à publier.",
};

export default function ContentFactoryPage() {
  const {
    connections, brand, analysis, addGeneration, seo, setSeo,
    factoryStatus, factoryOutputs, setFactoryStatus, addFactoryOutput, clearFactoryOutputs,
  } = useOrkestra();
  const providers = connectedProviders(connections);
  const { preset } = getPreset({ niche: brand.niche, brandName: brand.storeName });
  const cols = brand.collections.length ? brand.collections : preset.collections;

  const { categories, tasks } = useMemo(() => buildFactoryQueue(analysis, brand), [analysis, brand]);
  const prioritized = useMemo(() => prioritizeTasks(tasks, factoryStatus), [tasks, factoryStatus]);
  const progress = useMemo(() => computeProgress(tasks, factoryStatus), [tasks, factoryStatus]);

  const [active, setActive] = useState<FactoryType>("product");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const inited = useRef(false);

  // Fiche produit (live API)
  const [form, setForm] = useState({
    productName: "", url: "", collection: "", features: "", benefits: "", materials: "",
    price: "", audience: "", keywords: "", ton: brand.writingStyle, level: "poussé" as SeoLevel, format: "html",
  });
  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) { setForm((f) => ({ ...f, [k]: v })); }

  // Workflows clients
  const [collInput, setCollInput] = useState(cols[0] || "");
  const [metaSubject, setMetaSubject] = useState("");
  const [metaType, setMetaType] = useState<"produit" | "collection" | "accueil">("collection");
  const [altSubject, setAltSubject] = useState("");
  const [blogTopic, setBlogTopic] = useState("");
  const [blogColl, setBlogColl] = useState(cols[0] || "");

  // Résultats persistés
  const result = seo.product;
  const prodMeta = seo.productMeta;
  const collResult = seo.collection;
  const metaResult = seo.meta;
  const altResult = seo.alt;
  const blogResult = seo.blog;

  const nicheCtx = { niche: brand.niche, brandName: brand.storeName, positioning: brand.positioning, keywords: brand.primaryKeywords.join(", ") };
  const selectedTask = tasks.find((t) => t.id === selectedTaskId);
  const taskForActive = selectedTask && selectedTask.type === active ? selectedTask : undefined;
  const altTask = tasks.find((t) => t.id === "alt:global");
  const altRemaining = altTask && !PRODUCED_STATUSES.includes(factoryStatus["alt:global"] ?? "todo") ? altTask.count ?? 0 : 0;

  const hasResult = active === "product" ? !!result : active === "collection" ? !!collResult : active === "meta" ? !!metaResult : active === "alt" ? !!altResult : !!blogResult;

  function flash(msg: string) { setToast(msg); window.setTimeout(() => setToast(null), 1800); }
  function scrollToZone() { window.setTimeout(() => zoneRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60); }

  // Charge une tâche dans la zone de production (sélection + pré-remplissage).
  function loadTask(t: FactoryTask) {
    setActive(t.type);
    setSelectedTaskId(t.id);
    if (t.type === "product") setForm((f) => ({ ...f, productName: t.title, collection: t.collection || f.collection || cols[0] || "" }));
    if (t.type === "collection") setCollInput(t.collection || t.title);
    if (t.type === "meta") { setMetaType(t.metaType || "collection"); setMetaSubject(t.metaType === "accueil" ? brand.niche || "" : t.collection || t.title); }
    if (t.type === "alt") setAltSubject(analysis?.priorityProducts?.[0]?.title || preset.sampleProduct);
    if (t.type === "blog") { setBlogTopic(t.title); setBlogColl(t.collection || cols[0] || ""); }
  }
  function startTask(t: FactoryTask) {
    loadTask(t);
    if ((factoryStatus[t.id] ?? "todo") === "todo") setFactoryStatus(t.id, "doing");
    scrollToZone();
  }
  function selectFormat(type: FactoryType) {
    setActive(type);
    const t = prioritized.find((x) => x.type === type) || tasks.find((x) => x.type === type);
    if (t) loadTask(t); else setSelectedTaskId(null);
  }
  function ignoreTask(t: FactoryTask) { setFactoryStatus(t.id, "ignored"); flash("Tâche ignorée"); }
  function markDone(t: FactoryTask) { setFactoryStatus(t.id, "published"); flash("Marqué comme fait"); }

  // Sélection initiale : la tâche la plus prioritaire.
  useEffect(() => {
    if (inited.current) return;
    const first = prioritized[0] || tasks[0];
    if (first) { inited.current = true; loadTask(first); }
  }, [prioritized, tasks]); // eslint-disable-line react-hooks/exhaustive-deps

  // Enregistre une sortie produite + passe la tâche en « généré ».
  function record(type: FactoryType, title: string, copyText: string) {
    if (taskForActive) setFactoryStatus(taskForActive.id, "generated");
    addFactoryOutput({ id: crypto.randomUUID(), taskId: taskForActive?.id, type, title, copyText, status: "generated", createdAt: new Date().toISOString() });
    flash("Contenu produit");
  }

  async function generateProduct() {
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
      record("product", `Fiche produit — ${form.productName || "Produit"}`, data.result.longDescriptionHtml || data.result.optimizedTitle);
      addGeneration({ id: crypto.randomUUID(), type: "seo-product", title: `Fiche produit — ${form.productName || "Produit"}`, store: brand.storeName || "Boutique", createdAt: new Date().toISOString(), models: providers.length ? providers : ["openai"], status: "completed", score: data.result.seoScore, preview: "Titre, description HTML, FAQ, meta, tags et mots-clés produits." } as GenerationRecord);
    }
  }
  function produceCollection() { const c = collInput || cols[0]; const r = generateCollectionSeo({ collection: c, ...nicheCtx, others: cols }); setSeo({ collection: r }); record("collection", `Collection — ${c}`, r.descriptionHtml); }
  function produceMeta() { const subject = metaSubject || (metaType === "accueil" ? brand.niche || preset.label : cols[0]); const r = generateMetaVariants({ subject, type: metaType, ...nicheCtx }); setSeo({ meta: r }); record("meta", `Meta — ${subject}`, r.map((v) => `${v.title}\n${v.metaDescription}`).join("\n\n")); }
  function produceAlt() { const subject = altSubject || preset.sampleProduct; const r = generateAltTexts({ subject, niche: brand.niche, count: 5 }); setSeo({ alt: r, altSubject: subject }); record("alt", `Alt text — ${subject}`, r.map((a) => a.alt).join("\n")); }
  function produceBlog() { const r = generateBlogOutline({ topic: blogTopic, collection: blogColl || cols[0], ...nicheCtx }); setSeo({ blog: r }); record("blog", `Article — ${r.title}`, `${r.title}\n\n${r.outline.join("\n")}`); }

  function currentCopyText(): string {
    if (active === "product") return result?.longDescriptionHtml || "";
    if (active === "collection") return collResult?.descriptionHtml || "";
    if (active === "meta") return (metaResult || []).map((v) => `${v.title}\n${v.metaDescription}`).join("\n\n");
    if (active === "alt") return (altResult || []).map((a) => a.alt).join("\n");
    return blogResult ? `${blogResult.title}\n\n${blogResult.outline.join("\n")}` : "";
  }
  function bumpOutput(taskId: string | undefined, status: "copied" | "published" | "to_publish") {
    if (!taskId) return;
    const o = factoryOutputs.find((x) => x.taskId === taskId);
    if (o) addFactoryOutput({ ...o, status });
  }
  function copyMain() { navigator.clipboard.writeText(currentCopyText()); if (taskForActive) { setFactoryStatus(taskForActive.id, "copied"); bumpOutput(taskForActive.id, "copied"); } flash("Contenu copié"); }
  function markPublished() { if (taskForActive) { setFactoryStatus(taskForActive.id, "published"); bumpOutput(taskForActive.id, "published"); } flash("Marqué comme publié"); }

  return (
    <>
      <PageHeader
        title="Content Factory"
        description="Votre atelier de production de contenus e-commerce. Orkestra détecte les contenus manquants ou faibles : produisez-les, copiez-les, publiez-les dans Shopify et suivez ce qu'il reste à faire."
      />

      <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Badge tone="brand"><Sparkles className="h-3 w-3" /> Basé sur votre scan public et la mémoire boutique</Badge>
        <span className="text-xs text-[var(--text-muted)]">Contenu prêt à copier — adapté à votre niche, à relire avant publication si nécessaire.</span>
      </div>

      {!analysis && (
        <Card className="ork-rise mb-5 flex flex-col items-center gap-3 border-brand-200 bg-gradient-to-br from-brand-50 to-transparent text-center dark:border-brand-900 dark:from-brand-950/40 sm:flex-row sm:text-left">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-600 text-white"><ScanSearch className="h-5 w-5" /></span>
          <div className="flex-1"><h3 className="text-sm font-semibold">Scannez votre boutique pour une file de production précise</h3><p className="mt-0.5 text-sm text-[var(--text-muted)]">Vous pouvez déjà produire des contenus, mais le scan détecte vos meta manquantes, fiches faibles et images sans alt.</p></div>
          <Link href="/onboarding"><Button size="sm" icon={<ScanSearch className="h-4 w-4" />}>Scanner ma boutique</Button></Link>
        </Card>
      )}

      <div className="ork-stagger space-y-5">
        {/* ── Progression de production ── */}
        <Card className="ork-rise overflow-hidden border-brand-200 bg-gradient-to-br from-brand-50 to-transparent dark:border-brand-900 dark:from-brand-950/40">
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <ScoreRing value={progress.percent} size={92} label="produit" />
              <div>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300"><Factory className="h-3.5 w-3.5" /> Production de contenu</div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge tone="brand">{progress.remaining} à produire</Badge>
                  <Badge tone="good">{progress.produced} produits</Badge>
                  <Badge tone="neutral">{progress.published} publiés</Badge>
                  {altRemaining > 0 && <Badge tone="warn">{altRemaining} alt text restants</Badge>}
                </div>
                <p className="mt-1.5 max-w-md text-xs text-[var(--text-muted)]">Traitez vos contenus un par un : détecté → produit → copié → publié. Revenez quand vous voulez, votre avancement est sauvegardé.</p>
              </div>
            </div>
            {prioritized[0] && <Button onClick={() => startTask(prioritized[0])} icon={<Rocket className="h-4 w-4" />}>Produire le prochain</Button>}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {categories.map((c) => {
              const bt = progress.byType[c.type];
              const pct = bt.total ? Math.round((bt.produced / bt.total) * 100) : 0;
              const Icon = TYPE_ICON[c.type];
              return (
                <div key={c.type} className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
                  <div className="flex items-center justify-between"><span className="flex items-center gap-1 text-[11px] font-medium"><Icon className="h-3.5 w-3.5 text-brand-500" /> {TYPE_SHORT[c.type]}</span><span className="text-[11px] text-[var(--text-muted)]">{bt.produced}/{bt.total}</span></div>
                  <div className="mt-2"><Progress value={pct} /></div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* ── File de production ── */}
        <Card>
          <div className="mb-1 flex items-center gap-1.5 text-sm font-bold"><ListChecks className="h-4 w-4 text-brand-600" /> File de production</div>
          <p className="mb-3 text-xs text-[var(--text-muted)]">Chaque catégorie de contenu détectée par Orkestra. Cliquez pour produire.</p>
          <div className="ork-stagger grid grid-cols-2 gap-3 lg:grid-cols-5">
            {categories.map((c) => {
              const Icon = TYPE_ICON[c.type];
              const bt = progress.byType[c.type];
              const on = active === c.type;
              const first = prioritized.find((t) => t.type === c.type) || tasks.find((t) => t.type === c.type);
              return (
                <button key={c.type} onClick={() => (first ? startTask(first) : selectFormat(c.type))} className={`ork-interactive flex flex-col rounded-xl border p-3 text-left hover:border-brand-300 ${on ? "border-brand-500 bg-brand-50 dark:bg-brand-950" : "border-[var(--border)]"}`}>
                  <div className="flex items-center justify-between"><Icon className="h-4 w-4 text-brand-500" /><span className="text-lg font-bold">{c.count}</span></div>
                  <div className="mt-1 text-xs font-semibold leading-tight">{c.label}</div>
                  <div className="mt-0.5 flex-1 text-[10px] leading-tight text-[var(--text-muted)]">{c.desc}</div>
                  <div className="mt-1.5 flex items-center gap-1"><Badge tone={PRIORITY_META[c.priority].tone}>{c.priority}</Badge><span className="text-[10px] text-[var(--text-muted)]">{bt.produced}/{bt.total} faits</span></div>
                  <div className="mt-1 truncate text-[10px] text-[var(--text-muted)]"><span className="font-medium text-[var(--text)]">Où :</span> {c.where}</div>
                  <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-brand-700 dark:text-brand-300">Produire <ArrowRight className="h-3 w-3" /></span>
                </button>
              );
            })}
          </div>
        </Card>

        {/* ── À produire maintenant ── */}
        <Card>
          <div className="mb-1 flex items-center gap-1.5 text-sm font-bold"><Rocket className="h-4 w-4 text-brand-600" /> À produire maintenant</div>
          <p className="mb-3 text-xs text-[var(--text-muted)]">Vos contenus prioritaires, triés automatiquement. Traitez-les un par un.</p>
          {prioritized.length === 0 ? (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 dark:border-emerald-900/60 dark:bg-emerald-950/20">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
              <div><div className="text-sm font-semibold">Tout est traité 🎉</div><p className="text-xs text-[var(--text-muted)]">Aucun contenu en attente. Relancez un scan après vos changements pour détecter de nouveaux contenus à produire.</p></div>
            </div>
          ) : (
            <div className="ork-stagger space-y-2.5">
              {prioritized.slice(0, 6).map((t, i) => {
                const Icon = TYPE_ICON[t.type];
                const st = factoryStatus[t.id] ?? "todo";
                return (
                  <div key={t.id} className="ork-rise rounded-xl border border-[var(--border)] p-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-brand-600 text-[10px] font-bold text-white">{i + 1}</span>
                      <Icon className="h-4 w-4 text-brand-500" />
                      <span className="text-sm font-semibold">{TYPE_LABEL[t.type]} — {t.title}</span>
                      <Badge tone={PRIORITY_META[t.priority].tone}>{PRIORITY_META[t.priority].label}</Badge>
                      <Badge tone={STATUS_META[st].tone}>{STATUS_META[st].label}</Badge>
                      <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)]"><Timer className="h-3 w-3" /> {t.eta}</span>
                    </div>
                    <p className="mt-1.5 text-xs text-[var(--text-muted)]">{t.impact}</p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" icon={<Wand2 className="h-3.5 w-3.5" />} onClick={() => startTask(t)}>Produire</Button>
                      <Button size="sm" variant="ghost" icon={<CheckCircle2 className="h-3.5 w-3.5" />} onClick={() => markDone(t)}>Marquer comme fait</Button>
                      <Button size="sm" variant="ghost" icon={<X className="h-3.5 w-3.5" />} onClick={() => ignoreTask(t)}>Ignorer</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* ── Formats de production (onglets) ── */}
        <div className="flex flex-wrap gap-2">
          {FORMATS.map((f) => {
            const Icon = f.icon;
            const on = active === f.id;
            return (
              <button key={f.id} onClick={() => selectFormat(f.id)} className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition ${on ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300" : "border-[var(--border)] text-[var(--text-muted)] hover:border-brand-300"}`}>
                <Icon className="h-4 w-4" /> {f.label}
              </button>
            );
          })}
        </div>

        {/* ── Zone de production ── */}
        <div ref={zoneRef} className="grid gap-5 lg:grid-cols-2">
          <Card>
            {/* Production sélectionnée */}
            {selectedTask && selectedTask.type === active ? (
              <div className="mb-4 rounded-xl border border-brand-200 bg-brand-50/60 p-3 dark:border-brand-900 dark:bg-brand-950/30">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">Production sélectionnée</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2"><span className="text-sm font-semibold">{TYPE_LABEL[selectedTask.type]} — {selectedTask.title}</span><Badge tone={PRIORITY_META[selectedTask.priority].tone}>{PRIORITY_META[selectedTask.priority].label}</Badge></div>
                <p className="mt-1 text-xs text-[var(--text-muted)]"><span className="font-medium text-[var(--text)]">Pourquoi : </span>{selectedTask.impact}</p>
                <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)]"><Timer className="h-3 w-3" /> {selectedTask.eta} · à publier dans : {selectedTask.where}</div>
              </div>
            ) : (
              <div className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3 text-xs text-[var(--text-muted)]">Production libre — {FORMATS.find((f) => f.id === active)?.tagline}</div>
            )}

            <OutputCard type={active} />

            {active === "product" && (
              <>
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
                    <Field label="Niveau de production">
                      <div className="flex gap-1.5">{(["standard", "poussé", "ultra"] as SeoLevel[]).map((l) => (<button key={l} onClick={() => set("level", l)} className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium capitalize transition ${form.level === l ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950" : "border-[var(--border)] text-[var(--text-muted)]"}`}>{l}</button>))}</div>
                    </Field>
                  </div>
                  <Button onClick={generateProduct} loading={loading} size="lg" className="w-full" icon={!loading ? <Wand2 className="h-4 w-4" /> : undefined}>{loading ? "Production en cours…" : "Produire la fiche"}</Button>
                  {providers.length === 0 && <p className="text-center text-xs text-amber-600">Aucune IA connectée — la démo utilise le mode simulé.</p>}
                </div>
              </>
            )}

            {active === "collection" && (
              <>
                <Field label="Collection"><input className="input" value={collInput} onChange={(e) => setCollInput(e.target.value)} placeholder={cols[0]} list="ork-cols2" /><datalist id="ork-cols2">{cols.map((c) => <option key={c} value={c} />)}</datalist></Field>
                <Button onClick={produceCollection} className="mt-4 w-full" icon={<Wand2 className="h-4 w-4" />}>Enrichir cette collection</Button>
              </>
            )}

            {active === "meta" && (
              <>
                <Field label="Type de page"><div className="flex gap-1.5">{(["produit", "collection", "accueil"] as const).map((t) => (<button key={t} onClick={() => setMetaType(t)} className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium capitalize transition ${metaType === t ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950" : "border-[var(--border)] text-[var(--text-muted)]"}`}>{t}</button>))}</div></Field>
                <div className="mt-4"><Field label="Sujet de la page"><input className="input" value={metaSubject} onChange={(e) => setMetaSubject(e.target.value)} placeholder={metaType === "accueil" ? brand.niche || preset.label : cols[0]} /></Field></div>
                <Button onClick={produceMeta} className="mt-4 w-full" icon={<Wand2 className="h-4 w-4" />}>Produire les meta</Button>
              </>
            )}

            {active === "alt" && (
              <>
                <Field label="Produit / sujet de l'image"><input className="input" value={altSubject} onChange={(e) => setAltSubject(e.target.value)} placeholder={`Ex : ${preset.sampleProduct}`} /></Field>
                <Button onClick={produceAlt} className="mt-4 w-full" icon={<Wand2 className="h-4 w-4" />}>Compléter les alt text</Button>
              </>
            )}

            {active === "blog" && (
              <>
                <Field label="Sujet de l'article"><input className="input" value={blogTopic} onChange={(e) => setBlogTopic(e.target.value)} placeholder="Laisser vide pour une suggestion automatique" /></Field>
                <div className="mt-4"><Field label="Collection à mailler"><input className="input" value={blogColl} onChange={(e) => setBlogColl(e.target.value)} placeholder={cols[0]} list="ork-cols3" /><datalist id="ork-cols3">{cols.map((c) => <option key={c} value={c} />)}</datalist></Field></div>
                <Button onClick={produceBlog} className="mt-4 w-full" icon={<Wand2 className="h-4 w-4" />}>Préparer l&apos;article</Button>
              </>
            )}
          </Card>

          <div>
            {/* Barre de production (statut + actions) */}
            {hasResult && (
              <Card className="mb-4 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold">Statut :</span>
                <Badge tone={taskForActive ? STATUS_META[factoryStatus[taskForActive.id] ?? "generated"].tone : "brand"}>{taskForActive ? STATUS_META[factoryStatus[taskForActive.id] ?? "generated"].label : "Généré"}</Badge>
                <div className="ml-auto flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" icon={<Copy className="h-3.5 w-3.5" />} onClick={copyMain}>Copier le contenu</Button>
                  <Link href={assistantLink(WHERE_Q[active])}><Button size="sm" variant="outline" icon={<MapPin className="h-3.5 w-3.5" />}>Où le publier ?</Button></Link>
                  <Link href={councilLink("seo", IMPROVE_Q[active])}><Button size="sm" variant="ghost" icon={<Sparkles className="h-3.5 w-3.5" />}>Améliorer</Button></Link>
                  <Button size="sm" variant="ghost" icon={<CheckCircle2 className="h-3.5 w-3.5" />} onClick={markPublished}>Marquer publié</Button>
                </div>
              </Card>
            )}

            {active === "product" && (loading ? <SkeletonResult /> : result ? (
              <>
                <div className="mb-2 flex items-center gap-2 text-xs">{prodMeta?.live ? <Badge tone="good">OpenAI live</Badge> : <Badge tone="neutral">Mode démo</Badge>}<span className="text-[var(--text-muted)]">{prodMeta?.live ? `Produit avec OpenAI · ${prodMeta.model}` : `Fiche simulée${prodMeta?.fallbackReason ? ` · ${prodMeta.fallbackReason}` : ""}`}</span></div>
                <ProductResult result={result} />
              </>
            ) : <EmptyResult label="Votre fiche produit apparaîtra ici" />)}
            {active === "collection" && (collResult ? <CollectionResult r={collResult} /> : <EmptyResult label="Le contenu de collection apparaîtra ici" />)}
            {active === "meta" && (metaResult ? <MetaResult variants={metaResult} /> : <EmptyResult label="Vos 3 variantes meta apparaîtront ici" />)}
            {active === "alt" && (altResult ? <AltResult alts={altResult} subject={seo.altSubject || preset.sampleProduct} /> : <EmptyResult label="Vos alt text apparaîtront ici" />)}
            {active === "blog" && (blogResult ? <BlogResult r={blogResult} /> : <EmptyResult label="Le plan d'article apparaîtra ici" />)}
          </div>
        </div>

        {/* ── Sorties récentes ── */}
        {factoryOutputs.length > 0 && (
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-sm font-bold"><FileText className="h-4 w-4 text-brand-600" /> Sorties récentes</div>
              <button onClick={clearFactoryOutputs} className="text-[11px] font-medium text-[var(--text-muted)] transition hover:text-red-500">Vider</button>
            </div>
            <div className="space-y-2">
              {factoryOutputs.map((o) => {
                const Icon = TYPE_ICON[o.type];
                const st = STATUS_META[o.status];
                return (
                  <div key={o.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] p-3">
                    <Icon className="h-4 w-4 shrink-0 text-brand-500" />
                    <span className="min-w-0 truncate text-sm font-medium">{o.title}</span>
                    <Badge tone={st.tone}>{st.label}</Badge>
                    <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)]"><Clock className="h-3 w-3" /> {relativeDate(o.createdAt)}</span>
                    <div className="ml-auto flex flex-wrap gap-1.5">
                      <button onClick={() => { navigator.clipboard.writeText(o.copyText); addFactoryOutput({ ...o, status: "copied" }); if (o.taskId) setFactoryStatus(o.taskId, "copied"); flash("Copié"); }} className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1 text-[11px] font-medium transition hover:border-brand-300"><Copy className="h-3 w-3" /> Copier</button>
                      <Link href={assistantLink(WHERE_Q[o.type])} className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1 text-[11px] font-medium transition hover:border-brand-300"><MapPin className="h-3 w-3" /> Où publier</Link>
                      <Link href={councilLink("seo", IMPROVE_Q[o.type])} className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1 text-[11px] font-medium transition hover:border-brand-300"><Sparkles className="h-3 w-3" /> Améliorer</Link>
                      {o.status !== "published" && <button onClick={() => { addFactoryOutput({ ...o, status: "published" }); if (o.taskId) setFactoryStatus(o.taskId, "published"); flash("Marqué comme publié"); }} className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 transition hover:border-emerald-300 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"><CheckCircle2 className="h-3 w-3" /> Publié</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>

      {toast && (
        <div className="ork-rise pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <div className="inline-flex items-center gap-2 rounded-full bg-ink-900 px-4 py-2 text-xs font-medium text-white shadow-pop dark:bg-ink-100 dark:text-ink-900"><Check className="h-3.5 w-3.5 text-emerald-400 dark:text-emerald-600" /> {toast}</div>
        </div>
      )}
    </>
  );
}

// ── Helpers UI ──────────────────────────────────────────────────────────────
function OutputCard({ type }: { type: FactoryType }) {
  const o = OUTPUT[type];
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
function Rationale({ type }: { type: FactoryType }) {
  const r = RATIONALE[type];
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="rounded-lg bg-[var(--bg)] px-2.5 py-2 text-xs text-[var(--text-muted)]"><span className="font-semibold text-[var(--text)]">Pourquoi : </span>{r.why}</div>
      <div className="flex items-start gap-1.5 rounded-lg bg-brand-50 px-2.5 py-2 text-xs text-brand-900 dark:bg-brand-950/40 dark:text-brand-200"><TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span><span className="font-semibold">Impact : </span>{r.impact}</span></div>
    </div>
  );
}
function EmptyResult({ label }: { label: string }) {
  return (
    <Card className="flex h-full min-h-[360px] flex-col items-center justify-center text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950"><FileText className="h-7 w-7" /></div>
      <h3 className="mt-4 text-base font-semibold">{label}</h3>
      <p className="mt-1.5 max-w-xs text-sm text-[var(--text-muted)]">Lancez la production pour voir le contenu prêt à copier.</p>
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
      <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Fiche produit produite</h3><div className="flex gap-3 text-xs"><span className="flex items-center gap-1.5"><span className="text-[var(--text-muted)]">SEO</span><Badge tone="good">{result.seoScore}</Badge></span><span className="flex items-center gap-1.5"><span className="text-[var(--text-muted)]">Conversion</span><Badge tone="good">{result.conversionScore}</Badge></span></div></div>
      <Rationale type="product" />
      <Block title="Titre optimisé" value={result.optimizedTitle} />
      <div className="grid gap-4 sm:grid-cols-2"><Block title="Meta title" value={result.metaTitle} /><Block title="Handle" value={result.handle} mono /></div>
      <Block title="Meta description" value={result.metaDescription} />
      {(result.productType || result.parentCollection) && (<div className="grid gap-4 sm:grid-cols-2">{result.productType && <Block title="Product type" value={result.productType} />}{result.parentCollection && <Block title="Collection parente" value={result.parentCollection} />}</div>)}
      <div><div className="mb-1.5 flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-ink-400">Description longue (HTML Shopify)</span><CopyBtn text={result.longDescriptionHtml} /></div><pre className="max-h-52 overflow-auto rounded-xl bg-ink-950 p-3 text-xs text-ink-100"><code>{result.longDescriptionHtml}</code></pre></div>
      <div className="grid gap-4 sm:grid-cols-2"><ListBlock title="Mots-clés principaux" items={result.primaryKeywords} /><ListBlock title="Longue traîne" items={result.longTailKeywords} />{!!result.tags?.length && <ListBlock title="Tags recommandés" items={result.tags} />}<ListBlock title="Alt text images" items={result.imageAltTexts} /></div>
      <FaqBlock faq={result.faq} />
      {result.merchantNote && <div className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"><span className="font-semibold">Google Merchant : </span>{result.merchantNote}</div>}
      <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-4"><Link href={assistantLink("Où ajouter une fiche produit (description, meta, tags, type) dans Shopify ?")}><Button variant="secondary" size="sm" icon={<MapPin className="h-3.5 w-3.5" />}>Où l&apos;ajouter dans Shopify ?</Button></Link><Link href={councilLink("seo", "Contexte : Content Factory vient de produire une fiche produit. Réponds uniquement : comment l'améliorer (angle éditorial, maillage interne, données Google Merchant), sans refaire d'audit complet.")}><Button variant="outline" size="sm" icon={<Sparkles className="h-3.5 w-3.5" />}>Améliorer avec AI Council</Button></Link></div>
    </Card>
  );
}
function CollectionResult({ r }: { r: CollectionSeoResult }) {
  return (
    <Card className="animate-fade-in space-y-5">
      <h3 className="text-sm font-semibold">Page collection produite</h3>
      <Rationale type="collection" />
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
        <Link href={councilLink("seo", `Contexte : Content Factory a produit le contenu de la collection « ${r.h1} ». Réponds uniquement : comment renforcer cette page (maillage vers produits, FAQ, mots-clés longue traîne), sans audit complet.`)}><Button variant="outline" size="sm" icon={<Sparkles className="h-3.5 w-3.5" />}>Approfondir dans AI Council</Button></Link>
      </div>
    </Card>
  );
}
function MetaResult({ variants }: { variants: MetaVariant[] }) {
  return (
    <Card className="animate-fade-in space-y-3">
      <h3 className="text-sm font-semibold">3 variantes meta</h3>
      <Rationale type="meta" />
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
      <Rationale type="alt" />
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
      <Rationale type="blog" />
      <div className="flex flex-wrap items-center gap-2 text-xs"><Badge tone="brand">Mot-clé : {r.keyword}</Badge><Badge tone="neutral">{r.intent}</Badge><Badge tone="warn">{r.priority}</Badge></div>
      <div className="rounded-lg bg-[var(--bg)] px-3 py-2 text-xs text-[var(--text-muted)]"><div><span className="font-semibold text-[var(--text)]">Angle : </span>{r.angle}</div><div className="mt-0.5"><span className="font-semibold text-[var(--text)]">Pourquoi : </span>{r.why}</div></div>
      <ListBlock title="Mots-clés secondaires" items={r.secondaryKeywords} />
      <Block title="Intro" value={r.intro} />
      <ListBlock title="Plan (H2/H3)" items={r.outline} />
      <FaqBlock faq={r.faq} />
      <div className="grid gap-4 sm:grid-cols-2"><Block title="Meta title" value={r.metaTitle} /><Block title="Meta description" value={r.metaDescription} /></div>
      <div className="rounded-xl bg-brand-50 p-3 text-xs dark:bg-brand-950/40"><div className="text-brand-800 dark:text-brand-200"><span className="font-semibold">Maillage : </span>{r.internalLink}</div><div className="mt-1 text-brand-800 dark:text-brand-200"><span className="font-semibold">CTA : </span>{r.cta}</div></div>
      <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-4"><Link href={councilLink("seo", `Contexte : Content Factory a produit le plan de l'article « ${r.title} ». Réponds uniquement : rédige l'article complet en suivant ce plan (intro, H2/H3, FAQ, CTA), prêt à publier.`)}><Button variant="secondary" size="sm" icon={<Sparkles className="h-3.5 w-3.5" />}>Rédiger avec AI Council</Button></Link><Link href={assistantLink("Où publier un article de blog dans Shopify ?")}><Button variant="outline" size="sm" icon={<MapPin className="h-3.5 w-3.5" />}>Où le publier ?</Button></Link></div>
    </Card>
  );
}

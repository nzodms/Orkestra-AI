"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useOrkestra, connectedProviders } from "@/lib/store";
import { DemoBadge } from "@/components/lens/atoms";
import { ProductOpportunityCard, AIFixPreview } from "@/components/lens/blocks";
import { SectionTabs, PRODUCT_STUDIO_TABS } from "@/components/lens/SectionTabs";
import { PRODUCTS, euro } from "@/lib/lens-mock";
import { downloadShopifyCsv } from "@/lib/shopify/csv";
import type { AnalyzedProduct, ProductOverride } from "@/lib/shopify/types";
import type { ProductSeoResult } from "@/lib/types";
import {
  Boxes, FileWarning, Languages, ImageOff, Download, AlertCircle, ArrowRight, Sparkles,
  Plug, RefreshCw, Loader2, Check, ShieldCheck, Lock, Store, Wand2, Search, X, CheckCircle2,
} from "lucide-react";

export default function ProductStudio() {
  const { shopify, products } = useOrkestra();
  const real = shopify.connected && products.length > 0;

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-300">
          Product Studio
        </div>
        <SectionTabs tabs={PRODUCT_STUDIO_TABS} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            {real ? (
              <>
                <span className="chip bg-teal-50 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300"><span className="h-1.5 w-1.5 rounded-full bg-teal-500 ork-live" /> Données Shopify réelles</span>
                <span className="chip bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"><Sparkles className="h-3 w-3" /> Analyse Orkestra</span>
              </>
            ) : (
              <DemoBadge />
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">Transformez vos fiches faibles en fiches prêtes à vendre</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {real ? `${shopify.name || shopify.shop} · ${products.length} produits analysés.` : "Connectez Shopify pour analyser vos vrais produits, corriger avec l’IA et exporter un CSV propre."}
          </p>
        </div>
      </div>

      {real ? <RealStudio /> : <ConnectAndDemo />}
    </div>
  );
}

// ── Connexion Shopify + aperçu démo ─────────────────────────────────────────
function ConnectAndDemo() {
  const { shopify } = useOrkestra();
  return (
    <div className="space-y-5">
      <ConnectPanel />
      {shopify.connected && <SyncPanel />}
      <div className="pt-1">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
          <Boxes className="h-4 w-4 text-brand-500" /> Aperçu de l’expérience
          <DemoBadge className="ml-1" />
        </div>
        <DemoStudio />
      </div>
    </div>
  );
}

function ConnectPanel() {
  const { shopify, setShopify } = useOrkestra();
  const [shop, setShop] = useState(shopify.shop || "");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setError(null);
    if (!shop.trim() || !token.trim()) { setError("Renseignez le domaine et le token Admin API."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/shopify/connect", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop, token }),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.error || "Connexion échouée."); return; }
      setShopify({ connected: true, shop: data.shop, name: data.name, currency: data.currency, maskedToken: data.maskedToken, keyId: data.keyId, encrypted: !!data.encrypted });
      setToken("");
    } catch { setError("Erreur réseau. Réessayez."); }
    finally { setBusy(false); }
  }

  if (shopify.connected) {
    return (
      <div className="glass-card ork-sheen flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 text-white"><Store className="h-5 w-5" /></span>
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">{shopify.name || shopify.shop} <span className="chip bg-teal-50 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300"><Check className="h-3 w-3" /> Connectée</span></div>
            <div className="text-xs text-[var(--text-muted)]">{shopify.shop} · token {shopify.maskedToken} {shopify.encrypted && <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" /> chiffré</span>}</div>
          </div>
        </div>
        <ConnectActions />
      </div>
    );
  }

  return (
    <div className="glass-card ork-sheen p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-[0_10px_24px_-10px_rgba(36,89,230,0.7)]"><Plug className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-[var(--text)]">Connecter votre boutique Shopify</h3>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">Créez une app personnalisée Shopify (Admin → Paramètres → Apps → Développer des apps) avec l’accès <b>read_products</b>, puis collez le domaine et le token Admin API.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <input className="input" placeholder="ma-boutique.myshopify.com" value={shop} onChange={(e) => setShop(e.target.value)} />
            <input className="input font-mono" type="password" placeholder="shpat_…" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" />
            <button onClick={connect} disabled={busy} className="btn-primary">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />} Connecter
            </button>
          </div>
          {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--text-muted)]">
            <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3 text-brand-500" /> Token chiffré AES-256-GCM, jamais réaffiché.</span>
            <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3 text-brand-500" /> Lecture seule — aucune publication automatique.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConnectActions() {
  const { clearShopify } = useOrkestra();
  return (
    <div className="flex items-center gap-2">
      <SyncButton />
      <button onClick={clearShopify} className="btn-ghost h-9 px-3 text-xs"><X className="h-3.5 w-3.5" /> Déconnecter</button>
    </div>
  );
}

function useSync() {
  const { shopify, setProducts } = useOrkestra();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function sync() {
    setError(null); setBusy(true);
    try {
      const res = await fetch("/api/shopify/sync", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop: shopify.shop, keyId: shopify.keyId }),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.error || "Synchronisation échouée."); return; }
      setProducts(data.products, data.summary, data.syncedAt);
    } catch { setError("Erreur réseau pendant la synchronisation."); }
    finally { setBusy(false); }
  }
  return { sync, busy, error };
}

function SyncButton() {
  const { sync, busy } = useSync();
  return (
    <button onClick={sync} disabled={busy} className="btn-primary h-9 px-3 text-xs">
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Synchroniser les produits
    </button>
  );
}

function SyncPanel() {
  const { sync, busy, error } = useSync();
  return (
    <div className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 className="text-sm font-semibold text-[var(--text)]">Importer vos produits</h3>
        <p className="text-xs text-[var(--text-muted)]">Récupère vos vrais produits Shopify et lance l’analyse qualité Orkestra.</p>
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>
      <button onClick={sync} disabled={busy} className="btn-primary shrink-0">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Synchroniser les produits
      </button>
    </div>
  );
}

// ── Studio réel (produits Shopify analysés) ─────────────────────────────────
const PRIORITY_TONE: Record<AnalyzedProduct["priority"], string> = {
  haute: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  moyenne: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  basse: "bg-ink-100 text-ink-600 dark:bg-ink-900 dark:text-ink-300",
};

function scoreColor(v: number) { return v >= 70 ? "#10b77f" : v >= 45 ? "#f59e0b" : "#ef4444"; }

function RealStudio() {
  const { products, productSummary, productOverrides, productsSyncedAt } = useOrkestra();
  const [selected, setSelected] = useState<string>(products[0]?.id ?? "");
  const [filter, setFilter] = useState<"all" | "haute" | "meta" | "alt" | "english">("all");
  const [q, setQ] = useState("");
  const [exportSel, setExportSel] = useState<Set<string>>(() => new Set(products.filter((p) => p.priority !== "basse").map((p) => p.id)));

  const filtered = useMemo(() => {
    let list = products;
    if (q.trim()) list = list.filter((p) => p.title.toLowerCase().includes(q.toLowerCase()));
    if (filter === "haute") list = list.filter((p) => p.priority === "haute");
    if (filter === "meta") list = list.filter((p) => p.issues.some((i) => i.code.startsWith("meta_")));
    if (filter === "alt") list = list.filter((p) => p.issues.some((i) => i.code.startsWith("alt_")));
    if (filter === "english") list = list.filter((p) => p.issues.some((i) => i.code === "desc_english"));
    return [...list].sort((a, b) => a.scores.global - b.scores.global);
  }, [products, q, filter]);

  const product = products.find((p) => p.id === selected) ?? filtered[0] ?? products[0];

  function exportCsv() {
    const items = products.filter((p) => exportSel.has(p.id)).map((p) => ({ product: p, override: productOverrides[p.id] }));
    if (items.length === 0) return;
    downloadShopifyCsv(items, "orkestra-produits-shopify.csv");
  }

  const s = productSummary;
  return (
    <div className="space-y-5">
      {/* Synthèse catalogue */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MiniStat icon={<Boxes className="h-[18px] w-[18px]" />} value={String(s?.total ?? products.length)} label="Produits analysés" tone="brand" />
        <MiniStat icon={<FileWarning className="h-[18px] w-[18px]" />} value={String(s?.weak ?? 0)} label="Fiches faibles" />
        <MiniStat icon={<AlertCircle className="h-[18px] w-[18px]" />} value={String(s?.metaMissing ?? 0)} label="Meta manquantes" />
        <MiniStat icon={<ImageOff className="h-[18px] w-[18px]" />} value={String(s?.altMissing ?? 0)} label="Alt manquants" />
        <MiniStat icon={<Languages className="h-[18px] w-[18px]" />} value={String(s?.englishTexts ?? 0)} label="Textes anglais" />
      </div>

      {/* Barre d'action : filtres + export */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {([["all", "Tous"], ["haute", "Priorité haute"], ["meta", "Meta manquantes"], ["alt", "Alt manquants"], ["english", "Anglais"]] as const).map(([id, label]) => (
            <button key={id} onClick={() => setFilter(id)} className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${filter === id ? "bg-brand-600 text-white" : "text-[var(--text-muted)] hover:bg-[var(--bg)]"}`}>{label}</button>
          ))}
          <div className="relative ml-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…" className="h-8 w-40 rounded-lg border border-[var(--border)] bg-[var(--bg)] pl-8 pr-2 text-xs outline-none focus:border-brand-400" />
          </div>
        </div>
        <button onClick={exportCsv} className="btn-primary h-9 shrink-0 px-3 text-xs">
          <Download className="h-3.5 w-3.5" /> Exporter CSV Shopify <span className="rounded-md bg-white/20 px-1.5 py-0.5 text-[11px]">{exportSel.size}</span>
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Liste produits */}
        <div className="space-y-2 lg:col-span-5">
          {filtered.map((p) => (
            <ProductRow key={p.id} p={p} active={p.id === product?.id} selected={exportSel.has(p.id)} onOpen={() => setSelected(p.id)} onToggle={() => setExportSel((s) => { const n = new Set(s); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n; })} hasFix={!!productOverrides[p.id]} />
          ))}
          {filtered.length === 0 && <div className="card p-6 text-center text-sm text-[var(--text-muted)]">Aucun produit pour ce filtre.</div>}
        </div>

        {/* Détail */}
        <div className="lg:col-span-7">
          {product ? <ProductDetail product={product} /> : <div className="card p-6 text-sm text-[var(--text-muted)]">Sélectionnez un produit.</div>}
        </div>
      </div>

      {productsSyncedAt && <p className="text-center text-[11px] text-[var(--text-muted)]">Dernière synchronisation : {new Date(productsSyncedAt).toLocaleString("fr-FR")}</p>}
    </div>
  );
}

function MiniStat({ icon, value, label, tone }: { icon: React.ReactNode; value: string; label: string; tone?: "brand" }) {
  const cls = tone === "brand" ? "bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300" : "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300";
  return (
    <div className="card flex items-center gap-3 p-3.5">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${cls}`}>{icon}</span>
      <div><div className="text-lg font-bold leading-none tracking-tight text-[var(--text)]">{value}</div><div className="mt-1 text-[11px] text-[var(--text-muted)]">{label}</div></div>
    </div>
  );
}

function ProductRow({ p, active, selected, hasFix, onOpen, onToggle }: { p: AnalyzedProduct; active: boolean; selected: boolean; hasFix: boolean; onOpen: () => void; onToggle: () => void }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl border bg-[var(--surface)] p-3 transition ${active ? "border-brand-400 shadow-lift ring-4 ring-[var(--ring)]" : "border-[var(--border)] hover:shadow-lift"}`}>
      <button onClick={onToggle} aria-label="Sélectionner pour l'export" className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 transition ${selected ? "border-brand-600 bg-brand-600 text-white" : "border-ink-300 text-transparent hover:border-brand-400 dark:border-ink-700"}`}><Check className="h-3 w-3" /></button>
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        {p.images[0]?.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.images[0].src} alt="" className="h-11 w-11 shrink-0 rounded-lg border border-[var(--border)] object-cover" />
        ) : (
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[var(--bg)] text-ink-300"><ImageOff className="h-4 w-4" /></span>
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium text-[var(--text)]">{p.title || "(sans titre)"}</span>
            {hasFix && <span className="chip shrink-0 bg-teal-50 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300"><Wand2 className="h-3 w-3" /> IA</span>}
          </span>
          <span className="mt-1 flex items-center gap-2">
            <span className={`chip ${PRIORITY_TONE[p.priority]}`}>{p.priority}</span>
            <span className="text-[11px] text-[var(--text-muted)]">{p.issues.length} problème{p.issues.length > 1 ? "s" : ""}</span>
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="text-base font-bold tracking-tight" style={{ color: scoreColor(p.scores.global) }}>{p.scores.global}</span>
          <span className="block text-[9px] text-[var(--text-muted)]">score</span>
        </span>
      </button>
    </div>
  );
}

function ProductDetail({ product }: { product: AnalyzedProduct }) {
  const { connections, brand, productOverrides, setProductOverride, setProductReviewStatus } = useOrkestra();
  const providers = connectedProviders(connections);
  const override = productOverrides[product.id];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setError(null); setBusy(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "seo-product",
          keyRefs: { openai: connections.openai?.keyId, claude: connections.anthropic?.keyId },
          input: {
            productName: product.title,
            collection: product.collections[0],
            features: product.bodyHtml.replace(/<[^>]+>/g, " ").slice(0, 400),
            price: product.variants[0]?.price,
            keywords: product.tags.join(", "),
            ton: brand.formality === "tutoiement" ? "tutoiement" : "vouvoiement",
            level: "poussé",
          },
          context: { brandName: brand.storeName, niche: brand.niche },
        }),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.error || "Génération échouée."); return; }
      const r = data.result as ProductSeoResult;
      const ov: ProductOverride = {
        title: r.optimizedTitle,
        bodyHtml: r.longDescriptionHtml,
        seoTitle: r.metaTitle,
        seoDescription: r.metaDescription,
        tags: r.primaryKeywords?.length ? r.primaryKeywords : undefined,
        imageAlts: r.imageAltTexts?.length ? product.images.map((_, i) => r.imageAltTexts[i] ?? null) : undefined,
      };
      setProductOverride(product.id, ov);
    } catch { setError("Erreur réseau pendant la génération."); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      {/* Carte produit réel */}
      <div className="card overflow-hidden">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] p-4">
          <div className="flex min-w-0 items-center gap-3">
            {product.images[0]?.src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.images[0].src} alt="" className="h-14 w-14 shrink-0 rounded-xl border border-[var(--border)] object-cover" />
            ) : (
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-[var(--bg)] text-ink-300"><ImageOff className="h-5 w-5" /></span>
            )}
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-[var(--text)]">{product.title || "(sans titre)"}</h3>
              <p className="truncate font-mono text-[11px] text-[var(--text-muted)]">/{product.handle}</p>
            </div>
          </div>
          <span className={`chip shrink-0 ${PRIORITY_TONE[product.priority]}`}>priorité {product.priority}</span>
        </div>
        <div className="grid grid-cols-3 gap-px bg-[var(--border)]">
          {([["SEO", product.scores.seo], ["Contenu", product.scores.content], ["Conversion", product.scores.conversion]] as const).map(([label, v]) => (
            <div key={label} className="bg-[var(--surface)] p-3 text-center">
              <div className="text-lg font-bold" style={{ color: scoreColor(v) }}>{v}</div>
              <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Problèmes détectés */}
      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--text)]">Problèmes détectés ({product.issues.length})</h3>
          <button onClick={generate} disabled={busy} className="btn-primary h-9 px-3 text-xs">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />} {providers.length ? "Générer la correction IA" : "Générer (démo)"}
          </button>
        </div>
        {error && <p className="mb-2 text-xs text-red-500">{error}</p>}
        {product.issues.length === 0 ? (
          <p className="flex items-center gap-1.5 text-sm text-teal-600 dark:text-teal-400"><CheckCircle2 className="h-4 w-4" /> Fiche solide — rien à corriger en priorité.</p>
        ) : (
          <div className="space-y-1.5">
            {product.issues.map((iss) => (
              <div key={iss.code} className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                <span className={`chip ${iss.severity === "haut" ? "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300" : iss.severity === "moyen" ? "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" : "bg-ink-100 text-ink-600 dark:bg-ink-900 dark:text-ink-300"}`}>{iss.area}</span>
                <span className="flex-1 text-sm text-[var(--text)]">{iss.label}</span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-[11px] text-[var(--text-muted)]">Le texte généré reste descriptif et factuel (compatible Merchant Center). Rien n’est publié sur Shopify — l’export CSV reste sous votre contrôle.</p>
      </div>

      {/* Avant / après si correction générée */}
      {override && <RealBeforeAfter product={product} override={override} onClear={() => setProductOverride(product.id, null)} onStatus={() => setProductReviewStatus(product.id, "pret")} />}
    </div>
  );
}

function RealBeforeAfter({ product, override, onClear, onStatus }: { product: AnalyzedProduct; override: ProductOverride; onClear: () => void; onStatus: () => void }) {
  const rows: { label: string; before: string; after: string }[] = [
    { label: "Titre", before: product.title || "—", after: override.title ?? product.title },
    { label: "Meta title", before: product.seoTitle || "(aucune)", after: override.seoTitle ?? "" },
    { label: "Meta description", before: product.seoDescription || "(aucune)", after: override.seoDescription ?? "" },
  ];
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] p-4">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white"><Wand2 className="h-4 w-4" /></span>
          <div><h3 className="text-sm font-semibold text-[var(--text)]">Correction IA — avant / après</h3><p className="text-[11px] text-[var(--text-muted)]">Ajoutée à l’export CSV.</p></div>
        </div>
        <button onClick={onClear} className="btn-ghost h-8 px-2.5 text-xs"><X className="h-3.5 w-3.5" /> Annuler</button>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {rows.map((r) => (
          <div key={r.label} className="grid gap-px bg-[var(--border)] sm:grid-cols-2">
            <div className="bg-[var(--surface)] p-3">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{r.label} · avant</div>
              <p className="text-xs italic text-ink-400">{r.before}</p>
            </div>
            <div className="bg-teal-50/40 p-3 dark:bg-teal-950/20">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{r.label} · après</div>
              <p className="text-xs font-medium text-[var(--text)]">{r.after || "—"}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] p-3">
        <button onClick={onStatus} className="btn-primary h-9 px-3 text-xs"><Check className="h-3.5 w-3.5" /> Marquer comme prêt</button>
      </div>
    </div>
  );
}

// ── Démo (aperçu quand Shopify n'est pas connecté) ──────────────────────────
function DemoStudio() {
  const [selected, setSelected] = useState(PRODUCTS[0].id);
  const product = PRODUCTS.find((p) => p.id === selected) ?? PRODUCTS[0];
  const totalUplift = PRODUCTS.reduce((s, p) => s + p.uplift, 0);
  return (
    <div className="space-y-4">
      <div className="glass-card ork-sheen flex items-center gap-3 p-4">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-600 dark:bg-teal-900/40 dark:text-teal-300"><Sparkles className="h-5 w-5" /></span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-[var(--text)]">Potentiel cumulé : <span className="text-teal-600 dark:text-teal-400">+{euro(totalUplift)}/mois</span></p>
          <p className="text-xs text-[var(--text-muted)]">Exemple — vos vrais chiffres apparaîtront après connexion Shopify.</p>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-5">
          {PRODUCTS.map((p) => (
            <ProductOpportunityCard key={p.id} p={p} active={p.id === selected} onClick={() => setSelected(p.id)} />
          ))}
        </div>
        <div className="lg:col-span-7"><AIFixPreview p={product} /></div>
      </div>
    </div>
  );
}

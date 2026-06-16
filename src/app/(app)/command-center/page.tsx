"use client";

import Link from "next/link";
import { useOrkestra } from "@/lib/store";
import { DemoBadge } from "@/components/lens/atoms";
import { CouncilCTA } from "@/components/lens/CouncilCTA";
import {
  StoreHealthScore,
  RevenueLeakMap,
  ActionQueue,
  SmartRecommendations,
} from "@/components/lens/blocks";
import {
  STORE_HEALTH,
  MONTHLY_LEAK_TOTAL,
  LEAKS,
  ACTIONS,
  DATA_TRUST_SCORE,
  euro,
} from "@/lib/lens-mock";
import { TrendingDown, ShieldCheck, ListChecks, Zap, ArrowRight, AlertTriangle, Boxes } from "lucide-react";

const RECOS = [
  { title: "Corriger d’abord les 2 fiches du tunnel paiement", why: "Plus gros levier : ~1 180 €/mois récupérables, effort moyen.", href: "/product-studio" },
  { title: "Réconcilier la source Meta", why: "18 % des sessions ne sont pas attribuées — décisions faussées.", href: "/data-lens" },
  { title: "Générer les 8 meta descriptions manquantes", why: "Gain SEO rapide, 8 minutes, fort impact d’indexation.", href: "/growth-actions" },
];

function Kpi({
  icon,
  label,
  value,
  sub,
  tone,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tone: "red" | "teal" | "brand";
  href: string;
}) {
  const toneCls = {
    red: "bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-300",
    teal: "bg-teal-50 text-teal-600 dark:bg-teal-900/40 dark:text-teal-300",
    brand: "bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300",
  }[tone];
  return (
    <Link href={href} className="card group p-4 transition hover:shadow-lift">
      <div className="flex items-center justify-between">
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${toneCls}`}>{icon}</span>
        <ArrowRight className="h-4 w-4 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
      </div>
      <div className="mt-3 text-2xl font-bold tracking-tight text-[var(--text)]">{value}</div>
      <div className="text-xs font-medium text-[var(--text)]">{label}</div>
      <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">{sub}</div>
    </Link>
  );
}

export default function CommandCenter() {
  const { brand, shopify, products, productSummary } = useOrkestra();
  const store = brand.storeName || "votre boutique";
  const todo = ACTIONS.filter((a) => a.status !== "fait").length;
  const realProducts = shopify.connected && products.length > 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-300">
              Command Center
            </span>
            <DemoBadge />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">
            Bonjour — voici l’état de <span className="text-gradient">{store}</span>
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Ce qui marche, ce qui fait perdre de l’argent, et la prochaine action utile.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <CouncilCTA
            variant="button"
            mode="strategy"
            label="Résumer avec AI Council"
            prompt="Résume l’état de santé de ma boutique à partir des données analysées, puis recommande le prochain meilleur levier à activer en priorité."
          />
          <Link href="/data-lens" className="btn-ghost">
            Rescanner
          </Link>
        </div>
      </div>

      {/* Alerte critique */}
      <Link
        href="/product-studio"
        className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50/60 p-4 transition hover:bg-red-50 dark:border-red-900/50 dark:bg-red-950/30"
      >
        <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300">
          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-red-500 ork-live" />
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--text)]">Alerte critique — abandon panier anormal au paiement</p>
          <p className="text-xs text-[var(--text-muted)]">52 % d’abandon panier → checkout. ~1 180 €/mois en jeu.</p>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-red-500" />
      </Link>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={<TrendingDown className="h-[18px] w-[18px]" />} tone="red" label="Pertes potentielles" value={`~${euro(MONTHLY_LEAK_TOTAL)}`} sub="par mois, fourchette basse" href="/data-lens" />
        <Kpi icon={<ShieldCheck className="h-[18px] w-[18px]" />} tone="teal" label="Fiabilité des données" value={`${DATA_TRUST_SCORE}/100`} sub="1 source incohérente" href="/data-lens" />
        <Kpi icon={<ListChecks className="h-[18px] w-[18px]" />} tone="brand" label="Actions prioritaires" value={`${todo}`} sub="prêtes à appliquer" href="/growth-actions" />
        <Kpi icon={<Zap className="h-[18px] w-[18px]" />} tone="brand" label="Meilleur levier" value="+1 180 €" sub="tunnel paiement" href="/product-studio" />
      </div>

      {/* Santé produits — Shopify réel (alimenté par Product Studio) */}
      {realProducts && productSummary && (
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-teal-400 to-teal-600 text-white"><Boxes className="h-4 w-4" /></span>
              <h2 className="text-[15px] font-semibold tracking-tight text-[var(--text)]">Santé produits</h2>
              <span className="chip bg-teal-50 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300"><span className="h-1.5 w-1.5 rounded-full bg-teal-500 ork-live" /> Données Shopify réelles</span>
            </div>
            <Link href="/product-studio" className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-300">Ouvrir Product Studio</Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { v: productSummary.total, l: "Produits analysés" },
              { v: productSummary.weak, l: "Fiches faibles" },
              { v: productSummary.metaMissing, l: "Meta manquantes" },
              { v: `${productSummary.avgGlobal}/100`, l: "Score produit moyen" },
            ].map((k) => (
              <div key={k.l} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                <div className="text-xl font-bold tracking-tight text-[var(--text)]">{k.v}</div>
                <div className="text-[11px] text-[var(--text-muted)]">{k.l}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-1.5">
            {[...products].sort((a, b) => a.scores.global - b.scores.global).slice(0, 3).map((p) => (
              <Link key={p.id} href="/product-studio" className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 transition hover:shadow-soft">
                <span className="min-w-0 flex-1 truncate text-sm text-[var(--text)]">{p.title || "(sans titre)"}</span>
                <span className="chip bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300">{p.issues.length} pb</span>
                <span className="text-sm font-bold" style={{ color: p.scores.global >= 70 ? "#10b77f" : p.scores.global >= 45 ? "#f59e0b" : "#ef4444" }}>{p.scores.global}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Santé + recommandations */}
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <StoreHealthScore score={STORE_HEALTH.score} trend={STORE_HEALTH.trend} breakdown={STORE_HEALTH.breakdown} />
        </div>
        <div className="lg:col-span-5">
          <SmartRecommendations items={RECOS} />
        </div>
      </div>

      {/* Leak map + priorités du jour */}
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <RevenueLeakMap total={MONTHLY_LEAK_TOTAL} leaks={LEAKS} />
        </div>
        <div className="lg:col-span-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold tracking-tight text-[var(--text)]">Priorités du jour</h2>
            <Link href="/growth-actions" className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-300">
              Tout voir
            </Link>
          </div>
          <ActionQueue actions={ACTIONS} compact />
        </div>
      </div>
    </div>
  );
}

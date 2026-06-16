"use client";

import Link from "next/link";
import { DemoBadge, SeverityChip, SectionTitle } from "@/components/lens/atoms";
import { FunnelReliabilityPanel, DataTrustScore } from "@/components/lens/blocks";
import { SectionTabs, DATA_LENS_TABS } from "@/components/lens/SectionTabs";
import { CouncilCTA } from "@/components/lens/CouncilCTA";
import {
  FUNNEL,
  TRUST_SOURCES,
  DATA_TRUST_SCORE,
  LEAKS,
  compact,
  euro,
} from "@/lib/lens-mock";
import { Activity, Percent, GitCompareArrows, ShoppingBag, ArrowRight, ArrowUpRight, ArrowDownRight, RefreshCw } from "lucide-react";

function Stat({ icon, label, value, sub, trend }: { icon: React.ReactNode; label: string; value: string; sub: string; trend?: number }) {
  return (
    <div className="card p-4 transition hover:shadow-lift">
      <div className="flex items-center justify-between">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
          {icon}
        </span>
        {typeof trend === "number" && (
          <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${trend >= 0 ? "text-teal-600 dark:text-teal-400" : "text-red-500"}`}>
            {trend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}{trend >= 0 ? "+" : ""}{trend}%
          </span>
        )}
      </div>
      <div className="mt-2.5 text-2xl font-bold tracking-tight text-[var(--text)]">{value}</div>
      <div className="text-xs font-medium text-[var(--text)]">{label}</div>
      <div className="text-[11px] text-[var(--text-muted)]">{sub}</div>
    </div>
  );
}

export default function DataLens() {
  const sessions = FUNNEL[0].reliable;
  const orders = FUNNEL[FUNNEL.length - 1].reliable;
  const convRate = ((orders / sessions) * 100).toFixed(1);
  const dataLeaks = LEAKS.filter((l) => l.target === "data-lens" || l.severity !== "info");

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-300">
          Data Lens
        </div>
        <SectionTabs tabs={DATA_LENS_TABS} />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <DemoBadge />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">La vérité de votre tunnel</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Données réelles, réconciliées. On sépare ce qui est mesuré de ce qui est fiable avant d’agir dessus.
          </p>
        </div>
        <CouncilCTA
          variant="button"
          mode="strategy"
          label="Analyser avec AI Council"
          prompt="Analyse les incohérences de mon tunnel (sessions, paniers, checkouts, commandes), identifie les fuites de revenu et propose les priorités de correction."
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<Activity className="h-[18px] w-[18px]" />} label="Sessions (30 j)" value={compact(sessions)} sub="fiabilisées" trend={12} />
        <Stat icon={<ShoppingBag className="h-[18px] w-[18px]" />} label="Commandes" value={compact(orders)} sub="réconciliées Shopify" trend={8} />
        <Stat icon={<Percent className="h-[18px] w-[18px]" />} label="Taux de conversion" value={`${convRate}%`} sub="sur données fiables" trend={-3} />
        <Stat icon={<GitCompareArrows className="h-[18px] w-[18px]" />} label="Écart brut/fiable" value="8 %" sub="à surveiller sur Meta" trend={-2} />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <FunnelReliabilityPanel funnel={FUNNEL} />
        </div>
        <div className="space-y-4 lg:col-span-5">
          <DataTrustScore score={DATA_TRUST_SCORE} sources={TRUST_SOURCES} />
          <div className="card flex items-center gap-3 p-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-600 dark:bg-teal-900/40 dark:text-teal-300">
              <RefreshCw className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text)]">
                Données fraîches <span className="h-1.5 w-1.5 rounded-full bg-teal-500 ork-live" />
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">Dernière synchronisation il y a 12 min · réconciliation continue.</p>
            </div>
            <span className="shrink-0 rounded-lg bg-[var(--bg)] px-2 py-1 text-[11px] font-semibold text-[var(--text-muted)]">30 j</span>
          </div>
        </div>
      </div>

      {/* Incohérences détectées */}
      <div className="card p-5">
        <SectionTitle
          eyebrow="Réconciliation"
          title="Incohérences & sources problématiques"
          hint="Écarts entre ce que la boutique mesure et ce qui est réellement attribuable."
        />
        <div className="space-y-2.5">
          {dataLeaks.map((l) => (
            <div
              key={l.id}
              className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <SeverityChip severity={l.severity} />
                  <span className="text-[11px] text-[var(--text-muted)]">{l.where}</span>
                </div>
                <p className="mt-1.5 text-sm font-medium text-[var(--text)]">{l.title}</p>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">{l.cause}</p>
              </div>
              <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                <span className="text-sm font-bold text-red-600 dark:text-red-400">−{euro(l.amount)}/mois</span>
                <Link
                  href={`/${l.target}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline dark:text-brand-300"
                >
                  {l.action} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Méthodologie — comment Orkestra fiabilise les données */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: Activity, title: "On mesure le brut", text: "Sessions, vues, paniers et commandes tels que remontés par vos sources." },
          { icon: GitCompareArrows, title: "On réconcilie", text: "Doublons, bots et sessions non attribuées sont écartés avant tout calcul." },
          { icon: ShoppingBag, title: "On fiabilise", text: "Vous décidez sur des chiffres nets — pas sur du bruit d’attribution." },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={s.title} className="card p-4">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-900/40 dark:text-teal-300"><Icon className="h-4 w-4" /></span>
                <span className="text-[11px] font-bold text-teal-600 dark:text-teal-400">Étape {i + 1}</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-[var(--text)]">{s.title}</p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">{s.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

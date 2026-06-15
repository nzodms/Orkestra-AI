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
import { Activity, Percent, GitCompareArrows, ShoppingBag, ArrowRight } from "lucide-react";

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-[var(--text-muted)]">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
          {icon}
        </span>
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-[var(--text)]">{value}</div>
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
        <Stat icon={<Activity className="h-4 w-4" />} label="Sessions (30 j)" value={compact(sessions)} sub="fiabilisées · 16,9k" />
        <Stat icon={<ShoppingBag className="h-4 w-4" />} label="Commandes" value={compact(orders)} sub="réconciliées Shopify" />
        <Stat icon={<Percent className="h-4 w-4" />} label="Taux de conversion" value={`${convRate}%`} sub="sur données fiables" />
        <Stat icon={<GitCompareArrows className="h-4 w-4" />} label="Écart brut/fiable" value="8 %" sub="à surveiller sur Meta" />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <FunnelReliabilityPanel funnel={FUNNEL} />
        </div>
        <div className="lg:col-span-5">
          <DataTrustScore score={DATA_TRUST_SCORE} sources={TRUST_SOURCES} />
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
    </div>
  );
}

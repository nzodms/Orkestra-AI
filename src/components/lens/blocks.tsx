"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Ring, ScoreBar, SeverityChip, TrustChip, Delta, SectionTitle } from "./atoms";
import {
  euro,
  compact,
  type FunnelStep,
  type RevenueLeak,
  type TrustSource,
  type GrowthAction,
  type ProductOpportunity,
} from "@/lib/lens-mock";
import {
  ArrowRight,
  TrendingDown,
  ShieldCheck,
  Zap,
  Check,
  Sparkles,
  ChevronRight,
  Wand2,
  CircleDashed,
  Inbox,
} from "lucide-react";

// ── Store Health Score ─────────────────────────────────────────────────────
export function StoreHealthScore({
  score,
  trend,
  breakdown,
}: {
  score: number;
  trend: number;
  breakdown: { key: string; label: string; value: number }[];
}) {
  return (
    <div className="glass-card ork-sheen p-6">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
        <div className="relative shrink-0">
          <Ring value={score} size={148} big label="Santé" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight text-[var(--text)]">Santé de la boutique</h2>
            <Delta value={trend} />
          </div>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Indice global SEO · conversion · données · Merchant. Calculé sur les 30 derniers jours.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3">
            {breakdown.map((b) => (
              <div key={b.key}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-[var(--text-muted)]">{b.label}</span>
                  <span className="font-semibold text-[var(--text)]">{b.value}</span>
                </div>
                <ScoreBar value={b.value} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Revenue Leak Map ───────────────────────────────────────────────────────
export function RevenueLeakMap({ total, leaks }: { total: number; leaks: RevenueLeak[] }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-300">
            <TrendingDown className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--text)]">Où la boutique perd de l’argent</h3>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">Estimation prudente, fourchette basse.</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold tracking-tight text-[var(--text)]">~{euro(total)}</div>
          <div className="text-[11px] text-[var(--text-muted)]">de pertes / mois</div>
        </div>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {leaks.map((l) => (
          <Link
            key={l.id}
            href={`/${l.target}`}
            className="group flex items-start gap-3 p-5 transition-colors hover:bg-[var(--bg)]"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <SeverityChip severity={l.severity} />
                <span className="text-[11px] text-[var(--text-muted)]">{l.where}</span>
              </div>
              <p className="mt-2 text-sm font-medium text-[var(--text)]">{l.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">{l.cause}</p>
              <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 dark:text-brand-300">
                {l.action} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-sm font-bold text-red-600 dark:text-red-400">−{euro(l.amount)}</div>
              <div className="text-[10px] text-[var(--text-muted)]">/ mois</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── Funnel Reliability Panel ───────────────────────────────────────────────
export function FunnelReliabilityPanel({ funnel }: { funnel: FunnelStep[] }) {
  const max = Math.max(...funnel.map((s) => s.raw));
  return (
    <div className="card p-5">
      <SectionTitle
        eyebrow="Data Lens"
        title="Tunnel brut vs tunnel fiable"
        hint="Barre claire : mesure brute. Barre pleine : valeur fiabilisée après réconciliation."
      />
      <div className="space-y-4">
        {funnel.map((s, i) => {
          const next = funnel[i + 1];
          const rate = next ? Math.round((next.reliable / s.reliable) * 100) : null;
          const gap = Math.round(((s.raw - s.reliable) / s.raw) * 100);
          return (
            <div key={s.key}>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-medium text-[var(--text)]">{s.label}</span>
                <span className="text-[var(--text-muted)]">
                  <span className="font-semibold text-[var(--text)]">{compact(s.reliable)}</span>
                  <span className="text-ink-400"> / {compact(s.raw)} brut</span>
                  {gap > 3 && <span className="ml-2 text-amber-600 dark:text-amber-400">−{gap}%</span>}
                </span>
              </div>
              <div className="relative h-7 w-full overflow-hidden rounded-lg bg-ink-100 dark:bg-ink-900">
                <div
                  className="absolute inset-y-0 left-0 rounded-lg bg-brand-100 dark:bg-brand-950"
                  style={{ width: `${(s.raw / max) * 100}%` }}
                />
                <div
                  className="absolute inset-y-0 left-0 rounded-lg bg-gradient-to-r from-brand-600 to-brand-500 transition-[width] duration-700"
                  style={{ width: `${(s.reliable / max) * 100}%` }}
                />
              </div>
              {rate !== null && (
                <div className="mt-1 flex items-center gap-1 pl-1 text-[11px] text-[var(--text-muted)]">
                  <ChevronRight className="h-3 w-3" /> {rate}% passent à l’étape suivante
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Data Trust Score ───────────────────────────────────────────────────────
export function DataTrustScore({ score, sources }: { score: number; sources: TrustSource[] }) {
  return (
    <div className="card ork-sheen p-5">
      <div className="flex items-center gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-teal-50 text-teal-600 dark:bg-teal-900/40 dark:text-teal-300">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-[var(--text)]">Score de confiance des données</h3>
          <p className="text-xs text-[var(--text-muted)]">Fiabilité de ce que vous mesurez avant d’agir dessus.</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold tracking-tight text-teal-600 dark:text-teal-400">{score}</div>
          <div className="text-[10px] text-[var(--text-muted)]">/ 100</div>
        </div>
      </div>
      <div className="mt-4 space-y-2.5">
        {sources.map((s) => (
          <div key={s.id} className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-[var(--text)]">{s.label}</span>
                <TrustChip status={s.status} />
              </div>
              <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">{s.note}</p>
            </div>
            <div className="w-20 shrink-0">
              <div className="mb-1 text-right text-[11px] font-semibold text-[var(--text)]">{s.coverage}%</div>
              <ScoreBar value={s.coverage} tone={s.status === "fiable" ? "teal" : "auto"} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Action Queue ───────────────────────────────────────────────────────────
const impactCls: Record<GrowthAction["impact"], string> = {
  haut: "bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300",
  moyen: "bg-ink-100 text-ink-600 dark:bg-ink-900 dark:text-ink-300",
  bas: "bg-ink-100 text-ink-500 dark:bg-ink-900 dark:text-ink-400",
};

export function ActionQueue({ actions, compact: dense }: { actions: GrowthAction[]; compact?: boolean }) {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const list = dense ? actions.slice(0, 4) : actions;
  return (
    <div className="space-y-2.5">
      {list.map((a) => {
        const isDone = done[a.id] || a.status === "fait";
        return (
          <div
            key={a.id}
            className={cn(
              "group flex items-center gap-3 rounded-2xl border bg-[var(--surface)] p-3.5 transition-all",
              isDone ? "border-[var(--border-soft)] opacity-60" : "border-[var(--border)] hover:shadow-lift"
            )}
          >
            <button
              onClick={() => setDone((d) => ({ ...d, [a.id]: !d[a.id] }))}
              aria-label="Marquer comme fait"
              className={cn(
                "grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition",
                isDone
                  ? "border-teal-500 bg-teal-500 text-white"
                  : "border-ink-300 text-transparent hover:border-brand-500 dark:border-ink-700"
              )}
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={cn("text-sm font-medium text-[var(--text)]", isDone && "line-through")}>{a.title}</span>
                {a.status === "en_cours" && !isDone && (
                  <span className="chip bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                    <CircleDashed className="h-3 w-3 animate-spin" /> En cours
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{a.detail}</p>
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <span className={cn("chip", impactCls[a.impact])}>Impact {a.impact}</span>
              <span className="text-[11px] text-[var(--text-muted)]">~{a.minutes} min</span>
            </div>
            <Link
              href={`/${a.target}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-600 px-3 text-xs font-semibold text-white opacity-0 transition group-hover:opacity-100"
            >
              <Wand2 className="h-3.5 w-3.5" /> Lancer
            </Link>
          </div>
        );
      })}
    </div>
  );
}

// ── Smart Recommendations ──────────────────────────────────────────────────
export function SmartRecommendations({
  items,
}: {
  items: { title: string; why: string; href: string }[];
}) {
  return (
    <div className="glass-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white">
          <Sparkles className="h-4 w-4" />
        </div>
        <h3 className="text-sm font-semibold text-[var(--text)]">Prochain meilleur levier</h3>
      </div>
      <div className="space-y-2">
        {items.map((it) => (
          <Link
            key={it.title}
            href={it.href}
            className="group flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 transition hover:border-brand-300 hover:shadow-soft"
          >
            <Zap className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--text)]">{it.title}</p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">{it.why}</p>
            </div>
            <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── Product Opportunity Card ───────────────────────────────────────────────
export function ProductOpportunityCard({
  p,
  active,
  onClick,
}: {
  p: ProductOpportunity;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full rounded-2xl border bg-[var(--surface)] p-4 text-left transition-all",
        active ? "border-brand-400 shadow-lift ring-4 ring-[var(--ring)]" : "border-[var(--border)] hover:shadow-lift"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--text)]">{p.title}</p>
          <p className="mt-0.5 truncate font-mono text-[11px] text-[var(--text-muted)]">/{p.handle}</p>
        </div>
        <div className="shrink-0 rounded-lg bg-teal-50 px-2 py-1 text-right dark:bg-teal-900/40">
          <div className="text-xs font-bold text-teal-700 dark:text-teal-300">+{euro(p.uplift)}</div>
          <div className="text-[9px] text-teal-600/80 dark:text-teal-400/80">potentiel / mois</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <div className="mb-1 flex justify-between text-[11px]"><span className="text-[var(--text-muted)]">SEO</span><span className="font-semibold text-[var(--text)]">{p.seoScore}</span></div>
          <ScoreBar value={p.seoScore} />
        </div>
        <div>
          <div className="mb-1 flex justify-between text-[11px]"><span className="text-[var(--text-muted)]">Conversion</span><span className="font-semibold text-[var(--text)]">{p.convScore}</span></div>
          <ScoreBar value={p.convScore} />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {p.issues.slice(0, 3).map((iss) => (
          <span key={iss} className="chip bg-ink-100 text-ink-600 dark:bg-ink-900 dark:text-ink-300">{iss}</span>
        ))}
        {p.issues.length > 3 && (
          <span className="chip bg-ink-100 text-ink-500 dark:bg-ink-900 dark:text-ink-400">+{p.issues.length - 3}</span>
        )}
      </div>
    </button>
  );
}

// ── AI Fix Preview (Before / After) ────────────────────────────────────────
export function AIFixPreview({ p }: { p: ProductOpportunity }) {
  const seoAfter = Math.min(p.seoScore + 41, 94);
  const convAfter = Math.min(p.convScore + 36, 90);
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] p-4">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white">
            <Wand2 className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--text)]">Correction IA — aperçu</h3>
            <p className="text-[11px] text-[var(--text-muted)]">{p.title}</p>
          </div>
        </div>
        <button className="btn-primary h-9 px-3 text-xs">
          <Check className="h-3.5 w-3.5" /> Appliquer
        </button>
      </div>

      {/* Transformation projetée */}
      <div className="grid grid-cols-2 gap-px border-b border-[var(--border)] bg-[var(--border)]">
        <ScoreJump label="SEO" from={p.seoScore} to={seoAfter} />
        <ScoreJump label="Conversion" from={p.convScore} to={convAfter} />
      </div>

      <div className="grid gap-px bg-[var(--border)] sm:grid-cols-2">
        <BeforeAfterColumn kind="before" title={p.before.title} meta={p.before.meta} />
        <BeforeAfterColumn kind="after" title={p.after.title} meta={p.after.meta} />
      </div>
    </div>
  );
}

function ScoreJump({ label, from, to }: { label: string; from: number; to: number }) {
  return (
    <div className="flex items-center justify-between bg-[var(--surface)] px-4 py-2.5">
      <span className="text-[11px] font-medium text-[var(--text-muted)]">{label}</span>
      <span className="flex items-center gap-1.5 text-sm font-semibold">
        <span className="text-ink-400">{from}</span>
        <ArrowRight className="h-3.5 w-3.5 text-teal-500" />
        <span className="text-teal-600 dark:text-teal-400">{to}</span>
      </span>
    </div>
  );
}

function BeforeAfterColumn({ kind, title, meta }: { kind: "before" | "after"; title: string; meta: string }) {
  const isAfter = kind === "after";
  return (
    <div className={cn("p-4", isAfter ? "bg-teal-50/40 dark:bg-teal-950/20" : "bg-[var(--surface)]")}>
      <div className="mb-3 flex items-center gap-2">
        <span
          className={cn(
            "chip",
            isAfter
              ? "bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300"
              : "bg-ink-100 text-ink-500 dark:bg-ink-900 dark:text-ink-400"
          )}
        >
          {isAfter ? "Après IA" : "Avant"}
        </span>
      </div>
      <div className="space-y-3">
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Titre</div>
          <p className={cn("text-sm", isAfter ? "font-medium text-[var(--text)]" : "text-[var(--text-muted)]")}>{title}</p>
        </div>
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Meta description</div>
          <p className={cn("text-xs leading-relaxed", isAfter ? "text-[var(--text)]" : "italic text-ink-400")}>{meta}</p>
        </div>
      </div>
    </div>
  );
}

// ── Premium Empty State ────────────────────────────────────────────────────
export function PremiumEmpty({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="glass-card flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-brand-50 to-teal-50 text-brand-600 shadow-soft dark:from-brand-950 dark:to-teal-950/40 dark:text-brand-300">
        {icon ?? <Inbox className="h-7 w-7" />}
      </div>
      <h3 className="mt-5 text-base font-semibold text-[var(--text)]">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-[var(--text-muted)]">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

// ── Premium Loading (skeleton) ─────────────────────────────────────────────
export function PremiumLoading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="card space-y-4 p-5">
      <div className="flex items-center gap-3">
        <div className="skeleton h-10 w-10 rounded-xl" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-3 w-1/3 rounded-full" />
          <div className="skeleton h-2.5 w-1/2 rounded-full" />
        </div>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="skeleton h-2.5 w-full rounded-full" />
          <div className="skeleton h-2.5 w-4/5 rounded-full" />
        </div>
      ))}
    </div>
  );
}

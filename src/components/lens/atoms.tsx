"use client";

import { cn } from "@/lib/utils";
import type { Severity, TrustStatus } from "@/lib/lens-mock";
import { Sparkles, ArrowUpRight, ArrowDownRight } from "lucide-react";

// ── Bandeau honnêteté : données de démonstration ──────────────────────────
export function DemoBadge({ className }: { className?: string }) {
  return (
    <span className={cn("chip bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300", className)}>
      <Sparkles className="h-3 w-3" /> Données de démonstration
    </span>
  );
}

// ── Section title (léger, premium) ─────────────────────────────────────────
export function SectionTitle({
  eyebrow,
  title,
  hint,
  action,
}: {
  eyebrow?: string;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-300">
            {eyebrow}
          </div>
        )}
        <h2 className="text-[15px] font-semibold tracking-tight text-[var(--text)]">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-[var(--text-muted)]">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

// ── Severity chip ──────────────────────────────────────────────────────────
const sevMap: Record<Severity, { label: string; cls: string; dot: string }> = {
  critique: { label: "Critique", cls: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300", dot: "bg-red-500" },
  eleve: { label: "Élevé", cls: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300", dot: "bg-amber-500" },
  moyen: { label: "Moyen", cls: "bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300", dot: "bg-brand-500" },
  info: { label: "Info", cls: "bg-ink-100 text-ink-600 dark:bg-ink-900 dark:text-ink-300", dot: "bg-ink-400" },
};

export function SeverityChip({ severity }: { severity: Severity }) {
  const s = sevMap[severity];
  return (
    <span className={cn("chip", s.cls)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} /> {s.label}
    </span>
  );
}

// ── Trust chip ─────────────────────────────────────────────────────────────
const trustMap: Record<TrustStatus, { label: string; cls: string; dot: string }> = {
  fiable: { label: "Fiable", cls: "bg-teal-50 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300", dot: "bg-teal-500" },
  partiel: { label: "Partiel", cls: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300", dot: "bg-amber-500" },
  incoherent: { label: "Incohérent", cls: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300", dot: "bg-red-500" },
};

export function TrustChip({ status }: { status: TrustStatus }) {
  const s = trustMap[status];
  return (
    <span className={cn("chip", s.cls)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} /> {s.label}
    </span>
  );
}

// ── Delta (tendance) ───────────────────────────────────────────────────────
export function Delta({ value, suffix = "pts" }: { value: number; suffix?: string }) {
  const up = value >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-semibold",
        up ? "text-teal-600 dark:text-teal-400" : "text-red-500"
      )}
    >
      {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
      {up ? "+" : ""}
      {value} {suffix}
    </span>
  );
}

// ── Mini score bar ─────────────────────────────────────────────────────────
export function ScoreBar({ value, tone }: { value: number; tone?: "brand" | "teal" | "auto" }) {
  const color =
    tone === "teal"
      ? "#10b77f"
      : tone === "brand"
      ? "#2459e6"
      : value >= 70
      ? "#10b77f"
      : value >= 45
      ? "#f59e0b"
      : "#ef4444";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-900">
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{ width: `${value}%`, background: color }}
      />
    </div>
  );
}

// ── Ring (score circulaire premium) ────────────────────────────────────────
export function Ring({
  value,
  size = 132,
  stroke = 11,
  label,
  big,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  big?: boolean;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2459e6" />
            <stop offset="100%" stopColor="#10b77f" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#ring-grad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute text-center">
        <div className={cn("font-bold tracking-tight text-[var(--text)]", big ? "text-4xl" : "text-2xl")}>{value}</div>
        {label && <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">{label}</div>}
      </div>
    </div>
  );
}

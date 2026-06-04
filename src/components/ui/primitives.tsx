"use client";

import { useEffect, useState } from "react";
import { cn, scoreTone } from "@/lib/utils";

// ── Card ──────────────────────────────────────────────────────────────────
export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("card p-5", className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
            {icon}
          </div>
        )}
        <div>
          <h3 className="text-sm font-semibold text-[var(--text)]">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-[var(--text-muted)]">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────
type BadgeTone = "neutral" | "brand" | "good" | "warn" | "bad";
const badgeTones: Record<BadgeTone, string> = {
  neutral: "bg-ink-100 text-ink-600 dark:bg-ink-900 dark:text-ink-300",
  brand: "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300",
  good: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  warn: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  bad: "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        badgeTones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

// ── ScoreRing ─────────────────────────────────────────────────────────────
const toneColor = {
  good: "#10b981",
  warn: "#f59e0b",
  bad: "#ef4444",
};

export function ScoreRing({
  value,
  size = 76,
  label,
}: {
  value: number;
  size?: number;
  label?: string;
}) {
  const tone = scoreTone(value);
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  // Comptage progressif 0 → value (anneau + nombre synchronisés), reduced-motion OK.
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const dur = 700;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(value * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  const offset = c - (shown / 100) * c;
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth="6" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={toneColor[tone]}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-lg font-bold text-[var(--text)]">{shown}</div>
        {label && <div className="text-[10px] text-[var(--text-muted)]">{label}</div>}
      </div>
    </div>
  );
}

// ── Progress ──────────────────────────────────────────────────────────────
export function Progress({ value }: { value: number }) {
  const tone = scoreTone(value);
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-900">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${value}%`, background: toneColor[tone] }}
      />
    </div>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] px-6 py-14 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
        {icon}
      </div>
      <h3 className="mt-4 text-base font-semibold text-[var(--text)]">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-[var(--text-muted)]">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ── PageHeader ────────────────────────────────────────────────────────────
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">{title}</h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

// ── Field helpers ─────────────────────────────────────────────────────────
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="hint mt-1.5">{hint}</p>}
    </div>
  );
}

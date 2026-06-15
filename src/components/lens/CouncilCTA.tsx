"use client";

import Link from "next/link";
import { MessagesSquare, ArrowRight, Sparkles } from "lucide-react";

/**
 * Point d'entrée contextuel vers AI Council — la couche IA transversale.
 * Chaque section passe son `mode` et une question pré-remplie liée à la page
 * (« Analyser avec AI Council », « Prioriser avec AI Council »…).
 */
export function CouncilCTA({
  label,
  prompt,
  mode = "free",
  hint,
  variant = "card",
}: {
  label: string;
  prompt: string;
  mode?: string;
  hint?: string;
  variant?: "card" | "button";
}) {
  const href = `/council?mode=${mode}&q=${encodeURIComponent(prompt)}`;

  if (variant === "button") {
    return (
      <Link
        href={href}
        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50 px-3 text-xs font-semibold text-brand-700 transition hover:bg-brand-100 dark:border-brand-900 dark:bg-brand-950/50 dark:text-brand-300"
      >
        <MessagesSquare className="h-3.5 w-3.5" /> {label}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className="group glass-card flex items-center gap-3 p-4 transition hover:shadow-lift"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-[0_8px_20px_-8px_rgba(36,89,230,0.7)]">
        <Sparkles className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[var(--text)]">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-[var(--text-muted)]">{hint}</p>}
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
    </Link>
  );
}

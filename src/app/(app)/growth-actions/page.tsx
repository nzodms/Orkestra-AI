"use client";

import { DemoBadge } from "@/components/lens/atoms";
import { ActionQueue } from "@/components/lens/blocks";
import { ACTIONS } from "@/lib/lens-mock";
import { ListChecks, Clock, Target } from "lucide-react";

export default function GrowthActions() {
  const todo = ACTIONS.filter((a) => a.status === "a_faire");
  const doing = ACTIONS.filter((a) => a.status === "en_cours");
  const totalMin = ACTIONS.filter((a) => a.status !== "fait").reduce((s, a) => s + a.minutes, 0);
  const highImpact = ACTIONS.filter((a) => a.impact === "haut" && a.status !== "fait").length;

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-300">
            Growth Actions
          </span>
          <DemoBadge />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">File d’actions priorisées</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Triées par impact réel. Chaque action est applicable maintenant et chiffrée en temps.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4">
          <ListChecks className="h-5 w-5 text-brand-500" />
          <div className="mt-2 text-2xl font-bold tracking-tight text-[var(--text)]">{todo.length + doing.length}</div>
          <div className="text-[11px] text-[var(--text-muted)]">actions ouvertes</div>
        </div>
        <div className="card p-4">
          <Target className="h-5 w-5 text-brand-500" />
          <div className="mt-2 text-2xl font-bold tracking-tight text-[var(--text)]">{highImpact}</div>
          <div className="text-[11px] text-[var(--text-muted)]">à fort impact</div>
        </div>
        <div className="card p-4">
          <Clock className="h-5 w-5 text-brand-500" />
          <div className="mt-2 text-2xl font-bold tracking-tight text-[var(--text)]">~{totalMin} min</div>
          <div className="text-[11px] text-[var(--text-muted)]">pour tout traiter</div>
        </div>
      </div>

      {doing.length > 0 && (
        <div>
          <h2 className="mb-3 text-[15px] font-semibold tracking-tight text-[var(--text)]">En cours</h2>
          <ActionQueue actions={doing} />
        </div>
      )}

      <div>
        <h2 className="mb-3 text-[15px] font-semibold tracking-tight text-[var(--text)]">À corriger maintenant</h2>
        <ActionQueue actions={todo} />
      </div>
    </div>
  );
}

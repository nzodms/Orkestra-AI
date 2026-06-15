"use client";

import { DemoBadge } from "@/components/lens/atoms";
import { ActionQueue } from "@/components/lens/blocks";
import { CouncilCTA } from "@/components/lens/CouncilCTA";
import { ACTIONS, MONTHLY_LEAK_TOTAL, euro } from "@/lib/lens-mock";
import { ListChecks, Clock, Target, TrendingUp } from "lucide-react";

export default function GrowthActions() {
  const todo = ACTIONS.filter((a) => a.status === "a_faire");
  const doing = ACTIONS.filter((a) => a.status === "en_cours");
  const done = ACTIONS.filter((a) => a.status === "fait");
  const totalMin = ACTIONS.filter((a) => a.status !== "fait").reduce((s, a) => s + a.minutes, 0);
  const highImpact = ACTIONS.filter((a) => a.impact === "haut" && a.status !== "fait").length;
  const progress = Math.round((done.length / ACTIONS.length) * 100);
  // Revenu mensuel récupérable estimé en traitant la file (fourchette basse).
  const recoverable = Math.round(MONTHLY_LEAK_TOTAL * 0.7);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
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
        <CouncilCTA
          variant="button"
          mode="strategy"
          label="Prioriser avec AI Council"
          prompt="Classe ma file d’actions par impact business réel, justifie l’ordre et prépare l’exécution des 3 premières (étapes concrètes)."
        />
      </div>

      {/* Hero impact projeté */}
      <div className="grid gap-3 lg:grid-cols-12">
        <div className="glass-card ork-sheen ork-glow-pulse lg:col-span-7">
          <div className="flex items-center gap-4 p-5">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-teal-400 to-teal-600 text-white shadow-[0_10px_24px_-10px_rgba(16,183,127,0.7)]">
              <TrendingUp className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">Impact projeté</div>
              <div className="mt-0.5 text-2xl font-bold tracking-tight text-[var(--text)]">
                +{euro(recoverable)}<span className="text-sm font-medium text-[var(--text-muted)]"> /mois récupérables</span>
              </div>
              <p className="mt-1 text-xs text-[var(--text-muted)]">en traitant cette file d’actions priorisées.</p>
            </div>
          </div>
          <div className="border-t border-[var(--border)] px-5 py-3">
            <div className="mb-1.5 flex items-center justify-between text-[11px]">
              <span className="text-[var(--text-muted)]">Avancement</span>
              <span className="font-semibold text-[var(--text)]">{done.length}/{ACTIONS.length} traitées · {progress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-900">
              <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-teal-500 transition-[width] duration-700" style={{ width: `${Math.max(progress, 4)}%` }} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 lg:col-span-5">
          <div className="card flex flex-col justify-between p-4">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300"><ListChecks className="h-[18px] w-[18px]" /></span>
            <div><div className="text-xl font-bold tracking-tight text-[var(--text)]">{todo.length + doing.length}</div><div className="text-[11px] text-[var(--text-muted)]">ouvertes</div></div>
          </div>
          <div className="card flex flex-col justify-between p-4">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300"><Target className="h-[18px] w-[18px]" /></span>
            <div><div className="text-xl font-bold tracking-tight text-[var(--text)]">{highImpact}</div><div className="text-[11px] text-[var(--text-muted)]">fort impact</div></div>
          </div>
          <div className="card flex flex-col justify-between p-4">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300"><Clock className="h-[18px] w-[18px]" /></span>
            <div><div className="text-xl font-bold tracking-tight text-[var(--text)]">~{totalMin}<span className="text-xs font-medium text-[var(--text-muted)]">min</span></div><div className="text-[11px] text-[var(--text-muted)]">au total</div></div>
          </div>
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

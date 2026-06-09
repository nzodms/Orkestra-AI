"use client";

import { useVoice } from "./VoiceProvider";
import { Mic } from "lucide-react";

/** Point d'entrée Orkestra Voice dans la sidebar (au-dessus de « Plan Bêta »). */
export function VoiceSidebarEntry() {
  const { openPanel, status, statusLabel } = useVoice();
  const dot =
    status === "listening" ? "bg-brand-500 animate-pulse" :
    status === "thinking" ? "bg-amber-500" :
    status === "reply" ? "bg-emerald-500" : "bg-ink-300 dark:bg-ink-600";
  return (
    <button
      onClick={openPanel}
      className="ork-interactive group mx-3 flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-gradient-to-br from-brand-50/80 to-transparent p-3 text-left dark:from-brand-950/30"
    >
      <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white shadow-soft" style={{ background: "radial-gradient(120% 120% at 30% 25%, #9d8efc, #5b4fd1)" }}>
        {status === "listening" && <span className="ork-aura" />}
        <Mic className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block text-sm font-semibold text-[var(--text)]">Orkestra Voice</span>
        <span className="block truncate text-[11px] text-[var(--text-muted)]">Parlez à Orkestra</span>
      </span>
      <span className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />{statusLabel}
      </span>
    </button>
  );
}

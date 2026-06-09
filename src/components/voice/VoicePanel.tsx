"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { speakReply, ttsSupported } from "@/lib/voice/voice-orchestrator";
import { useVoice } from "./VoiceProvider";
import { Mic, Square, X, Volume2, ArrowRight, Sparkles, Send, RotateCcw, History } from "lucide-react";
import { useState } from "react";

function Orb() {
  const { status, listening, start, stop } = useVoice();
  return (
    <button
      onClick={() => (listening ? stop() : start())}
      aria-label={listening ? "Arrêter l'écoute" : "Parler"}
      className={`relative grid h-24 w-24 place-items-center rounded-full text-white transition-transform duration-200 active:scale-95 ${status === "idle" ? "ork-breathe" : ""}`}
      style={{ background: "radial-gradient(120% 120% at 30% 24%, #9d8efc, #5b4fd1 58%, #45399f)", boxShadow: "0 16px 50px -14px rgba(109,94,242,.75), inset 0 1px 0 rgba(255,255,255,.35)" }}
    >
      {listening && <span className="ork-aura" />}
      {status === "thinking" && <span className="ork-ring" />}
      {listening ? <Square className="h-7 w-7" /> : <Mic className="h-8 w-8" />}
    </button>
  );
}

function Waveform() {
  const { listening } = useVoice();
  return (
    <div className="flex h-6 items-end gap-[3px]" aria-hidden>
      {Array.from({ length: 11 }).map((_, i) => (
        <span key={i} className={`w-[3px] rounded-full ${listening ? "ork-wave bg-brand-400" : "bg-[var(--border)]"}`} style={{ height: listening ? undefined : 5, animationDelay: `${i * 80}ms` }} />
      ))}
    </div>
  );
}

export function VoicePanelBody() {
  const { closePanel, statusLabel, status, listening, partial, transcript, reply, history, error, supported, readAloud, setReadAloud, suggestions, process, retry } = useVoice();
  const [typed, setTyped] = useState("");
  const send = () => { if (typed.trim()) { process(typed); setTyped(""); } };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header compact */}
      <div className="relative flex items-center justify-between px-5 pb-3 pt-5">
        <div className="ork-halo pointer-events-none absolute -top-16 left-10 h-40 w-40" />
        <div className="relative flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-soft"><Sparkles className="h-4 w-4" /></span>
          <div className="leading-tight">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text)]">Orkestra Voice <span className="rounded-full bg-brand-50 px-1.5 py-px text-[9px] font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">V1</span></div>
            <div className="text-[11px] text-[var(--text-muted)]">{statusLabel}</div>
          </div>
        </div>
        <button onClick={closePanel} aria-label="Fermer" className="grid h-8 w-8 place-items-center rounded-lg text-[var(--text-muted)] transition hover:bg-ink-100 hover:text-[var(--text)] dark:hover:bg-ink-900"><X className="h-4 w-4" /></button>
      </div>

      {/* Orbe principale */}
      <div className="grid place-items-center px-5 py-5">
        <Orb />
        <div className="mt-4"><Waveform /></div>
        <p className="mt-2.5 text-xs text-[var(--text-muted)]">
          {status === "listening" ? "À l'écoute… parlez maintenant" : status === "thinking" ? "Orkestra réfléchit…" : reply ? "Voici ce que j'ai compris" : supported ? "Touchez l'orbe pour parler" : "Tapez votre demande ci-dessous"}
        </p>
      </div>

      {/* Corps scrollable */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 pb-4">
        {(partial || transcript) && (
          <div className="ork-rise rounded-2xl border border-[var(--border)] bg-[var(--bg)]/60 px-4 py-3 text-sm text-[var(--text)] backdrop-blur">
            {transcript || <span className="italic text-[var(--text-muted)]">{partial}…</span>}
          </div>
        )}

        {error && <p className="text-xs text-amber-600">{error}</p>}

        {reply && (
          <div className="ork-rise rounded-2xl border border-brand-200/70 bg-gradient-to-br from-brand-50/70 to-transparent p-4 backdrop-blur dark:border-brand-900/50 dark:from-brand-950/40">
            <p className="text-sm leading-relaxed text-[var(--text)]">{reply.text}</p>
            {reply.links && reply.links.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {reply.links.map((l) => (
                  <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--text)] transition hover:border-brand-300 hover:text-brand-600">{l.source}</a>
                ))}
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {reply.href && reply.label && (
                <Link href={reply.href} onClick={closePanel}><Button size="sm" className="ork-glow" icon={<ArrowRight className="h-3.5 w-3.5" />}>{reply.label}</Button></Link>
              )}
              {ttsSupported() && <Button size="sm" variant="ghost" onClick={() => speakReply(reply.text)} icon={<Volume2 className="h-3.5 w-3.5" />}>Lire</Button>}
              <Button size="sm" variant="ghost" onClick={retry} icon={<RotateCcw className="h-3.5 w-3.5" />}>Réessayer</Button>
            </div>
          </div>
        )}

        {!reply && !listening && status !== "thinking" && (
          <div className="ork-fade">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-400">Suggestions</p>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((ex) => (
                <button key={ex} onClick={() => process(ex)} className="rounded-full border border-[var(--border)] bg-[var(--surface)]/60 px-3 py-1.5 text-[11px] text-[var(--text-muted)] backdrop-blur transition hover:-translate-y-px hover:border-brand-300 hover:text-brand-600">{ex}</button>
              ))}
            </div>
          </div>
        )}

        {history.length > 0 && !listening && (
          <div className="ork-fade">
            <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-ink-400"><History className="h-3 w-3" /> Récent</p>
            <div className="flex flex-wrap gap-1.5">
              {history.map((h) => (
                <button key={h} onClick={() => process(h)} className="max-w-full truncate rounded-full bg-ink-50 px-3 py-1.5 text-[11px] text-[var(--text-muted)] transition hover:text-brand-600 dark:bg-ink-900">{h}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Saisie secondaire + lecture auto */}
      <div className="space-y-2 border-t border-[var(--border)] px-5 py-3.5">
        <div className="flex items-center gap-2">
          <input className="input flex-1" placeholder={supported ? "…ou écrivez à Orkestra" : "Écrivez à Orkestra"} value={typed} onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} />
          <Button size="sm" variant="outline" onClick={send} icon={<Send className="h-3.5 w-3.5" />} aria-label="Envoyer" />
        </div>
        <label className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
          <input type="checkbox" checked={readAloud} onChange={(e) => setReadAloud(e.target.checked)} className="accent-brand-600" />
          Lire les réponses à voix haute
        </label>
      </div>
    </div>
  );
}

/** Panneau Orkestra Voice : drawer latéral (desktop) + bottom sheet (mobile). */
export function VoicePanel() {
  const { open, closePanel } = useVoice();
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40 bg-ink-950/25 backdrop-blur-[2px] ork-fade" onClick={closePanel} />
      {/* Desktop : drawer droit */}
      <aside className="ork-drawer-in fixed right-0 top-0 z-50 hidden h-full w-[420px] max-w-[92vw] flex-col border-l border-[var(--border)] bg-[var(--surface)]/85 shadow-2xl backdrop-blur-2xl lg:flex">
        <VoicePanelBody />
      </aside>
      {/* Mobile : bottom sheet */}
      <aside className="ork-sheet-in fixed inset-x-0 bottom-0 z-50 flex max-h-[88vh] flex-col rounded-t-3xl border-t border-[var(--border)] bg-[var(--surface)]/90 shadow-2xl backdrop-blur-2xl lg:hidden">
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-[var(--border)]" />
        <VoicePanelBody />
      </aside>
    </>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { speakReply, ttsSupported } from "@/lib/voice/voice-orchestrator";
import { useVoice } from "./VoiceProvider";
import type { VoiceCard, VoiceCardKind } from "@/lib/voice/voice-types";
import {
  Mic, Square, X, Volume2, ArrowRight, Sparkles, Send, RotateCcw, History,
  Package, Search, AlertTriangle, Languages, ShieldAlert, Gauge, Info, ExternalLink, ListChecks,
} from "lucide-react";

const CARD_ICON: Record<VoiceCardKind, React.ElementType> = {
  supplier: Package, "search-link": Search, "seo-issue": AlertTriangle, "english-term": Languages,
  "import-issue": ListChecks, "merchant-risk": ShieldAlert, "shopify-step": ArrowRight, metric: Gauge, info: Info,
};
function accentFor(tone?: VoiceCard["tone"]): string {
  return tone === "bad" ? "border-l-red-400" : tone === "warn" ? "border-l-amber-400" : tone === "good" ? "border-l-emerald-400" : tone === "brand" ? "border-l-brand-400" : "border-l-[var(--border)]";
}

function VoiceCardView({ card }: { card: VoiceCard }) {
  const Icon = CARD_ICON[card.kind] || Info;
  const inner = (
    <div className={`flex items-start gap-2.5 rounded-xl border border-l-2 border-[var(--border)] ${accentFor(card.tone)} bg-[var(--surface)]/60 px-3 py-2.5 backdrop-blur transition`}>
      <span className="mt-0.5 text-[var(--text-muted)]"><Icon className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-[var(--text)]">{card.title}</span>
          {card.meta && <span className="shrink-0 text-[10px] text-[var(--text-muted)]">{card.meta}</span>}
        </div>
        {card.subtitle && <p className="truncate text-xs text-[var(--text-muted)]">{card.subtitle}</p>}
        {card.detail && <p className="mt-0.5 text-[11px] leading-snug text-[var(--text-muted)]">{card.detail}</p>}
      </div>
      {card.href && <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />}
    </div>
  );
  return card.href ? <a href={card.href} target="_blank" rel="noopener noreferrer" className="block transition hover:-translate-y-px">{inner}</a> : inner;
}

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
  const { closePanel, statusLabel, status, listening, partial, transcript, result, history, error, supported, readAloud, setReadAloud, suggestions, process, retry } = useVoice();
  const [typed, setTyped] = useState("");
  const send = () => { if (typed.trim()) { process(typed); setTyped(""); } };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
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

      <div className="grid place-items-center px-5 py-4">
        <Orb />
        <div className="mt-3.5"><Waveform /></div>
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          {status === "listening" ? "À l'écoute… parlez maintenant" : status === "thinking" ? "Orkestra exécute votre demande…" : result ? "Voici le résultat" : supported ? "Touchez l'orbe pour parler" : "Tapez votre demande ci-dessous"}
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 pb-4">
        {(partial || transcript) && (
          <div className="ork-rise rounded-2xl border border-[var(--border)] bg-[var(--bg)]/60 px-4 py-2.5 text-sm text-[var(--text)] backdrop-blur">
            {transcript || <span className="italic text-[var(--text-muted)]">{partial}…</span>}
          </div>
        )}

        {error && <p className="text-xs text-amber-600">{error}</p>}

        {result && (
          <div className="ork-rise space-y-3">
            <div className="rounded-2xl border border-brand-200/70 bg-gradient-to-br from-brand-50/70 to-transparent p-4 backdrop-blur dark:border-brand-900/50 dark:from-brand-950/40">
              {result.title && <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-300">{result.title}</p>}
              <p className="text-sm leading-relaxed text-[var(--text)]">{result.spokenSummary}</p>
              {ttsSupported() && (
                <button onClick={() => speakReply(result.spokenSummary)} className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-brand-600 hover:underline"><Volume2 className="h-3 w-3" /> Lire</button>
              )}
            </div>

            {result.cards.length > 0 && <div className="space-y-2">{result.cards.map((c, i) => <VoiceCardView key={i} card={c} />)}</div>}

            {(result.actions.length > 0 || result.moduleLink) && (
              <div className="flex flex-wrap items-center gap-2">
                {result.actions.map((a, i) => a.kind === "command" ? (
                  <Button key={i} size="sm" variant={a.primary ? "primary" : "outline"} onClick={() => process(a.command || "")}>{a.label}</Button>
                ) : a.kind === "navigate" ? (
                  <Link key={i} href={a.href || "/"} onClick={closePanel}><Button size="sm" variant={a.primary ? "primary" : "outline"}>{a.label}</Button></Link>
                ) : (
                  <a key={i} href={a.href} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="outline" icon={<ExternalLink className="h-3.5 w-3.5" />}>{a.label}</Button></a>
                ))}
                <Button size="sm" variant="ghost" onClick={retry} icon={<RotateCcw className="h-3.5 w-3.5" />}>Réessayer</Button>
              </div>
            )}

            {result.moduleLink && (
              <Link href={result.moduleLink.href} onClick={closePanel} className="inline-flex items-center gap-1 text-xs font-medium text-[var(--text-muted)] transition hover:text-brand-600">
                <ArrowRight className="h-3.5 w-3.5" /> {result.moduleLink.label}
              </Link>
            )}
          </div>
        )}

        {!result && !listening && status !== "thinking" && (
          <div className="ork-fade">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-400">Demandez n'importe quoi</p>
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
      <aside className="ork-drawer-in fixed right-0 top-0 z-50 hidden h-full w-[420px] max-w-[92vw] flex-col border-l border-[var(--border)] bg-[var(--surface)]/85 shadow-2xl backdrop-blur-2xl lg:flex">
        <VoicePanelBody />
      </aside>
      <aside className="ork-sheet-in fixed inset-x-0 bottom-0 z-50 flex max-h-[88vh] flex-col rounded-t-3xl border-t border-[var(--border)] bg-[var(--surface)]/90 shadow-2xl backdrop-blur-2xl lg:hidden">
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-[var(--border)]" />
        <VoicePanelBody />
      </aside>
    </>
  );
}

"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOrkestra, connectedProviders } from "@/lib/store";
import { Button } from "@/components/ui/Button";
import {
  createSpeechRecognition, handleVoiceCommand, speakReply, stopSpeaking,
  speechSupported, ttsSupported,
} from "@/lib/voice/voice-orchestrator";
import type { VoiceContext, VoiceReply } from "@/lib/voice/voice-types";
import { Mic, X, Volume2, ArrowRight, Sparkles, Send, Square, RotateCcw, History } from "lucide-react";

// Suggestions intelligentes selon la page courante.
const SUGGESTIONS: { match: RegExp; items: string[] }[] = [
  { match: /^\/seo/, items: ["Est-ce que mon import est prêt ?", "Quels produits sont à corriger ?", "Quelle est la prochaine action ?"] },
  { match: /^\/lens/, items: ["Trouve des fournisseurs pour un Pilates Reformer", "Compare les meilleurs résultats", "Cherche ça sur Alibaba"] },
  { match: /^\/merchant/, items: ["Je peux lancer Google Shopping ?", "Quels sont les risques Merchant ?", "3 trucs à corriger avant GMC"] },
  { match: /^\/assistant/, items: ["Où importer un CSV ?", "Où modifier une meta description ?", "Où créer une redirection ?"] },
];
const DEFAULT_SUGGESTIONS = ["Analyse mon dernier import", "Ma boutique est-elle prête pour Merchant ?", "C'est quoi le plus urgent ?", "Résume ma boutique"];
function suggestionsFor(path: string): string[] {
  for (const s of SUGGESTIONS) if (s.match.test(path)) return s.items;
  return DEFAULT_SUGGESTIONS;
}

export function OrkestraVoice() {
  const { recentImports, analysis, brand, merchantResolved, lensSaved, importDraft, connections } = useOrkestra();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState("");
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState<VoiceReply | null>(null);
  const [readAloud, setReadAloud] = useState(false);
  const [error, setError] = useState("");
  const [typed, setTyped] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const recRef = useRef<{ start: () => void; stop: () => void } | null>(null);
  const supported = useMemo(() => speechSupported(), []);
  const suggestions = useMemo(() => suggestionsFor(pathname || "/"), [pathname]);

  function buildCtx(): VoiceContext {
    return {
      recentImports: recentImports.map((r) => ({
        fileName: r.fileName, products: r.products, status: r.status,
        warnings: r.warnings, risks: r.risks, failed: r.failed,
        verdict: r.verdict, riskReasons: r.riskReasons, avgScore: r.avgScore,
      })),
      analysis, brand, merchantResolved,
      lensSavedCount: lensSaved.length,
      lastProductName: lensSaved[0]?.analysis.productName,
      hasImportDraft: !!importDraft,
      connectedCount: connectedProviders(connections).length,
    };
  }
  function process(text: string) {
    if (!text.trim()) return;
    setTranscript(text); setPartial("");
    const { reply } = handleVoiceCommand(text, buildCtx());
    setReply(reply);
    setHistory((h) => [text, ...h.filter((x) => x !== text)].slice(0, 3));
    if (readAloud) speakReply(reply.text);
  }
  function start() {
    setError(""); setReply(null); setTranscript(""); setPartial("");
    const r = createSpeechRecognition({
      onPartial: setPartial,
      onFinal: (t) => { setListening(false); process(t); },
      onError: (c) => { setListening(false); setError(c === "not-allowed" ? "Micro refusé. Autorisez le microphone dans le navigateur." : "Reconnaissance vocale indisponible — tapez votre demande."); },
      onEnd: () => setListening(false),
    });
    if (!r) { setError("La reconnaissance vocale n'est pas supportée ici — tapez votre demande."); return; }
    recRef.current = r; r.start(); setListening(true);
  }
  function stop() { recRef.current?.stop(); setListening(false); }
  function openPanel() { setOpen(true); setReply(null); setTranscript(""); setPartial(""); setError(""); if (supported) start(); }
  function closePanel() { stop(); stopSpeaking(); setOpen(false); }

  return (
    <>
      {/* Bouton micro discret (header) */}
      <button
        onClick={openPanel}
        aria-label="Orkestra Voice"
        className="ork-glow grid h-10 w-10 place-items-center rounded-xl border border-[var(--border)] text-[var(--text-muted)] transition hover:text-brand-600"
      >
        <Mic className="h-[18px] w-[18px]" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-start justify-center bg-ink-950/30 p-4 pt-24 backdrop-blur-sm ork-fade" onClick={closePanel}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="ork-rise relative w-full max-w-lg overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-pop"
          >
            {/* Halo futuriste discret */}
            <div className="ork-halo pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2" />

            <div className="relative flex items-center justify-between px-5 pt-5">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white"><Sparkles className="h-4 w-4" /></span>
                <span className="text-sm font-semibold text-[var(--text)]">Orkestra Voice</span>
                <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">V1</span>
              </div>
              <button onClick={closePanel} aria-label="Fermer" className="grid h-8 w-8 place-items-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text)]"><X className="h-4 w-4" /></button>
            </div>

            {/* Orbe micro + waveform */}
            <div className="relative grid place-items-center px-5 py-6">
              <button
                onClick={() => (listening ? stop() : start())}
                className="relative grid h-20 w-20 place-items-center rounded-full text-white transition"
                style={{ background: "radial-gradient(120% 120% at 30% 25%, #8b7cf6, #5b4fd1 60%, #4a3fb0)" }}
                aria-label={listening ? "Arrêter" : "Parler"}
              >
                {listening && <span className="ork-aura" />}
                {listening ? <Square className="h-6 w-6" /> : <Mic className="h-7 w-7" />}
              </button>
              <div className="mt-4 flex h-6 items-end gap-1" aria-hidden>
                {Array.from({ length: 9 }).map((_, i) => (
                  <span key={i} className={`w-1 rounded-full ${listening ? "ork-wave bg-brand-500" : "bg-[var(--border)]"}`} style={{ height: listening ? undefined : 6, animationDelay: `${i * 90}ms` }} />
                ))}
              </div>
              <p className="mt-3 h-5 text-xs text-[var(--text-muted)]">
                {listening ? "À l'écoute…" : reply ? "Compris." : "Cliquez l'orbe pour parler"}
              </p>
            </div>

            <div className="space-y-3 px-5 pb-5">
              {/* Transcription */}
              {(partial || transcript) && (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm text-[var(--text)]">
                  {transcript || <span className="italic text-[var(--text-muted)]">{partial}…</span>}
                </div>
              )}

              {error && <p className="text-xs text-amber-600">{error}</p>}

              {/* Réponse Orkestra */}
              {reply && (
                <div className="ork-rise rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50/80 to-transparent p-4 dark:border-brand-900/60 dark:from-brand-950/40">
                  <p className="text-sm text-[var(--text)]">{reply.text}</p>
                  {reply.links && reply.links.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {reply.links.map((l) => (
                        <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--text)] hover:bg-ink-50 dark:hover:bg-ink-900">{l.source}</a>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {reply.href && reply.label && (
                      <Link href={reply.href} onClick={closePanel}><Button size="sm" icon={<ArrowRight className="h-3.5 w-3.5" />}>{reply.label}</Button></Link>
                    )}
                    {ttsSupported() && (
                      <Button size="sm" variant="ghost" onClick={() => speakReply(reply.text)} icon={<Volume2 className="h-3.5 w-3.5" />}>Lire la réponse</Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => { setReply(null); setTranscript(""); if (supported) start(); }} icon={<RotateCcw className="h-3.5 w-3.5" />}>Réessayer</Button>
                  </div>
                </div>
              )}

              {/* Saisie texte (repli + alternative au micro) */}
              <div className="flex items-center gap-2">
                <input
                  className="input flex-1"
                  placeholder={supported ? "…ou tapez votre demande" : "Tapez votre demande"}
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && typed.trim()) { process(typed); setTyped(""); } }}
                />
                <Button size="sm" variant="outline" onClick={() => { if (typed.trim()) { process(typed); setTyped(""); } }} icon={<Send className="h-3.5 w-3.5" />}>Envoyer</Button>
              </div>

              {!reply && !listening && (
                <div>
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-400">Suggestions</p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.map((ex) => (
                      <button key={ex} onClick={() => process(ex)} className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] text-[var(--text-muted)] transition hover:border-brand-300 hover:text-brand-600">{ex}</button>
                    ))}
                  </div>
                </div>
              )}

              {history.length > 0 && (
                <div>
                  <p className="mb-1.5 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-ink-400"><History className="h-3 w-3" /> Récent</p>
                  <div className="flex flex-wrap gap-1.5">
                    {history.map((h) => (
                      <button key={h} onClick={() => process(h)} className="max-w-full truncate rounded-full bg-ink-50 px-2.5 py-1 text-[11px] text-[var(--text-muted)] transition hover:text-brand-600 dark:bg-ink-900">{h}</button>
                    ))}
                  </div>
                </div>
              )}

              <label className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <input type="checkbox" checked={readAloud} onChange={(e) => setReadAloud(e.target.checked)} className="accent-brand-600" />
                Lire automatiquement les réponses à voix haute
              </label>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

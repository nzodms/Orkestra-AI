"use client";

// ──────────────────────────────────────────────────────────────────────────
// Orkestra Voice — orchestrateur (client).
// V1 : reconnaissance navigateur (Web Speech) → classification → outil → réponse
// courte → TTS navigateur. Architecture prête pour la V2 (transcribeAudio /
// streamVoiceSession via Gemini Live / OpenAI Realtime). Aucune clé loggée.
// ──────────────────────────────────────────────────────────────────────────

export function vlog(event: string, extra: Record<string, unknown> = {}): void {
  console.log("[Voice]", { event, ...extra });
}

// ── Capacités navigateur ─────────────────────────────────────────────────────
interface SpeechResult { 0: { transcript: string }; isFinal: boolean }
interface SpeechEvt { resultIndex: number; results: ArrayLike<SpeechResult> }
interface SpeechRec {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number;
  start(): void; stop(): void;
  onresult: ((e: SpeechEvt) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechCtor = new () => SpeechRec;
function speechCtor(): SpeechCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}
export function speechSupported(): boolean { return !!speechCtor(); }
export function ttsSupported(): boolean { return typeof window !== "undefined" && "speechSynthesis" in window; }

export interface RecognitionOpts {
  lang?: string;
  onPartial?: (t: string) => void;
  onFinal?: (t: string) => void;
  onError?: (code: string) => void;
  onEnd?: () => void;
}
/** Crée un recognizer navigateur (null si non supporté). */
export function createSpeechRecognition(opts: RecognitionOpts): { start: () => void; stop: () => void } | null {
  const Ctor = speechCtor();
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = opts.lang || "fr-FR";
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;
  rec.onresult = (e) => {
    let interim = "", final = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) final += r[0].transcript; else interim += r[0].transcript;
    }
    if (interim && opts.onPartial) opts.onPartial(interim);
    if (final && opts.onFinal) { vlog("voice-transcription-ok", { len: final.trim().length }); opts.onFinal(final.trim()); }
  };
  rec.onerror = (e) => { vlog("voice-transcription-error", { code: e?.error }); opts.onError?.(e?.error || "error"); };
  rec.onend = () => opts.onEnd?.();
  return {
    start: () => { vlog("voice-start"); try { rec.start(); } catch { /* déjà démarré */ } },
    stop: () => { try { rec.stop(); } catch { /* déjà arrêté */ } },
  };
}

// ── TTS (réponse lue) ────────────────────────────────────────────────────────
export function speakReply(text: string, opts: { lang?: string } = {}): void {
  if (!ttsSupported() || !text) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = opts.lang || "fr-FR"; u.rate = 1.02; u.pitch = 1;
    u.onerror = () => vlog("voice-tts-error");
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch { vlog("voice-tts-error"); }
}
export function stopSpeaking(): void { if (ttsSupported()) { try { window.speechSynthesis.cancel(); } catch { /* ignore */ } } }

// ── V2 (préparé, NON branché en V1) ─────────────────────────────────────────
/** V2 : transcription serveur (OpenAI/Gemini) — repli si Web Speech indisponible. */
export async function transcribeAudio(): Promise<string> {
  throw new Error("transcribeAudio() : V2. La V1 utilise la reconnaissance vocale du navigateur.");
}
/** V2 : session temps réel (Gemini Live API / OpenAI Realtime). */
export async function streamVoiceSession(): Promise<never> {
  throw new Error("streamVoiceSession() : V2 temps réel (Gemini Live / OpenAI Realtime).");
}

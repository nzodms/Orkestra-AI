// ──────────────────────────────────────────────────────────────────────────
// Orkestra Voice — couche RUNTIME (abstraction temps réel + voix premium).
// V1 : « text-fallback » actif (transcription navigateur + tools + cards). La
// voix robotique du navigateur n'est PAS l'expérience principale (fallback opt-in).
// V2 (préparée, non branchée) : Gemini Live / OpenAI Realtime (audio temps réel,
// interruption, tool calling streaming).
// ──────────────────────────────────────────────────────────────────────────

export type VoiceRuntimeProvider = "gemini-live" | "openai-realtime" | "text-fallback";

export interface VoiceRuntimeStatus {
  /** Runtime ACTIF (V1 = text-fallback). */
  provider: VoiceRuntimeProvider;
  /** Le temps réel audio est-il branché ? (false en V1) */
  realtimeAvailable: boolean;
  /** Une voix premium est-elle configurée ? (false en V1) */
  premiumVoice: boolean;
  /** Provider qui SERAIT utilisé en V2 selon les IA connectées. */
  detected?: "gemini-live" | "openai-realtime";
  /** Libellé honnête affiché dans le panel. */
  label: string;
}
export interface ConnectedFlags { gemini?: boolean; openai?: boolean }

/** Choisit le runtime. Priorité : OpenAI Realtime (branché) → text-fallback.
 *  Gemini Live reste détecté pour un second runtime (à brancher plus tard). */
export function selectVoiceRuntime(c: ConnectedFlags): VoiceRuntimeStatus {
  if (c.openai) {
    return { provider: "openai-realtime", realtimeAvailable: true, premiumVoice: true, detected: "openai-realtime", label: "OpenAI Realtime" };
  }
  const detected = c.gemini ? "gemini-live" : undefined;
  return {
    provider: "text-fallback",
    realtimeAvailable: false,
    premiumVoice: false,
    detected,
    label: detected ? "Mode texte · Gemini Live bientôt" : "Mode texte",
  };
}

// ── V2 — architecture prête, NON branchée (stubs documentés) ────────────────
export async function startRealtimeVoiceSession(): Promise<never> {
  throw new Error("startRealtimeVoiceSession() : V2 (Gemini Live / OpenAI Realtime). V1 = text-fallback.");
}
export async function stopRealtimeVoiceSession(): Promise<void> { /* no-op en V1 */ }
export function sendAudioChunk(_chunk: ArrayBuffer): void { /* V2 : flux micro → provider realtime */ }
export function receiveAudioStream(_onChunk: (a: ArrayBuffer) => void): void { /* V2 : audio assistant → lecture */ }
export function handleRealtimeToolCall(_name: string, _args: unknown): void { /* V2 : routé vers le command center (mêmes tools) */ }
/** Interrompt la parole de l'assistant (annule la TTS en cours). */
export function interruptAssistantSpeech(): void {
  if (typeof window !== "undefined" && "speechSynthesis" in window) { try { window.speechSynthesis.cancel(); } catch { /* ignore */ } }
}
export function storeConversationState(): void { /* V1 : géré par VoiceProvider (turns + session) */ }
export function resumeConversationContext(): void { /* V1 : géré par VoiceProvider */ }

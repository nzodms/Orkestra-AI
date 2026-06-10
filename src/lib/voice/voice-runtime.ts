// ──────────────────────────────────────────────────────────────────────────
// Orkestra Voice — couche RUNTIME (abstraction temps réel + voix premium).
// V1 : « text-fallback » actif (transcription navigateur + tools + cards). La
// voix robotique du navigateur n'est PAS l'expérience principale (fallback opt-in).
// V2 (préparée, non branchée) : Gemini Live / OpenAI Realtime (audio temps réel,
// interruption, tool calling streaming).
// ──────────────────────────────────────────────────────────────────────────

export type VoiceRuntimeProvider = "gemini-live" | "openai-realtime" | "text-fallback";

/** URL du proxy WS Orkestra (repli quand les tokens éphémères Gemini sont refusés).
 *  Vide tant qu'aucun proxy n'est déployé → repli texte. Jamais la clé : juste l'URL. */
export const VOICE_PROXY_URL = (process.env.NEXT_PUBLIC_VOICE_PROXY_URL || "").trim();

export interface VoiceRuntimeStatus {
  /** Runtime ACTIF. Mode principal actuel = text-fallback (Command Center intelligent). */
  provider: VoiceRuntimeProvider;
  /** Le temps réel audio est-il le mode PRINCIPAL ? (false pour l'instant) */
  realtimeAvailable: boolean;
  /** Le temps réel peut-il être tenté en OPTION AVANCÉE (OpenAI connecté) ? */
  realtimeOption: boolean;
  /** Une voix premium est-elle configurée ? */
  premiumVoice: boolean;
  /** Un proxy WS serveur est-il configuré (repli si token éphémère refusé) ? */
  proxyAvailable: boolean;
  /** Provider qui SERAIT utilisé en temps réel selon les IA connectées. */
  detected?: "gemini-live" | "openai-realtime";
  /** Libellé principal affiché dans le panel. */
  label: string;
  /** Sous-texte rassurant. */
  note: string;
}
export interface ConnectedFlags { gemini?: boolean; openai?: boolean }

/** Priorité : Gemini Live (PRINCIPAL si Gemini connecté) → OpenAI Realtime (option
 *  avancée) → texte intelligent. Le temps réel reste non bloquant (repli texte).
 *  En mode Gemini, l'ordre de connexion réel est : token éphémère → proxy serveur
 *  (si configuré) → texte — orchestré côté VoiceProvider. */
export function selectVoiceRuntime(c: ConnectedFlags): VoiceRuntimeStatus {
  const proxyAvailable = !!VOICE_PROXY_URL;
  if (c.gemini) {
    return { provider: "gemini-live", realtimeAvailable: true, realtimeOption: true, premiumVoice: true, proxyAvailable, detected: "gemini-live", label: "Gemini Live", note: "Conversation vocale temps réel" };
  }
  if (c.openai) {
    return { provider: "openai-realtime", realtimeAvailable: false, realtimeOption: true, premiumVoice: false, proxyAvailable, detected: "openai-realtime", label: "Mode texte intelligent", note: "Voix temps réel (OpenAI) en option avancée" };
  }
  return { provider: "text-fallback", realtimeAvailable: false, realtimeOption: false, premiumVoice: false, proxyAvailable, label: "Mode texte intelligent", note: "Voix temps réel bientôt disponible" };
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

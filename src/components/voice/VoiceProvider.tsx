"use client";

import { createContext, useContext, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useOrkestra, connectedProviders } from "@/lib/store";
import { createSpeechRecognition, speakReply, stopSpeaking, speechSupported } from "@/lib/voice/voice-orchestrator";
import { runVoiceCommand } from "@/lib/voice/voice-command-center";
import { selectVoiceRuntime, interruptAssistantSpeech, type VoiceRuntimeStatus } from "@/lib/voice/voice-runtime";
import { EMPTY_SESSION, nextSession, type VoiceSession } from "@/lib/voice/voice-session";
import { startRealtimeSession, type RealtimeHandle, type RealtimeStatus, type RealtimeCallbacks } from "@/lib/voice/voice-realtime";
import { startGeminiLiveSession } from "@/lib/voice/voice-gemini-live";
import { executeRealtimeTool } from "@/lib/voice/voice-realtime-tools";
import type { VoiceContext as VCtx, VoiceResult } from "@/lib/voice/voice-types";

// Suggestions intelligentes selon la page courante.
const SUGGESTIONS: { match: RegExp; items: string[] }[] = [
  { match: /^\/seo/, items: ["Mon import est-il prêt ?", "Quels produits sont à corriger ?", "Quelle est la prochaine action ?"] },
  { match: /^\/lens/, items: ["Trouve des fournisseurs pour un Pilates Reformer", "Compare les meilleurs résultats", "Cherche ça sur Alibaba"] },
  { match: /^\/merchant/, items: ["Je peux lancer Google Shopping ?", "Quels sont les risques Merchant ?", "3 trucs à corriger avant GMC"] },
  { match: /^\/assistant/, items: ["Où importer un CSV ?", "Où modifier une meta ?", "Où créer une redirection ?"] },
];
const DEFAULT_SUGGESTIONS = ["Analyse mon dernier import", "Ma boutique est prête pour Merchant ?", "C'est quoi le plus urgent ?"];
function suggestionsFor(path: string): string[] {
  for (const s of SUGGESTIONS) if (s.match.test(path)) return s.items;
  return DEFAULT_SUGGESTIONS;
}

export type VoiceStatus = "idle" | "listening" | "thinking" | "searching" | "connecting" | "tool" | "speaking" | "reply";
export interface VoiceTurn { user: string; result: VoiceResult }

interface VoiceContextValue {
  open: boolean;
  openPanel: () => void;
  closePanel: () => void;
  status: VoiceStatus;
  statusLabel: string;
  listening: boolean;
  partial: string;
  transcript: string;
  result: VoiceResult | null;
  turns: VoiceTurn[];
  runtime: VoiceRuntimeStatus;
  history: string[];
  error: string;
  supported: boolean;
  readAloud: boolean;
  setReadAloud: (v: boolean) => void;
  suggestions: string[];
  start: () => void;
  stop: () => void;
  process: (text: string) => void;
  retry: () => void;
  interrupt: () => void;
  clearConversation: () => void;
  // ── Temps réel (OpenAI Realtime) ──
  realtimeActive: boolean;
  muted: boolean;
  assistantLive: string;
  startRealtime: () => void;
  stopRealtime: () => void;
  toggleMute: () => void;
}

const Ctx = createContext<VoiceContextValue | null>(null);
export function useVoice(): VoiceContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useVoice must be used within VoiceProvider");
  return v;
}

const STATUS_LABEL: Record<VoiceStatus, string> = { idle: "Prêt", listening: "À l'écoute", thinking: "Comprend…", searching: "Recherche…", connecting: "Connexion…", tool: "Appel d'outil…", speaking: "Réponse vocale", reply: "Réponse" };
function mapRealtime(s: RealtimeStatus): VoiceStatus {
  return s === "connecting" ? "connecting" : s === "listening" ? "listening" : s === "thinking" ? "thinking" : s === "tool" ? "tool" : s === "speaking" ? "speaking" : "idle";
}

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const { recentImports, analysis, brand, merchantResolved, lensSaved, importDraft, connections } = useOrkestra();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [partial, setPartial] = useState("");
  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState<VoiceResult | null>(null);
  const [turns, setTurns] = useState<VoiceTurn[]>([]);
  const [readAloud, setReadAloud] = useState(false); // voix navigateur = fallback opt-in (jamais auto)
  const [error, setError] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const recRef = useRef<{ start: () => void; stop: () => void } | null>(null);
  const sessionRef = useRef<VoiceSession>(EMPTY_SESSION);
  const [realtimeActive, setRealtimeActive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [assistantLive, setAssistantLive] = useState("");
  const handleRef = useRef<RealtimeHandle | null>(null);
  const lastUserRef = useRef("");
  const supported = useMemo(() => speechSupported(), []);
  const suggestions = useMemo(() => suggestionsFor(pathname || "/"), [pathname]);
  const runtime = useMemo(() => selectVoiceRuntime({ gemini: !!connections.gemini?.connected, openai: !!connections.openai?.connected }), [connections.gemini?.connected, connections.openai?.connected]);

  function buildCtx(): VCtx {
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
  async function process(text: string) {
    if (!text.trim()) return;
    setTranscript(text); setPartial(""); setResult(null); setError("");
    const searching = /fournisseur|alibaba|aliexpress|1688|cherche|trouve|sourcing/.test(text.toLowerCase());
    setStatus(searching ? "searching" : "thinking");
    const ctx = buildCtx();
    const keyRefs = { openai: connections.openai?.keyId, claude: connections.anthropic?.keyId, gemini: connections.gemini?.keyId };
    try {
      const res = await runVoiceCommand(text, ctx, keyRefs, sessionRef.current);
      sessionRef.current = nextSession(sessionRef.current, res.intent, res);
      setResult(res); setStatus("reply");
      setTurns((ts) => [...ts, { user: text, result: res }].slice(-6));
      setHistory((h) => [text, ...h.filter((x) => x !== text)].slice(0, 3));
      // Voix navigateur UNIQUEMENT si l'utilisateur l'a activée (jamais en automatique premium).
      if (readAloud) speakReply(res.spokenSummary);
    } catch {
      setStatus("idle"); setError("Action impossible pour l'instant. Réessayez.");
    }
  }
  // ── OpenAI Realtime (vraie conversation audio) ──
  async function handleToolCall(name: string, args: Record<string, unknown>): Promise<string> {
    const keyRefs = { openai: connections.openai?.keyId, claude: connections.anthropic?.keyId, gemini: connections.gemini?.keyId };
    const { result, session, text } = await executeRealtimeTool(name, args, buildCtx(), sessionRef.current, keyRefs);
    sessionRef.current = session;
    setResult(result);
    setTurns((ts) => [...ts, { user: lastUserRef.current || "(demande vocale)", result }].slice(-6));
    lastUserRef.current = "";
    return text;
  }
  async function startRealtime() {
    if (!runtime.realtimeOption) { setError("La voix temps réel nécessite Gemini ou OpenAI connecté. Orkestra reste disponible en mode texte intelligent."); return; }
    if (handleRef.current) return;
    setError(""); setStatus("connecting"); if (recRef.current) stop();
    const callbacks: RealtimeCallbacks = {
      keyRefs: { openai: connections.openai?.keyId, gemini: connections.gemini?.keyId },
      onStatus: (s) => setStatus(mapRealtime(s)),
      onUserTranscript: (t) => { lastUserRef.current = t; setTranscript(t); },
      onAssistantText: (t) => setAssistantLive(t),
      onToolCall: handleToolCall,
      onError: (m) => setError(m),
    };
    try {
      const engine = runtime.provider === "gemini-live" ? startGeminiLiveSession : startRealtimeSession;
      const h = await engine(callbacks);
      handleRef.current = h; setRealtimeActive(true); setMuted(false);
    } catch {
      // Repli propre : mode texte intelligent + dictée navigateur.
      setRealtimeActive(false); setStatus("idle");
      if (supported) start();
    }
  }
  function stopRealtime() {
    handleRef.current?.stop(); handleRef.current = null;
    setRealtimeActive(false); setAssistantLive(""); setStatus("idle");
  }
  function toggleMute() { const m = !muted; setMuted(m); handleRef.current?.setMuted(m); }

  function start() {
    setError(""); setResult(null); setTranscript(""); setPartial("");
    const r = createSpeechRecognition({
      onPartial: setPartial,
      onFinal: (t) => process(t),
      onError: (c) => { setStatus("idle"); setError(c === "not-allowed" ? "Micro refusé. Autorisez le microphone." : "Reconnaissance vocale indisponible — tapez votre demande."); },
      onEnd: () => setStatus((s) => (s === "listening" ? "idle" : s)),
    });
    if (!r) { setError("Reconnaissance vocale non supportée ici — tapez votre demande."); return; }
    recRef.current = r; r.start(); setStatus("listening");
  }
  function stop() { recRef.current?.stop(); setStatus((s) => (s === "listening" ? "idle" : s)); }
  function openPanel() {
    setOpen(true); setError(""); setResult(null); setTranscript(""); setPartial(""); setStatus("idle");
    // Gemini Live primaire : on attend « Démarrer la conversation ». Sinon dictée navigateur.
    if (!runtime.realtimeAvailable && supported) start();
  }
  function closePanel() {
    if (handleRef.current) stopRealtime();
    stop(); stopSpeaking(); setOpen(false); setStatus("idle");
  }
  function retry() { setResult(null); setTranscript(""); setStatus("idle"); if (realtimeActive) handleRef.current?.interrupt(); else if (supported) start(); }
  function interrupt() {
    if (realtimeActive) handleRef.current?.interrupt();
    else { stopSpeaking(); interruptAssistantSpeech(); if (status === "listening") stop(); }
  }
  function clearConversation() { setTurns([]); setResult(null); setTranscript(""); setHistory([]); sessionRef.current = EMPTY_SESSION; setStatus(realtimeActive ? "listening" : "idle"); }

  const value: VoiceContextValue = {
    open, openPanel, closePanel,
    status, statusLabel: STATUS_LABEL[status],
    listening: status === "listening",
    partial, transcript, result, turns, runtime, history, error, supported,
    readAloud, setReadAloud, suggestions,
    start, stop, process, retry, interrupt, clearConversation,
    realtimeActive, muted, assistantLive, startRealtime, stopRealtime, toggleMute,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

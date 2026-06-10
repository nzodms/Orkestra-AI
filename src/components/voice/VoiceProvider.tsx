"use client";

import { createContext, useContext, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useOrkestra, connectedProviders } from "@/lib/store";
import { createSpeechRecognition, speakReply, stopSpeaking, speechSupported, vlog } from "@/lib/voice/voice-orchestrator";
import { runVoiceCommand } from "@/lib/voice/voice-command-center";
import { selectVoiceRuntime, interruptAssistantSpeech, VOICE_PROXY_URL, type VoiceRuntimeStatus } from "@/lib/voice/voice-runtime";
import { EMPTY_SESSION, nextSession, type VoiceSession } from "@/lib/voice/voice-session";
import { startRealtimeSession, type RealtimeHandle, type RealtimeStatus, type RealtimeCallbacks, type VoiceDiag } from "@/lib/voice/voice-realtime";
import { startGeminiLiveSession } from "@/lib/voice/voice-gemini-live";
import { executeRealtimeTool } from "@/lib/voice/voice-realtime-tools";

export type RealtimeState = "off" | "connecting" | "live" | "failed";
/** Mode de connexion temps réel réellement actif (pour un badge honnête). */
export type RealtimeMode = "token" | "proxy" | null;
const EMPTY_DIAG: VoiceDiag = { ws: false, mic: false, audioIn: false, audioOut: false, chunks: 0, messages: 0 };
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
  // ── Temps réel (Gemini Live / OpenAI Realtime) ──
  realtimeActive: boolean;
  realtimeState: RealtimeState;
  realtimeMode: RealtimeMode;
  diag: VoiceDiag;
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
  const [realtimeState, setRealtimeState] = useState<RealtimeState>("off");
  const [realtimeMode, setRealtimeMode] = useState<RealtimeMode>(null);
  const [diag, setDiag] = useState<VoiceDiag>(EMPTY_DIAG);
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
    setError(""); setStatus("connecting"); setRealtimeState("connecting"); setRealtimeMode(null); setDiag(EMPTY_DIAG); if (recRef.current) stop();
    const callbacks: RealtimeCallbacks = {
      keyRefs: { openai: connections.openai?.keyId, gemini: connections.gemini?.keyId },
      onStatus: (s) => {
        setStatus(mapRealtime(s));
        if (s === "listening" || s === "speaking" || s === "tool") setRealtimeState("live");
        else if (s === "error" || s === "closed") { handleRef.current = null; setRealtimeActive(false); setRealtimeState((prev) => (prev === "connecting" ? "failed" : "off")); }
      },
      onUserTranscript: (t) => { lastUserRef.current = t; setTranscript(t); },
      onAssistantText: (t) => setAssistantLive(t),
      onToolCall: handleToolCall,
      onError: (m) => setError(m),
      onDiag: (patch) => setDiag((d) => ({ ...d, ...patch })),
    };
    const live = (h: RealtimeHandle, mode: RealtimeMode) => { handleRef.current = h; setRealtimeActive(true); setMuted(false); setRealtimeMode(mode); };
    const fail = (reason: string, msg?: string) => { setRealtimeActive(false); setRealtimeState("failed"); setStatus("idle"); setRealtimeMode(null); setDiag((d) => ({ ...d, lastError: reason })); if (msg) setError(msg); };

    // OpenAI Realtime (option avancée) — pas de chaîne token→proxy.
    if (runtime.provider !== "gemini-live") {
      try { live(await startRealtimeSession(callbacks), "token"); setError(""); }
      catch (e) { const reason = (e as Error)?.message || "inconnue"; vlog("gemini-live-fallback-to-text", { reason }); fail(reason); }
      return;
    }

    // Gemini — ordre de connexion : token éphémère → proxy serveur → texte.
    try { live(await startGeminiLiveSession(callbacks), "token"); setError(""); return; }
    catch (e) {
      const reason = (e as Error)?.message || "inconnue";
      // Token refusé (no-access / invalid-key / no-token) → PROXY serveur si configuré.
      if (reason.startsWith("token:") && VOICE_PROXY_URL) {
        vlog("gemini-live-token-no-access", { reason });
        setError("Token Gemini Live indisponible. Connexion via proxy sécurisé…");
        setRealtimeState("connecting"); setDiag(EMPTY_DIAG);
        try { live(await startGeminiLiveSession(callbacks, { proxyUrl: VOICE_PROXY_URL }), "proxy"); setError(""); return; }
        catch (e2) {
          const r2 = (e2 as Error)?.message || "inconnue";
          vlog("gemini-live-fallback-to-text", { reason: r2, after: "proxy" });
          fail(r2, "Proxy Gemini Live indisponible. Orkestra reste en mode texte intelligent.");
          return;
        }
      }
      // Pas de proxy configuré, ou autre échec → honnête, pas de bascule silencieuse.
      vlog("gemini-live-fallback-to-text", { reason });
      fail(reason, reason.startsWith("token:") && !VOICE_PROXY_URL ? "Gemini Live nécessite un proxy WebSocket persistant (token éphémère refusé). Mode texte intelligent activé." : undefined);
    }
  }
  function stopRealtime() {
    handleRef.current?.stop(); handleRef.current = null;
    setRealtimeActive(false); setRealtimeState("off"); setRealtimeMode(null); setAssistantLive(""); setStatus("idle");
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
    realtimeActive, realtimeState, realtimeMode, diag, muted, assistantLive, startRealtime, stopRealtime, toggleMute,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

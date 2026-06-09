"use client";

import { createContext, useContext, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useOrkestra, connectedProviders } from "@/lib/store";
import {
  createSpeechRecognition, handleVoiceCommand, speakReply, stopSpeaking, speechSupported,
} from "@/lib/voice/voice-orchestrator";
import type { VoiceContext as VCtx, VoiceReply } from "@/lib/voice/voice-types";

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

export type VoiceStatus = "idle" | "listening" | "thinking" | "reply";

interface VoiceContextValue {
  open: boolean;
  openPanel: () => void;
  closePanel: () => void;
  status: VoiceStatus;
  statusLabel: string;
  listening: boolean;
  partial: string;
  transcript: string;
  reply: VoiceReply | null;
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
}

const Ctx = createContext<VoiceContextValue | null>(null);
export function useVoice(): VoiceContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useVoice must be used within VoiceProvider");
  return v;
}

const STATUS_LABEL: Record<VoiceStatus, string> = { idle: "Prêt", listening: "À l'écoute", thinking: "Réflexion…", reply: "Réponse" };

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const { recentImports, analysis, brand, merchantResolved, lensSaved, importDraft, connections } = useOrkestra();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [partial, setPartial] = useState("");
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState<VoiceReply | null>(null);
  const [readAloud, setReadAloud] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const recRef = useRef<{ start: () => void; stop: () => void } | null>(null);
  const thinkRef = useRef<number | null>(null);
  const supported = useMemo(() => speechSupported(), []);
  const suggestions = useMemo(() => suggestionsFor(pathname || "/"), [pathname]);

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
  function process(text: string) {
    if (!text.trim()) return;
    setTranscript(text); setPartial(""); setReply(null); setStatus("thinking");
    const ctx = buildCtx();
    if (thinkRef.current) window.clearTimeout(thinkRef.current);
    thinkRef.current = window.setTimeout(() => {
      const { reply } = handleVoiceCommand(text, ctx);
      setReply(reply); setStatus("reply");
      setHistory((h) => [text, ...h.filter((x) => x !== text)].slice(0, 3));
      if (readAloud) speakReply(reply.text);
    }, 280);
  }
  function start() {
    setError(""); setReply(null); setTranscript(""); setPartial("");
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
  function openPanel() { setOpen(true); setError(""); setReply(null); setTranscript(""); setPartial(""); setStatus("idle"); if (supported) start(); }
  function closePanel() { stop(); stopSpeaking(); setOpen(false); setStatus("idle"); }
  function retry() { setReply(null); setTranscript(""); setStatus("idle"); if (supported) start(); }

  const value: VoiceContextValue = {
    open, openPanel, closePanel,
    status, statusLabel: STATUS_LABEL[status],
    listening: status === "listening",
    partial, transcript, reply, history, error, supported,
    readAloud, setReadAloud, suggestions,
    start, stop, process, retry,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

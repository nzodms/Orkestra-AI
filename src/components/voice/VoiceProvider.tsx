"use client";

import { createContext, useContext, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useOrkestra, connectedProviders } from "@/lib/store";
import { createSpeechRecognition, speakReply, stopSpeaking, speechSupported } from "@/lib/voice/voice-orchestrator";
import { runVoiceCommand } from "@/lib/voice/voice-command-center";
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
  result: VoiceResult | null;
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
  const [result, setResult] = useState<VoiceResult | null>(null);
  const [readAloud, setReadAloud] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const recRef = useRef<{ start: () => void; stop: () => void } | null>(null);
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
  async function process(text: string) {
    if (!text.trim()) return;
    setTranscript(text); setPartial(""); setResult(null); setStatus("thinking"); setError("");
    const ctx = buildCtx();
    const keyRefs = { openai: connections.openai?.keyId, claude: connections.anthropic?.keyId, gemini: connections.gemini?.keyId };
    try {
      const res = await runVoiceCommand(text, ctx, keyRefs);
      setResult(res); setStatus("reply");
      setHistory((h) => [text, ...h.filter((x) => x !== text)].slice(0, 3));
      if (readAloud) speakReply(res.spokenSummary);
    } catch {
      setStatus("idle"); setError("Action impossible pour l'instant. Réessayez.");
    }
  }
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
  function openPanel() { setOpen(true); setError(""); setResult(null); setTranscript(""); setPartial(""); setStatus("idle"); if (supported) start(); }
  function closePanel() { stop(); stopSpeaking(); setOpen(false); setStatus("idle"); }
  function retry() { setResult(null); setTranscript(""); setStatus("idle"); if (supported) start(); }

  const value: VoiceContextValue = {
    open, openPanel, closePanel,
    status, statusLabel: STATUS_LABEL[status],
    listening: status === "listening",
    partial, transcript, result, history, error, supported,
    readAloud, setReadAloud, suggestions,
    start, stop, process, retry,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

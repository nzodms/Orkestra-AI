"use client";

import { useState } from "react";
import { useOrkestra, connectedProviders } from "@/lib/store";
import { PROVIDERS } from "@/lib/providers";
import { PageHeader, Card, Badge, ScoreRing } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import type { CouncilMode, CouncilResult, GenerationRecord } from "@/lib/types";
import {
  MessagesSquare, Send, Sparkles, Search, Code2, ShieldCheck, Mail, FileText,
  TrendingUp, Swords, MessageCircle, Copy, Check, Wand2, Scissors, FileCode2,
} from "lucide-react";

const MODES: { id: CouncilMode; label: string; icon: React.ElementType }[] = [
  { id: "seo", label: "SEO", icon: Search },
  { id: "code", label: "Code Shopify", icon: Code2 },
  { id: "merchant", label: "Merchant Center", icon: ShieldCheck },
  { id: "email", label: "Email client", icon: Mail },
  { id: "quote", label: "Devis", icon: FileText },
  { id: "strategy", label: "Stratégie", icon: TrendingUp },
  { id: "competitive", label: "Concurrence", icon: Swords },
  { id: "free", label: "Question libre", icon: MessageCircle },
];

const ACTIONS = [
  { label: "Améliorer", icon: Wand2 },
  { label: "Raccourcir", icon: Scissors },
  { label: "Plus premium", icon: Sparkles },
  { label: "Convertir en HTML", icon: FileCode2 },
];

export default function CouncilPage() {
  const { connections, brand, addGeneration } = useOrkestra();
  const providers = connectedProviders(connections);
  const [mode, setMode] = useState<CouncilMode>("seo");
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CouncilResult | null>(null);
  const [tab, setTab] = useState<"final" | string>("final");

  async function ask() {
    if (!question.trim()) return;
    setLoading(true);
    setResult(null);
    setTab("final");
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "council", mode, question, providers }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.ok) {
      setResult(data.result);
      const rec: GenerationRecord = {
        id: crypto.randomUUID(),
        type: "council",
        title: `AI Council — ${question.slice(0, 40)}`,
        store: brand.storeName || "Boutique",
        createdAt: new Date().toISOString(),
        models: providers.length ? providers : ["openai"],
        status: "completed",
        score: data.result.qualityScore,
        preview: "Réponse fusionnée multi-IA.",
      };
      addGeneration(rec);
    }
  }

  return (
    <>
      <PageHeader
        title="AI Council"
        description="Posez une question : Orkestra interroge vos IA connectées en parallèle, puis fusionne la meilleure réponse finale."
        actions={
          <Badge tone={providers.length ? "good" : "warn"}>
            {providers.length ? `${providers.length} IA dans l'orchestre` : "Mode simulé"}
          </Badge>
        }
      />

      {/* Mode selector */}
      <div className="mb-4 flex flex-wrap gap-2">
        {MODES.map((m) => {
          const Icon = m.icon;
          const active = mode === m.id;
          return (
            <button key={m.id} onClick={() => setMode(m.id)} className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition ${active ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300" : "border-[var(--border)] text-[var(--text-muted)] hover:border-brand-300"}`}>
              <Icon className="h-4 w-4" /> {m.label}
            </button>
          );
        })}
      </div>

      {/* Input */}
      <Card className="mb-5">
        <div className="flex items-end gap-3">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) ask(); }}
            placeholder={`Posez votre question en mode « ${MODES.find((m) => m.id === mode)?.label} »…`}
            className="input min-h-[56px] flex-1 resize-none"
          />
          <Button onClick={ask} loading={loading} size="lg" icon={!loading ? <Send className="h-4 w-4" /> : undefined}>
            Demander
          </Button>
        </div>
        <p className="mt-2 hint">⌘/Ctrl + Entrée pour envoyer · Réponses des IA fusionnées par l&apos;orchestre Orkestra.</p>
      </Card>

      {!result && !loading && (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950">
            <MessagesSquare className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-base font-semibold">L&apos;orchestre est prêt</h3>
          <p className="mt-1.5 max-w-md text-sm text-[var(--text-muted)]">
            Plusieurs IA répondent à votre question. Orkestra compare, arbitre et synthétise la meilleure réponse — avec les réponses individuelles consultables en onglets.
          </p>
        </Card>
      )}

      {loading && (
        <Card className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <Sparkles className="h-4 w-4 animate-pulse text-brand-600" /> L&apos;orchestre délibère…
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-4 animate-pulse rounded bg-ink-100 dark:bg-ink-900" style={{ width: `${50 + Math.random() * 45}%` }} />
          ))}
        </Card>
      )}

      {result && (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card className="animate-fade-in">
              {/* Tabs */}
              <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-[var(--border)] pb-3">
                <button onClick={() => setTab("final")} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${tab === "final" ? "bg-brand-600 text-white" : "text-[var(--text-muted)] hover:bg-ink-100 dark:hover:bg-ink-900"}`}>
                  ✦ Réponse recommandée
                </button>
                {result.providerAnswers.map((p) => (
                  <button key={p.provider} onClick={() => setTab(p.provider)} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${tab === p.provider ? "bg-ink-900 text-white dark:bg-ink-100 dark:text-ink-900" : "text-[var(--text-muted)] hover:bg-ink-100 dark:hover:bg-ink-900"}`}>
                    {PROVIDERS[p.provider].name}
                  </button>
                ))}
              </div>

              {tab === "final" ? (
                <div>
                  <div className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text)]">{result.finalAnswer}</div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {ACTIONS.map((a) => {
                      const Icon = a.icon;
                      return <Button key={a.label} variant="outline" size="sm" icon={<Icon className="h-3.5 w-3.5" />} onClick={ask}>{a.label}</Button>;
                    })}
                    <CopyBtn text={result.finalAnswer} />
                  </div>
                </div>
              ) : (
                (() => {
                  const p = result.providerAnswers.find((x) => x.provider === tab);
                  if (!p) return null;
                  return (
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <Badge tone="brand">{PROVIDERS[p.provider].name}</Badge>
                        <Badge tone="neutral">Qualité {p.qualityScore}</Badge>
                      </div>
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">{p.answer}</div>
                    </div>
                  );
                })()
              )}
            </Card>
          </div>

          {/* Synthesis sidebar */}
          <div className="space-y-4">
            <Card className="flex flex-col items-center text-center">
              <ScoreRing value={result.qualityScore} size={88} label="qualité" />
              <p className="mt-2 text-xs text-[var(--text-muted)]">Score de qualité de la synthèse finale</p>
            </Card>
            <Card>
              <h3 className="mb-3 text-sm font-semibold">Pourquoi cette synthèse ?</h3>
              <ul className="space-y-2">
                {result.synthesisReasons.map((r, i) => (
                  <li key={i} className="flex gap-2 text-xs text-[var(--text-muted)]">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" /> {r}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }} icon={copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}>
      {copied ? "Copié" : "Exporter"}
    </Button>
  );
}

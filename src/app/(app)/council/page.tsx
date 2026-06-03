"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useOrkestra, connectedProviders } from "@/lib/store";
import { PROVIDERS } from "@/lib/providers";
import { PageHeader, Card, Badge, ScoreRing, Progress } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { Markdown } from "@/components/ui/Markdown";
import type { CouncilMode, CouncilResult, CouncilTurn, GenerationRecord, AIProviderId, SiteReview, ModuleId, GenMeta } from "@/lib/types";
import {
  MessagesSquare, Send, Sparkles, Search, Code2, ShieldCheck, Mail, FileText,
  TrendingUp, Swords, MessageCircle, Copy, Check, Wand2, Scissors, FileCode2,
  Trash2, Layers, Clock, ListChecks, CheckCircle2, AlertCircle, ArrowDown,
  Home, ListOrdered, Wrench, ArrowRight, CornerDownRight,
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

const EXAMPLE_PROMPTS = [
  "Comment améliorer le SEO de ma boutique ?",
  "Crée une section FAQ premium",
  "Analyse les risques Merchant Center de mon site",
  "Rédige une réponse client professionnelle",
  "Améliore le SEO de ma collection",
  "Fais-moi un plan d'action sur 30 jours",
];

type Directive = "improve" | "shorten" | "premium" | "html";
const ACTIONS: { label: string; icon: React.ElementType; directive: Directive | null }[] = [
  { label: "Améliorer", icon: Wand2, directive: "improve" },
  { label: "Raccourcir", icon: Scissors, directive: "shorten" },
  { label: "Plus premium", icon: Sparkles, directive: "premium" },
  { label: "Convertir en HTML", icon: FileCode2, directive: "html" },
];

// Suggestions de suivi (envoient une vraie question de suivi dans la conversation).
type Follow = { label: string; q: string; icon: React.ElementType };
const FOLLOWUPS_SEO: Follow[] = [
  { label: "Me faire le plan 7 jours", q: "Fais-moi le plan d'action SEO sur 7 jours, avec le chemin Shopify pour chaque action.", icon: ListChecks },
  { label: "Uniquement les meta", q: "Donne-moi uniquement les meta titles et meta descriptions prêts à copier.", icon: Copy },
  { label: "Quels problèmes sont prioritaires ?", q: "Quels problèmes SEO sont vraiment prioritaires à corriger en premier ?", icon: AlertCircle },
  { label: "Où corriger dans Shopify ?", q: "Où corriger exactement ces éléments dans Shopify (chemins précis) ?", icon: Wrench },
  { label: "Générer les textes prêts à copier", q: "Génère les textes prêts à copier : titles, meta, FAQ et alt text.", icon: FileText },
  { label: "Résumer en 10 actions", q: "Résume tout en 10 actions concrètes et priorisées.", icon: ListOrdered },
];
const FOLLOWUPS_DEFAULT: Follow[] = [
  { label: "Résumer en 10 actions", q: "Résume ta réponse en 10 actions concrètes et priorisées.", icon: ListOrdered },
  { label: "Quelles priorités ?", q: "Quelles sont les priorités à traiter en premier ?", icon: AlertCircle },
  { label: "Me faire le plan 7 jours", q: "Donne-moi un plan d'action concret sur 7 jours.", icon: ListChecks },
  { label: "Plus de détails", q: "Développe davantage les points les plus importants de ta réponse.", icon: FileText },
];
function followUps(mode: CouncilMode): Follow[] {
  return mode === "seo" ? FOLLOWUPS_SEO : FOLLOWUPS_DEFAULT;
}

export default function CouncilPage() {
  const { connections, brand, analysis, addGeneration, councilMessages, addCouncilTurn, clearCouncil } = useOrkestra();
  const providers = connectedProviders(connections);
  const [mode, setMode] = useState<CouncilMode>("seo");
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Dernière question utilisateur (continuité de conversation).
  const lastUserQuestion = [...councilMessages].reverse().find((m) => m.role === "user")?.question;
  // Dernier résultat council (pour la colonne droite).
  const lastResult = [...councilMessages].reverse().find((m) => m.role === "council")?.result;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [councilMessages, loading]);

  // Question préparée passée par le dashboard (/council?mode=seo&q=...).
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current) return;
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    const m = params.get("mode") as CouncilMode | null;
    if (q) {
      autoRan.current = true;
      if (m) setMode(m);
      runCouncil(q, null, m ?? undefined);
      // Nettoie l'URL pour éviter une relance au refresh.
      window.history.replaceState({}, "", "/council");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runCouncil(q: string, directive: Directive | null = null, modeOverride?: CouncilMode) {
    if (!q.trim()) return;
    const useMode = modeOverride ?? mode;
    // Historique AVANT d'ajouter le nouveau tour (provider-agnostique).
    const history = councilMessages
      .slice(-6)
      .map((t) =>
        t.role === "user"
          ? { role: "user" as const, content: t.question || "" }
          : { role: "assistant" as const, content: t.result?.finalAnswer?.slice(0, 800) || "" }
      )
      .filter((h) => h.content);
    setLoading(true);
    if (!directive) {
      addCouncilTurn({ id: crypto.randomUUID(), role: "user", mode: useMode, question: q });
    }
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "council",
        mode: useMode,
        question: q,
        providers,
        keyRefs: { openai: connections.openai?.keyId },
        context: {
          brandName: brand.storeName || undefined,
          niche: brand.niche || undefined,
          url: `${brand.publicUrl} ${brand.adminUrl}`.trim() || undefined,
          positioning: brand.positioning,
          country: brand.country,
          language: brand.language,
          collections: brand.collections,
          productTypes: brand.productTypes,
          primaryKeywords: brand.primaryKeywords,
          secondaryKeywords: brand.secondaryKeywords,
          competitors: brand.competitors,
          promises: brand.promises,
          guarantees: brand.guarantees,
          formality: brand.formality,
          shippingDelay: brand.shippingDelay,
          returnPolicy: brand.returnPolicy,
          englishCount: analysis?.englishTexts?.length,
          missingLegal: analysis?.legalPages?.filter((l) => l.essential && !l.found).map((l) => l.label),
          legalFound: analysis?.legalPages?.filter((l) => l.found).map((l) => l.label),
          merchantScore: analysis?.scores?.merchant,
          pagesAnalyzed: analysis?.pagesAnalyzed,
          productsFound: analysis?.productsFound,
          productsAnalyzed: analysis?.productsAnalyzed,
          productsEnriched: analysis?.productsEnriched,
          weakDescriptions: analysis?.catalogStats ? analysis.catalogStats.noDescription + analysis.catalogStats.shortDescriptions : undefined,
          weakTitles: analysis?.catalogStats?.weakTitles,
          collectionsFound: analysis?.collectionsFound,
          coverage: analysis?.coverage,
          catalogSource: analysis?.catalogSource,
          collectionsAnalyzed: analysis?.collectionsAnalyzed,
          noType: analysis?.catalogStats?.noType,
          tagsCoverage: analysis?.catalogStats?.tagsCoverage,
          topTypes: analysis?.catalogStats?.topTypes?.map((t) => t.type),
          missingMeta: analysis?.metrics?.missingMetaDescriptions,
          imagesNoAlt: analysis?.metrics?.imagesWithoutAlt,
          priorityProducts: analysis?.priorityProducts?.slice(0, 6).map((p) => ({
            title: p.title,
            reason: p.reason,
            contentScore: p.contentScore,
          })),
          issuesSummary: analysis?.issues?.slice(0, 8).map((i) => `${i.area} (${i.severity}) — ${i.fix}`),
          englishList: analysis?.englishTexts?.slice(0, 12),
          problems: analysis?.issues?.slice(0, 10).map((i) => ({ area: i.area, severity: i.severity, impact: i.impact, fix: i.fix, module: i.module })),
          history,
          scoresSummary: analysis
            ? `SEO ${analysis.scores.seo}, confiance ${analysis.scores.trust}, conversion ${analysis.scores.conversion}, Merchant ${analysis.scores.merchant}, contenu ${analysis.scores.content}`
            : undefined,
          previousQuestion: directive ? undefined : lastUserQuestion,
          directive,
        },
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.ok) {
      const result = data.result as CouncilResult;
      addCouncilTurn({ id: crypto.randomUUID(), role: "council", mode: useMode, result, meta: data.meta });
      const rec: GenerationRecord = {
        id: crypto.randomUUID(),
        type: "council",
        title: `AI Council — ${q.slice(0, 40)}`,
        store: brand.storeName || "Boutique",
        createdAt: new Date().toISOString(),
        models: providers.length ? providers : ["openai"],
        status: "completed",
        score: result.qualityScore,
        preview: "Réponse fusionnée multi-IA.",
      };
      addGeneration(rec);
    }
  }

  function submit() {
    const q = question.trim();
    if (!q) return;
    setQuestion("");
    runCouncil(q);
  }

  return (
    <>
      <PageHeader
        title="AI Council"
        description="Posez une demande : Orkestra interroge vos IA connectées en parallèle, compare leurs réponses, puis fusionne la meilleure réponse finale — plus forte que ChatGPT seul."
        actions={
          councilMessages.length > 0 ? (
            <Button variant="ghost" onClick={clearCouncil} icon={<Trash2 className="h-4 w-4" />}>
              Effacer la conversation
            </Button>
          ) : undefined
        }
      />

      {/* Mode selector */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {MODES.map((m) => {
          const Icon = m.icon;
          const active = mode === m.id;
          return (
            <button key={m.id} onClick={() => setMode(m.id)} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${active ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300" : "border-[var(--border)] text-[var(--text-muted)] hover:border-brand-300"}`}>
              <Icon className="h-4 w-4" /> {m.label}
            </button>
          );
        })}
      </div>

      <div className="grid min-w-0 gap-5 lg:grid-cols-3">
        {/* ── Conversation (cœur du produit) ── */}
        <div className="flex min-w-0 flex-col lg:col-span-2">
          <Card className="flex h-[calc(100vh-15rem)] max-h-[820px] min-h-[460px] flex-col p-0">
            {/* Connected AIs bar */}
            <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <span className="text-xs font-medium text-[var(--text-muted)]">Orchestre :</span>
                {providers.length ? (
                  providers.map((p) => (
                    <span key={p} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-2 py-0.5 text-xs">
                      <span className="h-2 w-2 rounded-full" style={{ background: PROVIDERS[p].color }} />
                      {PROVIDERS[p].name}
                    </span>
                  ))
                ) : (
                  <Badge tone="warn">Mode simulé — connectez vos IA</Badge>
                )}
              </div>
              <span className="hidden shrink-0 text-xs text-[var(--text-muted)] sm:block">Mode {MODES.find((m) => m.id === mode)?.label}</span>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">
              {councilMessages.length === 0 && !loading ? (
                <EmptyCouncil providers={providers} onPick={(p) => runCouncil(p)} />
              ) : (
                councilMessages.map((turn) =>
                  turn.role === "user" ? (
                    <UserBubble key={turn.id} turn={turn} />
                  ) : (
                    <CouncilTurnCard key={turn.id} result={turn.result!} meta={turn.meta} mode={turn.mode} onAction={(d) => lastUserQuestion && runCouncil(lastUserQuestion, d)} onFollow={(q) => runCouncil(q)} />
                  )
                )
              )}
              {loading && <Thinking providers={providers} />}
            </div>

            {/* Input */}
            <div className="border-t border-[var(--border)] p-3 sm:p-4">
              <div className="flex items-end gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-2 transition focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-500/10">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
                  placeholder={councilMessages.length ? "Poser une question de suivi…" : `Posez votre demande en mode « ${MODES.find((m) => m.id === mode)?.label} »…`}
                  rows={1}
                  className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-ink-400"
                />
                <Button onClick={submit} loading={loading} icon={!loading ? <Send className="h-4 w-4" /> : undefined}>
                  Demander
                </Button>
              </div>
              <p className="mt-1.5 hint">Entrée pour envoyer · Maj+Entrée pour un retour à la ligne · Le contexte de la conversation est conservé.</p>
            </div>
          </Card>
        </div>

        {/* ── Colonne droite : analyse de la synthèse ── */}
        <div className="min-w-0 space-y-4 lg:sticky lg:top-20 lg:self-start">
          {lastResult ? (
            <CouncilSidebar result={lastResult} mode={mode} />
          ) : (
            <Card>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Layers className="h-4 w-4 text-brand-600" /> Analyse de l'orchestre
              </div>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                Après votre première demande, retrouvez ici le score qualité, les modèles interrogés, le temps gagné et les prochaines actions recommandées.
              </p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

// ── Empty state premium ─────────────────────────────────────────────────────
function EmptyCouncil({ providers, onPick }: { providers: AIProviderId[]; onPick: (p: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-pop">
        <MessagesSquare className="h-8 w-8" />
      </div>
      <h3 className="mt-4 text-lg font-bold">Posez une demande à vos IA connectées</h3>
      <p className="mt-1.5 max-w-md text-sm text-[var(--text-muted)]">
        Orkestra interroge {providers.length ? `vos ${providers.length} IA` : "vos IA"}, compare leurs réponses et vous livre une synthèse finale plus complète.
      </p>
      <div className="mt-6 grid w-full max-w-xl gap-2 sm:grid-cols-2">
        {EXAMPLE_PROMPTS.map((p) => (
          <button key={p} onClick={() => onPick(p)} className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] px-3.5 py-3 text-left text-sm transition hover:border-brand-300 hover:bg-ink-50 dark:hover:bg-ink-900">
            <Sparkles className="h-4 w-4 shrink-0 text-brand-500" />
            <span className="min-w-0">{p}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Thinking({ providers }: { providers: AIProviderId[] }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-muted)]">
        <Sparkles className="h-4 w-4 animate-pulse text-brand-600" />
        L'orchestre délibère{providers.length ? ` — ${providers.length} IA en parallèle` : ""}…
      </div>
      <div className="mt-3 space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-3.5 animate-pulse rounded bg-ink-100 dark:bg-ink-900" style={{ width: `${55 + Math.random() * 40}%` }} />
        ))}
      </div>
    </div>
  );
}

function UserBubble({ turn }: { turn: CouncilTurn }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] break-words rounded-2xl rounded-br-md bg-brand-600 px-4 py-2.5 text-sm text-white shadow-soft">
        {turn.question}
      </div>
    </div>
  );
}

// ── Carte d'un tour de réponse (synthèse finale + onglets IA) ───────────────
function CouncilTurnCard({ result, meta, mode, onAction, onFollow }: { result: CouncilResult; meta?: GenMeta; mode: CouncilMode; onAction: (d: Directive) => void; onFollow: (q: string) => void }) {
  const [tab, setTab] = useState<"final" | string>("final");
  const current = result.providerAnswers.find((p) => p.provider === tab);
  const time = meta ? new Date(meta.generatedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <div className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-card">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="text-sm font-bold">Réponse finale recommandée</span>
          {meta?.live ? <Badge tone="good">OpenAI live</Badge> : <Badge tone="neutral">Mode démo</Badge>}
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <Badge tone="good">Qualité {result.qualityScore}</Badge>
        </div>
      </div>

      {/* Bandeau méta : réel vs démo */}
      <div className="border-b border-[var(--border)] bg-[var(--bg)] px-4 py-1.5 text-[11px] text-[var(--text-muted)]">
        {meta?.live
          ? `Réponse générée avec OpenAI · ${meta.model}${meta.tokens ? ` · ${meta.tokens} tokens` : ""} · ${time}`
          : `Réponse simulée (template contextualisé)${meta?.fallbackReason ? ` · ${meta.fallbackReason}` : ""}`}
        {meta?.routingNote ? ` · ${meta.routingNote}` : ""}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--border)] px-3 py-2">
        <button onClick={() => setTab("final")} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${tab === "final" ? "bg-brand-600 text-white" : "text-[var(--text-muted)] hover:bg-ink-100 dark:hover:bg-ink-900"}`}>
          ✦ Synthèse
        </button>
        {result.providerAnswers.map((p) => (
          <button key={p.provider} onClick={() => setTab(p.provider)} className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${tab === p.provider ? "bg-ink-900 text-white dark:bg-ink-100 dark:text-ink-900" : "text-[var(--text-muted)] hover:bg-ink-100 dark:hover:bg-ink-900"}`}>
            <span className="h-2 w-2 rounded-full" style={{ background: PROVIDERS[p.provider].color }} />
            {PROVIDERS[p.provider].name}
          </button>
        ))}
      </div>

      <div className="min-w-0 p-4 sm:p-5">
        {tab === "final" ? (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-muted)]">
              <span className="inline-flex items-center gap-1"><Layers className="h-3.5 w-3.5" /> {result.modelsUsed.map((m) => PROVIDERS[m].name).join(" · ")}</span>
            </div>
            <div className="min-w-0 break-words">
              <Markdown content={result.finalAnswer} />
            </div>
            {result.review && <ReviewBlock review={result.review} />}
            {/* Actions sur la réponse */}
            <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
              {ACTIONS.map((a) => {
                const Icon = a.icon;
                return (
                  <Button key={a.label} variant="outline" size="sm" icon={<Icon className="h-3.5 w-3.5" />} onClick={() => a.directive && onAction(a.directive)}>
                    {a.label}
                  </Button>
                );
              })}
              <CopyBtn text={result.finalAnswer} label="Exporter" />
            </div>

            {/* Suivi rapide — envoie une question de suivi dans la conversation */}
            <div className="mt-3">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                <CornerDownRight className="h-3.5 w-3.5" /> Continuer la conversation
              </div>
              <div className="flex flex-wrap gap-1.5">
                {followUps(mode).map((f) => {
                  const Icon = f.icon;
                  return (
                    <button
                      key={f.q}
                      onClick={() => onFollow(f.q)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition hover:-translate-y-0.5 hover:border-brand-300 hover:text-brand-700 dark:hover:text-brand-300"
                    >
                      <Icon className="h-3.5 w-3.5 text-brand-500" /> {f.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        ) : current ? (
          <ProviderTab answer={current} />
        ) : null}
      </div>
    </div>
  );
}

function ProviderTab({ answer }: { answer: CouncilResult["providerAnswers"][number] }) {
  return (
    <div className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge tone="brand">{PROVIDERS[answer.provider].name}</Badge>
        <span className="font-mono text-xs text-[var(--text-muted)]">{answer.model}</span>
        <Badge tone="good">Qualité {answer.qualityScore}</Badge>
        <span className="text-xs text-[var(--text-muted)]">· {answer.specialty}</span>
      </div>
      <div className="min-w-0 break-words">
        <Markdown content={answer.answer} />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] p-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Forces</div>
          <ul className="space-y-1">
            {answer.strengths.map((s, i) => <li key={i} className="text-xs text-[var(--text-muted)]">• {s}</li>)}
          </ul>
        </div>
        <div className="rounded-xl border border-[var(--border)] p-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-amber-600"><AlertCircle className="h-3.5 w-3.5" /> Limites</div>
          <ul className="space-y-1">
            {answer.limits.map((s, i) => <li key={i} className="text-xs text-[var(--text-muted)]">• {s}</li>)}
          </ul>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <CopyBtn text={answer.answer} label="Utiliser cette réponse" icon={<Check className="h-3.5 w-3.5" />} variant="secondary" />
      </div>
    </div>
  );
}

// ── Colonne droite enrichie ──────────────────────────────────────────────────
function CouncilSidebar({ result, mode }: { result: CouncilResult; mode: CouncilMode }) {
  const scoreRows: { label: string; value: number }[] = [
    { label: "Qualité globale", value: result.scores.quality },
    { label: "Clarté", value: result.scores.clarity },
    { label: "Actionnable", value: result.scores.actionable },
    ...(result.scores.seo ? [{ label: "Score SEO", value: result.scores.seo }] : []),
  ];
  return (
    <>
      <Card className="flex flex-col items-center text-center">
        <ScoreRing value={result.qualityScore} size={92} label="qualité" />
        <p className="mt-2 text-xs text-[var(--text-muted)]">Synthèse finale de l'orchestre</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
          {result.modelsUsed.map((m) => (
            <span key={m} className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px]">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: PROVIDERS[m].color }} />
              {PROVIDERS[m].name}
            </span>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 text-sm font-semibold">Scores détaillés</h3>
        <div className="space-y-3">
          {scoreRows.map((r) => (
            <div key={r.label}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)]">{r.label}</span>
                <span className="font-semibold">{r.value}</span>
              </div>
              <Progress value={r.value} />
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between rounded-xl bg-brand-50 px-3 py-2.5 dark:bg-brand-950/40">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 dark:text-brand-300"><Clock className="h-3.5 w-3.5" /> Temps estimé gagné</span>
          <span className="text-sm font-bold text-brand-700 dark:text-brand-300">{result.timeSaved}</span>
        </div>
      </Card>

      <Card>
        <h3 className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold"><Layers className="h-4 w-4 text-brand-600" /> Pourquoi cette synthèse ?</h3>
        <ul className="space-y-2">
          {result.synthesisReasons.map((r, i) => (
            <li key={i} className="flex gap-2 text-xs text-[var(--text-muted)]">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" /> {r}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h3 className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold"><ListChecks className="h-4 w-4 text-brand-600" /> Prochaines actions</h3>
        <ul className="space-y-2">
          {result.nextActions.map((a, i) => (
            <li key={i} className="flex items-start gap-2 text-xs">
              <ArrowDown className="mt-0.5 h-3.5 w-3.5 shrink-0 rotate-[-45deg] text-brand-500" /> <span className="text-[var(--text-muted)]">{a}</span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

// ── Bloc review structuré (homepage order, structure produit, problèmes) ─────
const MODULE_ROUTE: Record<ModuleId, string> = {
  dashboard: "/dashboard", seo: "/seo", sections: "/sections", council: "/council",
  merchant: "/merchant", assistant: "/assistant", memory: "/memory", history: "/history", settings: "/settings",
};
const SEV_TONE: Record<string, "bad" | "warn" | "neutral"> = { critique: "bad", important: "warn", mineur: "neutral" };

function ReviewBlock({ review }: { review: SiteReview }) {
  return (
    <div className="mt-5 space-y-4 border-t border-[var(--border)] pt-5">
      {/* Ordres recommandés */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] p-3.5">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--text)]"><Home className="h-3.5 w-3.5 text-brand-600" /> Ordre des sections recommandé (Home)</div>
          <ol className="space-y-1">
            {review.homepageOrder.map((step, i) => (
              <li key={i} className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <span className="grid h-4 w-4 shrink-0 place-items-center rounded bg-brand-50 text-[9px] font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </div>
        <div className="rounded-xl border border-[var(--border)] p-3.5">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--text)]"><ListOrdered className="h-3.5 w-3.5 text-brand-600" /> Structure idéale d&apos;une page produit</div>
          <ol className="space-y-1">
            {review.productPageStructure.map((step, i) => (
              <li key={i} className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <span className="grid h-4 w-4 shrink-0 place-items-center rounded bg-brand-50 text-[9px] font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Problèmes détectés */}
      <div>
        <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Wrench className="h-4 w-4 text-brand-600" /> Problèmes détectés ({review.issues.length})</div>
        <div className="space-y-2.5">
          {review.issues.map((issue, i) => (
            <div key={i} className="rounded-xl border border-[var(--border)] p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{issue.area}</span>
                    <Badge tone={SEV_TONE[issue.severity]}>{issue.severity}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{issue.explanation}</p>
                </div>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg bg-amber-50 px-2.5 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                  <span className="font-semibold">Impact :</span> {issue.impact}
                </div>
                <div className="rounded-lg bg-brand-50 px-2.5 py-2 text-xs text-brand-900 dark:bg-brand-950/40 dark:text-brand-200">
                  <span className="font-semibold">Correction :</span> {issue.fix}
                </div>
              </div>
              <div className="mt-2.5">
                <Link href={MODULE_ROUTE[issue.module]}>
                  <Button variant="secondary" size="sm" icon={<Wrench className="h-3.5 w-3.5" />}>
                    Corriger avec Orkestra <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CopyBtn({ text, label = "Copier", icon, variant = "ghost" }: { text: string; label?: string; icon?: React.ReactNode; variant?: "ghost" | "secondary" }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button variant={variant} size="sm" onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }} icon={copied ? <Check className="h-3.5 w-3.5" /> : icon ?? <Copy className="h-3.5 w-3.5" />}>
      {copied ? "Copié ✓" : label}
    </Button>
  );
}

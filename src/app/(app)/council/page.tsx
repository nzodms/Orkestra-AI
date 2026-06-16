"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useOrkestra, connectedProviders } from "@/lib/store";
import { PROVIDERS } from "@/lib/providers";
import { Badge, ScoreRing, Progress } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { Markdown } from "@/components/ui/Markdown";
import type { CouncilMode, CouncilResult, CouncilTurn, GenerationRecord, AIProviderId, AIConnection, SiteReview, ModuleId, GenMeta, StoreAnalysis } from "@/lib/types";
import {
  MessagesSquare, Sparkles, Search, Code2, ShieldCheck, Mail, FileText,
  TrendingUp, Swords, MessageCircle, Copy, Check, Wand2, Scissors, FileCode2,
  Trash2, Layers, Clock, ListChecks, CheckCircle2, AlertCircle,
  Home, ListOrdered, Wrench, ArrowRight, CornerDownRight, ChevronDown, Cpu,
  Loader2, Zap, ArrowUp, Plus, Brain,
} from "lucide-react";

const MODES: { id: CouncilMode; label: string; icon: React.ElementType; desc: string }[] = [
  { id: "seo", label: "SEO", icon: Search, desc: "Titres, meta, contenu, maillage" },
  { id: "code", label: "Code Shopify", icon: Code2, desc: "Sections Liquid + CSS + schema" },
  { id: "merchant", label: "Merchant Center", icon: ShieldCheck, desc: "Risques avant Google Ads" },
  { id: "email", label: "Email client", icon: Mail, desc: "Réponses pro et cadrées" },
  { id: "quote", label: "Devis", icon: FileText, desc: "Chiffrage clair et structuré" },
  { id: "strategy", label: "Stratégie", icon: TrendingUp, desc: "Diagnostic & priorités business" },
  { id: "competitive", label: "Concurrence", icon: Swords, desc: "Concurrents & différenciation" },
  { id: "free", label: "Question libre", icon: MessageCircle, desc: "Tout le reste" },
];

// Modes qui bénéficient d'une synthèse multi-IA (OpenAI + Claude).
const FUSION_MODES_UI = new Set<CouncilMode>(["code", "strategy", "competitive", "free", "email", "quote"]);

// ── Choix du modèle (intégré au composer) ───────────────────────────────────
type ModelChoice = "auto" | "fusion" | AIProviderId;
const MODEL_OPTIONS: { id: ModelChoice; name: string; sub: string; provider?: AIProviderId }[] = [
  { id: "auto", name: "Auto", sub: "Meilleur modèle disponible" },
  { id: "fusion", name: "Fusion multi-IA", sub: "OpenAI + Claude, synthèse" },
  { id: "openai", name: "GPT (OpenAI)", sub: "Rapide & polyvalent", provider: "openai" },
  { id: "anthropic", name: "Claude", sub: "Relecture premium", provider: "anthropic" },
  { id: "gemini", name: "Gemini", sub: "Analyse & multimodal", provider: "gemini" },
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
  const { connections, brand, analysis, addGeneration, councilMessages, addCouncilTurn, clearCouncil, pendingCouncil, clearPendingCouncil } = useOrkestra();
  const providers = connectedProviders(connections);
  const openaiConnected = !!connections.openai?.connected;
  const claudeConnected = !!connections.anthropic?.connected;
  const [mode, setMode] = useState<CouncilMode>("seo");
  const [modelChoice, setModelChoice] = useState<ModelChoice>("auto");
  const [reasoning, setReasoning] = useState(false);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Providers réellement envoyés selon le choix de modèle.
  function providersToSend(): AIProviderId[] {
    if (modelChoice === "auto" || modelChoice === "fusion") return providers;
    return providers.includes(modelChoice) ? [modelChoice] : providers;
  }

  // Dernière question utilisateur (continuité de conversation).
  const lastUserQuestion = [...councilMessages].reverse().find((m) => m.role === "user")?.question;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [councilMessages, loading]);

  // Question préparée passée par une section (/council?mode=seo&q=...).
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current) return;
    if (pendingCouncil?.question) {
      autoRan.current = true;
      const m = pendingCouncil.mode as CouncilMode;
      const q = pendingCouncil.question;
      clearPendingCouncil();
      if (m) setMode(m);
      runCouncil(q, null, m ?? undefined);
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    const m = params.get("mode") as CouncilMode | null;
    if (q) {
      autoRan.current = true;
      if (m) setMode(m);
      runCouncil(q, null, m ?? undefined);
      window.history.replaceState({}, "", "/council");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runCouncil(q: string, directive: Directive | null = null, modeOverride?: CouncilMode) {
    if (!q.trim()) return;
    const useMode = modeOverride ?? mode;
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
        providers: providersToSend(),
        keyRefs: { openai: connections.openai?.keyId, claude: connections.anthropic?.keyId },
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

  const empty = councilMessages.length === 0 && !loading;

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col">
      {/* Header premium */}
      <div className="mx-auto flex w-full max-w-3xl items-end justify-between gap-3 pb-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-300">
            <span className="grid h-5 w-5 place-items-center rounded-md bg-gradient-to-br from-brand-500 to-brand-700 text-white"><Sparkles className="h-3 w-3" /></span>
            AI Council
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--text)]">
            La couche IA <span className="text-gradient">transversale</span> d’Orkestra
          </h1>
        </div>
        {councilMessages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearCouncil} icon={<Trash2 className="h-4 w-4" />}>
            Effacer
          </Button>
        )}
      </div>

      {/* Zone de conversation centrale */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className={`mx-auto w-full max-w-3xl ${empty ? "flex min-h-full flex-col justify-center" : "space-y-5 pb-2"}`}>
          {empty ? (
            <StarterScreen
              providers={providers}
              analysis={analysis}
              onStart={(m, q) => { setMode(m); runCouncil(q, null, m); }}
            />
          ) : (
            councilMessages.map((turn) =>
              turn.role === "user" ? (
                <UserBubble key={turn.id} turn={turn} />
              ) : (
                <CouncilTurnCard key={turn.id} result={turn.result!} meta={turn.meta} mode={turn.mode} onAction={(d) => lastUserQuestion && runCouncil(lastUserQuestion, d)} onFollow={(q) => runCouncil(q)} />
              )
            )
          )}
          {loading && <ActivityFeed providers={providersToSend()} modelChoice={modelChoice} reasoning={reasoning} />}
        </div>
      </div>

      {/* Composer docké premium */}
      <div className="relative mx-auto w-full max-w-3xl">
        {/* fondu qui ancre le composer au bas de la conversation */}
        <div className="pointer-events-none absolute -top-6 left-0 right-0 h-6 bg-gradient-to-t from-[var(--bg)] to-transparent" />
        <Composer
          value={question}
          onChange={setQuestion}
          onSubmit={submit}
          loading={loading}
          mode={mode}
          setMode={setMode}
          modelChoice={modelChoice}
          setModelChoice={setModelChoice}
          connections={connections}
          hasMessages={councilMessages.length > 0}
          reasoning={reasoning}
          setReasoning={setReasoning}
          connectHint={openaiConnected && !claudeConnected && FUSION_MODES_UI.has(mode)}
        />
      </div>
    </div>
  );
}

// ── Composer (dock premium + sélecteurs intégrés, inspiré chat-input moderne) ─
function Composer({
  value, onChange, onSubmit, loading, mode, setMode, modelChoice, setModelChoice, connections, hasMessages, reasoning, setReasoning, connectHint,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
  mode: CouncilMode;
  setMode: (m: CouncilMode) => void;
  modelChoice: ModelChoice;
  setModelChoice: (m: ModelChoice) => void;
  connections: Record<AIProviderId, AIConnection>;
  hasMessages: boolean;
  reasoning: boolean;
  setReasoning: (v: boolean) => void;
  connectHint: boolean;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [value]);

  return (
    <div className="relative pb-3">
      {/* Glow doux derrière le dock (visible en light mode) */}
      <div className="pointer-events-none absolute inset-x-6 -bottom-1 top-2 rounded-[30px] bg-brand-500/15 blur-2xl" aria-hidden />

      <div className="group relative rounded-[26px] border border-brand-100 bg-[var(--glass-strong)] p-2 shadow-[0_22px_60px_-26px_rgba(36,89,230,0.5)] backdrop-blur-xl transition-all duration-300 focus-within:-translate-y-0.5 focus-within:border-brand-300 focus-within:shadow-[0_28px_70px_-24px_rgba(36,89,230,0.6)] focus-within:ring-4 focus-within:ring-[var(--ring)] dark:border-brand-950/60">
        {/* liseré supérieur lumineux */}
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-brand-300/70 to-transparent" aria-hidden />

        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSubmit(); } }}
          placeholder={hasMessages ? "Poser une question de suivi…" : "Écrivez votre demande à Orkestra…"}
          rows={1}
          className="max-h-52 min-h-[48px] w-full resize-none bg-transparent px-3 py-3 text-[15px] leading-relaxed outline-none placeholder:text-ink-400"
        />

        <div className="flex items-center justify-between gap-2 px-1 pt-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {/* + ajouter du contexte (base file-preview, activé plus tard) */}
            <button
              type="button"
              title="Ajouter du contexte ou une image (bientôt)"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-ink-400 transition hover:border-brand-300 hover:text-brand-600 dark:hover:text-brand-300"
            >
              <Plus className="h-4 w-4" />
            </button>
            <ModePicker mode={mode} setMode={setMode} />
            <ModelPicker modelChoice={modelChoice} setModelChoice={setModelChoice} connections={connections} connectHint={connectHint} />
            {/* Raisonnement opérationnel */}
            <button
              type="button"
              onClick={() => setReasoning(!reasoning)}
              aria-pressed={reasoning}
              className={`inline-flex h-8 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-medium transition ${reasoning ? "border-brand-300 bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300" : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:border-brand-300"}`}
            >
              <Brain className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Raisonnement</span>
            </button>
          </div>
          <button
            onClick={onSubmit}
            disabled={loading || !value.trim()}
            aria-label="Envoyer"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-600 text-white shadow-[0_10px_24px_-8px_rgba(36,89,230,0.75)] transition enabled:hover:bg-brand-700 enabled:hover:shadow-[0_14px_30px_-8px_rgba(36,89,230,0.85)] enabled:active:scale-95 disabled:opacity-40"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowUp className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <p className="mt-2 px-1 text-center text-[11px] text-[var(--text-muted)]">
        Entrée pour envoyer · Maj+Entrée pour un retour à la ligne · le contexte de la conversation est conservé.
      </p>
    </div>
  );
}

// ── Popover générique ───────────────────────────────────────────────────────
function Popover({ open, onClose, children, width = "w-64" }: { open: boolean; onClose: () => void; children: React.ReactNode; width?: string }) {
  if (!open) return null;
  return (
    <>
      <button className="fixed inset-0 z-30 cursor-default" aria-hidden onClick={onClose} />
      <div className={`absolute bottom-full left-0 z-40 mb-2 ${width} origin-bottom-left animate-scale-in rounded-2xl border border-[var(--border)] bg-[var(--glass-strong)] p-1.5 shadow-pop backdrop-blur-xl`}>
        {children}
      </div>
    </>
  );
}

function ModePicker({ mode, setMode }: { mode: CouncilMode; setMode: (m: CouncilMode) => void }) {
  const [open, setOpen] = useState(false);
  const current = MODES.find((m) => m.id === mode)!;
  const Icon = current.icon;
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex h-8 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-medium transition ${open ? "border-brand-300 bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300" : "border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:border-brand-300"}`}
      >
        <Icon className="h-3.5 w-3.5 text-brand-600 dark:text-brand-300" />
        <span className="hidden sm:inline">{current.label}</span>
        <ChevronDown className={`h-3 w-3 text-ink-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} width="w-72">
        <div className="px-2 pb-1.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-400">Type de demande</div>
        <div className="max-h-[19rem] space-y-0.5 overflow-y-auto">
          {MODES.map((m) => {
            const MIcon = m.icon;
            const active = m.id === mode;
            return (
              <button
                key={m.id}
                onClick={() => { setMode(m.id); setOpen(false); }}
                className={`group flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition ${active ? "bg-gradient-to-r from-brand-50 to-transparent dark:from-brand-950/60" : "hover:bg-[var(--bg)]"}`}
              >
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg transition ${active ? "bg-brand-600 text-white shadow-[0_6px_14px_-6px_rgba(36,89,230,0.7)]" : "bg-[var(--bg)] text-[var(--text-muted)] group-hover:text-brand-600 dark:group-hover:text-brand-300"}`}>
                  <MIcon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-[var(--text)]">
                    {m.label}
                    {active && <Check className="h-3.5 w-3.5 text-brand-600 dark:text-brand-300" />}
                  </span>
                  <span className="block truncate text-[11px] text-[var(--text-muted)]">{m.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Popover>
    </div>
  );
}

function ModelPicker({
  modelChoice, setModelChoice, connections, connectHint,
}: {
  modelChoice: ModelChoice;
  setModelChoice: (m: ModelChoice) => void;
  connections: Record<AIProviderId, AIConnection>;
  connectHint?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const current = MODEL_OPTIONS.find((m) => m.id === modelChoice)!;
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs font-medium text-[var(--text)] transition hover:border-brand-300"
      >
        {current.provider ? (
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: PROVIDERS[current.provider].color }} />
        ) : current.id === "fusion" ? (
          <Layers className="h-3.5 w-3.5 text-brand-600 dark:text-brand-300" />
        ) : (
          <Cpu className="h-3.5 w-3.5 text-brand-600 dark:text-brand-300" />
        )}
        <span className="hidden sm:inline">{current.name}</span>
        {connectHint && <span className="h-1.5 w-1.5 rounded-full bg-amber-500 ork-live" />}
        <ChevronDown className="h-3 w-3 text-ink-400" />
      </button>
      <Popover open={open} onClose={() => setOpen(false)}>
        <div className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-400">Modèle / orchestration</div>
        {connectHint && (
          <Link href="/settings" onClick={() => setOpen(false)} className="mb-1 flex items-start gap-2 rounded-xl bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800 transition hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-200">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Connectez <b>Claude</b> pour activer la synthèse multi-IA.</span>
          </Link>
        )}
        {MODEL_OPTIONS.map((m) => {
          const connected = m.provider ? !!connections[m.provider]?.connected : true;
          const active = m.id === modelChoice;
          return (
            <button
              key={m.id}
              onClick={() => { setModelChoice(m.id); setOpen(false); }}
              className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition ${active ? "bg-brand-50 dark:bg-brand-950/60" : "hover:bg-[var(--bg)]"}`}
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--bg)]">
                {m.provider ? (
                  <span className="h-3 w-3 rounded-full" style={{ background: PROVIDERS[m.provider].color }} />
                ) : m.id === "fusion" ? (
                  <Layers className="h-4 w-4 text-brand-600 dark:text-brand-300" />
                ) : (
                  <Zap className="h-4 w-4 text-brand-600 dark:text-brand-300" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-medium text-[var(--text)]">
                  {m.name}
                  {active && <Check className="h-3.5 w-3.5 text-brand-600 dark:text-brand-300" />}
                </span>
                <span className="block truncate text-[11px] text-[var(--text-muted)]">{m.sub}</span>
              </span>
              {m.provider && !connected && (
                <span className="shrink-0 text-[10px] font-medium text-amber-600 dark:text-amber-400">non connecté</span>
              )}
            </button>
          );
        })}
        <Link href="/settings" onClick={() => setOpen(false)} className="mt-1 flex items-center justify-center gap-1 rounded-xl border border-dashed border-[var(--border)] px-2 py-1.5 text-[11px] font-medium text-brand-600 transition hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950/40">
          <Sparkles className="h-3 w-3" /> Gérer mes IA connectées
        </Link>
      </Popover>
    </div>
  );
}

// ── Écran de départ premium ─────────────────────────────────────────────────
const COUNCIL_START: { mode: CouncilMode; icon: React.ElementType; label: string; desc: string; q: string }[] = [
  { mode: "seo", icon: Search, label: "Améliorer mon SEO", desc: "Titres, meta, contenu, maillage", q: "Comment améliorer le SEO de ma boutique à partir des données analysées ?" },
  { mode: "strategy", icon: TrendingUp, label: "Corriger mon tunnel", desc: "Trouver et colmater les fuites", q: "Analyse mon tunnel de conversion, identifie les fuites de revenu et propose les priorités." },
  { mode: "seo", icon: Wand2, label: "Générer une fiche produit", desc: "Titre, meta, description, FAQ", q: "Génère une fiche produit optimisée (titre, meta, description, FAQ, alt) prête à copier." },
  { mode: "merchant", icon: ShieldCheck, label: "Préparer Merchant Center", desc: "Lever les risques avant Ads", q: "Fais un audit Merchant Center de ma boutique et liste les risques à corriger en priorité." },
  { mode: "strategy", icon: ListChecks, label: "Prioriser mes actions", desc: "Par impact business réel", q: "Classe mes actions par impact business réel et justifie l'ordre de priorité." },
  { mode: "strategy", icon: Sparkles, label: "Analyser ma boutique", desc: "Diagnostic global + prochain levier", q: "Analyse ma boutique et propose une stratégie de croissance priorisée." },
];

function StarterScreen({ providers, analysis, onStart }: { providers: AIProviderId[]; analysis: StoreAnalysis | null; onStart: (mode: CouncilMode, q: string) => void }) {
  const scan: { label: string; mode: CouncilMode; q: string }[] = [];
  if (analysis) {
    const eng = analysis.englishTexts?.length ?? 0;
    const meta = analysis.metrics?.missingMetaDescriptions ?? 0;
    const noType = analysis.catalogStats?.noType ?? 0;
    const alt = analysis.catalogStats?.imagesNoAlt ?? analysis.metrics?.imagesWithoutAlt ?? 0;
    if (eng) scan.push({ label: `Textes anglais (${eng})`, mode: "merchant", q: "Contexte : des textes anglais ont été détectés sur la boutique. Réponds uniquement à ce problème : liste-les, donne la correction française, l'impact Merchant et le chemin Shopify." });
    if (meta) scan.push({ label: `Meta manquantes (${meta})`, mode: "seo", q: "Donne-moi uniquement les meta titles et descriptions prêts à copier pour mes pages prioritaires." });
    if (noType) scan.push({ label: `Product_type (${noType})`, mode: "merchant", q: "Contexte : des product_type sont manquants. Réponds uniquement : produits concernés, types à ajouter et chemin Shopify." });
    if (alt) scan.push({ label: `Alt text (${alt})`, mode: "seo", q: "Comment ajouter des alt text descriptifs à mes images, et où dans Shopify ?" });
  }
  return (
    <div className="ork-rise flex flex-col items-center py-4 text-center">
      <div className="relative mb-1">
        {/* halo radial premium derrière l'orbe (visible en light mode) */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500/15 blur-3xl" aria-hidden />
        <div className="ork-breathe relative grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-[0_18px_40px_-14px_rgba(36,89,230,0.7)]">
          <MessagesSquare className="h-8 w-8" />
          <span className="ork-aura" />
        </div>
      </div>
      <h2 className="mt-4 text-[26px] font-bold tracking-tight text-[var(--text)]">Bonjour, comment puis-je vous aider aujourd&apos;hui&nbsp;?</h2>
      <p className="mt-2 max-w-lg text-sm text-[var(--text-muted)]">
        Orkestra interroge {providers.length ? `vos ${providers.length} IA connectée${providers.length > 1 ? "s" : ""}` : "vos IA"}, compare leurs réponses et livre une synthèse orientée action. Choisissez un départ ou écrivez votre demande.
      </p>
      <div className="ork-stagger mt-6 grid w-full gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {COUNCIL_START.map((c) => {
          const Icon = c.icon;
          return (
            <button key={c.label} onClick={() => onStart(c.mode, c.q)} className="group relative flex items-start gap-3 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lift">
              <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-50/0 to-brand-50/0 transition group-hover:from-brand-50/60 group-hover:to-transparent dark:group-hover:from-brand-950/40" aria-hidden />
              <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 transition-transform duration-200 group-hover:scale-110 dark:bg-brand-950 dark:text-brand-300"><Icon className="h-[18px] w-[18px]" /></span>
              <span className="relative min-w-0 flex-1">
                <span className="flex items-center gap-1 text-sm font-semibold text-[var(--text)]">{c.label}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-[var(--text-muted)]">{c.desc}</span>
              </span>
              <ArrowUp className="relative h-3.5 w-3.5 shrink-0 rotate-45 text-ink-300 opacity-0 transition group-hover:opacity-100 group-hover:text-brand-500" />
            </button>
          );
        })}
      </div>
      {scan.length > 0 && (
        <div className="mt-6 w-full">
          <div className="mb-2 text-xs text-[var(--text-muted)]">D&apos;après votre scan, Orkestra peut déjà vous aider sur&nbsp;:</div>
          <div className="flex flex-wrap justify-center gap-2">
            {scan.map((s) => (
              <button key={s.label} onClick={() => onStart(s.mode, s.q)} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium transition hover:-translate-y-0.5 hover:border-brand-300 hover:text-brand-700 dark:hover:text-brand-300">
                <Sparkles className="h-3.5 w-3.5 text-brand-500" /> {s.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Activity feed (« Ce qu'Orkestra fait maintenant ») ──────────────────────
const ACTIVITY_STEPS = [
  "Analyse du contexte boutique",
  "Lecture des données du module concerné",
  "Interrogation des IA connectées",
  "Comparaison des réponses",
  "Synthèse de la meilleure réponse",
  "Préparation des actions recommandées",
];
const ACTIVITY_STEPS_DEEP = [
  "Analyse du contexte boutique",
  "Lecture des données du module concerné",
  "Identification des signaux faibles & priorités",
  "Interrogation des IA connectées",
  "Comparaison & arbitrage des réponses",
  "Vérification (cohérence, Merchant, ton de marque)",
  "Synthèse de la meilleure réponse",
  "Préparation des actions recommandées",
];

function ActivityFeed({ providers, modelChoice, reasoning }: { providers: AIProviderId[]; modelChoice: ModelChoice; reasoning?: boolean }) {
  const steps = reasoning ? ACTIVITY_STEPS_DEEP : ACTIVITY_STEPS;
  const [active, setActive] = useState(0);
  useEffect(() => {
    setActive(0);
    const t = setInterval(() => setActive((a) => Math.min(a + 1, steps.length - 1)), reasoning ? 700 : 850);
    return () => clearInterval(t);
  }, [reasoning, steps.length]);
  return (
    <div className="ork-rise glass-card ork-sheen overflow-hidden p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
        <span className="relative grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white">
          <Sparkles className="h-4 w-4" />
          <span className="ork-aura" />
        </span>
        Ce qu’Orkestra fait maintenant
        <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-normal text-[var(--text-muted)]">
          {reasoning && <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-950/60 dark:text-brand-300"><Brain className="h-2.5 w-2.5" /> Approfondi</span>}
          {modelChoice === "fusion" ? <><Layers className="h-3 w-3" /> Fusion multi-IA</> : `${providers.length || 1} IA`}
        </span>
      </div>
      <ol className="space-y-2">
        {steps.map((s, i) => {
          const done = i < active;
          const current = i === active;
          return (
            <li key={s} className={`flex items-center gap-2.5 text-sm transition-opacity ${i > active ? "opacity-40" : "opacity-100"}`}>
              <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${done ? "bg-teal-500 text-white" : current ? "bg-brand-100 text-brand-600 dark:bg-brand-950 dark:text-brand-300" : "bg-[var(--bg)] text-ink-400"}`}>
                {done ? <Check className="h-3 w-3" /> : current ? <Loader2 className="h-3 w-3 animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
              </span>
              <span className={done ? "text-[var(--text-muted)]" : "text-[var(--text)]"}>{s}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function UserBubble({ turn }: { turn: CouncilTurn }) {
  return (
    <div className="flex justify-end">
      <div className="ork-rise max-w-[85%] break-words rounded-3xl rounded-br-lg bg-brand-600 px-4 py-2.5 text-sm text-white shadow-[0_10px_24px_-12px_rgba(36,89,230,0.6)]">
        {turn.question}
      </div>
    </div>
  );
}

// ── Carte d'un tour de réponse (synthèse finale + onglets IA) ───────────────
function CouncilTurnCard({ result, meta, mode, onAction, onFollow }: { result: CouncilResult; meta?: GenMeta; mode: CouncilMode; onAction: (d: Directive) => void; onFollow: (q: string) => void }) {
  const [tab, setTab] = useState<"final" | "why" | string>("final");
  const current = result.providerAnswers.find((p) => p.provider === tab);
  const time = meta ? new Date(meta.generatedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "";
  const fusion = !!meta?.fusion;
  const hasWhy = result.synthesisReasons && result.synthesisReasons.length > 0;

  return (
    <div className="ork-rise min-w-0 overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-card">
      {/* Header assistant */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-[0_8px_18px_-8px_rgba(36,89,230,0.7)]">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold text-[var(--text)]">Réponse finale Orkestra</div>
            <div className="text-[11px] text-[var(--text-muted)]">
              {meta?.live
                ? fusion ? "Synthèse OpenAI + Claude" : result.modelsUsed.map((m) => PROVIDERS[m].name).join(" · ") + " · live"
                : "Mode démo · template contextualisé"}
              {time ? ` · ${time}` : ""}
            </div>
          </div>
        </div>
        <Badge tone="good">Qualité {result.qualityScore}</Badge>
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
        {hasWhy && (
          <button onClick={() => setTab("why")} className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${tab === "why" ? "bg-ink-900 text-white dark:bg-ink-100 dark:text-ink-900" : "text-[var(--text-muted)] hover:bg-ink-100 dark:hover:bg-ink-900"}`}>
            Pourquoi cette synthèse&nbsp;?
          </button>
        )}
      </div>

      <div className="min-w-0 p-4 sm:p-5">
        {tab === "why" ? (
          <div className="min-w-0">
            <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold"><Layers className="h-4 w-4 text-brand-600" /> Comment Orkestra a fusionné les réponses</div>
            {result.councilWhy ? (
              <div className="grid gap-2.5 sm:grid-cols-2">
                <WhyCard color="#10a37f" title="Ce qu'OpenAI a apporté" text={result.councilWhy.openai} />
                <WhyCard color="#d97757" title="Ce que Claude a apporté" text={result.councilWhy.claude} />
                <WhyCard color="var(--brand-600)" title="Ce qu'Orkestra a gardé" text={result.councilWhy.kept} icon={<Check className="h-3.5 w-3.5 text-emerald-500" />} />
                <WhyCard color="var(--brand-600)" title="Ce qu'Orkestra a écarté" text={result.councilWhy.rejected} icon={<AlertCircle className="h-3.5 w-3.5 text-amber-500" />} />
                {result.councilWhy.contradiction && <div className="sm:col-span-2"><WhyCard color="#ef4444" title="Contradiction arbitrée" text={result.councilWhy.contradiction} icon={<AlertCircle className="h-3.5 w-3.5 text-red-500" />} /></div>}
              </div>
            ) : (
              <ul className="space-y-2">
                {result.synthesisReasons.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-muted)]"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" /> {s}</li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[11px] text-[var(--text-muted)]">La synthèse garde le meilleur de chaque IA, retire les doublons et tranche les contradictions. Le contrôle qualité reste l&apos;arbitre final.</p>
          </div>
        ) : tab === "final" ? (
          <>
            <div className="min-w-0 break-words">
              <Markdown content={result.finalAnswer} />
            </div>
            {result.review && <ReviewBlock review={result.review} />}

            {/* Bloc exécution structuré */}
            <ExecutionFooter result={result} />

            {/* Actions sur la réponse */}
            <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
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

            {/* Suivi rapide */}
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

// ── Bloc exécution (modèles · temps · scores · actions prêtes) ──────────────
function ExecutionFooter({ result }: { result: CouncilResult }) {
  const scoreRows: { label: string; value: number }[] = [
    { label: "Clarté", value: result.scores.clarity },
    { label: "Actionnable", value: result.scores.actionable },
    ...(result.scores.seo ? [{ label: "SEO", value: result.scores.seo }] : []),
  ];
  return (
    <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-4">
      <div className="grid gap-4 sm:grid-cols-[auto,1fr]">
        <div className="flex items-center gap-3 sm:flex-col sm:items-center sm:gap-1">
          <ScoreRing value={result.qualityScore} size={70} label="qualité" />
          <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700 dark:bg-brand-950/50 dark:text-brand-300">
            <Clock className="h-3 w-3" /> {result.timeSaved}
          </div>
        </div>
        <div className="min-w-0 space-y-2.5">
          {scoreRows.map((r) => (
            <div key={r.label}>
              <div className="mb-1 flex items-center justify-between text-[11px]"><span className="text-[var(--text-muted)]">{r.label}</span><span className="font-semibold text-[var(--text)]">{r.value}</span></div>
              <Progress value={r.value} />
            </div>
          ))}
        </div>
      </div>

      {result.nextActions.length > 0 && (
        <div className="mt-4 border-t border-[var(--border)] pt-3.5">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--text)]"><ListChecks className="h-4 w-4 text-brand-600" /> Actions prêtes à appliquer</div>
          <div className="space-y-1.5">
            {result.nextActions.map((a, i) => (
              <div key={i} className="flex items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs">
                <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-brand-50 text-[9px] font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">{i + 1}</span>
                <span className="text-[var(--text)]">{a}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function WhyCard({ color, title, text, icon }: { color: string; title: string; text: string; icon?: React.ReactNode }) {
  if (!text) return null;
  return (
    <div className="rounded-xl border border-[var(--border)] p-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold">
        {icon ?? <span className="h-2 w-2 rounded-full" style={{ background: color }} />}
        {title}
      </div>
      <p className="text-xs text-[var(--text-muted)]">{text}</p>
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

// ── Bloc review structuré (homepage order, structure produit, problèmes) ─────
const MODULE_ROUTE: Record<ModuleId, string> = {
  dashboard: "/command-center", seo: "/product-studio", sections: "/council?mode=code", council: "/council",
  merchant: "/growth-actions", assistant: "/council", memory: "/settings", history: "/settings", settings: "/settings",
};
const SEV_TONE: Record<string, "bad" | "warn" | "neutral"> = { critique: "bad", important: "warn", mineur: "neutral" };

function ReviewBlock({ review }: { review: SiteReview }) {
  return (
    <div className="mt-5 space-y-4 border-t border-[var(--border)] pt-5">
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

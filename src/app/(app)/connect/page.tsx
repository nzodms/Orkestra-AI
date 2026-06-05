"use client";

import { useEffect, useState } from "react";
import { ProviderCard } from "@/components/ProviderCard";
import { PageHeader, Card, Badge } from "@/components/ui/primitives";
import { PROVIDER_ORDER, PROVIDERS } from "@/lib/providers";
import type { AIProviderId } from "@/lib/types";
import {
  ShieldCheck, Lock, EyeOff, AlertTriangle, CheckCircle2, KeyRound, ClipboardPaste,
  MessagesSquare, Sparkles, Clock,
} from "lucide-react";

// Providers réellement branchés en live (les autres : bientôt).
const AVAILABLE: AIProviderId[] = ["openai", "anthropic"];

interface Health {
  status: string;
  mockMode: boolean;
  openAiLiveReady: boolean;
  hasEncryptionMasterKey: boolean;
  hasDatabaseUrl: boolean;
  keyStore: string;
  environment: string;
  warnings: string[];
}

function HealthBanner() {
  const [h, setH] = useState<Health | null>(null);
  useEffect(() => {
    fetch("/api/health").then((r) => r.json()).then(setH).catch(() => {});
  }, []);
  if (!h) return null;
  const ok = h.openAiLiveReady;
  return (
    <Card className={`mb-5 ${ok ? "border-emerald-200 dark:border-emerald-900" : "border-amber-200 dark:border-amber-900"}`}>
      <div className="flex items-start gap-3">
        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${ok ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50" : "bg-amber-50 text-amber-600 dark:bg-amber-950/50"}`}>
          {ok ? <CheckCircle2 className="h-[18px] w-[18px]" /> : <AlertTriangle className="h-[18px] w-[18px]" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{ok ? "Configuration prête pour OpenAI live" : "Configuration : mode démo"}</span>
            <Badge tone={h.mockMode ? "neutral" : "good"}>{h.mockMode ? "Mock" : "Live"}</Badge>
            <Badge tone={h.keyStore === "prisma" ? "good" : "warn"}>clés : {h.keyStore}</Badge>
            <Badge tone="neutral">{h.environment}</Badge>
          </div>
          {h.warnings.length > 0 && (
            <ul className="mt-2 space-y-1">
              {h.warnings.map((w, i) => (
                <li key={i} className="flex gap-1.5 text-xs text-[var(--text-muted)]"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />{w}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}

const STEPS = [
  { icon: KeyRound, title: "Créer une clé", desc: "Sur le site de votre IA (OpenAI, Claude…)." },
  { icon: ClipboardPaste, title: "Coller la clé", desc: "Dans la carte du provider, ci-dessous." },
  { icon: CheckCircle2, title: "Tester", desc: "Orkestra vérifie la clé en un clic." },
  { icon: MessagesSquare, title: "Utiliser", desc: "Vos analyses tournent dans l'AI Council." },
];

function HowItWorks() {
  return (
    <Card className="mb-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Sparkles className="h-4 w-4 text-brand-600" /> Comment ça marche
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={s.title} className="relative flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3.5">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
                <Icon className="h-[18px] w-[18px]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="grid h-4 w-4 place-items-center rounded-full bg-brand-600 text-[10px] font-bold text-white">{i + 1}</span>
                  <span className="text-sm font-semibold">{s.title}</span>
                </div>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">{s.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function ModelGuide() {
  return (
    <Card className="mt-5">
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <Sparkles className="h-4 w-4 text-brand-600" /> Quel modèle utiliser pour quoi&nbsp;?
      </div>
      <p className="mb-3 text-xs text-[var(--text-muted)]">
        Connectez ce que vous voulez : Orkestra route automatiquement vers le bon modèle selon la tâche.
      </p>
      <div className="overflow-hidden rounded-xl border border-[var(--border)]">
        {PROVIDER_ORDER.map((id, i) => {
          const p = PROVIDERS[id];
          const live = AVAILABLE.includes(id);
          return (
            <div
              key={id}
              className={`flex items-center justify-between gap-3 px-3.5 py-3 ${i % 2 ? "bg-[var(--bg)]" : "bg-[var(--surface)]"}`}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
                <span className="shrink-0 text-sm font-semibold">{p.name}</span>
                <span className="truncate text-xs text-[var(--text-muted)]">— {p.bestFor}</span>
              </div>
              {live ? (
                <Badge tone="good"><CheckCircle2 className="h-3 w-3" /> Live</Badge>
              ) : (
                <Badge tone="neutral"><Clock className="h-3 w-3" /> Bientôt</Badge>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default function ConnectPage() {
  return (
    <>
      <PageHeader
        title="Connecter mes IA"
        description="Orkestra fonctionne en BYOK (Bring Your Own Key) : vous connectez vos propres clés API. Orkestra les utilise pour vos analyses — vous gardez le contrôle, vos crédits restent les vôtres."
      />

      <HealthBanner />

      <HowItWorks />

      <Card className="mb-5 border-brand-200 bg-gradient-to-br from-brand-50 to-transparent dark:border-brand-900 dark:from-brand-950/40">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { icon: Lock, title: "Clés chiffrées", desc: "AES-256-GCM côté serveur. Stockées chiffrées, jamais en clair." },
            { icon: EyeOff, title: "Jamais réaffichées", desc: "Après sauvegarde, seule une version masquée est visible." },
            { icon: ShieldCheck, title: "Vos crédits", desc: "Chaque génération utilise vos clés, pas les nôtres." },
          ].map((b) => {
            const Icon = b.icon;
            return (
              <div key={b.title} className="flex items-start gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-brand-600 shadow-soft dark:bg-ink-900">
                  <Icon className="h-[18px] w-[18px]" />
                </div>
                <div>
                  <div className="text-sm font-semibold">{b.title}</div>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">{b.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="ork-stagger grid gap-4 md:grid-cols-2">
        {PROVIDER_ORDER.map((id) => (
          <ProviderCard key={id} id={id} />
        ))}
      </div>

      <ModelGuide />

      <p className="mt-6 text-center text-xs text-[var(--text-muted)]">
        Vous pouvez connecter une ou plusieurs IA. Plus vous en connectez, meilleure est la
        synthèse de l&apos;AI Council.
      </p>
    </>
  );
}

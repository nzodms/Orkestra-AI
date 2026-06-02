"use client";

import { useEffect, useState } from "react";
import { ProviderCard } from "@/components/ProviderCard";
import { PageHeader, Card, Badge } from "@/components/ui/primitives";
import { PROVIDER_ORDER } from "@/lib/providers";
import { ShieldCheck, Lock, EyeOff, AlertTriangle, CheckCircle2 } from "lucide-react";

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

export default function ConnectPage() {
  return (
    <>
      <PageHeader
        title="Connecter mes IA"
        description="Orkestra fonctionne en BYOK (Bring Your Own Key) : vous utilisez vos propres clés API. Vos crédits restent à vous, jamais les nôtres."
      />

      <HealthBanner />

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

      <div className="grid gap-4 md:grid-cols-2">
        {PROVIDER_ORDER.map((id) => (
          <ProviderCard key={id} id={id} />
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-[var(--text-muted)]">
        Vous pouvez connecter une ou plusieurs IA. Plus vous en connectez, meilleure est la
        synthèse de l&apos;AI Council.
      </p>
    </>
  );
}

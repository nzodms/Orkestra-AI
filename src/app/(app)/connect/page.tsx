"use client";

import { ProviderCard } from "@/components/ProviderCard";
import { PageHeader, Card } from "@/components/ui/primitives";
import { PROVIDER_ORDER } from "@/lib/providers";
import { ShieldCheck, Lock, EyeOff } from "lucide-react";

export default function ConnectPage() {
  return (
    <>
      <PageHeader
        title="Connecter mes IA"
        description="Orkestra fonctionne en BYOK (Bring Your Own Key) : vous utilisez vos propres clés API. Vos crédits restent à vous, jamais les nôtres."
      />

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

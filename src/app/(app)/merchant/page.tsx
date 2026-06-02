"use client";

import { useState } from "react";
import { useOrkestra } from "@/lib/store";
import { PageHeader, Card, Badge, ScoreRing, EmptyState } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import type { MerchantAudit, MerchantSeverity } from "@/lib/types";
import { ShieldCheck, ScanSearch, AlertOctagon, AlertTriangle, Info, Wand2, Check } from "lucide-react";

const SEV: Record<MerchantSeverity, { tone: "bad" | "warn" | "neutral"; icon: React.ElementType; label: string }> = {
  critique: { tone: "bad", icon: AlertOctagon, label: "Critique" },
  important: { tone: "warn", icon: AlertTriangle, label: "Important" },
  mineur: { tone: "neutral", icon: Info, label: "Mineur" },
};

export default function MerchantPage() {
  const { resolvedIssues, toggleIssue, brand, analysis } = useOrkestra();
  const [audit, setAudit] = useState<MerchantAudit | null>(null);
  const [loading, setLoading] = useState(false);

  async function runAudit() {
    setLoading(true);
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "merchant-audit",
        context: {
          brandName: brand.storeName || undefined,
          niche: brand.niche || undefined,
          language: brand.language,
          collections: brand.collections,
          // Données réelles issues du scan public (si disponibles).
          englishCount: analysis?.englishTexts?.length,
          scoreHint: analysis?.scores.merchant,
          missingLegal: analysis?.legalPages?.filter((l) => l.essential && !l.found).map((l) => l.label),
        },
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.ok) setAudit(data.result);
  }

  const issues = audit?.issues ?? [];
  const counts = {
    critique: issues.filter((i) => i.severity === "critique" && !resolvedIssues.includes(i.id)).length,
    important: issues.filter((i) => i.severity === "important" && !resolvedIssues.includes(i.id)).length,
    mineur: issues.filter((i) => i.severity === "mineur" && !resolvedIssues.includes(i.id)).length,
  };

  return (
    <>
      <PageHeader
        title="Merchant Shield"
        description="Détectez les risques fréquents avant Google Merchant Center et Google Ads, et améliorez votre conformité apparente."
        actions={
          <Button onClick={runAudit} loading={loading} icon={!loading ? <ScanSearch className="h-4 w-4" /> : undefined}>
            {audit ? "Relancer l'audit" : "Lancer l'audit"}
          </Button>
        }
      />

      <Card className="mb-5 flex items-start gap-3 border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <p className="text-xs text-amber-800 dark:text-amber-200">
          Orkestra détecte les risques les plus fréquents et vous aide à améliorer votre conformité apparente.
          Aucun outil ne peut garantir qu&apos;un compte Merchant Center ne sera jamais suspendu — Google reste seul décisionnaire.
        </p>
      </Card>

      {!audit && !loading && (
        <EmptyState
          icon={<ShieldCheck className="h-7 w-7" />}
          title="Aucun audit pour le moment"
          description="Lancez un audit pour analyser confiance, pages légales, cohérence de langue, descriptions, prix et plus encore."
          action={<Button onClick={runAudit} icon={<ScanSearch className="h-4 w-4" />}>Lancer mon premier audit</Button>}
        />
      )}

      {loading && (
        <Card className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]"><ScanSearch className="h-4 w-4 animate-pulse text-brand-600" /> Analyse de conformité en cours…</div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-ink-100 dark:bg-ink-900" />
          ))}
        </Card>
      )}

      {audit && (
        <div className="grid gap-5 lg:grid-cols-3">
          <Card className="flex flex-col items-center text-center">
            <ScoreRing value={audit.score} size={104} label="/ 100" />
            <h3 className="mt-3 text-sm font-semibold">Score Merchant Center</h3>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Estimation du risque apparent</p>
            <div className="mt-4 grid w-full grid-cols-3 gap-2">
              {(["critique", "important", "mineur"] as MerchantSeverity[]).map((s) => {
                const meta = SEV[s];
                return (
                  <div key={s} className="rounded-xl border border-[var(--border)] p-2">
                    <div className="text-lg font-bold">{counts[s]}</div>
                    <div className="text-[10px] text-[var(--text-muted)]">{meta.label}</div>
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="space-y-3 lg:col-span-2">
            {[...issues]
              .sort((a, b) => a.priority - b.priority)
              .map((issue) => {
                const meta = SEV[issue.severity];
                const Icon = meta.icon;
                const resolved = resolvedIssues.includes(issue.id);
                return (
                  <Card key={issue.id} className={resolved ? "opacity-60" : ""}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${meta.tone === "bad" ? "bg-red-50 text-red-600 dark:bg-red-950/50" : meta.tone === "warn" ? "bg-amber-50 text-amber-600 dark:bg-amber-950/50" : "bg-ink-100 text-ink-500 dark:bg-ink-900"}`}>
                          <Icon className="h-[18px] w-[18px]" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className={`text-sm font-semibold ${resolved ? "line-through" : ""}`}>{issue.title}</h4>
                            <Badge tone={meta.tone}>{meta.label}</Badge>
                          </div>
                          <div className="mt-0.5 text-xs text-[var(--text-muted)]">{issue.category}</div>
                        </div>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-[var(--text-muted)]">{issue.explanation}</p>
                    <div className="mt-3 rounded-xl bg-brand-50 p-3 dark:bg-brand-950/40">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">Correction proposée</span>
                      <p className="mt-1 text-sm">{issue.fix}</p>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button variant="secondary" size="sm" icon={<Wand2 className="h-3.5 w-3.5" />}>Générer la correction</Button>
                      <Button variant={resolved ? "outline" : "ghost"} size="sm" icon={<Check className="h-3.5 w-3.5" />} onClick={() => toggleIssue(issue.id)}>
                        {resolved ? "Corrigé ✓" : "Marquer comme corrigé"}
                      </Button>
                    </div>
                  </Card>
                );
              })}
          </div>
        </div>
      )}
    </>
  );
}

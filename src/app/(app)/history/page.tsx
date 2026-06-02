"use client";

import { useState } from "react";
import { useOrkestra } from "@/lib/store";
import { PageHeader, Card, Badge, EmptyState } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { scoreTone, relativeDate } from "@/lib/utils";
import type { GenerationType } from "@/lib/types";
import { History, Sparkles, Blocks, ShieldCheck, MessagesSquare, FileText, Download, Eye } from "lucide-react";

const TYPE_META: Record<string, { label: string; icon: React.ElementType }> = {
  "seo-product": { label: "Fiche SEO", icon: Sparkles },
  "seo-collection": { label: "Collection SEO", icon: Sparkles },
  section: { label: "Section Shopify", icon: Blocks },
  "merchant-audit": { label: "Audit Merchant", icon: ShieldCheck },
  council: { label: "AI Council", icon: MessagesSquare },
  email: { label: "Email", icon: FileText },
  quote: { label: "Devis", icon: FileText },
};

const FILTERS: { id: string; label: string }[] = [
  { id: "all", label: "Tout" },
  { id: "seo-product", label: "SEO" },
  { id: "section", label: "Sections" },
  { id: "merchant-audit", label: "Audits" },
  { id: "council", label: "AI Council" },
];

export default function HistoryPage() {
  const { history } = useOrkestra();
  const [filter, setFilter] = useState("all");

  const filtered = filter === "all" ? history : history.filter((h) => h.type === filter);

  return (
    <>
      <PageHeader
        title="Historique & projets"
        description="Toutes vos générations sont sauvegardées, exportables et réutilisables."
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)} className={`rounded-xl border px-3.5 py-2 text-sm font-medium transition ${filter === f.id ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300" : "border-[var(--border)] text-[var(--text-muted)] hover:border-brand-300"}`}>
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<History className="h-7 w-7" />}
          title="Aucune génération pour ce filtre"
          description="Générez du contenu depuis le SEO Studio, le Section Builder ou l'AI Council pour le retrouver ici."
        />
      ) : (
        <Card className="p-0">
          <div className="divide-y divide-[var(--border)]">
            {filtered.map((g) => {
              const meta = TYPE_META[g.type] ?? { label: g.type, icon: FileText };
              const Icon = meta.icon;
              return (
                <div key={g.id} className="flex items-center justify-between gap-4 p-4 transition hover:bg-ink-50 dark:hover:bg-ink-900">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{g.title}</span>
                        <Badge tone="neutral">{meta.label}</Badge>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 truncate text-xs text-[var(--text-muted)]">
                        <span>{g.store}</span><span>•</span><span>{relativeDate(g.createdAt)}</span><span>•</span><span>{g.models.join(", ")}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {typeof g.score === "number" && <Badge tone={scoreTone(g.score)}>{g.score}</Badge>}
                    <Button variant="ghost" size="sm" icon={<Eye className="h-3.5 w-3.5" />} className="hidden sm:inline-flex">Voir</Button>
                    <Button variant="ghost" size="sm" icon={<Download className="h-3.5 w-3.5" />}>Exporter</Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </>
  );
}

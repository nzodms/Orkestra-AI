"use client";

import Link from "next/link";
import { useOrkestra } from "@/lib/store";
import { DEMO_SCORES, DEMO_METRICS, DEMO_ACTIONS } from "@/lib/mock-data";
import { scoreTone, relativeDate } from "@/lib/utils";
import { Card, CardHeader, ScoreRing, Badge, PageHeader, Progress } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import {
  Sparkles,
  Blocks,
  ShieldCheck,
  MessagesSquare,
  ArrowUpRight,
  AlertTriangle,
  Package,
  FolderOpen,
  Languages,
  FileText,
  ImageOff,
  ArrowRight,
} from "lucide-react";

const SCORE_CARDS = [
  { key: "seo", label: "Score SEO", desc: "Optimisation moteurs de recherche" },
  { key: "merchant", label: "Conformité Merchant", desc: "Risques Google Merchant Center" },
  { key: "conversion", label: "Score conversion", desc: "Potentiel de transformation" },
  { key: "content", label: "Score contenu", desc: "Qualité éditoriale globale" },
] as const;

const QUICK = [
  { href: "/seo", label: "Optimiser une fiche produit", icon: Sparkles },
  { href: "/sections", label: "Créer une section Shopify", icon: Blocks },
  { href: "/merchant", label: "Auditer ma boutique", icon: ShieldCheck },
  { href: "/council", label: "Lancer le chat multi-IA", icon: MessagesSquare },
];

const METRICS = [
  { key: "productsToOptimize", label: "Produits à optimiser", icon: Package, module: "/seo" },
  { key: "collectionsWithoutSeo", label: "Collections sans SEO", icon: FolderOpen, module: "/seo" },
  { key: "englishTextsDetected", label: "Textes anglais détectés", icon: Languages, module: "/merchant" },
  { key: "missingMetaDescriptions", label: "Meta descriptions manquantes", icon: FileText, module: "/seo" },
  { key: "imagesWithoutAlt", label: "Images sans alt text", icon: ImageOff, module: "/seo" },
] as const;

export default function DashboardPage() {
  const { brand, history } = useOrkestra();
  const storeName = brand.storeName || "votre boutique";

  return (
    <>
      <PageHeader
        title={`Bonjour 👋`}
        description={`Voici l'état de santé de ${storeName}. Orkestra a identifié les actions prioritaires pour progresser.`}
        actions={
          <Link href="/onboarding">
            <Button variant="outline" size="md" icon={<Sparkles className="h-4 w-4" />}>
              Re-scanner ma boutique
            </Button>
          </Link>
        }
      />

      {/* Scores */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {SCORE_CARDS.map((s) => {
          const value = DEMO_SCORES[s.key];
          const tone = scoreTone(value);
          return (
            <Card key={s.key} className="flex items-center gap-4">
              <ScoreRing value={value} />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[var(--text)]">{s.label}</div>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">{s.desc}</p>
                <Badge tone={tone} className="mt-2">
                  {tone === "good" ? "Bon" : tone === "warn" ? "À améliorer" : "Critique"}
                </Badge>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Quick actions */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {QUICK.map((q) => {
          const Icon = q.icon;
          return (
            <Link key={q.href} href={q.href}>
              <div className="group flex h-full items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-brand-300 hover:shadow-card">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-600 text-white transition group-hover:scale-105">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-sm font-medium leading-tight">{q.label}</span>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Priority actions */}
        <Card className="lg:col-span-2">
          <CardHeader
            icon={<AlertTriangle className="h-[18px] w-[18px]" />}
            title="Actions prioritaires"
            subtitle="Triées par impact sur vos scores"
            action={
              <Link href="/history">
                <Button variant="ghost" size="sm">
                  Tout voir
                </Button>
              </Link>
            }
          />
          <div className="space-y-2.5">
            {DEMO_ACTIONS.map((a) => (
              <Link
                key={a.id}
                href={`/${a.module}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] p-3.5 transition hover:bg-ink-50 dark:hover:bg-ink-900"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Badge tone={a.impact === "haut" ? "bad" : a.impact === "moyen" ? "warn" : "neutral"}>
                    Impact {a.impact}
                  </Badge>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{a.title}</div>
                    <div className="truncate text-xs text-[var(--text-muted)]">{a.description}</div>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-400" />
              </Link>
            ))}
          </div>
        </Card>

        {/* Metrics */}
        <Card>
          <CardHeader icon={<Package className="h-[18px] w-[18px]" />} title="Diagnostic boutique" />
          <div className="space-y-1">
            {METRICS.map((m) => {
              const Icon = m.icon;
              return (
                <Link
                  key={m.key}
                  href={m.module}
                  className="flex items-center justify-between gap-2 rounded-lg px-2 py-2.5 transition hover:bg-ink-50 dark:hover:bg-ink-900"
                >
                  <span className="flex items-center gap-2.5 text-sm text-[var(--text-muted)]">
                    <Icon className="h-4 w-4 text-ink-400" /> {m.label}
                  </span>
                  <span className="text-sm font-semibold text-[var(--text)]">{DEMO_METRICS[m.key]}</span>
                </Link>
              );
            })}
          </div>
          <div className="mt-4 rounded-xl bg-brand-50 p-3.5 dark:bg-brand-950/40">
            <div className="mb-1.5 flex items-center justify-between text-xs font-medium">
              <span>Progression globale</span>
              <span className="text-brand-700 dark:text-brand-300">61%</span>
            </div>
            <Progress value={61} />
          </div>
        </Card>
      </div>

      {/* Recent generations */}
      <Card className="mt-4">
        <CardHeader
          icon={<FileText className="h-[18px] w-[18px]" />}
          title="Derniers projets générés"
          subtitle="Vos générations IA récentes"
          action={
            <Link href="/history">
              <Button variant="ghost" size="sm" icon={<ArrowRight className="h-4 w-4" />}>
                Historique
              </Button>
            </Link>
          }
        />
        <div className="divide-y divide-[var(--border)]">
          {history.slice(0, 4).map((g) => (
            <div key={g.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{g.title}</div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <span>{relativeDate(g.createdAt)}</span>
                  <span>•</span>
                  <span>{g.models.join(", ")}</span>
                </div>
              </div>
              {typeof g.score === "number" && (
                <Badge tone={scoreTone(g.score)}>Score {g.score}</Badge>
              )}
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

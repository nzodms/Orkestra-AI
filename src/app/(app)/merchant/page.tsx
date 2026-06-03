"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useOrkestra } from "@/lib/store";
import { PageHeader, Card, Badge, ScoreRing } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { buildMerchantReport, type MCItem, type MCStatus } from "@/lib/merchant";
import { councilLink, assistantLink } from "@/lib/shopify";
import type { MerchantSeverity } from "@/lib/types";
import {
  ShieldCheck, ScanSearch, AlertOctagon, AlertTriangle, Info, Check, Languages, Wand2,
  ArrowRight, Sparkles, Package, ShieldQuestion, ListChecks, Wrench, FileText,
} from "lucide-react";

const SEV: Record<MerchantSeverity, { tone: "bad" | "warn" | "neutral"; icon: React.ElementType; label: string }> = {
  critique: { tone: "bad", icon: AlertOctagon, label: "Critique" },
  important: { tone: "warn", icon: AlertTriangle, label: "Important" },
  mineur: { tone: "neutral", icon: Info, label: "Mineur" },
};
const STATUS: Record<MCStatus, { tone: "good" | "bad" | "warn"; label: string }> = {
  ok: { tone: "good", label: "OK" },
  fix: { tone: "bad", label: "À corriger" },
  check: { tone: "warn", label: "À vérifier" },
};

const WILL_CHECK = [
  { icon: ShieldCheck, t: "Pages de confiance", d: "Contact, mentions, retours, livraison, CGV, confidentialité, FAQ, garantie." },
  { icon: Languages, t: "Langue & cohérence", d: "Libellés anglais résiduels, cohérence langue / devise." },
  { icon: Package, t: "Données produit", d: "product_type, descriptions, meta, alt text, tags." },
  { icon: ShieldQuestion, t: "Signaux Merchant", d: "Ce qui peut fragiliser Merchant Center / Google Shopping." },
];

export default function MerchantPage() {
  const { brand, analysis } = useOrkestra();
  const [audited, setAudited] = useState(false);
  const [loading, setLoading] = useState(false);
  const report = useMemo(() => buildMerchantReport(analysis, brand), [analysis, brand]);

  function runAudit() {
    setLoading(true);
    setTimeout(() => { setAudited(true); setLoading(false); }, 550);
  }

  // Actions contextuelles (n'affiche que celles qui ont du sens selon le scan).
  const quickActions = useMemo(() => {
    const a: { label: string; href: string; icon: React.ElementType }[] = [];
    if (report.englishCount > 0) a.push({ label: "Corriger les textes anglais", href: assistantLink("Où corriger les textes anglais détectés dans Shopify ?"), icon: Languages });
    if (report.critical.some((i) => ["contact", "mentions", "return", "shipping", "cgv", "privacy"].includes(i.key)))
      a.push({ label: "Voir les pages légales manquantes", href: assistantLink("Où trouver et créer mes pages légales manquantes (retour, livraison, mentions) dans Shopify ?"), icon: ShieldCheck });
    if (report.checklist.some((i) => i.key === "product_type" && i.status !== "ok"))
      a.push({ label: "Corriger les product_type", href: assistantLink("Où corriger les product_type manquants dans Shopify ?"), icon: Package });
    a.push({ label: "Générer les textes de politiques", href: councilLink("merchant", "Rédige mes politiques de retour, de livraison et de confidentialité, prêtes à publier."), icon: FileText });
    a.push({ label: "Demander à AI Council", href: councilLink("merchant", "Fais un audit Merchant Center complet de ma boutique à partir des données détectées."), icon: Sparkles });
    a.push({ label: "Ouvrir Assistant Shopify", href: "/assistant", icon: Wrench });
    return a;
  }, [report]);

  return (
    <>
      <PageHeader
        title="Merchant Shield"
        description="Préparez votre boutique avant Google Merchant Center, Google Shopping et Performance Max."
        actions={
          analysis ? (
            <Button onClick={runAudit} loading={loading} icon={!loading ? <ScanSearch className="h-4 w-4" /> : undefined}>
              {audited ? "Relancer l'audit" : "Lancer l'audit Merchant"}
            </Button>
          ) : (
            <Link href="/onboarding"><Button icon={<ScanSearch className="h-4 w-4" />}>Scanner ma boutique</Button></Link>
          )
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Badge tone="brand"><ScanSearch className="h-3 w-3" /> Analyse basée sur le scan public</Badge>
        {analysis && <span className="text-xs text-[var(--text-muted)]">Pays : {brand.country || "—"} · Langue : {brand.language || "français"}</span>}
      </div>

      {/* Boutique non scannée */}
      {!analysis ? (
        <Card className="text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-base font-semibold">Prêt à auditer — scannez d&apos;abord votre boutique</h3>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-[var(--text-muted)]">
            Merchant Shield s&apos;appuie sur le scan public. Voici ce qui sera contrôlé :
          </p>
          <div className="mx-auto mt-5 grid max-w-2xl gap-3 sm:grid-cols-2">
            {WILL_CHECK.map((w) => {
              const Icon = w.icon;
              return (
                <div key={w.t} className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3.5 text-left">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300"><Icon className="h-[18px] w-[18px]" /></div>
                  <div><div className="text-sm font-semibold">{w.t}</div><p className="mt-0.5 text-xs text-[var(--text-muted)]">{w.d}</p></div>
                </div>
              );
            })}
          </div>
          <Link href="/onboarding" className="mt-5 inline-block"><Button icon={<ScanSearch className="h-4 w-4" />}>Scanner ma boutique</Button></Link>
        </Card>
      ) : (
        <>
          {/* 4 cartes de synthèse */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card className="flex items-center gap-3">
              <ScoreRing value={report.score} />
              <div><div className="text-sm font-semibold">Score Merchant</div><p className="mt-0.5 text-xs text-[var(--text-muted)]">apparent</p></div>
            </Card>
            <SummaryCard icon={ShieldCheck} label="Pages de confiance" big={`${report.trustFound}/${report.trustTotal}`} tone={report.trustFound >= report.trustTotal ? "good" : report.trustFound >= report.trustTotal - 1 ? "warn" : "bad"} sub="essentielles présentes" />
            <SummaryCard icon={Languages} label="Langue & cohérence" big={report.englishCount === 0 ? "OK" : String(report.englishCount)} tone={report.englishCount === 0 ? "good" : "warn"} sub={report.englishCount === 0 ? "aucun texte EN" : "textes anglais"} />
            <SummaryCard icon={Package} label="Données produit" big={report.weakDataCount === 0 ? "OK" : String(report.weakDataCount)} tone={report.weakDataCount === 0 ? "good" : "warn"} sub={report.weakDataCount === 0 ? "catalogue propre" : "points à renforcer"} />
          </div>

          {/* Avant audit : invitation à lancer */}
          {!audited && !loading && (
            <Card className="mt-4 flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
              <div>
                <h3 className="text-sm font-semibold">Prêt à auditer</h3>
                <p className="mt-0.5 text-sm text-[var(--text-muted)]">Lancez l&apos;audit pour obtenir la checklist Merchant Center, les risques classés et le plan de correction.</p>
              </div>
              <Button onClick={runAudit} icon={<ScanSearch className="h-4 w-4" />}>Lancer l&apos;audit Merchant</Button>
            </Card>
          )}

          {loading && (
            <Card className="mt-4 space-y-3">
              <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]"><ScanSearch className="h-4 w-4 animate-pulse text-brand-600" /> Analyse de conformité en cours…</div>
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-ink-100 dark:bg-ink-900" />)}
            </Card>
          )}

          {audited && !loading && (
            <div className="mt-4 space-y-5">
              {/* Actions rapides contextuelles */}
              <div className="flex flex-wrap gap-2">
                {quickActions.map((a) => {
                  const Icon = a.icon;
                  return (
                    <Link key={a.label} href={a.href}>
                      <Button variant="outline" size="sm" icon={<Icon className="h-3.5 w-3.5" />}>{a.label}</Button>
                    </Link>
                  );
                })}
              </div>

              {/* Score interprété */}
              <Card className="border-brand-200 bg-gradient-to-br from-brand-50 to-transparent dark:border-brand-900 dark:from-brand-950/40">
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="h-4 w-4 text-brand-600" /> Lecture du score</h3>
                <ul className="space-y-1.5">
                  {report.interpretation.map((line, i) => (
                    <li key={i} className="flex gap-2 text-sm text-[var(--text-muted)]"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" /> {line}</li>
                  ))}
                </ul>
              </Card>

              {/* Checklist Merchant Center */}
              <Card>
                <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold"><ListChecks className="h-4 w-4 text-brand-600" /> Checklist Merchant Center</h3>
                <div className="divide-y divide-[var(--border)]">
                  {report.checklist.map((it) => {
                    const st = STATUS[it.status];
                    return (
                      <div key={it.key} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg ${it.status === "ok" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50" : it.status === "fix" ? "bg-red-50 text-red-600 dark:bg-red-950/50" : "bg-amber-50 text-amber-600 dark:bg-amber-950/50"}`}>
                            {it.status === "ok" ? <Check className="h-3.5 w-3.5" /> : it.status === "fix" ? <AlertOctagon className="h-3.5 w-3.5" /> : <Info className="h-3.5 w-3.5" />}
                          </span>
                          <span className="truncate text-sm">{it.label}</span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {it.status !== "ok" && <Badge tone={SEV[it.severity].tone}>{SEV[it.severity].label}</Badge>}
                          <Badge tone={st.tone}>{st.label}</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Risques classés */}
              <RiskGroup title="Risques critiques" subtitle="À régler avant toute soumission Merchant Center" tone="bad" icon={AlertOctagon} items={report.critical} />
              <RiskGroup title="Risques importants" subtitle="À traiter en priorité pour un flux fiable" tone="warn" icon={AlertTriangle} items={report.important} />
              <RiskGroup title="Optimisations recommandées" subtitle="Mineur pour Merchant, utile pour SEO / confiance" tone="neutral" icon={Info} items={report.optimizations} />

              {/* Disclaimer */}
              <div className="flex items-start gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3.5">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                <p className="text-xs text-[var(--text-muted)]">
                  Orkestra détecte les risques fréquents visibles publiquement. Google reste seul décisionnaire de l&apos;approbation Merchant Center.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

function SummaryCard({ icon: Icon, label, big, sub, tone }: { icon: React.ElementType; label: string; big: string; sub: string; tone: "good" | "warn" | "bad" }) {
  const color = tone === "good" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : "text-red-500";
  return (
    <Card className="flex items-center gap-3">
      <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--bg)] ${color}`}><Icon className="h-5 w-5" /></div>
      <div className="min-w-0">
        <div className={`text-xl font-bold ${color}`}>{big}</div>
        <div className="truncate text-xs font-medium text-[var(--text)]">{label}</div>
        <div className="truncate text-[11px] text-[var(--text-muted)]">{sub}</div>
      </div>
    </Card>
  );
}

function itemActions(item: MCItem): { label: string; href: string; icon: React.ElementType }[] {
  if (item.key === "english") return [{ label: "Corriger les textes anglais", href: assistantLink("Où corriger les textes anglais détectés dans Shopify ?"), icon: Languages }];
  if (item.module === "seo") return [{ label: "Ouvrir SEO Studio", href: "/seo", icon: Sparkles }];
  if (item.module === "council")
    return [
      { label: "Générer le texte", href: councilLink("merchant", `Rédige le contenu de « ${item.label} » pour ma boutique, clair et prêt à publier.`), icon: Wand2 },
      { label: "Où l'ajouter", href: assistantLink(`Où ajouter « ${item.label} » dans Shopify ?`), icon: ArrowRight },
    ];
  return [{ label: "Voir comment faire", href: assistantLink(`${item.label} — où corriger dans Shopify ?`), icon: ArrowRight }];
}

function RiskGroup({ title, subtitle, tone, icon: Icon, items }: { title: string; subtitle: string; tone: "bad" | "warn" | "neutral"; icon: React.ElementType; items: MCItem[] }) {
  if (!items.length) return null;
  const ring = tone === "bad" ? "border-red-200 dark:border-red-900/60" : tone === "warn" ? "border-amber-200 dark:border-amber-900/60" : "border-[var(--border)]";
  const chip = tone === "bad" ? "bg-red-50 text-red-600 dark:bg-red-950/50" : tone === "warn" ? "bg-amber-50 text-amber-600 dark:bg-amber-950/50" : "bg-ink-100 text-ink-500 dark:bg-ink-900";
  return (
    <Card className={ring}>
      <div className="mb-3 flex items-center gap-2.5">
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${chip}`}><Icon className="h-[18px] w-[18px]" /></span>
        <div>
          <h3 className="text-sm font-bold">{title} <span className="ml-1 text-xs font-normal text-[var(--text-muted)]">({items.length})</span></h3>
          <p className="text-xs text-[var(--text-muted)]">{subtitle}</p>
        </div>
      </div>
      <div className="space-y-3">
        {items.map((it) => (
          <div key={it.key} className="rounded-xl border border-[var(--border)] p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">{it.label}</span>
              <Badge tone={SEV[it.severity].tone}>{SEV[it.severity].label}</Badge>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg bg-amber-50 px-2.5 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                <span className="font-semibold">Impact Merchant :</span> {it.impact}
              </div>
              <div className="rounded-lg bg-brand-50 px-2.5 py-2 text-xs text-brand-900 dark:bg-brand-950/40 dark:text-brand-200">
                <span className="font-semibold">Comment corriger :</span> {it.fix}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
              <Wrench className="h-3.5 w-3.5 text-brand-500" />
              <span className="rounded-md bg-[var(--bg)] px-1.5 py-0.5 font-mono text-[11px]">{it.where}</span>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {itemActions(it).map((a) => {
                const Icon2 = a.icon;
                return (
                  <Link key={a.label} href={a.href}>
                    <Button variant="secondary" size="sm" icon={<Icon2 className="h-3.5 w-3.5" />}>{a.label}</Button>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

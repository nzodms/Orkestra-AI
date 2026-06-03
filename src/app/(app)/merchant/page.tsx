"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useOrkestra } from "@/lib/store";
import { relativeDate } from "@/lib/utils";
import { PageHeader, Card, Badge, ScoreRing } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { buildMerchantReport, type MCItem, type MCStatus } from "@/lib/merchant";
import { councilLink, assistantLink } from "@/lib/shopify";
import type { MerchantSeverity } from "@/lib/types";
import {
  ShieldCheck, ScanSearch, AlertOctagon, AlertTriangle, Info, Check, Languages, Wand2,
  ArrowRight, Sparkles, Package, ShieldQuestion, ListChecks, Wrench, FileText,
  Percent, Rocket, RotateCcw, Clock, CircleSlash,
} from "lucide-react";

const SEV: Record<MerchantSeverity, { tone: "bad" | "warn" | "neutral"; label: string }> = {
  critique: { tone: "bad", label: "Critique" },
  important: { tone: "warn", label: "Important" },
  mineur: { tone: "neutral", label: "Mineur" },
};
const STATUS: Record<MCStatus, { tone: "good" | "bad" | "warn"; label: string }> = {
  ok: { tone: "good", label: "OK" },
  fix: { tone: "bad", label: "À corriger" },
  check: { tone: "warn", label: "À vérifier" },
};
const GMC_TONE: Record<string, "good" | "warn" | "bad"> = { ready: "good", fix: "warn", risk: "bad" };

const WILL_CHECK = [
  { icon: ShieldCheck, t: "Pages de confiance", d: "Contact, mentions, retours, livraison, CGV, confidentialité, FAQ, garantie." },
  { icon: Languages, t: "Langue & cohérence", d: "Libellés anglais résiduels, cohérence langue / devise." },
  { icon: Package, t: "Données produit", d: "product_type, descriptions, meta, alt text, tags." },
  { icon: Percent, t: "Promotions & prix", d: "Réductions agressives, prix barrés, urgence, cohérence prix/feed." },
  { icon: FileText, t: "Promesses & claims", d: "Formulations marketing à risque (« meilleur », « garanti »…)." },
  { icon: ShieldQuestion, t: "Signaux Merchant", d: "Ce qui peut fragiliser Merchant Center / Google Shopping." },
];

const DURING_CHECKS = [
  "Cohérence prix site / feed",
  "Cohérence stock site / disponibilité feed",
  "Cohérence livraison / retours / policies",
  "Informations de contact fiables",
  "Absence de promesses agressives",
  "Absence de textes anglais résiduels",
  "Clarté des promotions",
  "Cohérence devise / pays",
  "Cohérence titres / descriptions / produits",
];

const POST_ROUTINES: { t: string; icon: React.ElementType; items: string[] }[] = [
  { t: "Chaque semaine", icon: RotateCcw, items: ["Relancer un audit Merchant", "Vérifier les nouveaux produits ajoutés", "Contrôler les changements de prix", "Vérifier la cohérence des promotions"] },
  { t: "Avant Shopping / Performance Max", icon: Rocket, items: ["Boutique stable et complète", "Pages de confiance OK", "Feed prêt et cohérent"] },
  { t: "Après ajout de produits", icon: Package, items: ["Title, description, image, prix, disponibilité cohérents", "product_type / tags renseignés"] },
  { t: "Avant une grosse promotion", icon: Percent, items: ["Conditions de réduction claires", "Cohérence prix site / feed", "Éviter l'urgence trompeuse"] },
  { t: "Après modification du thème", icon: Wrench, items: ["Vérifier les textes anglais réapparus", "Vérifier H1 / structure des pages"] },
  { t: "Après modification des politiques", icon: ShieldCheck, items: ["Contrôler retours / livraison / confidentialité", "Re-vérifier la cohérence globale"] },
];

type Phase = "avant" | "pendant" | "apres";

export default function MerchantPage() {
  const { brand, analysis, merchantAuditAt, merchantResolved, setMerchantAudited, toggleMerchantResolved } = useOrkestra();
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<Phase>("avant");
  const report = useMemo(() => buildMerchantReport(analysis, brand, merchantResolved), [analysis, brand, merchantResolved]);
  const audited = !!merchantAuditAt;

  function runAudit() {
    setLoading(true);
    setTimeout(() => { setMerchantAudited(); setLoading(false); }, 550);
  }

  const quickActions = useMemo(() => {
    const a: { label: string; href: string; icon: React.ElementType }[] = [];
    if (report.englishCount > 0) a.push({ label: "Corriger les textes anglais", href: assistantLink("Où corriger les textes anglais détectés dans Shopify ?"), icon: Languages });
    if (report.critical.some((i) => ["contact", "mentions", "return", "shipping", "cgv", "privacy"].includes(i.key)))
      a.push({ label: "Pages légales manquantes", href: assistantLink("Où trouver et créer mes pages légales manquantes dans Shopify ?"), icon: ShieldCheck });
    if (report.checklist.some((i) => i.key === "product_type" && i.status !== "ok"))
      a.push({ label: "Corriger les product_type", href: assistantLink("Où corriger les product_type manquants dans Shopify ?"), icon: Package });
    a.push({ label: "Promotions plus propres", href: councilLink("merchant", report.promotions.resolveQ!), icon: Percent });
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

      <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Badge tone="brand"><ScanSearch className="h-3 w-3" /> Analyse basée sur le scan public</Badge>
        {audited && <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]"><Clock className="h-3.5 w-3.5" /> Dernier audit : {relativeDate(merchantAuditAt!)}</span>}
        {audited && <span className="text-xs text-[var(--text-muted)]">· {report.actionsRemaining} action{report.actionsRemaining > 1 ? "s" : ""} restante{report.actionsRemaining > 1 ? "s" : ""}</span>}
        {analysis && <span className="text-xs text-[var(--text-muted)]">· {brand.country || "—"} · {brand.language || "français"}</span>}
      </div>

      {!analysis ? (
        <EmptyState onScan />
      ) : (
        <>
          {/* Préparation GMC + métriques */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-1 border-brand-200 bg-gradient-to-br from-brand-50 to-transparent dark:border-brand-900 dark:from-brand-950/40">
              <div className="flex items-center gap-3">
                <ScoreRing value={report.readiness} />
                <div>
                  <div className="text-xs font-medium text-[var(--text-muted)]">Préparation GMC</div>
                  <Badge tone={GMC_TONE[report.gmcStatus.level]} className="mt-1">{report.gmcStatus.label}</Badge>
                  <div className="mt-1.5 text-xs text-[var(--text-muted)]">{report.actionsRemaining} action{report.actionsRemaining > 1 ? "s" : ""} restante{report.actionsRemaining > 1 ? "s" : ""}</div>
                </div>
              </div>
            </Card>
            <div className="grid grid-cols-2 gap-4 lg:col-span-2 sm:grid-cols-4">
              <Metric icon={ShieldQuestion} label="Score Merchant" big={String(report.score)} tone={report.score >= 70 ? "good" : report.score >= 50 ? "warn" : "bad"} sub="apparent" />
              <Metric icon={ShieldCheck} label="Pages confiance" big={`${report.trustFound}/${report.trustTotal}`} tone={report.trustFound >= report.trustTotal ? "good" : report.trustFound >= report.trustTotal - 1 ? "warn" : "bad"} sub="essentielles" />
              <Metric icon={Languages} label="Textes anglais" big={report.englishCount === 0 ? "OK" : String(report.englishCount)} tone={report.englishCount === 0 ? "good" : "warn"} sub={report.englishCount === 0 ? "cohérent" : "à traduire"} />
              <Metric icon={Percent} label="Promotions" big="?" tone="warn" sub="à vérifier" />
            </div>
          </div>

          {/* Avant audit */}
          {!audited && !loading && (
            <Card className="mt-4 flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
              <div>
                <h3 className="text-sm font-semibold">Lancez l&apos;audit pour le détail</h3>
                <p className="mt-0.5 text-sm text-[var(--text-muted)]">Checklist, risques classés, plan avant/pendant/après GMC et actions priorisées.</p>
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
              {/* Phases */}
              <div className="flex flex-wrap gap-2">
                {([["avant", "1 · Avant la demande GMC"], ["pendant", "2 · Pendant la validation"], ["apres", "3 · Après acceptation"]] as [Phase, string][]).map(([p, label]) => (
                  <button key={p} onClick={() => setPhase(p)} className={`rounded-xl border px-3.5 py-2 text-sm font-medium transition ${phase === p ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300" : "border-[var(--border)] text-[var(--text-muted)] hover:border-brand-300"}`}>{label}</button>
                ))}
              </div>

              {phase === "avant" && <PhaseAvant report={report} quickActions={quickActions} onResolve={toggleMerchantResolved} />}
              {phase === "pendant" && <PhasePendant />}
              {phase === "apres" && <PhaseApres />}

              <Disclaimer />
            </div>
          )}
        </>
      )}
    </>
  );
}

// ── Phase 1 : Avant la demande ──────────────────────────────────────────────
function PhaseAvant({ report, quickActions, onResolve }: { report: ReturnType<typeof buildMerchantReport>; quickActions: { label: string; href: string; icon: React.ElementType }[]; onResolve: (k: string) => void }) {
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {quickActions.map((a) => {
          const Icon = a.icon;
          return <Link key={a.label} href={a.href}><Button variant="outline" size="sm" icon={<Icon className="h-3.5 w-3.5" />}>{a.label}</Button></Link>;
        })}
      </div>

      <Card className="border-brand-200 bg-gradient-to-br from-brand-50 to-transparent dark:border-brand-900 dark:from-brand-950/40">
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="h-4 w-4 text-brand-600" /> Lecture du score</h3>
        <ul className="space-y-1.5">{report.interpretation.map((l, i) => <li key={i} className="flex gap-2 text-sm text-[var(--text-muted)]"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" /> {l}</li>)}</ul>
      </Card>

      <Card>
        <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold"><ListChecks className="h-4 w-4 text-brand-600" /> Checklist Merchant Center</h3>
        <div className="divide-y divide-[var(--border)]">
          {report.checklist.map((it) => {
            const stt = STATUS[it.status];
            return (
              <div key={it.key} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg ${it.status === "ok" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50" : it.status === "fix" ? "bg-red-50 text-red-600 dark:bg-red-950/50" : "bg-amber-50 text-amber-600 dark:bg-amber-950/50"}`}>
                    {it.status === "ok" ? <Check className="h-3.5 w-3.5" /> : it.status === "fix" ? <AlertOctagon className="h-3.5 w-3.5" /> : <Info className="h-3.5 w-3.5" />}
                  </span>
                  <span className="truncate text-sm">{it.label}</span>
                </div>
                <Badge tone={stt.tone}>{stt.label}</Badge>
              </div>
            );
          })}
        </div>
      </Card>

      <RiskGroup title="Risques critiques" subtitle="À régler avant toute soumission Merchant Center" tone="bad" icon={AlertOctagon} items={report.critical} onResolve={onResolve} />
      <RiskGroup title="Risques importants" subtitle="À traiter en priorité pour un flux fiable" tone="warn" icon={AlertTriangle} items={report.important} onResolve={onResolve} />
      <RiskGroup title="Optimisations recommandées" subtitle="Mineur pour Merchant, utile pour SEO / confiance" tone="neutral" icon={Info} items={report.optimizations} onResolve={onResolve} />

      {report.resolvedItems.length > 0 && (
        <Card className="border-emerald-200 dark:border-emerald-900/60">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-300"><Check className="h-4 w-4" /> Corrigés ({report.resolvedItems.length})</h3>
          <div className="flex flex-wrap gap-2">
            {report.resolvedItems.map((it) => (
              <button key={it.key} onClick={() => onResolve(it.key)} className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700 line-through transition hover:no-underline dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                {it.label} <RotateCcw className="h-3 w-3" />
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-[var(--text-muted)]">Cliquez pour rétablir. Relancez l&apos;audit pour confirmer après corrections dans Shopify.</p>
        </Card>
      )}

      {/* Checklist avant Shopping / PMax */}
      <Card>
        <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold"><Rocket className="h-4 w-4 text-brand-600" /> Checklist avant Google Shopping / Performance Max</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {report.beforeShopping.map((b) => {
            const stt = STATUS[b.status];
            return (
              <div key={b.key} className="flex items-start gap-2.5 rounded-xl border border-[var(--border)] p-3">
                <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded ${b.status === "ok" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50" : b.status === "fix" ? "bg-red-50 text-red-600 dark:bg-red-950/50" : "bg-amber-50 text-amber-600 dark:bg-amber-950/50"}`}>
                  {b.status === "ok" ? <Check className="h-3 w-3" /> : b.status === "fix" ? <CircleSlash className="h-3 w-3" /> : <Info className="h-3 w-3" />}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5"><span className="text-sm font-medium">{b.label}</span><Badge tone={stt.tone}>{stt.label}</Badge></div>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">{b.action}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );
}

// ── Phase 2 : Pendant la validation ─────────────────────────────────────────
function PhasePendant() {
  return (
    <>
      <Card className="border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Pendant la validation, évitez les changements majeurs de prix, de thème, de promotions ou de politiques sans relancer un contrôle.
          </p>
        </div>
      </Card>
      <Card>
        <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold"><ShieldQuestion className="h-4 w-4 text-brand-600" /> À surveiller pendant la validation</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {DURING_CHECKS.map((c) => (
            <div key={c} className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] p-3 text-sm">
              <Info className="h-4 w-4 shrink-0 text-amber-500" /> <span className="min-w-0">{c}</span>
              <Badge tone="warn" className="ml-auto">à vérifier</Badge>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

// ── Phase 3 : Après acceptation ─────────────────────────────────────────────
function PhaseApres() {
  return (
    <Card>
      <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold"><Rocket className="h-4 w-4 text-brand-600" /> Plan post-acceptation Google Merchant Center</h3>
      <p className="mb-3 text-xs text-[var(--text-muted)]">Maintenez un compte propre et stable après l&apos;acceptation.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {POST_ROUTINES.map((r) => {
          const Icon = r.icon;
          return (
            <div key={r.t} className="rounded-xl border border-[var(--border)] p-3.5">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4 text-brand-600" /> {r.t}</div>
              <ul className="space-y-1">{r.items.map((it, i) => <li key={i} className="flex gap-2 text-xs text-[var(--text-muted)]"><Check className="mt-0.5 h-3 w-3 shrink-0 text-brand-500" /> {it}</li>)}</ul>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── Composants ──────────────────────────────────────────────────────────────
function Metric({ icon: Icon, label, big, sub, tone }: { icon: React.ElementType; label: string; big: string; sub: string; tone: "good" | "warn" | "bad" }) {
  const color = tone === "good" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : "text-red-500";
  return (
    <Card className="flex items-center gap-2.5">
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--bg)] ${color}`}><Icon className="h-5 w-5" /></div>
      <div className="min-w-0">
        <div className={`text-lg font-bold ${color}`}>{big}</div>
        <div className="truncate text-[11px] font-medium text-[var(--text)]">{label}</div>
        <div className="truncate text-[10px] text-[var(--text-muted)]">{sub}</div>
      </div>
    </Card>
  );
}

function EmptyState({ onScan }: { onScan?: boolean }) {
  return (
    <Card className="text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300"><ShieldCheck className="h-7 w-7" /></div>
      <h3 className="mt-4 text-base font-semibold">Préparez votre boutique pour Google Merchant Center</h3>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-[var(--text-muted)]">Merchant Shield contrôle ce qui peut bloquer ou fragiliser votre validation. Scannez d&apos;abord votre boutique — voici ce qui sera analysé :</p>
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
      {onScan && <Link href="/onboarding" className="mt-5 inline-block"><Button icon={<ScanSearch className="h-4 w-4" />}>Scanner ma boutique</Button></Link>}
    </Card>
  );
}

function resolveHref(it: MCItem): string {
  if (it.module === "seo") return "/seo";
  if (it.resolveQ) return it.module === "assistant" ? assistantLink(it.resolveQ) : councilLink("merchant", it.resolveQ);
  return assistantLink(`${it.label} — où corriger dans Shopify ?`);
}

function RiskGroup({ title, subtitle, tone, icon: Icon, items, onResolve }: { title: string; subtitle: string; tone: "bad" | "warn" | "neutral"; icon: React.ElementType; items: MCItem[]; onResolve: (k: string) => void }) {
  if (!items.length) return null;
  const ring = tone === "bad" ? "border-red-200 dark:border-red-900/60" : tone === "warn" ? "border-amber-200 dark:border-amber-900/60" : "border-[var(--border)]";
  const chip = tone === "bad" ? "bg-red-50 text-red-600 dark:bg-red-950/50" : tone === "warn" ? "bg-amber-50 text-amber-600 dark:bg-amber-950/50" : "bg-ink-100 text-ink-500 dark:bg-ink-900";
  return (
    <Card className={ring}>
      <div className="mb-3 flex items-center gap-2.5">
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${chip}`}><Icon className="h-[18px] w-[18px]" /></span>
        <div><h3 className="text-sm font-bold">{title} <span className="ml-1 text-xs font-normal text-[var(--text-muted)]">({items.length})</span></h3><p className="text-xs text-[var(--text-muted)]">{subtitle}</p></div>
      </div>
      <div className="space-y-3">
        {items.map((it) => (
          <div key={it.key} className="rounded-xl border border-[var(--border)] p-3.5">
            <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold">{it.label}</span><Badge tone={SEV[it.severity].tone}>{SEV[it.severity].label}</Badge></div>
            {it.examples && it.examples.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">{it.examples.map((e, i) => <span key={i} className="rounded-md bg-[var(--bg)] px-2 py-0.5 font-mono text-[11px] text-[var(--text-muted)]">{e}</span>)}</div>
            )}
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg bg-amber-50 px-2.5 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200"><span className="font-semibold">Impact Merchant :</span> {it.impact}</div>
              <div className="rounded-lg bg-brand-50 px-2.5 py-2 text-xs text-brand-900 dark:bg-brand-950/40 dark:text-brand-200"><span className="font-semibold">Comment corriger :</span> {it.fix}</div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
              <Wrench className="h-3.5 w-3.5 text-brand-500" /><span className="rounded-md bg-[var(--bg)] px-1.5 py-0.5 font-mono text-[11px]">{it.where}</span>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <Link href={resolveHref(it)}><Button variant="secondary" size="sm" icon={it.module === "seo" ? <Sparkles className="h-3.5 w-3.5" /> : <Wand2 className="h-3.5 w-3.5" />}>Résoudre</Button></Link>
              <Link href={assistantLink(`${it.label} — où corriger dans Shopify ?`)}><Button variant="ghost" size="sm" icon={<ArrowRight className="h-3.5 w-3.5" />}>Où corriger ?</Button></Link>
              <Button variant="ghost" size="sm" icon={<Check className="h-3.5 w-3.5" />} onClick={() => onResolve(it.key)}>Marquer comme corrigé</Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Disclaimer() {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3.5">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-muted)]" />
      <p className="text-xs text-[var(--text-muted)]">
        Orkestra détecte les risques visibles publiquement et aide à préparer votre boutique. Google reste seul décisionnaire de l&apos;approbation Merchant Center.
      </p>
    </div>
  );
}

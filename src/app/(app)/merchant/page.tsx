"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOrkestra } from "@/lib/store";
import { relativeDate } from "@/lib/utils";
import { PageHeader, Card, Badge, ScoreRing } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { buildMerchantReport, type MCItem, type MCStatus, type Blocker, type MerchantReport } from "@/lib/merchant";
import { councilLink, assistantLink } from "@/lib/shopify";
import type { MerchantSeverity } from "@/lib/types";
import {
  ShieldCheck, ScanSearch, AlertOctagon, AlertTriangle, Info, Check, Languages, Wand2,
  ArrowRight, Sparkles, Package, ShieldQuestion, ListChecks, Wrench,
  Percent, Rocket, RotateCcw, Clock, Timer, Flag, CircleSlash, ChevronDown,
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
  { icon: ShieldCheck, t: "Pages de confiance", d: "Contact, mentions légales, livraison, retours, confidentialité, CGV." },
  { icon: Languages, t: "Cohérence boutique", d: "Langue, pays, devise, textes anglais, promesses commerciales." },
  { icon: Package, t: "Données produit", d: "product_type, descriptions, titles, prix, images, variants." },
  { icon: Percent, t: "Promotions & risques GMC", d: "Prix barrés, codes promo, urgence artificielle, cohérence prix/feed." },
  { icon: Rocket, t: "Plan Google Shopping", d: "Avant soumission, pendant validation, après acceptation, avant PMax." },
];
const BENEFITS = [
  { icon: ShieldQuestion, t: "Repérer les risques avant Google" },
  { icon: Wrench, t: "Savoir quoi corriger dans Shopify" },
  { icon: ListChecks, t: "Suivre votre préparation GMC" },
];

// Promotions : contrôles listés (non confirmables via scan public → à vérifier).
const PROMO_CONTROLS = ["Prix barrés", "Codes promo", "Bandeau d'urgence", "Compte à rebours", "Réduction permanente", "Conditions de promotion", "Cohérence prix site / feed"];

// Parcours GMC : 4 étapes (vérifier / éviter / Orkestra surveille).
const JOURNEY: { n: number; icon: React.ElementType; t: string; check: string; avoid: string; watch: string }[] = [
  { n: 1, icon: Flag, t: "Avant soumission", check: "Pages de confiance, langue, données produit", avoid: "Promesses agressives, textes anglais", watch: "Score de préparation" },
  { n: 2, icon: ShieldQuestion, t: "Pendant validation", check: "Cohérence prix/feed, stock, policies", avoid: "Changements majeurs (prix, thème, promos)", watch: "Cohérences site ↔ feed" },
  { n: 3, icon: Check, t: "Après acceptation", check: "Nouveaux produits, prix, promotions", avoid: "Claims non prouvés", watch: "Audit hebdomadaire" },
  { n: 4, icon: Rocket, t: "Avant PMax / Shopping", check: "Boutique stable, feed prêt", avoid: "Lancer sur un site fragile", watch: "Stabilité globale" },
];

const DURING_CHECKS = [
  "Cohérence prix site / feed", "Cohérence stock site / disponibilité feed", "Cohérence livraison / retours / policies",
  "Informations de contact fiables", "Absence de promesses agressives", "Absence de textes anglais résiduels",
  "Clarté des promotions", "Cohérence devise / pays", "Cohérence titres / descriptions / produits",
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
  const { brand, analysis, merchantAuditAt, merchantResolved, setMerchantAudited, toggleMerchantResolved, recentImports, setPendingCouncil } = useOrkestra();
  const router = useRouter();
  const [importChecked, setImportChecked] = useState<string[]>([]);
  const recentRisky = recentImports.filter((r) => !importChecked.includes(r.id) && (r.warnings > 0 || r.risks > 0 || r.failed > 0)).slice(0, 3);
  function askCouncilImport(r: typeof recentImports[number]) {
    const q =
      `Contexte ciblé Import Factory — vérification avant Google Merchant Center.\n` +
      `Import « ${r.fileName} » · ${r.products} produit(s) · ${r.warnings} à améliorer · ${r.risks} à risque · ${r.failed} bloqué(s).\n` +
      `Risques détectés : ${(r.riskReasons || []).join(" ; ") || "aucun détail"}.\n` +
      `Question : parmi ces points, lesquels sont vraiment bloquants pour Google Merchant Center, lesquels sont acceptables, et que corriger en priorité avant soumission ? Réponds de façon ciblée, sans refaire un audit complet.`;
    setPendingCouncil({ mode: "merchant", question: q });
    router.push("/council");
  }
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<Phase>("avant");
  const [toast, setToast] = useState<string | null>(null);
  const report = useMemo(() => buildMerchantReport(analysis, brand, merchantResolved), [analysis, brand, merchantResolved]);
  const audited = !!merchantAuditAt;
  const nextAction = report.actionPlan[0];

  function flash(msg: string) { setToast(msg); window.setTimeout(() => setToast(null), 1800); }
  function runAudit() {
    const was = audited;
    setLoading(true);
    setTimeout(() => { setMerchantAudited(); setLoading(false); flash(was ? "Audit relancé" : "Analyse terminée"); }, 550);
  }
  function handleResolve(key: string) {
    const wasResolved = merchantResolved.includes(key);
    toggleMerchantResolved(key);
    flash(wasResolved ? "Action rétablie" : "Action marquée comme corrigée");
  }

  const quickActions = useMemo(() => {
    const a: { label: string; href: string; icon: React.ElementType }[] = [];
    if (report.englishCount > 0) a.push({ label: "Corriger les textes anglais", href: assistantLink("Où corriger les textes anglais détectés dans Shopify ?"), icon: Languages });
    if (report.critical.some((i) => ["contact", "mentions", "return", "shipping", "cgv", "privacy"].includes(i.key))) a.push({ label: "Pages légales manquantes", href: assistantLink("Où trouver et créer mes pages légales manquantes dans Shopify ?"), icon: ShieldCheck });
    if (report.checklist.some((i) => i.key === "product_type" && i.status !== "ok")) a.push({ label: "Corriger les product_type", href: assistantLink("Où corriger les product_type manquants dans Shopify ?"), icon: Package });
    a.push({ label: "Promotions plus propres", href: councilLink("merchant", report.promotions.resolveQ!), icon: Percent });
    a.push({ label: "Demander à AI Council", href: councilLink("merchant", "Fais un audit Merchant Center complet de ma boutique à partir des données détectées."), icon: Sparkles });
    return a;
  }, [report]);

  return (
    <>
      <PageHeader title="Merchant Shield" description="Préparez votre boutique avant Google Merchant Center, Google Shopping et Performance Max." />

      <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Badge tone="brand"><ScanSearch className="h-3 w-3" /> Analyse basée sur le scan public</Badge>
        {audited && <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]"><Clock className="h-3.5 w-3.5" /> Dernier audit : {relativeDate(merchantAuditAt!)}</span>}
        {analysis && <span className="text-xs text-[var(--text-muted)]">· {brand.country || "—"} · {brand.language || "français"}</span>}
      </div>

      {/* §9 — Risques détectés dans vos derniers imports (Import Factory) */}
      {recentRisky.length > 0 && (
        <Card className="ork-rise mb-5 border-amber-200 bg-amber-50/40 dark:border-amber-900/60 dark:bg-amber-950/20">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-amber-500 text-white"><Package className="h-4 w-4" /></span>
            <h3 className="text-sm font-bold">Risques détectés dans vos derniers imports</h3>
          </div>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Import Factory a transformé des produits récemment. Vérifiez ces points avant de soumettre à Google Merchant Center.</p>
          <div className="mt-3 space-y-3">
            {recentRisky.map((r) => (
              <div key={r.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Package className="h-3.5 w-3.5 shrink-0 text-brand-600" />
                    <span className="truncate text-sm font-semibold">{r.fileName}</span>
                    <span className="shrink-0 text-[11px] text-[var(--text-muted)]">{new Date(r.date).toLocaleDateString("fr-FR")} · {r.products} produit(s)</span>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {r.warnings > 0 && <Badge tone="warn">{r.warnings} à améliorer</Badge>}
                    {r.risks > 0 && <Badge tone="bad">{r.risks} à risque</Badge>}
                    {r.failed > 0 && <Badge tone="bad">{r.failed} bloqué(s)</Badge>}
                  </div>
                </div>
                {r.riskReasons && r.riskReasons.length > 0 ? (
                  <ul className="mt-2 space-y-0.5">{r.riskReasons.map((x, i) => <li key={i} className="flex items-start gap-1.5 text-xs text-[var(--text-muted)]"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-500" /> {x}</li>)}</ul>
                ) : <p className="mt-2 text-xs text-[var(--text-muted)]">0 problème critique sur les variantes / prix / SKU.</p>}
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <Link href="/seo"><Button size="sm" variant="outline" icon={<Wand2 className="h-3.5 w-3.5" />}>Corriger dans Import Factory</Button></Link>
                  <Button size="sm" variant="ghost" icon={<Sparkles className="h-3.5 w-3.5" />} onClick={() => askCouncilImport(r)}>Faire analyser par AI Council</Button>
                  <Button size="sm" variant="ghost" icon={<Check className="h-3.5 w-3.5" />} onClick={() => setImportChecked((c) => [...c, r.id])}>Marquer comme vérifié</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {!analysis ? (
        <EmptyState onScan />
      ) : (
        <div className="ork-stagger space-y-4">
          {/* Hero — Merchant Readiness Center */}
          <Card className="ork-rise overflow-hidden border-brand-200 bg-gradient-to-br from-brand-50 to-transparent dark:border-brand-900 dark:from-brand-950/40">
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <ScoreRing value={report.readiness} size={92} label="prêt" />
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">Préparation Google Merchant Center</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge tone={GMC_TONE[report.gmcStatus.level]}>{report.gmcStatus.label}</Badge>
                    <span className="text-sm text-[var(--text-muted)]">{report.actionsRemaining} action{report.actionsRemaining > 1 ? "s" : ""} restante{report.actionsRemaining > 1 ? "s" : ""}</span>
                  </div>
                  <p className="mt-1.5 max-w-md text-xs text-[var(--text-muted)]">Identifiez les signaux qui peuvent fragiliser votre boutique avant Google Shopping, Performance Max ou une soumission Merchant Center.</p>
                </div>
              </div>
              <Button onClick={runAudit} loading={loading} icon={!loading ? <ScanSearch className="h-4 w-4" /> : undefined}>{audited ? "Relancer l'audit" : "Lancer l'audit Merchant"}</Button>
            </div>
          </Card>

          {/* Prochaine meilleure action */}
          {nextAction && (
            <Card className="ork-rise flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-600 text-white"><Rocket className="h-[18px] w-[18px]" /></span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">Prochaine meilleure action <Badge tone={SEV[nextAction.severity].tone}>{SEV[nextAction.severity].label}</Badge></div>
                  <div className="mt-0.5 text-sm font-semibold">{nextAction.label}</div>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">{nextAction.impact}</p>
                  <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)]"><Timer className="h-3 w-3" /> {nextAction.eta}</div>
                </div>
              </div>
              <Link href={resolveHref(nextAction)} className="shrink-0"><Button size="sm" icon={nextAction.module === "seo" ? <Sparkles className="h-3.5 w-3.5" /> : <Wand2 className="h-3.5 w-3.5" />}>Résoudre maintenant</Button></Link>
            </Card>
          )}

          {/* Métriques */}
          <div className="ork-stagger grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Metric icon={ShieldQuestion} label="Score Merchant" big={String(report.score)} tone={report.score >= 70 ? "good" : report.score >= 50 ? "warn" : "bad"} sub="apparent" />
            <Metric icon={ShieldCheck} label="Pages confiance" big={`${report.trustFound}/${report.trustTotal}`} tone={report.trustFound >= report.trustTotal ? "good" : report.trustFound >= report.trustTotal - 1 ? "warn" : "bad"} sub="essentielles" />
            <Metric icon={Languages} label="Textes anglais" big={report.englishCount === 0 ? "OK" : String(report.englishCount)} tone={report.englishCount === 0 ? "good" : "warn"} sub={report.englishCount === 0 ? "cohérent" : "à traduire"} />
            <Metric icon={Percent} label="Promotions" big="?" tone="warn" sub="à vérifier" />
          </div>

          {/* Ce qui peut bloquer Google */}
          <Card>
            <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold"><ShieldQuestion className="h-4 w-4 text-brand-600" /> Ce qui peut bloquer Google</div>
            <div className="ork-stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {report.blockers.map((b) => <BlockerCard key={b.key} b={b} />)}
            </div>
          </Card>

          {/* Votre parcours GMC */}
          <Card>
            <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold"><Rocket className="h-4 w-4 text-brand-600" /> Votre parcours Google Merchant Center</div>
            <div className="ork-stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {JOURNEY.map((j) => {
                const Icon = j.icon;
                return (
                  <div key={j.n} className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3.5">
                    <div className="flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-lg bg-brand-50 text-[11px] font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">{j.n}</span><Icon className="h-4 w-4 text-brand-500" /><span className="text-sm font-semibold">{j.t}</span></div>
                    <div className="mt-2 space-y-1 text-[11px] leading-relaxed">
                      <div><span className="font-medium text-emerald-600">Vérifier :</span> <span className="text-[var(--text-muted)]">{j.check}</span></div>
                      <div><span className="font-medium text-amber-600">Éviter :</span> <span className="text-[var(--text-muted)]">{j.avoid}</span></div>
                      <div><span className="font-medium text-brand-600">Orkestra surveille :</span> <span className="text-[var(--text-muted)]">{j.watch}</span></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {loading && (
            <Card className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]"><ScanSearch className="h-4 w-4 animate-pulse text-brand-600" /> Analyse de conformité en cours…</div>
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 rounded-xl ork-skeleton" />)}
            </Card>
          )}

          {!audited && !loading && (
            <Card className="ork-rise flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
              <div><h3 className="text-sm font-semibold">Lancez l&apos;audit pour le plan d&apos;action détaillé</h3><p className="mt-0.5 text-sm text-[var(--text-muted)]">Actions priorisées avec temps estimé, checklist complète et routines avant / pendant / après GMC.</p></div>
              <Button onClick={runAudit} icon={<ScanSearch className="h-4 w-4" />}>Lancer l&apos;audit Merchant</Button>
            </Card>
          )}

          {audited && !loading && (
            <div key={phase === "avant" ? "a" : "b"} className="ork-stagger space-y-4">
              {/* Conclusion de soumission GMC — verdict + 3 points prioritaires */}
              <SubmissionConclusion submission={report.submission} nextAction={nextAction?.label} />

              {/* Plan d'action (action center) */}
              <ActionCenter actionPlan={report.actionPlan} resolved={report.resolvedItems} onResolve={handleResolve} />

              {/* Promotions dédiée */}
              <PromotionsCard item={report.promotions} />

              {/* Quick actions */}
              <div className="flex flex-wrap gap-2">
                {quickActions.map((a) => { const Icon = a.icon; return <Link key={a.label} href={a.href}><Button variant="outline" size="sm" icon={<Icon className="h-3.5 w-3.5" />}>{a.label}</Button></Link>; })}
              </div>

              {/* Lecture du score */}
              <Card className="border-brand-200 bg-gradient-to-br from-brand-50 to-transparent dark:border-brand-900 dark:from-brand-950/40">
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="h-4 w-4 text-brand-600" /> Lecture du score</h3>
                <ul className="space-y-1.5">{report.interpretation.map((l, i) => <li key={i} className="flex gap-2 text-sm text-[var(--text-muted)]"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" /> {l}</li>)}</ul>
              </Card>

              {/* Routines détaillées avant / pendant / après */}
              <Card>
                <div className="mb-3 flex flex-wrap gap-2">
                  {([["avant", "1 · Avant la demande"], ["pendant", "2 · Pendant la validation"], ["apres", "3 · Après acceptation"]] as [Phase, string][]).map(([p, label]) => (
                    <button key={p} onClick={() => setPhase(p)} className={`rounded-xl border px-3.5 py-2 text-sm font-medium transition ${phase === p ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300" : "border-[var(--border)] text-[var(--text-muted)] hover:border-brand-300"}`}>{label}</button>
                  ))}
                </div>
                <div key={phase} className="ork-rise">
                  {phase === "avant" && <PhaseAvant report={report} />}
                  {phase === "pendant" && <PhasePendant />}
                  {phase === "apres" && <PhaseApres />}
                </div>
              </Card>

              <Disclaimer />
            </div>
          )}
        </div>
      )}

      {toast && (
        <div className="ork-rise pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <div className="inline-flex items-center gap-2 rounded-full bg-ink-900 px-4 py-2 text-xs font-medium text-white shadow-pop dark:bg-ink-100 dark:text-ink-900"><Check className="h-3.5 w-3.5 text-emerald-400 dark:text-emerald-600" /> {toast}</div>
        </div>
      )}
    </>
  );
}

// ── Conclusion de soumission Google Merchant Center ─────────────────────────
const SUBMISSION_CFG = {
  go: { Icon: ShieldCheck, tone: "good" as const, verdict: "Recommandée", ring: "border-emerald-200 bg-gradient-to-br from-emerald-50 to-transparent dark:border-emerald-900/60 dark:from-emerald-950/30", chip: "bg-emerald-600" },
  soon: { Icon: AlertTriangle, tone: "warn" as const, verdict: "Possible après correction", ring: "border-amber-200 bg-gradient-to-br from-amber-50 to-transparent dark:border-amber-900/60 dark:from-amber-950/30", chip: "bg-amber-500" },
  wait: { Icon: AlertOctagon, tone: "bad" as const, verdict: "Déconseillée pour l'instant", ring: "border-red-200 bg-gradient-to-br from-red-50 to-transparent dark:border-red-900/60 dark:from-red-950/30", chip: "bg-red-500" },
};
function SubmissionConclusion({ submission, nextAction }: { submission: MerchantReport["submission"]; nextAction?: string }) {
  const c = SUBMISSION_CFG[submission.level];
  const Icon = c.Icon;
  return (
    <Card className={`ork-rise ${c.ring}`}>
      <div className="flex items-start gap-3.5">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${c.chip} text-white`}><Icon className="h-6 w-6" /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Soumission Google Merchant Center</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold">{submission.label}</h3>
            <Badge tone={c.tone}>{c.verdict}</Badge>
          </div>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{submission.reason}</p>
          {submission.before.length > 0 && (
            <div className="mt-3">
              <div className="mb-1.5 text-xs font-semibold">À corriger avant de soumettre</div>
              <ul className="space-y-1">
                {submission.before.map((b, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[var(--surface)] text-[10px] font-bold text-[var(--text-muted)] ring-1 ring-[var(--border)]">{i + 1}</span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {nextAction && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[var(--surface)] px-3 py-1.5 text-xs ring-1 ring-[var(--border)]">
              <Rocket className="h-3.5 w-3.5 text-brand-600" /> <span className="font-medium">Prochaine action :</span> <span className="text-[var(--text-muted)]">{nextAction}</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// ── Plan d'action (action center) ───────────────────────────────────────────
function ActionCenter({ actionPlan, resolved, onResolve }: { actionPlan: MCItem[]; resolved: MCItem[]; onResolve: (k: string) => void }) {
  if (!actionPlan.length) {
    return (
      <Card className="flex items-center gap-3 border-emerald-200 dark:border-emerald-900/60">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50"><Check className="h-5 w-5" /></span>
        <div><div className="text-sm font-semibold">Aucune action restante</div><p className="text-xs text-[var(--text-muted)]">Votre boutique présente un bon socle de préparation. Relancez un audit après chaque changement.</p></div>
      </Card>
    );
  }
  const beforeCount = actionPlan.filter((i) => i.severity !== "mineur").length;
  return (
    <Card>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-bold"><ListChecks className="h-4 w-4 text-brand-600" /> Plan d&apos;action Merchant</h3>
        <Badge tone={beforeCount ? "warn" : "good"}>{beforeCount} action{beforeCount > 1 ? "s" : ""} prioritaire{beforeCount > 1 ? "s" : ""} avant soumission GMC</Badge>
      </div>
      <p className="mb-3 text-xs text-[var(--text-muted)]">{beforeCount > 0 ? `Corrigez ces ${beforeCount} point${beforeCount > 1 ? "s" : ""} avant de soumettre Google Merchant Center.` : "Quelques optimisations facultatives — votre socle est déjà bon."}</p>
      <div className="space-y-2.5">
        {actionPlan.slice(0, 6).map((it, i) => <ActionRow key={it.key} n={i + 1} it={it} onResolve={onResolve} />)}
      </div>
      {resolved.length > 0 && (
        <div className="mt-3 border-t border-[var(--border)] pt-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300"><Check className="h-3.5 w-3.5" /> Corrigées ({resolved.length})</div>
          <div className="flex flex-wrap gap-2">
            {resolved.map((it) => <button key={it.key} onClick={() => onResolve(it.key)} className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700 line-through transition hover:no-underline dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">{it.label} <RotateCcw className="h-3 w-3" /></button>)}
          </div>
        </div>
      )}
    </Card>
  );
}

function ActionRow({ n, it, onResolve }: { n: number; it: MCItem; onResolve: (k: string) => void }) {
  return (
    <div className="ork-rise rounded-xl border border-[var(--border)] p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-brand-600 text-[10px] font-bold text-white">{n}</span>
        <span className="text-sm font-semibold">Action #{n} — {it.label}</span>
        <Badge tone={SEV[it.severity].tone}>{SEV[it.severity].label}</Badge>
        <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)]"><Timer className="h-3 w-3" /> {it.eta}</span>
      </div>
      {it.examples && it.examples.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">{it.examples.map((e, i) => <span key={i} className="rounded-md bg-[var(--bg)] px-2 py-0.5 font-mono text-[11px] text-[var(--text-muted)]">{e}</span>)}</div>
      )}
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg bg-amber-50 px-2.5 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200"><span className="font-semibold">Impact :</span> {it.impact}</div>
        <div className="rounded-lg bg-brand-50 px-2.5 py-2 text-xs text-brand-900 dark:bg-brand-950/40 dark:text-brand-200"><span className="font-semibold">Corriger :</span> {it.fix}</div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]"><Wrench className="h-3.5 w-3.5 text-brand-500" /><span className="rounded-md bg-[var(--bg)] px-1.5 py-0.5 font-mono text-[11px]">{it.where}</span></div>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <Link href={resolveHref(it)}><Button variant="secondary" size="sm" icon={it.module === "seo" ? <Sparkles className="h-3.5 w-3.5" /> : <Wand2 className="h-3.5 w-3.5" />}>Résoudre</Button></Link>
        <Link href={assistantLink(`${it.label} — où corriger dans Shopify ?`)}><Button variant="ghost" size="sm" icon={<ArrowRight className="h-3.5 w-3.5" />}>Où corriger ?</Button></Link>
        <Button variant="ghost" size="sm" icon={<Check className="h-3.5 w-3.5" />} onClick={() => onResolve(it.key)}>Marquer corrigé</Button>
      </div>
    </div>
  );
}

function PromotionsCard({ item }: { item: MCItem }) {
  return (
    <Card className="border-amber-200 dark:border-amber-900/60">
      <div className="mb-2 flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/50"><Percent className="h-[18px] w-[18px]" /></span>
        <div><h3 className="text-sm font-bold">Promotions & prix barrés</h3><Badge tone="warn">À vérifier</Badge></div>
      </div>
      <p className="text-sm text-[var(--text-muted)]">Les promotions ne sont pas interdites, mais les réductions agressives, permanentes, mal synchronisées avec le feed ou sans conditions claires peuvent créer un risque de cohérence prix/offre.</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {PROMO_CONTROLS.map((c) => <span key={c} className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1 text-[11px] text-[var(--text-muted)]"><Info className="h-3 w-3 text-amber-500" /> {c}</span>)}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={councilLink("merchant", item.resolveQ!)}><Button variant="secondary" size="sm" icon={<Wand2 className="h-3.5 w-3.5" />}>Rendre mes promotions plus propres</Button></Link>
      </div>
    </Card>
  );
}

// ── Accordéon léger (réduit la longueur de page) ────────────────────────────
function Accordion({ title, icon: Icon, count, defaultOpen = false, children }: { title: string; icon: React.ElementType; count?: string; defaultOpen?: boolean; children: React.ReactNode }) {
  return (
    <details open={defaultOpen} className="group rounded-xl border border-[var(--border)] bg-[var(--bg)] [&_summary]:list-none [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer select-none items-center justify-between gap-2 px-3.5 py-3 text-sm font-semibold">
        <span className="flex items-center gap-1.5"><Icon className="h-4 w-4 text-brand-600" /> {title}{count && <span className="ml-1 text-xs font-normal text-[var(--text-muted)]">· {count}</span>}</span>
        <span className="flex items-center gap-1.5 text-xs font-normal text-[var(--text-muted)]"><span className="hidden sm:inline group-open:hidden">Voir détails</span><ChevronDown className="h-4 w-4 transition group-open:rotate-180" /></span>
      </summary>
      <div className="border-t border-[var(--border)] px-3.5 py-3">{children}</div>
    </details>
  );
}

// ── Phase 1 : Avant (détail) ────────────────────────────────────────────────
function PhaseAvant({ report }: { report: ReturnType<typeof buildMerchantReport> }) {
  const checklistFix = report.checklist.filter((i) => i.status !== "ok").length;
  const bsTodo = report.beforeShopping.filter((b) => b.status !== "ok").length;
  return (
    <div className="space-y-3">
      <Accordion title="Checklist Merchant Center" icon={ListChecks} count={checklistFix > 0 ? `${checklistFix} à traiter` : "tout est OK"} defaultOpen>
        <div className="divide-y divide-[var(--border)]">
          {report.checklist.map((it) => {
            const stt = STATUS[it.status];
            return (
              <div key={it.key} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg ${it.status === "ok" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50" : it.status === "fix" ? "bg-red-50 text-red-600 dark:bg-red-950/50" : "bg-amber-50 text-amber-600 dark:bg-amber-950/50"}`}>{it.status === "ok" ? <Check className="h-3.5 w-3.5" /> : it.status === "fix" ? <AlertOctagon className="h-3.5 w-3.5" /> : <Info className="h-3.5 w-3.5" />}</span>
                  <span className="truncate text-sm">{it.label}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">{it.status !== "ok" && <Badge tone={SEV[it.severity].tone}>{SEV[it.severity].label}</Badge>}<Badge tone={stt.tone}>{stt.label}</Badge></div>
              </div>
            );
          })}
        </div>
      </Accordion>
      <Accordion title="Checklist avant Google Shopping / Performance Max" icon={Rocket} count={bsTodo > 0 ? `${bsTodo} à vérifier` : "prêt"}>
        <div className="grid gap-2 sm:grid-cols-2">
          {report.beforeShopping.map((b) => {
            const stt = STATUS[b.status];
            return (
              <div key={b.key} className="flex items-start gap-2.5 rounded-xl border border-[var(--border)] p-3">
                <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded ${b.status === "ok" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50" : b.status === "fix" ? "bg-red-50 text-red-600 dark:bg-red-950/50" : "bg-amber-50 text-amber-600 dark:bg-amber-950/50"}`}>{b.status === "ok" ? <Check className="h-3 w-3" /> : b.status === "fix" ? <CircleSlash className="h-3 w-3" /> : <Info className="h-3 w-3" />}</span>
                <div className="min-w-0"><div className="flex items-center gap-1.5"><span className="text-sm font-medium">{b.label}</span><Badge tone={stt.tone}>{stt.label}</Badge></div><p className="mt-0.5 text-xs text-[var(--text-muted)]">{b.action}</p></div>
              </div>
            );
          })}
        </div>
      </Accordion>
    </div>
  );
}

function PhasePendant() {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900 dark:bg-amber-950/20">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <p className="text-sm text-amber-800 dark:text-amber-200">Pendant la validation, évitez les changements majeurs de prix, de thème, de promotions ou de politiques sans relancer un contrôle.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {DURING_CHECKS.map((c) => <div key={c} className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] p-3 text-sm"><Info className="h-4 w-4 shrink-0 text-amber-500" /> <span className="min-w-0">{c}</span><Badge tone="warn" className="ml-auto">à vérifier</Badge></div>)}
      </div>
    </div>
  );
}

function PhaseApres() {
  return (
    <div>
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
    </div>
  );
}

// ── Composants partagés ─────────────────────────────────────────────────────
function BlockerCard({ b }: { b: Blocker }) {
  const stt = STATUS[b.status];
  return (
    <div className="ork-interactive rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3.5 hover:border-brand-300">
      <div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold">{b.label}</span><Badge tone={stt.tone}>{stt.label}</Badge></div>
      <p className="mt-1.5 text-xs text-[var(--text-muted)]"><span className="font-medium text-[var(--text)]">Ex. :</span> {b.example}</p>
      <p className="mt-1 text-xs text-[var(--text-muted)]"><span className="font-medium text-[var(--text)]">Risque Google :</span> {b.why}</p>
    </div>
  );
}

function Metric({ icon: Icon, label, big, sub, tone }: { icon: React.ElementType; label: string; big: string; sub: string; tone: "good" | "warn" | "bad" }) {
  const color = tone === "good" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : "text-red-500";
  return (
    <Card className="flex items-center gap-2.5">
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--bg)] ${color}`}><Icon className="h-5 w-5" /></div>
      <div className="min-w-0"><div className={`text-lg font-bold ${color}`}>{big}</div><div className="truncate text-[11px] font-medium text-[var(--text)]">{label}</div><div className="truncate text-[10px] text-[var(--text-muted)]">{sub}</div></div>
    </Card>
  );
}

function Benefits() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {BENEFITS.map((b) => { const I = b.icon; return <span key={b.t} className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 dark:bg-brand-950 dark:text-brand-300"><I className="h-3.5 w-3.5" />{b.t}</span>; })}
    </div>
  );
}

function WhatWeCheckGrid() {
  return (
    <div className="ork-stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {WILL_CHECK.map((w) => {
        const Icon = w.icon;
        return (
          <div key={w.t} className="ork-interactive flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3.5 text-left hover:border-brand-300">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300"><Icon className="h-[18px] w-[18px]" /></div>
            <div><div className="text-sm font-semibold">{w.t}</div><p className="mt-0.5 text-xs text-[var(--text-muted)]">{w.d}</p></div>
          </div>
        );
      })}
    </div>
  );
}

function EmptyState({ onScan }: { onScan?: boolean }) {
  return (
    <Card className="ork-rise">
      <div className="text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300"><ShieldCheck className="h-7 w-7" /></div>
        <h3 className="mt-4 text-base font-semibold">{onScan ? "Prêt à analyser votre boutique" : "Préparez votre boutique pour Google Merchant Center"}</h3>
        <p className="mx-auto mt-1.5 max-w-xl text-sm text-[var(--text-muted)]">Merchant Shield analyse les signaux visibles qui peuvent fragiliser votre compte Merchant Center : pages de confiance, textes anglais, politiques, promotions, données produit et cohérence du site.</p>
        <div className="mt-4"><Benefits /></div>
      </div>
      <div className="mb-1.5 mt-6 text-xs font-semibold uppercase tracking-wide text-ink-400">Ce que Merchant Shield vérifie</div>
      <WhatWeCheckGrid />
      {onScan && <div className="mt-5 text-center"><Link href="/onboarding"><Button icon={<ScanSearch className="h-4 w-4" />}>Scanner ma boutique</Button></Link></div>}
    </Card>
  );
}

function resolveHref(it: MCItem): string {
  if (it.module === "seo") return "/seo";
  if (it.resolveQ) return it.module === "assistant" ? assistantLink(it.resolveQ) : councilLink("merchant", it.resolveQ);
  return assistantLink(`${it.label} — où corriger dans Shopify ?`);
}

function Disclaimer() {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3.5">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-muted)]" />
      <p className="text-xs text-[var(--text-muted)]">Orkestra détecte les risques visibles publiquement et aide à préparer votre boutique. Google reste seul décisionnaire de l&apos;approbation Merchant Center.</p>
    </div>
  );
}

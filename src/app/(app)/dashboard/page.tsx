"use client";

import Link from "next/link";
import { useOrkestra, connectedProviders } from "@/lib/store";
import { DEMO_SCORES, DEMO_METRICS } from "@/lib/mock-data";
import { scoreTone, relativeDate } from "@/lib/utils";
import { Card, CardHeader, ScoreRing, Badge, PageHeader, Progress, EmptyState } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import {
  Sparkles, Blocks, ShieldCheck, MessagesSquare, ArrowUpRight, Package, FolderOpen,
  Languages, FileText, ImageOff, ArrowRight, Plug, Store, Lock, ScanSearch, HelpCircle, Minus,
} from "lucide-react";

const SCORE_CARDS = [
  { key: "seo", label: "Score SEO", desc: "Optimisation moteurs de recherche" },
  { key: "merchant", label: "Conformité Merchant", desc: "Risques Google Merchant Center" },
  { key: "conversion", label: "Score conversion", desc: "Potentiel de transformation" },
  { key: "content", label: "Score contenu", desc: "Qualité éditoriale globale" },
] as const;

const METRICS = [
  { key: "productsToOptimize", label: "Produits à optimiser", icon: Package, module: "/seo" },
  { key: "collectionsWithoutSeo", label: "Collections sans SEO", icon: FolderOpen, module: "/seo" },
  { key: "englishTextsDetected", label: "Textes anglais détectés", icon: Languages, module: "/merchant" },
  { key: "missingMetaDescriptions", label: "Meta descriptions manquantes", icon: FileText, module: "/seo" },
  { key: "imagesWithoutAlt", label: "Images sans alt text", icon: ImageOff, module: "/seo" },
] as const;

// Actions "studios" — disponibles seulement après configuration.
const STUDIO_ACTIONS = [
  { href: "/seo", label: "Optimiser une fiche produit", icon: Sparkles },
  { href: "/sections", label: "Créer une section Shopify", icon: Blocks },
  { href: "/merchant", label: "Auditer ma boutique", icon: ShieldCheck },
  { href: "/seo", label: "Générer une FAQ", icon: HelpCircle },
];

export default function DashboardPage() {
  const { brand, history, connections, storeScanned } = useOrkestra();
  const providers = connectedProviders(connections);
  const aiConnected = providers.length > 0;
  const storeReady = storeScanned || Boolean(brand.niche);
  const fullyReady = aiConnected && storeReady;

  const storeName = brand.storeName || "votre boutique";

  // Progression de configuration (sur 100).
  const setupProgress = (aiConnected ? 50 : 0) + (storeReady ? 50 : 0);

  return (
    <>
      <PageHeader
        title={fullyReady ? "Bonjour 👋" : "Bienvenue sur Orkestra AI 👋"}
        description={
          fullyReady
            ? `Voici l'état de santé de ${storeName}. Orkestra a identifié les actions prioritaires pour progresser.`
            : "Votre espace est prêt. Connectez vos IA et votre boutique pour qu'Orkestra puisse scanner, générer, auditer et améliorer votre boutique."
        }
        actions={
          fullyReady ? (
            <Link href="/onboarding">
              <Button variant="outline" icon={<ScanSearch className="h-4 w-4" />}>Re-scanner ma boutique</Button>
            </Link>
          ) : undefined
        }
      />

      {/* Bandeau de configuration — visible tant que tout n'est pas prêt */}
      {!fullyReady && (
        <Card className="mb-4 border-brand-200 bg-gradient-to-br from-brand-50 to-transparent dark:border-brand-900 dark:from-brand-950/40">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Configuration de votre espace</div>
            <span className="text-xs font-medium text-brand-700 dark:text-brand-300">{setupProgress}%</span>
          </div>
          <div className="mt-2"><Progress value={setupProgress} /></div>
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            {!aiConnected
              ? "Étape 1 : connectez au moins une IA pour activer les générations multi-IA."
              : !storeReady
              ? "Étape 2 : renseignez ou connectez votre boutique pour lancer l'analyse."
              : ""}
          </p>
        </Card>
      )}

      {/* Scores */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {SCORE_CARDS.map((s) => (
          <Card key={s.key} className="flex items-center gap-4">
            {storeReady ? (
              <ScoreRing value={DEMO_SCORES[s.key]} />
            ) : (
              <div className="grid h-[76px] w-[76px] shrink-0 place-items-center rounded-full border-4 border-dashed border-[var(--border)] text-ink-400">
                <Minus className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[var(--text)]">{s.label}</div>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">{s.desc}</p>
              {storeReady ? (
                <Badge tone={scoreTone(DEMO_SCORES[s.key])} className="mt-2">
                  {scoreTone(DEMO_SCORES[s.key]) === "good" ? "Bon" : scoreTone(DEMO_SCORES[s.key]) === "warn" ? "À améliorer" : "Critique"}
                </Badge>
              ) : (
                <Badge tone="neutral" className="mt-2">Non analysé</Badge>
              )}
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Actions prioritaires */}
        <div className="space-y-3 lg:col-span-2">
          <h2 className="text-sm font-semibold text-[var(--text)]">Actions prioritaires</h2>

          {/* 1. Connecter mes IA — action principale très visible */}
          {!aiConnected ? (
            <div className="overflow-hidden rounded-2xl border-2 border-brand-300 bg-gradient-to-br from-brand-600 to-brand-800 p-5 text-white shadow-pop dark:border-brand-700">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/15">
                    <Plug className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold">Connecter mes IA</h3>
                      <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">Priorité élevée</span>
                    </div>
                    <p className="mt-1 text-sm text-brand-100">
                      Connectez OpenAI, Claude, Gemini ou OpenRouter pour activer les générations multi-IA.
                    </p>
                  </div>
                </div>
              </div>
              <Link href="/connect" className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-brand-700 transition hover:bg-brand-50">
                Connecter mes IA <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <DoneAction label="IA connectées" detail={`${providers.length} IA active${providers.length > 1 ? "s" : ""} dans l'orchestre.`} />
          )}

          {/* 2. Connecter la boutique — important */}
          {!storeReady ? (
            <Link href="/onboarding" className="block rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-card transition hover:border-brand-300">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
                    <Store className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold">Renseigner / connecter ma boutique</h3>
                      <Badge tone="warn">Important</Badge>
                    </div>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                      Ajoutez les informations de votre boutique ou connectez Shopify pour qu&apos;Orkestra comprenne votre niche, vos produits, vos collections et vos opportunités SEO.
                    </p>
                  </div>
                </div>
                <ArrowUpRight className="h-5 w-5 shrink-0 text-ink-400" />
              </div>
            </Link>
          ) : (
            <DoneAction label="Boutique connectée" detail={`Niche : ${brand.niche || "renseignée"} · ${brand.collections.length} collection(s) détectée(s).`} />
          )}

          {/* 3. Autres studios — en attente si non configuré */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium">Studios de génération</span>
              {!fullyReady && <Badge tone="neutral"><Lock className="h-3 w-3" /> Connectez vos IA pour commencer</Badge>}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {STUDIO_ACTIONS.map((a) => {
                const Icon = a.icon;
                const content = (
                  <div className={`flex items-center gap-3 rounded-xl border border-[var(--border)] p-3 transition ${fullyReady ? "hover:border-brand-300 hover:bg-ink-50 dark:hover:bg-ink-900" : "opacity-60"}`}>
                    <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${fullyReady ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-400 dark:bg-ink-900"}`}>
                      {fullyReady ? <Icon className="h-[18px] w-[18px]" /> : <Lock className="h-4 w-4" />}
                    </div>
                    <span className="text-sm font-medium">{a.label}</span>
                  </div>
                );
                return fullyReady ? (
                  <Link key={a.label} href={a.href}>{content}</Link>
                ) : (
                  <div key={a.label} title="Disponible après configuration">{content}</div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Diagnostic boutique */}
        <Card>
          <CardHeader icon={<Package className="h-[18px] w-[18px]" />} title="Diagnostic boutique" />
          {storeReady ? (
            <>
              <div className="space-y-1">
                {METRICS.map((m) => {
                  const Icon = m.icon;
                  return (
                    <Link key={m.key} href={m.module} className="flex items-center justify-between gap-2 rounded-lg px-2 py-2.5 transition hover:bg-ink-50 dark:hover:bg-ink-900">
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
            </>
          ) : (
            <div className="space-y-1">
              {METRICS.map((m) => {
                const Icon = m.icon;
                return (
                  <div key={m.key} className="flex items-center justify-between gap-2 px-2 py-2.5">
                    <span className="flex items-center gap-2.5 text-sm text-[var(--text-muted)]">
                      <Icon className="h-4 w-4 text-ink-400" /> {m.label}
                    </span>
                    <span className="text-xs text-ink-400">En attente</span>
                  </div>
                );
              })}
              <div className="mt-3 rounded-xl border border-dashed border-[var(--border)] p-3.5 text-center">
                <p className="text-xs text-[var(--text-muted)]">Boutique non scannée</p>
                <Link href="/onboarding" className="mt-1 inline-block text-xs font-medium text-brand-600 hover:underline">
                  Connectez Shopify pour lancer l&apos;audit →
                </Link>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* AI Council — toujours mis en avant */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-brand-200 bg-[var(--surface)] shadow-card dark:border-brand-900">
        <div className="flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
              <MessagesSquare className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Lancer AI Council</h3>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Posez une question à toutes vos IA connectées et obtenez la meilleure réponse fusionnée.
              </p>
            </div>
          </div>
          <Link href="/council" className="shrink-0">
            <Button icon={<Sparkles className="h-4 w-4" />}>Ouvrir l&apos;AI Council</Button>
          </Link>
        </div>
      </div>

      {/* Derniers projets générés */}
      <Card className="mt-4">
        <CardHeader
          icon={<FileText className="h-[18px] w-[18px]" />}
          title="Derniers projets générés"
          subtitle="Vos générations IA récentes"
          action={
            history.length > 0 ? (
              <Link href="/history"><Button variant="ghost" size="sm" icon={<ArrowRight className="h-4 w-4" />}>Historique</Button></Link>
            ) : undefined
          }
        />
        {history.length > 0 ? (
          <div className="divide-y divide-[var(--border)]">
            {history.slice(0, 4).map((g) => (
              <div key={g.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{g.title}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                    <span>{relativeDate(g.createdAt)}</span><span>•</span><span>{g.models.join(", ")}</span>
                  </div>
                </div>
                {typeof g.score === "number" && <Badge tone={scoreTone(g.score)}>Score {g.score}</Badge>}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<FileText className="h-7 w-7" />}
            title="Aucun projet pour le moment"
            description="Vos générations SEO, sections Shopify et audits apparaîtront ici une fois votre espace configuré."
          />
        )}
      </Card>
    </>
  );
}

function DoneAction({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500 text-white">
          <ShieldCheck className="h-[18px] w-[18px]" />
        </div>
        <div>
          <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">{label}</div>
          <p className="text-xs text-emerald-700/80 dark:text-emerald-300/70">{detail}</p>
        </div>
      </div>
      <Badge tone="good">Fait ✓</Badge>
    </div>
  );
}

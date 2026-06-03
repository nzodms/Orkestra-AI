"use client";

import Link from "next/link";
import { useOrkestra, connectedProviders } from "@/lib/store";
import { scoreTone, relativeDate } from "@/lib/utils";
import { Card, CardHeader, ScoreRing, Badge, PageHeader, Progress, EmptyState } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import type { StoreScores, DashboardMetrics } from "@/lib/types";
import {
  Sparkles, Blocks, ShieldCheck, MessagesSquare, ArrowUpRight, Package, FolderOpen,
  Languages, FileText, ImageOff, ArrowRight, Plug, Store, ScanSearch, Minus, UserCog, Check,
} from "lucide-react";

// Question préparée → ouvre AI Council contextualisé sur la boutique active.
function council(mode: string, q: string) {
  return `/council?mode=${mode}&q=${encodeURIComponent(q)}`;
}

const SCORE_CARDS: { key: keyof StoreScores; label: string; desc: string; href: string }[] = [
  { key: "seo", label: "Score SEO", desc: "Optimisation moteurs de recherche", href: council("seo", "Comment améliorer le SEO de ma boutique à partir des données analysées ?") },
  { key: "merchant", label: "Conformité Merchant", desc: "Risques Google Merchant Center", href: "/merchant" },
  { key: "conversion", label: "Score conversion", desc: "Potentiel de transformation", href: council("strategy", "Analyse ma boutique et propose des améliorations pour convertir davantage.") },
  { key: "content", label: "Score contenu", desc: "Qualité éditoriale globale", href: council("seo", "Quels contenus dois-je améliorer en priorité sur ma boutique ?") },
];

const METRICS: { key: keyof DashboardMetrics; label: string; icon: React.ElementType; href: string }[] = [
  { key: "productsToOptimize", label: "Produits à optimiser", icon: Package, href: "/seo" },
  { key: "collectionsWithoutSeo", label: "Collections sans SEO", icon: FolderOpen, href: "/seo" },
  { key: "englishTextsDetected", label: "Textes anglais détectés", icon: Languages, href: council("merchant", "Liste les textes anglais détectés et propose les corrections en français.") },
  { key: "missingMetaDescriptions", label: "Meta descriptions manquantes", icon: FileText, href: "/seo" },
  { key: "imagesWithoutAlt", label: "Images sans alt text", icon: ImageOff, href: "/seo" },
];

export default function DashboardPage() {
  const { brand, history, connections, analysis } = useOrkestra();
  const providers = connectedProviders(connections);
  const aiConnected = providers.length > 0;
  const profileComplete = Boolean(brand.storeName.trim() && brand.niche.trim());
  const storeReady = analysis != null; // source de vérité unique
  const fullyReady = aiConnected && storeReady;
  const storeName = brand.storeName || "votre boutique";
  const setupProgress = (aiConnected ? 34 : 0) + (profileComplete ? 33 : 0) + (storeReady ? 33 : 0);

  return (
    <>
      <PageHeader
        title={fullyReady ? `Bonjour 👋` : "Bienvenue sur Orkestra AI 👋"}
        description={
          fullyReady
            ? `Voici l'état de santé de ${storeName}. Orkestra a identifié les actions prioritaires pour progresser.`
            : "Votre espace est prêt. Complétez le profil de votre boutique et connectez vos IA pour qu'Orkestra puisse analyser, générer et auditer."
        }
        actions={
          storeReady ? (
            <Link href="/onboarding">
              <Button variant="outline" icon={<ScanSearch className="h-4 w-4" />}>Re-scanner ma boutique</Button>
            </Link>
          ) : undefined
        }
      />

      {!fullyReady && (
        <Card className="mb-4 border-brand-200 bg-gradient-to-br from-brand-50 to-transparent dark:border-brand-900 dark:from-brand-950/40">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Configuration de votre espace</div>
            <span className="text-xs font-medium text-brand-700 dark:text-brand-300">{setupProgress}%</span>
          </div>
          <div className="mt-2"><Progress value={setupProgress} /></div>
        </Card>
      )}

      {/* Scores */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {SCORE_CARDS.map((s) => {
          const value = analysis?.scores[s.key];
          const content = (
            <Card className="flex h-full items-center gap-4 transition hover:border-brand-300 hover:shadow-card">
              {typeof value === "number" ? (
                <ScoreRing value={value} />
              ) : (
                <div className="grid h-[76px] w-[76px] shrink-0 place-items-center rounded-full border-4 border-dashed border-[var(--border)] text-ink-400">
                  <Minus className="h-5 w-5" />
                </div>
              )}
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[var(--text)]">{s.label}</div>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">{s.desc}</p>
                {typeof value === "number" ? (
                  <Badge tone={scoreTone(value)} className="mt-2">
                    {scoreTone(value) === "good" ? "Bon" : scoreTone(value) === "warn" ? "À améliorer" : "Critique"}
                  </Badge>
                ) : (
                  <Badge tone="neutral" className="mt-2">Non analysé</Badge>
                )}
              </div>
            </Card>
          );
          return storeReady ? (
            <Link key={s.key} href={s.href} className="block">{content}</Link>
          ) : (
            <Link key={s.key} href="/onboarding" className="block">{content}</Link>
          );
        })}
      </div>

      {!storeReady && (
        <p className="mt-3 text-center text-xs text-[var(--text-muted)]">
          Connectez ou scannez votre boutique pour générer les premières statistiques.
        </p>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Actions prioritaires */}
        <div className="space-y-3 lg:col-span-2">
          <h2 className="text-sm font-semibold text-[var(--text)]">Actions prioritaires</h2>

          {/* 1. Connecter mes IA */}
          {!aiConnected ? (
            <div className="overflow-hidden rounded-2xl border-2 border-brand-300 bg-gradient-to-br from-brand-600 to-brand-800 p-5 text-white shadow-pop dark:border-brand-700">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/15"><Plug className="h-5 w-5" /></div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold">Connecter mes IA</h3>
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">Priorité élevée</span>
                  </div>
                  <p className="mt-1 text-sm text-brand-100">Connectez OpenAI, Claude, Gemini ou OpenRouter pour activer les générations multi-IA.</p>
                </div>
              </div>
              <Link href="/connect" className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-brand-700 transition hover:bg-brand-50">
                Connecter mes IA <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <DoneAction label="IA connectées" detail={`${providers.length} IA active${providers.length > 1 ? "s" : ""} dans l'orchestre.`} />
          )}

          {/* 2. Compléter le profil */}
          <ActionRow
            done={profileComplete}
            icon={UserCog}
            title="Compléter le profil de ma boutique"
            desc="Renseignez nom, niche, pays et ton de marque pour qu'Orkestra comprenne votre boutique."
            doneDetail={`${brand.niche || "Niche renseignée"} · positionnement ${brand.positioning}`}
            href="/onboarding"
            tone="important"
          />

          {/* 3. Connecter / scanner Shopify */}
          <ActionRow
            done={storeReady}
            icon={Store}
            title="Scanner ma boutique (vue client)"
            desc="Lancez un scan public à partir du lien de votre boutique pour détecter niche, collections et opportunités. Connexion API Shopify bientôt disponible."
            doneDetail={analysis ? `${brand.collections.length} collection(s) · analyse ${analysis.confidence}` : ""}
            href="/onboarding"
            tone="important"
          />

          {/* 4 & 5. Utiliser */}
          <ActionRow done={false} icon={MessagesSquare} title="Lancer AI Council" desc="Posez une question à toutes vos IA connectées et obtenez la meilleure réponse fusionnée." href="/council" tone="use" />
          <ActionRow done={false} icon={Blocks} title="Demander du code Shopify" desc="Générez des sections Shopify (Liquid, CSS, schema) en discutant avec l'IA — mode Code Shopify de l'AI Council." href={council("code", "Crée une section Shopify premium adaptée à ma boutique.")} tone="use" />
          <ActionRow done={false} icon={ShieldCheck} title="Auditer ma boutique" desc="Détectez les risques Merchant Center et obtenez des correctifs priorisés." href="/merchant" tone="use" />
        </div>

        {/* Diagnostic boutique */}
        <Card>
          <CardHeader icon={<Package className="h-[18px] w-[18px]" />} title="Diagnostic boutique" />
          {storeReady && analysis ? (
            <>
              <div className="space-y-1">
                {METRICS.map((m) => {
                  const Icon = m.icon;
                  return (
                    <Link key={m.key} href={m.href} className="flex items-center justify-between gap-2 rounded-lg px-2 py-2.5 transition hover:bg-ink-50 dark:hover:bg-ink-900">
                      <span className="flex items-center gap-2.5 text-sm text-[var(--text-muted)]">
                        <Icon className="h-4 w-4 text-ink-400" /> {m.label}
                      </span>
                      <span className="text-sm font-semibold text-[var(--text)]">{analysis.metrics[m.key]}</span>
                    </Link>
                  );
                })}
              </div>
              <div className="mt-3 rounded-xl bg-brand-50 p-3 text-xs dark:bg-brand-950/40">
                <span className="font-medium text-brand-700 dark:text-brand-300">Confiance : {analysis.confidence}</span>
                <span className="text-[var(--text-muted)]"> · dernier scan {relativeDate(analysis.lastScanAt)}</span>
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
                <p className="text-xs text-[var(--text-muted)]">Boutique non analysée</p>
                <Link href="/onboarding" className="mt-1 inline-block text-xs font-medium text-brand-600 hover:underline">
                  Scannez votre boutique pour lancer l&apos;analyse →
                </Link>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Derniers projets générés */}
      <Card className="mt-4">
        <CardHeader
          icon={<FileText className="h-[18px] w-[18px]" />}
          title="Derniers projets générés"
          subtitle="Vos générations IA récentes"
          action={history.length > 0 ? (<Link href="/history"><Button variant="ghost" size="sm" icon={<ArrowRight className="h-4 w-4" />}>Historique</Button></Link>) : undefined}
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

function ActionRow({
  done, icon: Icon, title, desc, doneDetail, href, tone,
}: {
  done: boolean; icon: React.ElementType; title: string; desc: string; doneDetail?: string; href: string; tone: "important" | "use";
}) {
  if (done) return <DoneAction label={title} detail={doneDetail || "Terminé."} />;
  return (
    <Link href={href} className="block rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-card transition hover:border-brand-300">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300"><Icon className="h-5 w-5" /></div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold">{title}</h3>
              {tone === "important" && <Badge tone="warn">Important</Badge>}
            </div>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{desc}</p>
          </div>
        </div>
        <ArrowUpRight className="h-5 w-5 shrink-0 text-ink-400" />
      </div>
    </Link>
  );
}

function DoneAction({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500 text-white"><Check className="h-[18px] w-[18px]" /></div>
        <div>
          <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">{label}</div>
          <p className="text-xs text-emerald-700/80 dark:text-emerald-300/70">{detail}</p>
        </div>
      </div>
      <Badge tone="good">Fait ✓</Badge>
    </div>
  );
}

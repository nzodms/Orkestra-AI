"use client";

import { useOrkestra } from "@/lib/store";
import { PageHeader, Card, CardHeader, Badge, EmptyState } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { relativeDate } from "@/lib/utils";
import Link from "next/link";
import {
  Brain, Store, Tag, FolderOpen, Palette, ShieldCheck, Users, Sparkles, Lightbulb,
  ScanSearch, UserCog, AlertTriangle,
} from "lucide-react";

const SEV_TONE: Record<string, "bad" | "warn" | "neutral"> = { critique: "bad", important: "warn", mineur: "neutral" };

function Chips({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) return <p className="text-sm text-ink-400">{empty}</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it, i) => (
        <span key={i} className="rounded-lg bg-ink-100 px-2.5 py-1 text-xs dark:bg-ink-900">{it}</span>
      ))}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="text-right font-medium">{value || "—"}</span>
    </div>
  );
}

export default function MemoryPage() {
  const { brand, analysis } = useOrkestra();
  const hasData = Boolean(brand.niche.trim() || brand.storeName.trim() || analysis);

  if (!hasData) {
    return (
      <>
        <PageHeader
          title="Mémoire boutique"
          description="Le cerveau d'Orkestra. Ces informations sont injectées dans toutes vos générations pour rester cohérentes avec votre marque."
        />
        <EmptyState
          icon={<Brain className="h-7 w-7" />}
          title="Votre mémoire boutique n'est pas encore complète"
          description="Renseignez le profil de votre boutique ou scannez Shopify pour qu'Orkestra détecte votre niche, vos collections, vos mots-clés et vos opportunités."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Link href="/onboarding"><Button icon={<UserCog className="h-4 w-4" />}>Compléter le profil</Button></Link>
              <Link href="/onboarding"><Button variant="outline" icon={<ScanSearch className="h-4 w-4" />}>Scanner Shopify</Button></Link>
            </div>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Mémoire boutique"
        description="Le cerveau d'Orkestra. Ces informations sont injectées dans toutes vos générations pour rester cohérentes avec votre marque."
        actions={
          <Link href="/onboarding">
            <Button variant="outline" icon={<Sparkles className="h-4 w-4" />}>Mettre à jour</Button>
          </Link>
        }
      />

      {analysis && (
        <div className="mb-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
            {analysis.coverage && (
              <Badge tone={analysis.coverage === "élevée" ? "good" : analysis.coverage === "moyenne" ? "warn" : "neutral"}>
                Couverture : {analysis.coverage}
              </Badge>
            )}
            {analysis.catalogSource && <Badge tone="brand">Source : {analysis.catalogSource}</Badge>}
            <span>Dernier scan : {relativeDate(analysis.lastScanAt)}</span>
          </div>
          {analysis.productsFound != null && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {[
                { label: "Produits trouvés", v: analysis.productsFound },
                { label: "Enrichis (JSON)", v: analysis.productsEnriched ?? 0 },
                { label: "Analysés (HTML)", v: analysis.productsAnalyzed ?? 0 },
                { label: "Collections trouvées", v: analysis.collectionsFound ?? 0 },
                { label: "Collections analysées", v: analysis.collectionsAnalyzed ?? 0 },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-[var(--border)] p-2.5 text-center">
                  <div className="text-base font-bold">{s.v}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">{s.label}</div>
                </div>
              ))}
            </div>
          )}
          {analysis.catalogStats && (
            <div className="flex flex-wrap gap-1.5 text-xs">
              <Badge tone="neutral">{analysis.catalogStats.noDescription + analysis.catalogStats.shortDescriptions} descriptions faibles</Badge>
              <Badge tone="neutral">{analysis.catalogStats.weakTitles} titres faibles</Badge>
              <Badge tone="neutral">{analysis.catalogStats.noType} sans type</Badge>
              <Badge tone="neutral">tags {analysis.catalogStats.tagsCoverage}%</Badge>
              {analysis.catalogStats.topTypes.length > 0 && (
                <Badge tone="brand">types : {analysis.catalogStats.topTypes.map((t) => t.type).slice(0, 3).join(", ")}</Badge>
              )}
            </div>
          )}
        </div>
      )}

      {/* Ce qu'Orkestra a compris */}
      <Card className="mb-4 border-brand-200 bg-gradient-to-br from-brand-50 to-transparent dark:border-brand-900 dark:from-brand-950/40">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
            <Lightbulb className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Ce qu&apos;Orkestra a compris de votre boutique</h3>
            {brand.understanding ? (
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-muted)]">{brand.understanding}</p>
            ) : (
              <p className="mt-1.5 text-sm text-[var(--text-muted)]">
                Lancez un scan de votre boutique depuis l&apos;onboarding pour qu&apos;Orkestra analyse votre niche, vos collections et vos opportunités.
              </p>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader icon={<Store className="h-[18px] w-[18px]" />} title="Identité" />
          <div className="divide-y divide-[var(--border)]">
            <Row label="Nom de marque" value={brand.storeName} />
            <Row label="Lien public" value={brand.publicUrl || brand.shopifyUrl} />
            <Row label="Lien admin Shopify" value={brand.adminUrl} />
            <Row label="Niche détectée" value={brand.niche} />
            <Row label="Pays cible" value={brand.country} />
            <Row label="Langue du site" value={brand.language} />
            <div className="flex items-center justify-between py-2 text-sm">
              <span className="text-[var(--text-muted)]">Positionnement</span>
              <Badge tone="brand">{brand.positioning}</Badge>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader icon={<Palette className="h-[18px] w-[18px]" />} title="Ton de marque" />
          <div className="divide-y divide-[var(--border)]">
            <Row label="Style rédactionnel" value={brand.writingStyle} />
            <Row label="Formalité" value={brand.formality} />
            <Row label="Délai de livraison" value={brand.shippingDelay} />
            <Row label="Politique de retour" value={brand.returnPolicy} />
          </div>
          <div className="mt-3 space-y-3">
            <div><div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">Mots à éviter</div><Chips items={brand.wordsToAvoid} empty="Aucun mot interdit défini" /></div>
            <div><div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">Promesses</div><Chips items={brand.promises} empty="Aucune promesse définie" /></div>
            <div><div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">Garanties</div><Chips items={brand.guarantees} empty="Aucune garantie définie" /></div>
          </div>
        </Card>

        <Card>
          <CardHeader icon={<FolderOpen className="h-[18px] w-[18px]" />} title="Catalogue détecté" />
          <div className="space-y-3">
            <div><div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">Collections principales</div><Chips items={brand.collections} empty="Lancez un scan pour détecter vos collections" /></div>
            <div><div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">Types de produits</div><Chips items={brand.productTypes} empty="Aucun type détecté" /></div>
          </div>
        </Card>

        <Card>
          <CardHeader icon={<Tag className="h-[18px] w-[18px]" />} title="SEO & mots-clés" />
          <div className="space-y-3">
            <div><div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">Mots-clés principaux</div><Chips items={brand.primaryKeywords} empty="Aucun mot-clé principal" /></div>
            <div><div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">Mots-clés secondaires</div><Chips items={brand.secondaryKeywords} empty="Aucun mot-clé secondaire" /></div>
          </div>
        </Card>

        <Card>
          <CardHeader icon={<Users className="h-[18px] w-[18px]" />} title="Concurrents" />
          <Chips items={brand.competitors} empty="Aucun concurrent renseigné" />
        </Card>

        <Card>
          <CardHeader icon={<ShieldCheck className="h-[18px] w-[18px]" />} title="Règles SEO & style" />
          <div className="space-y-3">
            <div><div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">Règles SEO</div><Chips items={brand.seoRules} empty="Règles par défaut Orkestra appliquées" /></div>
            <div><div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">Règles de style</div><Chips items={brand.styleRules} empty="Style aligné sur le ton de marque" /></div>
          </div>
        </Card>

        {analysis && analysis.issues.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader icon={<AlertTriangle className="h-[18px] w-[18px]" />} title="Problèmes détectés" subtitle="Issus de la dernière analyse de votre boutique" />
            <div className="grid gap-2 sm:grid-cols-2">
              {analysis.issues.map((issue, i) => (
                <div key={i} className="rounded-xl border border-[var(--border)] p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{issue.area}</span>
                    <Badge tone={SEV_TONE[issue.severity]}>{issue.severity}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{issue.explanation}</p>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <Link href="/council?mode=seo&q=Fais une analyse compl%C3%A8te de ma boutique avec les corrections prioritaires.">
                <Button variant="secondary" size="sm" icon={<Sparkles className="h-3.5 w-3.5" />}>Voir la review complète dans AI Council</Button>
              </Link>
            </div>
          </Card>
        )}

        {analysis?.priorityProducts && analysis.priorityProducts.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader icon={<Tag className="h-[18px] w-[18px]" />} title="Produits prioritaires à optimiser" subtitle="Triés par score de contenu (products.json)" />
            <div className="grid gap-2 sm:grid-cols-2">
              {analysis.priorityProducts.map((p, i) => (
                <div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{p.title}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                      <Badge tone={p.contentScore < 40 ? "bad" : p.contentScore < 70 ? "warn" : "good"}>contenu {p.contentScore}</Badge>
                      <span className="truncate">{p.reason}</span>
                    </div>
                  </div>
                  <Link href="/seo" className="shrink-0">
                    <Button variant="ghost" size="sm" icon={<Sparkles className="h-3.5 w-3.5" />}>Optimiser</Button>
                  </Link>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </>
  );
}

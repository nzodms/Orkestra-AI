"use client";

import { useState } from "react";
import { DemoBadge } from "@/components/lens/atoms";
import { ProductOpportunityCard, AIFixPreview } from "@/components/lens/blocks";
import { SectionTabs, PRODUCT_STUDIO_TABS } from "@/components/lens/SectionTabs";
import { CouncilCTA } from "@/components/lens/CouncilCTA";
import { PRODUCTS, euro } from "@/lib/lens-mock";
import { Boxes, FileWarning, Languages, ImageOff, Download, AlertCircle, ArrowRight, Sparkles } from "lucide-react";

function MiniStat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="card flex items-center gap-3 p-3.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300">
        {icon}
      </span>
      <div>
        <div className="text-lg font-bold leading-none tracking-tight text-[var(--text)]">{value}</div>
        <div className="mt-1 text-[11px] text-[var(--text-muted)]">{label}</div>
      </div>
    </div>
  );
}

export default function ProductStudio() {
  const [selected, setSelected] = useState(PRODUCTS[0].id);
  const product = PRODUCTS.find((p) => p.id === selected) ?? PRODUCTS[0];
  const totalUplift = PRODUCTS.reduce((s, p) => s + p.uplift, 0);

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-300">
          Product Studio
        </div>
        <SectionTabs tabs={PRODUCT_STUDIO_TABS} />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <DemoBadge />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">Optimisez vos fiches produit</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Fiches faibles d’abord. Aperçu avant/après, puis export CSV prêt pour Shopify.
          </p>
        </div>
        <button className="btn-ghost shrink-0">
          <Download className="h-4 w-4" /> Exporter CSV Shopify
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat icon={<FileWarning className="h-[18px] w-[18px]" />} value="12" label="Fiches faibles" />
        <MiniStat icon={<AlertCircle className="h-[18px] w-[18px]" />} value="8" label="Meta manquantes" />
        <MiniStat icon={<Languages className="h-[18px] w-[18px]" />} value="4" label="Textes anglais" />
        <MiniStat icon={<ImageOff className="h-[18px] w-[18px]" />} value="7" label="Images sans alt" />
      </div>

      {/* Potentiel cumulé */}
      <div className="glass-card ork-sheen ork-glow-pulse flex items-center gap-3 p-4">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-600 dark:bg-teal-900/40 dark:text-teal-300">
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-[var(--text)]">
            Potentiel cumulé : <span className="text-teal-600 dark:text-teal-400">+{euro(totalUplift)}/mois</span>
          </p>
          <p className="text-xs text-[var(--text-muted)]">en corrigeant les {PRODUCTS.length} fiches prioritaires ci-dessous.</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Liste produits */}
        <div className="space-y-3 lg:col-span-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
            <Boxes className="h-4 w-4 text-brand-500" /> Fiches à fort potentiel
          </div>
          {PRODUCTS.map((p) => (
            <ProductOpportunityCard key={p.id} p={p} active={p.id === selected} onClick={() => setSelected(p.id)} />
          ))}
        </div>

        {/* Détail / aperçu IA */}
        <div className="space-y-4 lg:col-span-7">
          <AIFixPreview p={product} />

          <div className="card p-5">
            <h3 className="text-sm font-semibold text-[var(--text)]">Ce que l’IA va corriger</h3>
            <div className="mt-3 space-y-2">
              {product.issues.map((iss) => (
                <div key={iss} className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300">
                    <AlertCircle className="h-3.5 w-3.5" />
                  </span>
                  <span className="flex-1 text-sm text-[var(--text)]">{iss}</span>
                  <ArrowRight className="h-4 w-4 text-ink-300" />
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-[var(--text-muted)]">
              Aucune promesse non vérifiable n’est ajoutée — le texte reste descriptif et factuel (compatible Merchant Center).
            </p>
          </div>

          <CouncilCTA
            mode="seo"
            label="Générer cette fiche avec AI Council"
            hint="Titre, meta, description, FAQ et alt text prêts à copier — puis export CSV Shopify."
            prompt={`Optimise la fiche produit « ${product.title} » : titre SEO, meta description, description longue, FAQ et alt text prêts à copier. Reste descriptif et factuel (compatible Merchant Center).`}
          />
        </div>
      </div>
    </div>
  );
}

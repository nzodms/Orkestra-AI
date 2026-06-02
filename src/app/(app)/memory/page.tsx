"use client";

import { useOrkestra } from "@/lib/store";
import { PageHeader, Card, CardHeader, Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import {
  Brain, Store, Tag, FolderOpen, Palette, ShieldCheck, Link2, Users, Globe, Sparkles,
} from "lucide-react";

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
  const { brand } = useOrkestra();

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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader icon={<Store className="h-[18px] w-[18px]" />} title="Identité" />
          <div className="divide-y divide-[var(--border)]">
            <Row label="Nom de marque" value={brand.storeName} />
            <Row label="URL Shopify" value={brand.shopifyUrl} />
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
      </div>
    </>
  );
}

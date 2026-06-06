"use client";

import { useRef, useState } from "react";
import { Card, CardHeader, Badge, ScoreRing, EmptyState } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { riskMeta } from "@/lib/supplier-score";
import type { LensAnalysis, SupplierResult, SupplierSearchMethod, SearchLink } from "@/lib/lens-store";
import {
  Upload, Link2, ScanLine, ImageIcon, Sparkles, Star, Truck, Package, ExternalLink,
  Bookmark, GitCompare, ArrowRight, Check, Store, Info, Copy, ShoppingBag, Search,
} from "lucide-react";

// Visuel placeholder déterministe (V1 : pas d'image fournisseur réelle).
function Thumb({ hue, label, src, className }: { hue: number; label?: string; src?: string; className?: string }) {
  if (src) return <img src={src} alt={label || ""} className={className} />;
  return (
    <div
      className={className}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 70% 86%), hsl(${(hue + 40) % 360} 70% 70%))` }}
    >
      <div className="grid h-full w-full place-items-center text-white/90">
        <ShoppingBag className="h-7 w-7" />
      </div>
    </div>
  );
}

// ── 1. Uploader (action principale) ─────────────────────────────────────────
export function LensUploader({ onImage, busy }: { onImage: (dataUrl: string) => void; busy: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  function read(file: File) {
    if (!file.type.startsWith("image/")) return;
    const r = new FileReader();
    r.onload = () => onImage(String(r.result));
    r.readAsDataURL(file);
  }
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) read(f); }}
      className={`relative grid place-items-center rounded-3xl border-2 border-dashed px-6 py-16 text-center transition-all ${drag ? "border-brand-400 bg-brand-50/60 dark:bg-brand-950/40" : "border-[var(--border)] bg-[var(--surface)] hover:border-brand-300"}`}
    >
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) read(f); }} />
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-soft">
        <ImageIcon className="h-8 w-8" />
      </div>
      <h2 className="mt-5 text-xl font-bold text-[var(--text)]">Importer une image</h2>
      <p className="mt-1.5 max-w-sm text-sm text-[var(--text-muted)]">
        Glissez une photo de produit, ou cliquez pour parcourir. Orkestra identifie le produit et trouve des fournisseurs similaires.
      </p>
      <Button size="lg" className="mt-5" loading={busy} onClick={() => inputRef.current?.click()} icon={<Upload className="h-4 w-4" />}>
        Choisir une image
      </Button>
    </div>
  );
}

// ── 2. Entrées secondaires : URL image / URL produit ────────────────────────
export function LensUrlInput({ onImageUrl, onProductUrl, busy }: { onImageUrl: (u: string) => void; onProductUrl: (u: string) => void; busy: boolean }) {
  const [img, setImg] = useState("");
  const [prod, setProd] = useState("");
  return (
    <Card>
      <CardHeader title="Coller une URL" subtitle="Image directe ou page produit (fournisseur, concurrent, Shopify, Alibaba…)" icon={<Link2 className="h-5 w-5" />} />
      <div className="space-y-3">
        <div className="flex gap-2">
          <input className="input flex-1" placeholder="https://…/image.jpg" value={img} onChange={(e) => setImg(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && img.trim()) onImageUrl(img.trim()); }} />
          <Button variant="outline" disabled={busy || !img.trim()} onClick={() => onImageUrl(img.trim())} icon={<ImageIcon className="h-4 w-4" />}>Image</Button>
        </div>
        <div className="flex gap-2">
          <input className="input flex-1" placeholder="https://…/produit" value={prod} onChange={(e) => setProd(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && prod.trim()) onProductUrl(prod.trim()); }} />
          <Button variant="outline" disabled={busy || !prod.trim()} onClick={() => onProductUrl(prod.trim())} icon={<Link2 className="h-4 w-4" />}>Produit</Button>
        </div>
      </div>
    </Card>
  );
}

// ── 3. Guide du clipper (V1 : bookmarklet « envoyer cette page ») ────────────
export function LensClipperGuide({ origin }: { origin: string }) {
  const [copied, setCopied] = useState(false);
  const bookmarklet =
    `javascript:(function(){if(window.__orkestraClipper){return;}window.__orkBase=${JSON.stringify(origin)};var s=document.createElement('script');s.src=${JSON.stringify(origin)}+'/clipper.js?v=4';s.onerror=function(){alert('Ce site bloque le clipper Orkestra (sécurité de la page). Essayez l\\'extension Orkestra, ou importez l\\'image manuellement dans Orkestra Lens.');};(document.body||document.documentElement).appendChild(s);})();`;
  const steps = [
    "La page passe en mode sélection (overlay sombre léger).",
    "Tracez un rectangle autour du produit (ou cliquez dessus).",
    "« Analyser cette zone » : Orkestra prend l'image de la zone.",
    "Orkestra Lens s'ouvre et lance l'analyse multi-IA.",
  ];
  return (
    <Card>
      <CardHeader title="Clipper Orkestra — sélection de zone" subtitle="Sélectionnez un produit sur n'importe quelle page web" icon={<ScanLine className="h-5 w-5" />} action={<Badge tone="brand">Bêta</Badge>} />
      <p className="text-sm text-[var(--text-muted)]">
        Glissez ce bouton dans votre barre de favoris, puis cliquez-le sur une page produit : un outil de sélection visuelle (type Alibaba Lens) s'ouvre pour entourer le produit et l'envoyer à Orkestra Lens.
        Pour une capture pixel exacte de la zone, l'extension locale est disponible (dossier <code>/extension/orkestra-clipper</code>).
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href={bookmarklet} onClick={(e) => e.preventDefault()} draggable className="inline-flex h-10 cursor-grab items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium text-[var(--text)]" title="Glissez-moi dans la barre de favoris">
          <Bookmark className="h-4 w-4 text-brand-600" /> Clipper Orkestra
        </a>
        <Button variant="ghost" size="sm" icon={copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} onClick={() => { navigator.clipboard?.writeText(bookmarklet); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
          {copied ? "Copié" : "Copier le code"}
        </Button>
      </div>
      <ol className="mt-4 space-y-1.5">
        {steps.map((s, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-[var(--text-muted)]">
            <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-brand-50 text-[10px] font-bold text-brand-600 dark:bg-brand-950 dark:text-brand-300">{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>
    </Card>
  );
}

// ── 4. Carte d'analyse de l'image ───────────────────────────────────────────
export function LensAnalysisCard({ analysis, preview }: { analysis: LensAnalysis; preview?: string }) {
  const kw = [...analysis.keywordsFr, ...analysis.keywordsEn];
  return (
    <Card>
      <CardHeader
        title="Produit analysé"
        subtitle={analysis.summary || "Type, niche et mots-clés détectés"}
        icon={<Sparkles className="h-5 w-5" />}
        action={analysis.engine === "gemini" ? <Badge tone="good">Analyse Gemini</Badge> : analysis.engine === "openai" ? <Badge tone="good">Analyse OpenAI</Badge> : <Badge tone="warn">Analyse simulée</Badge>}
      />
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="h-36 w-36 shrink-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-ink-50 dark:bg-ink-900">
          {preview ? <img src={preview} alt={analysis.productType} className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center text-[var(--text-muted)]"><ImageIcon className="h-8 w-8" /></div>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold text-[var(--text)]">{analysis.productType}</span>
            <Badge tone="brand">{analysis.niche}</Badge>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-3">
            {([["Style", analysis.style], ["Couleur", analysis.color], ["Matière", analysis.material], ["Forme", analysis.form], ["Usage", analysis.usage]] as const)
              .filter(([, v]) => v)
              .map(([k, v]) => (<div key={k}><dt className="text-[var(--text-muted)]">{k}</dt><dd className="font-medium text-[var(--text)]">{v}</dd></div>))}
          </dl>
          {kw.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {kw.slice(0, 10).map((k, i) => <Badge key={i} tone="neutral">{k}</Badge>)}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// ── 5. Carte résultat fournisseur ───────────────────────────────────────────
function SupplierCard({ r, selected, onToggle, onSend, onSave, saved }: {
  r: SupplierResult; selected: boolean; onToggle: () => void; onSend: () => void; onSave: () => void; saved: boolean;
}) {
  const risk = riskMeta(r.riskLevel);
  return (
    <Card className={`flex flex-col gap-3 transition-shadow ${selected ? "ring-2 ring-brand-400" : ""}`}>
      <div className="flex gap-3">
        <Thumb hue={r.hue} src={r.imageUrl} label={r.title} className="h-20 w-20 shrink-0 overflow-hidden rounded-xl object-cover" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge tone="neutral">{r.source}</Badge>
            {r.simulated && <Badge tone="warn">Simulé</Badge>}
          </div>
          <p className="mt-1 line-clamp-2 text-sm font-medium text-[var(--text)]">{r.title}</p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">{r.supplierName || "Vendeur non communiqué"}{r.location ? ` · ${r.location}` : ""}</p>
        </div>
        <ScoreRing value={r.supplierScore} size={56} label="Orkestra" />
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
        <div className="flex items-center gap-1.5 text-[var(--text)]"><Package className="h-3.5 w-3.5 text-[var(--text-muted)]" /> {r.price || "Prix non disponible"}</div>
        {r.moq && <div className="flex items-center gap-1.5 text-[var(--text-muted)]">MOQ : {r.moq}</div>}
        {typeof r.supplierRating === "number" && <div className="flex items-center gap-1.5 text-[var(--text)]"><Star className="h-3.5 w-3.5 text-amber-500" /> {r.supplierRating} {r.reviewCount ? <span className="text-[var(--text-muted)]">({r.reviewCount})</span> : null}</div>}
        {r.shippingInfo && <div className="flex items-center gap-1.5 text-[var(--text-muted)]"><Truck className="h-3.5 w-3.5" /> {r.shippingInfo}</div>}
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--text-muted)]">Similarité {r.similarityScore}%</span>
        <Badge tone={risk.tone}>{risk.label}</Badge>
      </div>
      <p className="text-[11px] text-[var(--text-muted)]">{r.reasons.join(", ")}</p>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        <Button size="sm" onClick={onSend} icon={<ArrowRight className="h-3.5 w-3.5" />}>Envoyer vers Import Factory</Button>
        <Button size="sm" variant="outline" onClick={onToggle} icon={<GitCompare className="h-3.5 w-3.5" />}>{selected ? "Retirer" : "Comparer"}</Button>
        <Button size="sm" variant="ghost" onClick={onSave} icon={<Bookmark className={`h-3.5 w-3.5 ${saved ? "fill-brand-500 text-brand-600" : ""}`} />}>{saved ? "Sauvegardé" : "Sauvegarder"}</Button>
        <a href={r.productUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)]"><ExternalLink className="h-3.5 w-3.5" /> Source</a>
      </div>
    </Card>
  );
}

// ── 6a. Recherches fournisseur prêtes (toujours disponibles) ─────────────────
export function SearchLinks({ links }: { links: SearchLink[] }) {
  if (!links.length) return null;
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Search className="h-4 w-4 text-brand-600" />
        <h3 className="text-sm font-semibold text-[var(--text)]">Recherches prêtes</h3>
        <span className="text-xs text-[var(--text-muted)]">Vous verrez les vrais prix / MOQ directement sur la source</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {links.map((l) => (
          <Card key={l.source} className="flex flex-col gap-2 p-4">
            <Badge tone="brand">{l.source}</Badge>
            <p className="text-xs text-[var(--text)]"><span className="font-semibold text-emerald-600">＋</span> {l.advantage}</p>
            <p className="text-xs text-[var(--text-muted)]"><span className="font-semibold text-amber-600">－</span> {l.limit}</p>
            <a href={l.url} target="_blank" rel="noopener noreferrer" className="mt-auto block">
              <Button size="sm" variant="outline" className="w-full" icon={<ExternalLink className="h-3.5 w-3.5" />}>Ouvrir {l.source}</Button>
            </a>
          </Card>
        ))}
      </div>
    </div>
  );
}

const METHOD_BANNER: Record<SupplierSearchMethod, { text: string; cls: string }> = {
  structured: { text: "Résultats fournisseurs structurés — à vérifier avant achat (fournisseur, qualité, conditions).", cls: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300" },
  "multi-ai-search": { text: "Recherche multi-IA — résultats web assistés par IA. Les prix / MOQ / notes ne sont pas garantis : à vérifier sur la source.", cls: "border-brand-200 bg-brand-50 text-brand-800 dark:border-brand-900/60 dark:bg-brand-950/40 dark:text-brand-200" },
  assisted: { text: "Recherche assistée — ouvrez les recherches préremplies ci-dessus. Les fiches ci-dessous sont des exemples simulés.", cls: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300" },
  simulated: { text: "Résultats simulés — source réelle non connectée. À vérifier avant achat.", cls: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300" },
};

// ── 6b. Grille de résultats ──────────────────────────────────────────────────
export function SupplierResults({ results, selected, onToggle, onSend, onSave, savedIds, method }: {
  results: SupplierResult[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSend: (r: SupplierResult) => void;
  onSave: (r: SupplierResult) => void;
  savedIds: Set<string>;
  method: SupplierSearchMethod;
}) {
  if (!results.length) return <EmptyState icon={<Store className="h-6 w-6" />} title="Aucun résultat" description="Réessayez avec une autre image, d'autres mots-clés ou une URL plus précise." />;
  const banner = METHOD_BANNER[method];
  return (
    <div>
      <div className={`mb-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${banner.cls}`}>
        <Info className="h-4 w-4 shrink-0" /> {banner.text}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {results.map((r) => (
          <SupplierCard key={r.id} r={r} selected={selected.has(r.id)} onToggle={() => onToggle(r.id)} onSend={() => onSend(r)} onSave={() => onSave(r)} saved={savedIds.has(r.id)} />
        ))}
      </div>
    </div>
  );
}

// ── 7. Comparaison (2 à 4 résultats) ────────────────────────────────────────
export function SupplierComparison({ results, onSend }: { results: SupplierResult[]; onSend: (r: SupplierResult) => void }) {
  if (results.length < 2) return null;
  const best = results.reduce((a, b) => (b.supplierScore > a.supplierScore ? b : a), results[0]);
  const rows: { k: string; get: (r: SupplierResult) => React.ReactNode }[] = [
    { k: "Source", get: (r) => r.source },
    { k: "Prix", get: (r) => r.price || "non disponible" },
    { k: "MOQ", get: (r) => r.moq || "non disponible" },
    { k: "Note", get: (r) => (typeof r.supplierRating === "number" ? `${r.supplierRating} (${r.reviewCount ?? 0})` : "non disponible") },
    { k: "Variantes", get: (r) => r.variants?.length ?? 0 },
    { k: "Livraison", get: (r) => r.shippingInfo || "non disponible" },
    { k: "Similarité", get: (r) => `${r.similarityScore}%` },
    { k: "Score Orkestra", get: (r) => <span className="font-semibold">{r.supplierScore}/100</span> },
  ];
  return (
    <Card>
      <CardHeader title="Comparaison" subtitle="Le meilleur choix Orkestra est mis en avant" icon={<GitCompare className="h-5 w-5" />} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr>
              <th className="w-32" />
              {results.map((r) => (
                <th key={r.id} className="px-2 pb-2 text-left align-bottom">
                  <Thumb hue={r.hue} src={r.imageUrl} className="mb-1 h-12 w-12 overflow-hidden rounded-lg object-cover" />
                  {r.id === best.id && <Badge tone="good">Meilleur choix</Badge>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.k} className="border-t border-[var(--border)]">
                <td className="py-2 pr-2 text-xs font-medium text-[var(--text-muted)]">{row.k}</td>
                {results.map((r) => <td key={r.id} className={`px-2 py-2 ${r.id === best.id ? "text-[var(--text)]" : "text-[var(--text-muted)]"}`}>{row.get(r)}</td>)}
              </tr>
            ))}
            <tr className="border-t border-[var(--border)]">
              <td />
              {results.map((r) => (
                <td key={r.id} className="px-2 pt-3">
                  <Button size="sm" variant={r.id === best.id ? "primary" : "outline"} onClick={() => onSend(r)} icon={<ArrowRight className="h-3.5 w-3.5" />}>Choisir</Button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}

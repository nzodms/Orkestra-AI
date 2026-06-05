"use client";

import { useRef, useState } from "react";
import { useOrkestra, type ImportPreset, type RecentImport } from "@/lib/store";
import { Card, Badge, EmptyState, Field } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import {
  parseCsv, detectColumns, autoMapColumns, groupProducts, presetRules, PRESETS,
  type ImportRules,
} from "@/lib/import-factory";
import { analyzeExampleCatalog, analysisToRules, type ImportStyleAnalysis } from "@/lib/import-analyze";
import {
  Upload, FileSpreadsheet, Wand2, Sparkles, Star, Copy, Trash2, Pencil, Check, Play, FileText,
  Clock, ArrowRight, ListChecks, AlertTriangle,
} from "lucide-react";

export type ImportTab = "import" | "create" | "presets" | "recent";

export interface UsePresetPayload { rules: ImportRules; collectionsText?: string; profileId?: string; presetId?: string; presetName?: string }

const TABS: { id: ImportTab; label: string; short: string; sub: string; icon: typeof Upload }[] = [
  { id: "import", label: "Importer", short: "Importer", sub: "Importez un CSV ou ajoutez un produit, puis transformez votre catalogue.", icon: Upload },
  { id: "create", label: "Profil d'import", short: "Profil", sub: "Importez un fichier exemple : Orkestra en déduit un profil réutilisable.", icon: Wand2 },
  { id: "presets", label: "Presets", short: "Presets", sub: "Réglages prêts à l'emploi, presets privés et profils créés depuis un exemple.", icon: Star },
  { id: "recent", label: "Historique", short: "Historique", sub: "Vos derniers imports — réutilisez leurs réglages en un clic.", icon: Clock },
];

const STATUS_TONE: Record<RecentImport["status"], "good" | "warn" | "bad" | "neutral"> = { ok: "good", warning: "warn", risk: "bad", failed: "bad" };
const STATUS_LABEL: Record<RecentImport["status"], string> = { ok: "OK", warning: "À améliorer", risk: "À risque", failed: "Bloqué" };

// ── Navigation par onglets (segmented control premium, scrollable sur mobile) ──
export function ImportTabsNav({ tab, setTab, presetCount, recentCount }: { tab: ImportTab; setTab: (t: ImportTab) => void; presetCount: number; recentCount: number }) {
  const sub = TABS.find((t) => t.id === tab)?.sub;
  return (
    <div className="mb-5">
      <div className="ork-segment flex gap-1 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg)] p-1">
        {TABS.map((t) => {
          const I = t.icon;
          const active = tab === t.id;
          const count = t.id === "presets" ? presetCount : t.id === "recent" ? recentCount : 0;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-current={active}
              className={`relative flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ease-out ${active ? "bg-[var(--card)] text-brand-700 shadow-sm dark:text-brand-300" : "text-[var(--text-muted)] hover:text-[var(--text)]"}`}
            >
              <I className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{t.label}</span>
              <span className="sm:hidden">{t.short}</span>
              {count > 0 && <span className={`rounded-full px-1.5 text-[10px] font-bold ${active ? "bg-brand-600 text-white" : "bg-[var(--border)] text-[var(--text-muted)]"}`}>{count}</span>}
            </button>
          );
        })}
      </div>
      {sub && <p className="ork-fade mt-2 px-1 text-xs text-[var(--text-muted)]">{sub}</p>}
    </div>
  );
}

// ── Onglet « Mes presets » (recommandés + privés) ───────────────────────────
export function PresetsTab({ onUseBuiltin, onUsePreset }: { onUseBuiltin: (id: string) => void; onUsePreset: (p: ImportPreset) => void }) {
  const { importPresets, addImportPreset, updateImportPreset, deleteImportPreset, duplicateImportPreset, setDefaultImportPreset } = useOrkestra();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  function duplicateBuiltin(id: string, label: string) {
    addImportPreset({
      id: `pr_${Date.now().toString(36)}`, name: `${label} (copie)`, description: "Copie d'un preset recommandé, personnalisable.",
      origin: "duplicated", builtinId: id, isDefault: false, createdAt: new Date().toISOString(), rules: presetRules(id),
    });
  }

  return (
    <div className="ork-stagger space-y-5">
      <div>
        <h2 className="flex items-center gap-1.5 text-sm font-bold"><Sparkles className="h-4 w-4 text-brand-600" /> Presets recommandés</h2>
        <p className="mt-0.5 text-sm text-[var(--text-muted)]">Réglages prêts à l'emploi, génériques et adaptables à toute boutique.</p>
        <div className="ork-stagger mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PRESETS.map((p) => (
            <Card key={p.id} className="ork-interactive flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold">{p.label}</h3>
                <Badge tone="neutral">recommandé</Badge>
              </div>
              <p className="mt-1 flex-1 text-xs text-[var(--text-muted)]">{p.desc}</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" icon={<Play className="h-3.5 w-3.5" />} onClick={() => onUseBuiltin(p.id)}>Utiliser</Button>
                <Button size="sm" variant="ghost" icon={<Copy className="h-3.5 w-3.5" />} onClick={() => duplicateBuiltin(p.id, p.label)} title="Dupliquer dans mes presets pour le personnaliser">Dupliquer</Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h2 className="flex items-center gap-1.5 text-sm font-bold"><Star className="h-4 w-4 text-brand-600" /> Mes presets</h2>
        <p className="mt-0.5 text-sm text-[var(--text-muted)]">Vos réglages sauvegardés et les profils créés depuis un fichier exemple.</p>
        {importPresets.length === 0 ? (
          <div className="mt-3"><EmptyState icon={<Star className="h-7 w-7" />} title="Aucun preset privé pour l'instant" description="Sauvegardez vos réglages depuis l'onglet « Importer un catalogue », ou créez un profil depuis un fichier exemple." /></div>
        ) : (
          <div className="ork-stagger mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {importPresets.map((p) => (
              <Card key={p.id} className="ork-interactive flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  {editing === p.id ? (
                    <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && draft.trim()) { updateImportPreset(p.id, { name: draft.trim() }); setEditing(null); } if (e.key === "Escape") setEditing(null); }} className="input h-7 py-0 text-sm font-semibold" />
                  ) : (
                    <h3 className="text-sm font-semibold">{p.name}</h3>
                  )}
                  <div className="flex shrink-0 items-center gap-1">
                    {p.isDefault && <Badge tone="brand">par défaut</Badge>}
                    <Badge tone="neutral">{p.origin === "analyzed" ? "depuis exemple" : p.origin === "duplicated" ? "dupliqué" : "privé"}</Badge>
                  </div>
                </div>
                {p.description && <p className="mt-1 text-xs text-[var(--text-muted)]">{p.description}</p>}
                <div className="mt-1.5 flex flex-wrap gap-1 text-[10px] text-[var(--text-muted)]">
                  <span className="rounded bg-[var(--bg)] px-1.5 py-0.5">{p.rules.level}</span>
                  <span className="rounded bg-[var(--bg)] px-1.5 py-0.5">{p.rules.brandNames ? "noms brandés" : "sans nom brandé"}</span>
                  {p.rules.metaSuffix && <span className="rounded bg-[var(--bg)] px-1.5 py-0.5">suffixe meta</span>}
                  {p.rules.internalLinking && <span className="rounded bg-[var(--bg)] px-1.5 py-0.5">maillage</span>}
                </div>
                <div className="mt-3 flex flex-1 flex-wrap items-end gap-1.5">
                  <Button size="sm" icon={<Play className="h-3.5 w-3.5" />} onClick={() => onUsePreset(p)}>Utiliser</Button>
                  {editing === p.id ? (
                    <Button size="sm" variant="ghost" icon={<Check className="h-3.5 w-3.5" />} onClick={() => { if (draft.trim()) updateImportPreset(p.id, { name: draft.trim() }); setEditing(null); }}>OK</Button>
                  ) : (
                    <Button size="sm" variant="ghost" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => { setEditing(p.id); setDraft(p.name); }}>Renommer</Button>
                  )}
                  <Button size="sm" variant="ghost" icon={<Copy className="h-3.5 w-3.5" />} onClick={() => duplicateImportPreset(p.id)}>Dupliquer</Button>
                  {!p.isDefault && <Button size="sm" variant="ghost" icon={<Star className="h-3.5 w-3.5" />} onClick={() => setDefaultImportPreset(p.id)}>Par défaut</Button>}
                  <Button size="sm" variant="ghost" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => { if (confirm(`Supprimer le preset « ${p.name} » ?`)) deleteImportPreset(p.id); }}>Supprimer</Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Onglet « Derniers imports » ─────────────────────────────────────────────
export function RecentImportsTab({ onReuse, setTab }: { onReuse: (r: RecentImport) => void; setTab: (t: ImportTab) => void }) {
  const { recentImports, clearRecentImports } = useOrkestra();
  if (recentImports.length === 0) {
    return <EmptyState icon={<Clock className="h-7 w-7" />} title="Vos derniers imports apparaîtront ici" description="Après votre première transformation, retrouvez ici vos imports pour les relancer en un clic." action={<Button icon={<Upload className="h-4 w-4" />} onClick={() => setTab("import")}>Importer un catalogue</Button>} />;
  }
  return (
    <div className="ork-stagger space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-bold"><Clock className="h-4 w-4 text-brand-600" /> Derniers imports ({recentImports.length})</h2>
        <Button size="sm" variant="ghost" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => { if (confirm("Effacer l'historique des imports ?")) clearRecentImports(); }}>Effacer</Button>
      </div>
      {recentImports.map((r) => (
        <Card key={r.id} className="ork-rise">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-brand-600" />
                <span className="truncate text-sm font-semibold">{r.fileName}</span>
                <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
              </div>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {new Date(r.date).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })} · {r.products} produit(s) · {r.variants} variante(s) · {r.images} image(s)
                {r.presetName ? ` · preset « ${r.presetName} »` : ""}
              </p>
              {(r.warnings > 0 || r.risks > 0 || r.failed > 0) && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {r.warnings > 0 && <Badge tone="warn">{r.warnings} à améliorer</Badge>}
                  {r.risks > 0 && <Badge tone="bad">{r.risks} à risque</Badge>}
                  {r.failed > 0 && <Badge tone="bad">{r.failed} bloqué(s)</Badge>}
                </div>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap gap-1.5">
              <Button size="sm" icon={<ArrowRight className="h-3.5 w-3.5" />} onClick={() => onReuse(r)}>Réutiliser ces réglages</Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── Onglet « Créer un profil d'import » (depuis un CSV exemple) ──────────────
export function CreateProfileTab({ onSaved, onUseRules, profileId }: { onSaved: () => void; onUseRules: (p: UsePresetPayload) => void; profileId: string }) {
  const { addImportPreset } = useOrkestra();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ImportStyleAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  function read(file: File) {
    setError(null);
    if (!/\.csv$/i.test(file.name)) { setError("Importez un fichier .csv exemple."); return; }
    file.text().then((text) => {
      const all = parseCsv(text);
      if (all.length < 2) { setError("CSV vide ou illisible."); return; }
      const headers = all[0];
      const rows = all.slice(1);
      const det = detectColumns(headers);
      const map = det.isShopify ? det.map : autoMapColumns(headers);
      const groups = groupProducts(rows, map);
      if (!groups.length) { setError("Aucun produit détecté dans ce fichier."); return; }
      const a = analyzeExampleCatalog(headers, rows, map, groups);
      setAnalysis(a);
      setName(a.suggestedPresetLabel);
      setFileName(file.name);
    });
  }
  function buildRules(): ImportRules { return analysisToRules(analysis!, presetRules(analysis!.suggestedPresetId)); }
  function save(use: boolean) {
    if (!analysis) return;
    const rules = buildRules();
    const collectionsText = analysis.collections.join("\n");
    const preset: ImportPreset = {
      id: `pr_${Date.now().toString(36)}`, name: name.trim() || analysis.suggestedPresetLabel, description: desc.trim() || `Profil créé depuis ${fileName ?? "un fichier exemple"}`,
      origin: "analyzed", profileId, isDefault: false, createdAt: new Date().toISOString(), rules, collectionsText, analysis,
    };
    addImportPreset(preset);
    if (use) onUseRules({ rules, collectionsText, profileId, presetId: preset.id, presetName: preset.name });
    else onSaved();
  }

  return (
    <div className="ork-stagger space-y-5">
      <Card className="ork-rise overflow-hidden border-brand-200 bg-gradient-to-br from-brand-50 to-transparent dark:border-brand-900 dark:from-brand-950/40">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-600 text-white"><Wand2 className="h-6 w-6" /></span>
          <div>
            <h2 className="text-base font-bold">Créez un profil d'import depuis un fichier exemple</h2>
            <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">Importez un CSV de produits déjà bien optimisés. Orkestra analyse le style (titres, descriptions, meta, variantes, tags, alt, collections) et crée un preset réutilisable — pour reproduire ce style sur vos prochains imports.</p>
          </div>
        </div>
      </Card>

      <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) read(f); e.target.value = ""; }} />

      {!analysis ? (
        <Card>
          <div onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) read(f); }} className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--border)] px-6 py-12 text-center transition hover:border-brand-300">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300"><FileSpreadsheet className="h-7 w-7" /></span>
            <h3 className="mt-4 text-sm font-semibold">Glissez un CSV exemple ici</h3>
            <p className="mt-1 text-xs text-[var(--text-muted)]">1 produit suffit · export Shopify ou CSV produit · aucune donnée n'est envoyée à un serveur pour l'analyse</p>
            <Button className="mt-4" size="sm" icon={<Upload className="h-3.5 w-3.5" />}>Choisir un fichier</Button>
          </div>
          {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950/30">{error}</p>}
        </Card>
      ) : (
        <>
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-1.5 text-sm font-bold"><ListChecks className="h-4 w-4 text-brand-600" /> Style détecté</h3>
              <Badge tone="brand"><Sparkles className="h-3 w-3" /> {analysis.suggestedPresetLabel}</Badge>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {analysis.summary.map((l, i) => (
                <div key={i} className="flex items-start gap-2 rounded-lg bg-[var(--bg)] px-3 py-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{l.label}</span>
                  <span className="ml-auto text-right text-xs text-[var(--text-muted)]">{l.value}</span>
                </div>
              ))}
            </div>
            {analysis.unitsInch && <p className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-300"><AlertTriangle className="h-3 w-3" /> Dimensions en pouces détectées : la conversion en cm sera activée.</p>}
          </Card>

          <Card>
            <h3 className="flex items-center gap-1.5 text-sm font-bold"><Pencil className="h-4 w-4 text-brand-600" /> Nommez votre profil d'import</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Nom du preset"><input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Ex : Style boutique principale" /></Field>
              <Field label="Description courte (optionnelle)"><input value={desc} onChange={(e) => setDesc(e.target.value)} className="input" placeholder="Ex : Fiches longues avec FAQ et noms brandés" /></Field>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button icon={<Check className="h-4 w-4" />} onClick={() => save(false)}>Sauvegarder ce profil d'import</Button>
              <Button variant="outline" icon={<ArrowRight className="h-4 w-4" />} onClick={() => save(true)}>Sauvegarder et utiliser maintenant</Button>
              <Button variant="ghost" icon={<Upload className="h-4 w-4" />} onClick={() => { setAnalysis(null); setFileName(null); }}>Analyser un autre fichier</Button>
            </div>
            <p className="mt-2 text-[11px] text-[var(--text-muted)]">Le preset apparaîtra dans « Mes presets » et dans le flux « Importer un catalogue ». Vous pourrez le modifier à tout moment.</p>
          </Card>
        </>
      )}
    </div>
  );
}

// ── Carte « Reprendre le dernier import » (onglet Importer) ──────────────────
export function ResumeLastImportCard({ last, onResume, setTab }: { last: RecentImport; onResume: (r: RecentImport) => void; setTab: (t: ImportTab) => void }) {
  return (
    <Card className="ork-rise border-brand-200 bg-gradient-to-br from-brand-50/70 to-transparent dark:border-brand-900 dark:from-brand-950/30">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-600 text-white"><Clock className="h-5 w-5" /></span>
          <div>
            <h3 className="text-sm font-semibold">Reprendre les réglages du dernier import ?</h3>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">{last.fileName} · {last.products} produit(s){last.presetName ? ` · preset « ${last.presetName} »` : ""}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button size="sm" icon={<Check className="h-3.5 w-3.5" />} onClick={() => onResume(last)}>Reprendre les mêmes réglages</Button>
          <Button size="sm" variant="ghost" icon={<Star className="h-3.5 w-3.5" />} onClick={() => setTab("presets")}>Partir d'un preset</Button>
        </div>
      </div>
    </Card>
  );
}

// ── Modal « Sauvegarder les réglages comme preset » ─────────────────────────
export function SavePresetModal({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (name: string, desc: string) => void }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <Card className="ork-rise w-full max-w-md" >
        <div onClick={(e) => e.stopPropagation()}>
          <h3 className="flex items-center gap-1.5 text-sm font-bold"><Star className="h-4 w-4 text-brand-600" /> Sauvegarder ces réglages comme preset</h3>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Réutilisez ce style d'import en un clic lors de vos prochains catalogues.</p>
          <div className="mt-3 space-y-3">
            <Field label="Nom du preset"><input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Ex : Import fournisseur déco" /></Field>
            <Field label="Description courte (optionnelle)"><input value={desc} onChange={(e) => setDesc(e.target.value)} className="input" placeholder="Ex : Réécriture complète, tags riches, cm" /></Field>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>Annuler</Button>
            <Button size="sm" icon={<Check className="h-3.5 w-3.5" />} disabled={!name.trim()} onClick={() => { onSave(name.trim(), desc.trim()); setName(""); setDesc(""); }}>Sauvegarder</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

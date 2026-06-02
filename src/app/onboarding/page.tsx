"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useOrkestra, connectedProviders } from "@/lib/store";
import { PROVIDER_ORDER } from "@/lib/providers";
import { buildDetectedProfile, buildAnalysis } from "@/lib/store-profile";
import { ProviderCard } from "@/components/ProviderCard";
import { Button } from "@/components/ui/Button";
import { Field, Badge } from "@/components/ui/primitives";
import type { Positioning } from "@/lib/types";
import Link from "next/link";
import { scoreTone } from "@/lib/utils";
import type { ModuleId } from "@/lib/types";
import { Sparkles, Check, ArrowRight, ArrowLeft, Store, Palette, Plug, ScanSearch, Eye, Lock, Globe, Wrench } from "lucide-react";

const MODULE_ROUTE: Record<ModuleId, string> = {
  dashboard: "/dashboard", seo: "/seo", sections: "/sections", council: "/council",
  merchant: "/merchant", assistant: "/assistant", memory: "/memory", history: "/history", settings: "/settings",
};
const SEV_TONE: Record<string, "bad" | "warn" | "neutral"> = { critique: "bad", important: "warn", mineur: "neutral" };

const STEPS = [
  { id: 1, label: "Boutique", icon: Store },
  { id: 2, label: "Ton de marque", icon: Palette },
  { id: 3, label: "Connexion IA", icon: Plug },
  { id: 4, label: "Scan Shopify", icon: ScanSearch },
];

const POSITIONINGS: { id: Positioning; label: string }[] = [
  { id: "premium", label: "Premium" },
  { id: "accessible", label: "Accessible" },
  { id: "luxe", label: "Luxe" },
  { id: "expert", label: "Expert" },
  { id: "familial", label: "Familial" },
  { id: "ecoresponsable", label: "Éco-responsable" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { brand, updateBrand, connections, setOnboardingComplete, setStoreScanned, setAnalysis, analysis } = useOrkestra();
  const [step, setStep] = useState(1);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const connected = connectedProviders(connections);

  function next() {
    setStep((s) => Math.min(4, s + 1));
  }
  function prev() {
    setStep((s) => Math.max(1, s - 1));
  }

  function fallbackSimulation(message: string) {
    const detected = buildDetectedProfile(brand);
    updateBrand(detected);
    setAnalysis(buildAnalysis({ ...brand, ...detected }, "simulation"));
    setScanError(message);
  }

  async function runScan() {
    setScanning(true);
    setScanError(null);
    try {
      // Crawl public RÉEL de l'URL storefront (vue visiteur, sans API Shopify).
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: brand.publicUrl,
          niche: brand.niche,
          brandName: brand.storeName,
          language: brand.language,
          positioning: brand.positioning,
          country: brand.country,
        }),
      });
      const data = await res.json();
      if (data.ok && data.analysis) {
        if (data.profile) updateBrand(data.profile);
        setAnalysis(data.analysis);
        if (data.analysis.partial) {
          setScanError("Scan public partiel — certaines pages n'ont pas pu être analysées.");
        }
      } else {
        fallbackSimulation(
          (data.error ? data.error + " " : "") +
            "Analyse simulée à partir de vos informations. Vous pourrez relancer un scan public plus tard."
        );
      }
    } catch {
      fallbackSimulation("Scan public indisponible (réseau). Analyse simulée à partir de vos informations.");
    } finally {
      setStoreScanned(true);
      setScanned(true);
      setScanning(false);
    }
  }

  function finish() {
    setOnboardingComplete(true);
    router.push("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      <header className="mx-auto flex w-full max-w-3xl items-center gap-2.5 px-5 py-6">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
          <Sparkles className="h-5 w-5" />
        </div>
        <span className="text-base font-bold">Orkestra AI</span>
      </header>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-5 pb-16 pt-2">
        {/* Stepper */}
        <div className="mb-8 flex items-center justify-between">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const done = step > s.id;
            const active = step === s.id;
            return (
              <div key={s.id} className="flex flex-1 items-center">
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={`grid h-10 w-10 place-items-center rounded-xl border transition-all duration-300 ${
                      done
                        ? "border-brand-600 bg-brand-600 text-white"
                        : active
                        ? "scale-110 border-brand-400 bg-brand-50 text-brand-600 ring-4 ring-brand-500/15 dark:bg-brand-950"
                        : "border-[var(--border)] text-ink-400"
                    }`}
                  >
                    {done ? <Check key="done" className="h-5 w-5 animate-pop" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <span className={`text-xs transition-colors ${active ? "font-semibold text-[var(--text)]" : "text-[var(--text-muted)]"}`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="mx-2 h-0.5 flex-1 overflow-hidden rounded bg-[var(--border)]">
                    <div className={`h-full rounded bg-brand-600 transition-all duration-500 ${step > s.id ? "w-full" : "w-0"}`} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="card p-6 sm:p-8">
          {/* Step 1 */}
          {step === 1 && (
            <div className="space-y-5 animate-step-in">
              <div>
                <h2 className="text-xl font-bold">Parlez-nous de votre boutique</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  Ces informations nourrissent la mémoire boutique utilisée dans toutes vos générations.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nom de la boutique">
                  <input className="input" value={brand.storeName} onChange={(e) => updateBrand({ storeName: e.target.value })} placeholder="Nom de votre boutique" />
                </Field>
                <Field label="URL Shopify">
                  <input className="input" value={brand.shopifyUrl} onChange={(e) => updateBrand({ shopifyUrl: e.target.value })} placeholder="maboutique.myshopify.com" />
                </Field>
                <Field label="Niche">
                  <input className="input" value={brand.niche} onChange={(e) => updateBrand({ niche: e.target.value })} placeholder="Ex : luminaires, mode, beauté, accessoires…" />
                </Field>
                <Field label="Pays / langue cible">
                  <input className="input" value={brand.country} onChange={(e) => updateBrand({ country: e.target.value })} placeholder="Ex : France · Français" />
                </Field>
              </div>
              <Field label="Positionnement">
                <div className="flex flex-wrap gap-2">
                  {POSITIONINGS.map((p) => {
                    const sel = brand.positioning === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => updateBrand({ positioning: p.id })}
                        className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-medium transition-all duration-200 hover:-translate-y-0.5 active:scale-95 ${
                          sel
                            ? "scale-[1.03] border-brand-500 bg-brand-50 text-brand-700 shadow-soft dark:bg-brand-950 dark:text-brand-300"
                            : "border-[var(--border)] text-[var(--text-muted)] hover:border-brand-300"
                        }`}
                      >
                        {sel && <Check className="h-3.5 w-3.5 animate-pop" />}
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="space-y-5 animate-step-in">
              <div>
                <h2 className="text-xl font-bold">Votre ton de marque</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  Orkestra rédigera tous vos contenus dans cette voix.
                </p>
              </div>
              <Field label="Style rédactionnel">
                <input className="input" value={brand.writingStyle} onChange={(e) => updateBrand({ writingStyle: e.target.value })} placeholder="Clair, inspirant, orienté bénéfices" />
              </Field>
              <Field label="Niveau de formalité">
                <div className="flex gap-2">
                  {(["tutoiement", "vouvoiement"] as const).map((f) => {
                    const sel = brand.formality === f;
                    return (
                      <button
                        key={f}
                        onClick={() => updateBrand({ formality: f })}
                        className={`inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-medium capitalize transition-all duration-200 hover:-translate-y-0.5 active:scale-95 ${
                          sel
                            ? "scale-[1.03] border-brand-500 bg-brand-50 text-brand-700 shadow-soft dark:bg-brand-950 dark:text-brand-300"
                            : "border-[var(--border)] text-[var(--text-muted)] hover:border-brand-300"
                        }`}
                      >
                        {sel && <Check className="h-3.5 w-3.5 animate-pop" />}
                        {f}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Mots à éviter" hint="Séparés par des virgules">
                  <input className="input" defaultValue={brand.wordsToAvoid.join(", ")} onBlur={(e) => updateBrand({ wordsToAvoid: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="cheap, gadget" />
                </Field>
                <Field label="Délai de livraison">
                  <input className="input" value={brand.shippingDelay} onChange={(e) => updateBrand({ shippingDelay: e.target.value })} />
                </Field>
                <Field label="Promesses principales" hint="Séparées par des virgules">
                  <input className="input" defaultValue={brand.promises.join(", ")} onBlur={(e) => updateBrand({ promises: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="Ex : qualité durable, livraison rapide" />
                </Field>
                <Field label="Politique de retour">
                  <input className="input" value={brand.returnPolicy} onChange={(e) => updateBrand({ returnPolicy: e.target.value })} />
                </Field>
              </div>
              <Field label="Garanties" hint="Séparées par des virgules">
                <input className="input" defaultValue={brand.guarantees.join(", ")} onBlur={(e) => updateBrand({ guarantees: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="Garantie 2 ans, paiement sécurisé" />
              </Field>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div className="space-y-5 animate-step-in">
              <div>
                <h2 className="text-xl font-bold">Connectez vos IA</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  BYOK : vous utilisez vos propres clés. Connectez-en au moins une pour continuer.
                </p>
              </div>
              <div className="grid gap-3">
                {PROVIDER_ORDER.map((id) => (
                  <ProviderCard key={id} id={id} />
                ))}
              </div>
            </div>
          )}

          {/* Step 4 */}
          {step === 4 && (
            <div className="space-y-5 animate-step-in">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold">Scan public — vue client</h2>
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                    <Eye className="h-3.5 w-3.5" /> Vue visiteur
                  </span>
                </div>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  Orkestra analyse votre boutique comme un client ou Google la voit publiquement. Simple, rapide, sans configuration technique.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Lien public de la boutique" hint="L'adresse que voient vos clients">
                  <input className="input" value={brand.publicUrl} onChange={(e) => updateBrand({ publicUrl: e.target.value })} placeholder="https://maboutique.com" />
                </Field>
                <Field label="Lien admin Shopify (optionnel)" hint="Sert uniquement à identifier votre boutique">
                  <input className="input" value={brand.adminUrl} onChange={(e) => updateBrand({ adminUrl: e.target.value })} placeholder="https://admin.shopify.com/store/nom-boutique" />
                </Field>
              </div>

              {/* Mention claire */}
              <div className="flex items-start gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3.5">
                <Globe className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                <p className="text-xs text-[var(--text-muted)]">
                  Ce scan analyse votre boutique comme un visiteur. Pour une analyse complète des produits, meta, alt text et données internes Shopify, une connexion API sera disponible ensuite.
                </p>
              </div>

              {/* Option avancée : API Shopify (bientôt) */}
              <div className="flex items-center justify-between rounded-xl border border-dashed border-[var(--border)] px-3.5 py-3 opacity-80">
                <div className="flex items-center gap-2.5">
                  <Lock className="h-4 w-4 text-ink-400" />
                  <div>
                    <div className="text-sm font-medium">Connexion API Shopify (avancé)</div>
                    <div className="text-xs text-[var(--text-muted)]">Token Admin API pour l'analyse interne complète.</div>
                  </div>
                </div>
                <span className="rounded-full bg-ink-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-500 dark:bg-ink-900">Bientôt disponible</span>
              </div>

              {!scanned ? (
                <Button size="lg" loading={scanning} onClick={runScan} icon={!scanning ? <ScanSearch className="h-4 w-4" /> : undefined} className="w-full" disabled={scanning || !brand.publicUrl.trim()}>
                  {scanning ? "Scan public en cours…" : "Lancer le scan public"}
                </Button>
              ) : (
                <div className="space-y-4 animate-scale-in">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
                    <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-500 text-white animate-pop"><Check className="h-4 w-4" /></span>
                      Scan terminé · {brand.niche}
                    </div>
                    {analysis && (
                      <p className="mt-1 pl-9 text-xs text-emerald-700/80 dark:text-emerald-300/70">Confiance : {analysis.confidence}</p>
                    )}
                  </div>

                  {/* Bannière erreur / partiel / fallback */}
                  {scanError && (
                    <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
                      <Globe className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                      <p className="text-xs text-amber-800 dark:text-amber-200">{scanError}</p>
                    </div>
                  )}

                  {/* Statistiques du crawl réel */}
                  {analysis && analysis.pagesAnalyzed != null && (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {[
                        { label: "Pages analysées", v: analysis.pagesAnalyzed },
                        { label: "Produits détectés", v: analysis.productsFound ?? 0 },
                        { label: "Collections détectées", v: analysis.collectionsFound ?? 0 },
                        { label: "Textes anglais", v: analysis.englishTexts?.length ?? analysis.metrics.englishTextsDetected },
                      ].map((st) => (
                        <div key={st.label} className="rounded-xl bg-[var(--bg)] p-3 text-center">
                          <div className="text-lg font-bold">{st.v}</div>
                          <div className="text-[11px] text-[var(--text-muted)]">{st.label}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Pages légales trouvées / manquantes */}
                  {analysis?.legalPages && analysis.legalPages.length > 0 && (
                    <div>
                      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">Pages légales & confiance</div>
                      <div className="flex flex-wrap gap-1.5">
                        {analysis.legalPages.map((l) => (
                          <span key={l.key} className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs ${l.found ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300"}`}>
                            {l.found ? <Check className="h-3 w-3" /> : <span className="text-[10px] font-bold">✕</span>}
                            {l.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Scores du scan */}
                  {analysis && (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {[
                        { label: "SEO visible", v: analysis.scores.seo },
                        { label: "Confiance", v: analysis.scores.trust },
                        { label: "Conversion", v: analysis.scores.conversion },
                        { label: "Merchant apparent", v: analysis.scores.merchant },
                      ].map((sc) => {
                        const tone = scoreTone(sc.v);
                        return (
                          <div key={sc.label} className="rounded-xl border border-[var(--border)] p-3 text-center">
                            <div className={`text-xl font-bold ${tone === "good" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : "text-red-500"}`}>{sc.v}</div>
                            <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">{sc.label}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Problèmes détectés (top 3) */}
                  {analysis && analysis.issues.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">Problèmes détectés</div>
                      {analysis.issues.slice(0, 3).map((issue, i) => (
                        <div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] p-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-medium">{issue.area}</span>
                              <Badge tone={SEV_TONE[issue.severity]}>{issue.severity}</Badge>
                            </div>
                            <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{issue.fix}</p>
                          </div>
                          <Link href={MODULE_ROUTE[issue.module]} className="shrink-0">
                            <Button variant="ghost" size="sm" icon={<Wrench className="h-3.5 w-3.5" />}>Corriger</Button>
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-center text-xs text-[var(--text-muted)]">
                    Résultats complets disponibles dans le Dashboard, la Mémoire boutique, Merchant Shield et l&apos;AI Council.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Footer nav */}
          <div className="mt-8 flex items-center justify-between border-t border-[var(--border)] pt-5">
            <Button variant="ghost" onClick={prev} disabled={step === 1} icon={<ArrowLeft className="h-4 w-4" />}>
              Retour
            </Button>
            {step < 4 ? (
              <Button onClick={next} icon={<ArrowRight className="h-4 w-4" />} disabled={step === 3 && connected.length === 0}>
                {step === 3 && connected.length === 0 ? "Connectez au moins une IA" : "Continuer"}
              </Button>
            ) : (
              <Button onClick={finish} disabled={!scanned} icon={<ArrowRight className="h-4 w-4" />}>
                Accéder au dashboard
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

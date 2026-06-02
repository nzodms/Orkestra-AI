"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useOrkestra, connectedProviders } from "@/lib/store";
import { PROVIDER_ORDER } from "@/lib/providers";
import { DEMO_SCAN_RESULT } from "@/lib/mock-data";
import { ProviderCard } from "@/components/ProviderCard";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/primitives";
import type { Positioning } from "@/lib/types";
import { Sparkles, Check, ArrowRight, ArrowLeft, Store, Palette, Plug, ScanSearch, Loader2 } from "lucide-react";

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
  const { brand, updateBrand, connections, setOnboardingComplete } = useOrkestra();
  const [step, setStep] = useState(1);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);

  const connected = connectedProviders(connections);

  function next() {
    setStep((s) => Math.min(4, s + 1));
  }
  function prev() {
    setStep((s) => Math.max(1, s - 1));
  }

  async function runScan() {
    setScanning(true);
    await new Promise((r) => setTimeout(r, 1800));
    updateBrand(DEMO_SCAN_RESULT);
    setScanning(false);
    setScanned(true);
  }

  function finish() {
    setOnboardingComplete(true);
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className="mx-auto flex max-w-3xl items-center gap-2.5 px-5 py-6">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
          <Sparkles className="h-5 w-5" />
        </div>
        <span className="text-base font-bold">Orkestra AI</span>
      </header>

      <div className="mx-auto max-w-3xl px-5 pb-20">
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
                    className={`grid h-10 w-10 place-items-center rounded-xl border transition ${
                      done
                        ? "border-brand-600 bg-brand-600 text-white"
                        : active
                        ? "border-brand-400 bg-brand-50 text-brand-600 dark:bg-brand-950"
                        : "border-[var(--border)] text-ink-400"
                    }`}
                  >
                    {done ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <span className={`text-xs ${active ? "font-semibold text-[var(--text)]" : "text-[var(--text-muted)]"}`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`mx-2 h-0.5 flex-1 rounded ${step > s.id ? "bg-brand-600" : "bg-[var(--border)]"}`} />
                )}
              </div>
            );
          })}
        </div>

        <div className="card p-6 sm:p-8">
          {/* Step 1 */}
          {step === 1 && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <h2 className="text-xl font-bold">Parlez-nous de votre boutique</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  Ces informations nourrissent la mémoire boutique utilisée dans toutes vos générations.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nom de la boutique">
                  <input className="input" value={brand.storeName} onChange={(e) => updateBrand({ storeName: e.target.value })} placeholder="Maison Lurel" />
                </Field>
                <Field label="URL Shopify">
                  <input className="input" value={brand.shopifyUrl} onChange={(e) => updateBrand({ shopifyUrl: e.target.value })} placeholder="maboutique.myshopify.com" />
                </Field>
                <Field label="Niche">
                  <input className="input" value={brand.niche} onChange={(e) => updateBrand({ niche: e.target.value })} placeholder="Maroquinerie premium" />
                </Field>
                <Field label="Pays / langue cible">
                  <input className="input" value={brand.country} onChange={(e) => updateBrand({ country: e.target.value })} placeholder="France / Français" />
                </Field>
              </div>
              <Field label="Positionnement">
                <div className="flex flex-wrap gap-2">
                  {POSITIONINGS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => updateBrand({ positioning: p.id })}
                      className={`rounded-xl border px-3.5 py-2 text-sm font-medium transition ${
                        brand.positioning === p.id
                          ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                          : "border-[var(--border)] text-[var(--text-muted)] hover:border-brand-300"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="space-y-5 animate-fade-in">
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
                  {(["tutoiement", "vouvoiement"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => updateBrand({ formality: f })}
                      className={`rounded-xl border px-4 py-2 text-sm font-medium capitalize transition ${
                        brand.formality === f
                          ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                          : "border-[var(--border)] text-[var(--text-muted)]"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
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
                  <input className="input" defaultValue={brand.promises.join(", ")} onBlur={(e) => updateBrand({ promises: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="Qualité durable, fabrication soignée" />
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
            <div className="space-y-5 animate-fade-in">
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
            <div className="space-y-5 animate-fade-in">
              <div>
                <h2 className="text-xl font-bold">Connectez et scannez votre boutique</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  Reliez votre Admin API Shopify, ou continuez en mode manuel. Le scan détecte niche, collections et opportunités.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="URL de la boutique">
                  <input className="input" value={brand.shopifyUrl} onChange={(e) => updateBrand({ shopifyUrl: e.target.value })} placeholder="maboutique.myshopify.com" />
                </Field>
                <Field label="Token Admin API" hint="OAuth arrive bientôt. Mode manuel disponible.">
                  <input className="input font-mono" type="password" placeholder="shpat_••••••••" />
                </Field>
              </div>

              {!scanned ? (
                <Button size="lg" loading={scanning} onClick={runScan} icon={!scanning ? <ScanSearch className="h-4 w-4" /> : undefined} className="w-full">
                  {scanning ? "Analyse de votre boutique en cours…" : "Scanner ma boutique"}
                </Button>
              ) : (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/40 animate-fade-in">
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                    <Check className="h-5 w-5" /> Boutique analysée avec succès
                  </div>
                  <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <div><span className="text-[var(--text-muted)]">Niche :</span> {brand.niche}</div>
                    <div><span className="text-[var(--text-muted)]">Collections :</span> {brand.collections.length}</div>
                    <div><span className="text-[var(--text-muted)]">Types produits :</span> {brand.productTypes.length}</div>
                    <div><span className="text-[var(--text-muted)]">Mots-clés :</span> {brand.primaryKeywords.length}</div>
                  </div>
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

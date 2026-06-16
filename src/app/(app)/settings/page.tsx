"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useOrkestra, connectedProviders } from "@/lib/store";
import { PROVIDERS, PROVIDER_ORDER } from "@/lib/providers";
import { Badge, Field } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { ProviderCard } from "@/components/ProviderCard";
import type { AIProviderId } from "@/lib/types";
import {
  User, Store, ShieldCheck, CreditCard, Cpu, Moon, Sun, Plug, Check, CheckCircle2,
  AlertTriangle, Lock, EyeOff, Sparkles, Clock, Zap, ArrowRight,
} from "lucide-react";

const AVAILABLE: AIProviderId[] = ["openai", "anthropic", "gemini"];

const TABS = [
  { id: "connections", label: "Connexions IA", icon: Plug, desc: "Clés API & modèles" },
  { id: "stores", label: "Boutiques Shopify", icon: Store, desc: "Boutiques connectées" },
  { id: "ai", label: "Préférences IA", icon: Cpu, desc: "Routage & orchestration" },
  { id: "security", label: "Sécurité des clés", icon: ShieldCheck, desc: "Chiffrement & accès" },
  { id: "profile", label: "Profil", icon: User, desc: "Compte & interface" },
  { id: "billing", label: "Abonnement", icon: CreditCard, desc: "Plan & factures" },
];

interface Health {
  mockMode: boolean;
  openAiLiveReady: boolean;
  keyStore: string;
  environment: string;
  warnings: string[];
}

export default function SettingsPage() {
  const { brand, connections, theme, toggleTheme } = useOrkestra();
  const [tab, setTab] = useState("connections");
  const connected = connectedProviders(connections);
  const [health, setHealth] = useState<Health | null>(null);
  useEffect(() => {
    fetch("/api/health").then((r) => r.json()).then(setHealth).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div>
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-300">
          Réglages & connexions
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">
          Connectez vos <span className="text-gradient">boutiques, IA et préférences</span>
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
          Tout ce qu’Orkestra utilise pour analyser et générer. Vos clés restent les vôtres, chiffrées.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Rail */}
        <div className="lg:col-span-1">
          <div className="space-y-1 lg:sticky lg:top-20">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${active ? "bg-gradient-to-r from-brand-50 to-transparent dark:from-brand-950/60" : "hover:bg-[var(--bg)]"}`}
                >
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition ${active ? "bg-brand-600 text-white shadow-[0_6px_16px_-6px_rgba(36,89,230,0.7)]" : "bg-[var(--bg)] text-[var(--text-muted)] group-hover:text-[var(--text)]"}`}>
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-[var(--text)]">{t.label}</span>
                    <span className="block truncate text-[11px] text-[var(--text-muted)]">{t.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Contenu */}
        <div className="lg:col-span-3">
          {tab === "connections" && <ConnectionsTab connected={connected} health={health} />}

          {tab === "stores" && (
            <div className="card p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300"><Store className="h-[18px] w-[18px]" /></span>
                  <div><h3 className="text-sm font-semibold">Boutiques Shopify</h3><p className="text-xs text-[var(--text-muted)]">Boutique active analysée par Orkestra.</p></div>
                </div>
                <Button size="sm" variant="outline">Ajouter</Button>
              </div>
              <div className="rounded-xl border border-[var(--border)] p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-teal-400 to-teal-600 text-white"><Store className="h-4 w-4" /></span>
                    <div>
                      <div className="text-sm font-medium">{brand.storeName || "Boutique sans nom"}</div>
                      <div className="text-xs text-[var(--text-muted)]">{brand.publicUrl || brand.shopifyUrl || "URL non renseignée"}</div>
                    </div>
                  </div>
                  <Badge tone="good"><Check className="h-3 w-3" /> Active</Badge>
                </div>
              </div>
            </div>
          )}

          {tab === "ai" && <PreferencesTab connected={connected} />}

          {tab === "security" && <SecurityTab />}

          {tab === "profile" && (
            <div className="card p-5">
              <div className="mb-4 flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300"><User className="h-[18px] w-[18px]" /></span>
                <h3 className="text-sm font-semibold">Profil utilisateur</h3>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nom complet"><input className="input" placeholder="Votre nom" /></Field>
                <Field label="Email"><input className="input" placeholder="vous@exemple.com" /></Field>
                <Field label="Langue de l'interface"><select className="input"><option>Français</option><option>English</option></select></Field>
                <Field label="Thème">
                  <button onClick={toggleTheme} className="input flex items-center justify-between">
                    <span className="capitalize">{theme === "light" ? "Clair" : "Sombre"}</span>
                    {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                  </button>
                </Field>
              </div>
              <div className="mt-4"><Button>Enregistrer</Button></div>
            </div>
          )}

          {tab === "billing" && (
            <div className="card p-5">
              <div className="mb-4 flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300"><CreditCard className="h-[18px] w-[18px]" /></span>
                <h3 className="text-sm font-semibold">Abonnement</h3>
              </div>
              <div className="rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-transparent p-5 dark:border-brand-900 dark:from-brand-950/40">
                <div className="flex items-center gap-2"><span className="text-lg font-bold">Plan Bêta</span><Badge tone="brand">Actif</Badge></div>
                <p className="mt-1 text-sm text-[var(--text-muted)]">Accès anticipé complet. Vous payez uniquement vos propres crédits IA (BYOK).</p>
                <div className="mt-4 flex gap-2">
                  <Button>Gérer l&apos;abonnement</Button>
                  <Button variant="outline">Voir les factures</Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Connexions IA (priorité visuelle) ───────────────────────────────────────
function ConnectionsTab({ connected, health }: { connected: AIProviderId[]; health: Health | null }) {
  const live = health ? health.openAiLiveReady && !health.mockMode : false;
  return (
    <div className="space-y-5">
      {/* Statut global */}
      <div className="glass-card ork-sheen overflow-hidden">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${connected.length ? "bg-gradient-to-br from-teal-400 to-teal-600" : "bg-gradient-to-br from-brand-500 to-brand-700"} text-white shadow-[0_10px_24px_-10px_rgba(16,183,127,0.7)]`}>
              <Plug className="h-6 w-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-[var(--text)]">{connected.length ? `${connected.length} IA connectée${connected.length > 1 ? "s" : ""}` : "Aucune IA connectée"}</h3>
                {health && <Badge tone={live ? "good" : "neutral"}>{live ? "Live" : "Démo"}</Badge>}
              </div>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                {connected.length ? "Vos modèles sont prêts dans AI Council." : "Connectez au moins une IA pour des analyses réelles."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {PROVIDER_ORDER.filter((id) => AVAILABLE.includes(id)).map((id) => {
              const on = connected.includes(id);
              return (
                <span key={id} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${on ? "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-900/30 dark:text-teal-300" : "border-[var(--border)] text-[var(--text-muted)]"}`}>
                  <span className={`h-2 w-2 rounded-full ${on ? "ork-live" : ""}`} style={{ background: on ? PROVIDERS[id].color : "var(--border)" }} />
                  {PROVIDERS[id].name}
                </span>
              );
            })}
          </div>
        </div>
        {health && health.warnings.length > 0 && (
          <div className="border-t border-[var(--border)] bg-amber-50/50 px-5 py-2.5 dark:bg-amber-950/20">
            {health.warnings.slice(0, 2).map((w, i) => (
              <p key={i} className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-300"><AlertTriangle className="h-3 w-3 shrink-0" /> {w}</p>
            ))}
          </div>
        )}
      </div>

      {/* Réassurance */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: Lock, title: "Clés chiffrées", desc: "AES-256-GCM côté serveur, jamais en clair." },
          { icon: EyeOff, title: "Jamais réaffichées", desc: "Seule une version masquée reste visible." },
          { icon: ShieldCheck, title: "Vos crédits", desc: "Chaque génération utilise vos clés, pas les nôtres." },
        ].map((b) => {
          const Icon = b.icon;
          return (
            <div key={b.title} className="card flex items-start gap-3 p-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300"><Icon className="h-[18px] w-[18px]" /></span>
              <div><div className="text-sm font-semibold text-[var(--text)]">{b.title}</div><p className="mt-0.5 text-xs text-[var(--text-muted)]">{b.desc}</p></div>
            </div>
          );
        })}
      </div>

      {/* Cards provider */}
      <div>
        <div className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
          <Sparkles className="h-4 w-4 text-brand-600" /> Connectez vos propres IA
        </div>
        <p className="mb-3 text-xs text-[var(--text-muted)]">Testez la connexion avant d’utiliser un modèle dans AI Council.</p>
        <div className="ork-stagger grid items-stretch gap-4 md:grid-cols-2">
          {PROVIDER_ORDER.map((id) => (
            <ProviderCard key={id} id={id} />
          ))}
        </div>
      </div>

      {/* Routage intelligent */}
      <div className="card p-5">
        <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
          <Zap className="h-4 w-4 text-brand-600" /> Routage intelligent — quel modèle pour quelle tâche
        </div>
        <p className="mb-3 text-xs text-[var(--text-muted)]">Connectez ce que vous voulez : Orkestra route automatiquement vers le bon modèle selon la tâche.</p>
        <div className="overflow-hidden rounded-xl border border-[var(--border)]">
          {PROVIDER_ORDER.map((id, i) => {
            const p = PROVIDERS[id];
            const isLive = AVAILABLE.includes(id);
            return (
              <div key={id} className={`flex items-center justify-between gap-3 px-3.5 py-3 ${i % 2 ? "bg-[var(--bg)]" : "bg-[var(--surface)]"}`}>
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
                  <span className="shrink-0 text-sm font-semibold text-[var(--text)]">{p.name}</span>
                  <span className="truncate text-xs text-[var(--text-muted)]">— {p.bestFor}</span>
                </div>
                {isLive ? <Badge tone="good"><CheckCircle2 className="h-3 w-3" /> Live</Badge> : <Badge tone="neutral"><Clock className="h-3 w-3" /> Bientôt</Badge>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PreferencesTab({ connected }: { connected: AIProviderId[] }) {
  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300"><Cpu className="h-[18px] w-[18px]" /></span>
        <div><h3 className="text-sm font-semibold">Préférences IA</h3><p className="text-xs text-[var(--text-muted)]">Comment l’orchestre travaille pour vous.</p></div>
      </div>
      <div className="space-y-4">
        <Field label="Mode de l'orchestre" hint="Comment fusionner les réponses des IA connectées">
          <select className="input">
            <option>Synthèse fusionnée (recommandé)</option>
            <option>Meilleure réponse unique</option>
            <option>Vote majoritaire</option>
          </select>
        </Field>
        <Field label="IA prioritaire pour le code Shopify">
          <select className="input">
            {connected.length ? connected.map((id) => <option key={id}>{PROVIDERS[id].name}</option>) : <option>Aucune IA connectée</option>}
          </select>
        </Field>
        <Field label="Niveau de créativité" hint="Plus élevé = sorties plus variées">
          <input type="range" min={0} max={100} defaultValue={40} className="w-full accent-brand-600" />
        </Field>
      </div>
      <Link href="/council" className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:underline dark:text-brand-300">
        Tester dans AI Council <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function SecurityTab() {
  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300"><ShieldCheck className="h-[18px] w-[18px]" /></span>
        <h3 className="text-sm font-semibold">Sécurité des clés</h3>
      </div>
      <div className="rounded-xl bg-brand-50 p-4 dark:bg-brand-950/40">
        <p className="text-sm font-medium text-[var(--text)]">Comment Orkestra protège vos clés API</p>
        <ul className="mt-2 space-y-1.5 text-sm text-[var(--text-muted)]">
          <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> Chiffrement AES-256-GCM côté serveur.</li>
          <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> Les clés ne sont jamais renvoyées au navigateur après sauvegarde.</li>
          <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> Aucune clé n'est écrite dans les logs.</li>
          <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> Suppression instantanée à tout moment.</li>
        </ul>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Mot de passe"><Button variant="outline">Changer de mot de passe</Button></Field>
        <Field label="Double authentification (2FA)"><Button variant="outline">Activer la 2FA</Button></Field>
      </div>
    </div>
  );
}

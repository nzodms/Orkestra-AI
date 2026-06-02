"use client";

import { useState } from "react";
import { useOrkestra, connectedProviders } from "@/lib/store";
import { PROVIDERS, PROVIDER_ORDER } from "@/lib/providers";
import { PageHeader, Card, CardHeader, Badge, Field } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import {
  User, Store, KeyRound, ShieldCheck, CreditCard, Cpu, Globe, Moon, Sun, Plug, Check,
} from "lucide-react";

const TABS = [
  { id: "profile", label: "Profil", icon: User },
  { id: "stores", label: "Boutiques", icon: Store },
  { id: "keys", label: "Clés API", icon: KeyRound },
  { id: "ai", label: "Préférences IA", icon: Cpu },
  { id: "security", label: "Sécurité", icon: ShieldCheck },
  { id: "billing", label: "Abonnement", icon: CreditCard },
];

export default function SettingsPage() {
  const { brand, connections, theme, toggleTheme } = useOrkestra();
  const [tab, setTab] = useState("profile");
  const connected = connectedProviders(connections);

  return (
    <>
      <PageHeader title="Paramètres" description="Gérez votre compte, vos boutiques, vos clés IA et vos préférences." />

      <div className="grid gap-5 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <div className="space-y-1">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button key={t.id} onClick={() => setTab(t.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${tab === t.id ? "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300" : "text-[var(--text-muted)] hover:bg-ink-50 dark:hover:bg-ink-900"}`}>
                  <Icon className="h-[18px] w-[18px]" /> {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-3">
          {tab === "profile" && (
            <Card>
              <CardHeader icon={<User className="h-[18px] w-[18px]" />} title="Profil utilisateur" />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nom complet"><input className="input" placeholder="Votre nom" /></Field>
                <Field label="Email"><input className="input" placeholder="vous@exemple.com" /></Field>
                <Field label="Langue de l'interface">
                  <select className="input"><option>Français</option><option>English</option></select>
                </Field>
                <Field label="Thème">
                  <button onClick={toggleTheme} className="input flex items-center justify-between">
                    <span className="capitalize">{theme === "light" ? "Clair" : "Sombre"}</span>
                    {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                  </button>
                </Field>
              </div>
              <div className="mt-4"><Button>Enregistrer</Button></div>
            </Card>
          )}

          {tab === "stores" && (
            <Card>
              <CardHeader icon={<Store className="h-[18px] w-[18px]" />} title="Mes boutiques" action={<Button size="sm" variant="outline">Ajouter une boutique</Button>} />
              <div className="rounded-xl border border-[var(--border)] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{brand.storeName || "Boutique sans nom"}</div>
                    <div className="text-xs text-[var(--text-muted)]">{brand.shopifyUrl || "URL non renseignée"}</div>
                  </div>
                  <Badge tone="brand">Active</Badge>
                </div>
              </div>
            </Card>
          )}

          {tab === "keys" && (
            <Card>
              <CardHeader icon={<KeyRound className="h-[18px] w-[18px]" />} title="Clés API (BYOK)" subtitle="Chiffrées, jamais réaffichées en clair" action={<Link href="/connect"><Button size="sm" icon={<Plug className="h-4 w-4" />}>Gérer</Button></Link>} />
              <div className="space-y-2">
                {PROVIDER_ORDER.map((id) => {
                  const conn = connections[id];
                  const meta = PROVIDERS[id];
                  return (
                    <div key={id} className="flex items-center justify-between rounded-xl border border-[var(--border)] px-3.5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-3 w-3 rounded-full" style={{ background: meta.color }} />
                        <span className="text-sm font-medium">{meta.name}</span>
                        {conn.connected && <span className="font-mono text-xs text-[var(--text-muted)]">{conn.maskedKey}</span>}
                      </div>
                      {conn.connected ? <Badge tone="good"><Check className="h-3 w-3" /> Connecté</Badge> : <Badge tone="neutral">Non connecté</Badge>}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {tab === "ai" && (
            <Card>
              <CardHeader icon={<Cpu className="h-[18px] w-[18px]" />} title="Préférences IA" subtitle="Comment l'orchestre travaille pour vous" />
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
            </Card>
          )}

          {tab === "security" && (
            <Card>
              <CardHeader icon={<ShieldCheck className="h-[18px] w-[18px]" />} title="Sécurité" />
              <div className="space-y-3 text-sm">
                <div className="rounded-xl bg-brand-50 p-4 dark:bg-brand-950/40">
                  <p className="font-medium">Comment Orkestra protège vos clés API</p>
                  <ul className="mt-2 space-y-1.5 text-[var(--text-muted)]">
                    <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> Chiffrement AES-256-GCM côté serveur.</li>
                    <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> Les clés ne sont jamais renvoyées au navigateur après sauvegarde.</li>
                    <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> Aucune clé n'est écrite dans les logs.</li>
                    <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> Suppression instantanée à tout moment.</li>
                  </ul>
                </div>
                <Field label="Mot de passe"><Button variant="outline">Changer de mot de passe</Button></Field>
                <Field label="Double authentification (2FA)"><Button variant="outline">Activer la 2FA</Button></Field>
              </div>
            </Card>
          )}

          {tab === "billing" && (
            <Card>
              <CardHeader icon={<CreditCard className="h-[18px] w-[18px]" />} title="Abonnement" />
              <div className="rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-transparent p-5 dark:border-brand-900 dark:from-brand-950/40">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2"><span className="text-lg font-bold">Plan Bêta</span><Badge tone="brand">Actif</Badge></div>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">Accès anticipé complet. Vous payez uniquement vos propres crédits IA (BYOK).</p>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button>Gérer l&apos;abonnement</Button>
                  <Button variant="outline">Voir les factures</Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

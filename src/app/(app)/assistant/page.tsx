"use client";

import { useState } from "react";
import { PageHeader, Card, Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { LifeBuoy, Send, ArrowRight } from "lucide-react";

const SUGGESTIONS = [
  "Comment ajouter une section dans Shopify ?",
  "Où modifier ma page produit ?",
  "Pourquoi mon bouton panier est mal affiché ?",
  "Comment ajouter du code Liquid ?",
  "Comment modifier une meta description ?",
  "Comment optimiser une collection ?",
  "Comment créer une FAQ ?",
  "Comment trouver les textes anglais restants ?",
];

interface Msg {
  role: "user" | "assistant";
  content: string;
  steps?: string[];
}

// Réponses step-by-step (mode mock). En prod, route vers l'AI Council mode "code".
function answerFor(q: string): { intro: string; steps: string[] } {
  const lower = q.toLowerCase();
  if (lower.includes("section")) {
    return {
      intro: "Pour ajouter une section dans Shopify (Online Store 2.0) :",
      steps: [
        "Admin Shopify → Boutique en ligne → Thèmes.",
        "Cliquez sur « Personnaliser » sur votre thème actif.",
        "Dans l'éditeur, cliquez sur « Ajouter une section » à l'endroit voulu.",
        "Choisissez la section (ou collez votre code via ⋯ → Modifier le code → Sections).",
        "Configurez les réglages dans le panneau de droite, puis Enregistrer.",
      ],
    };
  }
  if (lower.includes("meta")) {
    return {
      intro: "Pour modifier une meta description :",
      steps: [
        "Ouvrez le produit/page/collection concerné dans l'admin.",
        "Descendez jusqu'à « Référencement sur les moteurs de recherche » → Modifier.",
        "Renseignez le titre (≤ 60 caractères) et la meta description (≤ 155 caractères).",
        "Astuce : générez-la automatiquement dans le SEO Studio d'Orkestra.",
        "Enregistrez.",
      ],
    };
  }
  if (lower.includes("anglais")) {
    return {
      intro: "Pour trouver et corriger les textes en anglais :",
      steps: [
        "Lancez un audit dans Merchant Shield — Orkestra liste les libellés anglais détectés.",
        "Admin → Paramètres → Langues → Modifier la langue par défaut.",
        "Recherchez les libellés du thème (« Add to cart », « Sold out »…) et traduisez-les.",
        "Vérifiez aussi les apps tierces qui ajoutent parfois du texte EN.",
      ],
    };
  }
  if (lower.includes("liquid") || lower.includes("code")) {
    return {
      intro: "Pour ajouter du code Liquid :",
      steps: [
        "Admin → Boutique en ligne → Thèmes → ⋯ → Modifier le code.",
        "Créez/ouvrez la section ou le snippet concerné.",
        "Insérez votre code Liquid (utilisez le Section Builder d'Orkestra pour générer du code propre).",
        "Enregistrez et vérifiez le rendu dans l'aperçu.",
      ],
    };
  }
  return {
    intro: "Voici comment procéder, étape par étape :",
    steps: [
      "Identifiez la page concernée dans l'admin Shopify.",
      "Utilisez l'éditeur de thème (Personnaliser) pour les éléments visuels.",
      "Pour le code, passez par ⋯ → Modifier le code.",
      "Besoin d'aide précise ? Reformulez votre question ou utilisez l'AI Council.",
    ],
  };
}

export default function AssistantPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);

  function send(q?: string) {
    const text = (q ?? input).trim();
    if (!text) return;
    const a = answerFor(text);
    setMessages((m) => [
      ...m,
      { role: "user", content: text },
      { role: "assistant", content: a.intro, steps: a.steps },
    ]);
    setInput("");
  }

  return (
    <>
      <PageHeader
        title="Assistant Shopify"
        description="Posez n'importe quelle question sur Shopify. Orkestra vous répond pas à pas, comme un expert à vos côtés."
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="flex h-[520px] flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto pr-1">
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950">
                    <LifeBuoy className="h-7 w-7" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold">Comment puis-je vous aider ?</h3>
                  <p className="mt-1.5 max-w-xs text-sm text-[var(--text-muted)]">Choisissez une question fréquente ou tapez la vôtre.</p>
                </div>
              ) : (
                messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${m.role === "user" ? "bg-brand-600 text-white" : "border border-[var(--border)] bg-[var(--bg)]"}`}>
                      <p>{m.content}</p>
                      {m.steps && (
                        <ol className="mt-2 space-y-1.5">
                          {m.steps.map((s, j) => (
                            <li key={j} className="flex gap-2"><span className="font-semibold text-brand-600">{j + 1}.</span> {s}</li>
                          ))}
                        </ol>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="mt-4 flex items-end gap-2 border-t border-[var(--border)] pt-4">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Posez votre question Shopify…"
                className="input"
              />
              <Button onClick={() => send()} icon={<Send className="h-4 w-4" />}>Envoyer</Button>
            </div>
          </Card>
        </div>

        <Card>
          <h3 className="mb-3 text-sm font-semibold">Questions fréquentes</h3>
          <div className="space-y-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)} className="flex w-full items-center justify-between gap-2 rounded-xl border border-[var(--border)] px-3 py-2.5 text-left text-sm transition hover:border-brand-300 hover:bg-ink-50 dark:hover:bg-ink-900">
                <span className="min-w-0 truncate">{s}</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-400" />
              </button>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

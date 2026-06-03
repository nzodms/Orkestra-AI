"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useOrkestra } from "@/lib/store";
import { PageHeader, Card, Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { councilLink } from "@/lib/shopify";
import {
  LifeBuoy, Send, ArrowRight, Languages, Tag, FileText, ImageIcon, FolderOpen, Heading1,
  ShieldCheck, Sparkles, Wrench, MapPin, Lightbulb, Copy, Check,
} from "lucide-react";

// ──────────────────────────────────────────────────────────────────────────
// Assistant Shopify = exécution pas-à-pas. « Où je clique dans Shopify ? »
// Répond avec : chemin exact, étapes numérotées, précautions, données détectées
// par le scan, et CTA vers AI Council (générer le texte) / SEO Studio (contenu).
// ──────────────────────────────────────────────────────────────────────────

interface ResolvedProc {
  title: string;
  steps: string[];
  note?: string;
  english?: { text: string; suggestion: string }[];
  products?: { title: string; reason: string }[];
  missingLegal?: string[];
  council?: { label: string; href: string };
  seo?: boolean;
}

type Msg = { role: "user"; text: string } | { role: "assistant"; proc: ResolvedProc };

function detectTopic(q: string): string {
  const t = q.toLowerCase();
  if (/anglais|english|traduire|libellé/.test(t)) return "english";
  if (/meta|référencement|balise titre|title|description seo/.test(t)) return "meta";
  if (/collection/.test(t)) return "collection";
  if (/alt|texte alternatif|image/.test(t)) return "alt";
  if (/product.?type|type de produit|catégor/.test(t)) return "product_type";
  if (/\btags?\b|étiquette/.test(t)) return "tags";
  if (/\bh1\b|titre principal|plusieurs h1|h1 multiple/.test(t)) return "h1";
  if (/légal|legal|mention|cgv|retour|livraison|confidential|politique|contact|page/.test(t)) return "legal";
  if (/faq|section|réassur|reassur|hero|bandeau|bloc/.test(t)) return "section";
  if (/liquid|\bcode\b|snippet|thème|theme/.test(t)) return "code";
  if (/avis|review|témoignage|temoignage/.test(t)) return "reviews";
  return "generic";
}

type Analysis = ReturnType<typeof useOrkestra.getState>["analysis"];
type Brand = ReturnType<typeof useOrkestra.getState>["brand"];

function resolveAnswer(q: string, analysis: Analysis, brand: Brand): ResolvedProc {
  const topic = detectTopic(q);
  const coll = brand.collections?.[0] || analysis?.priorityProducts?.[0]?.title || "votre collection";
  const english = analysis?.englishTexts?.slice(0, 6).map((e) => ({ text: e.text, suggestion: e.suggestion })) ?? [];
  const products = analysis?.priorityProducts?.slice(0, 5).map((p) => ({ title: p.title, reason: p.reason })) ?? [];
  const missingLegal = analysis?.legalPages?.filter((l) => !l.found).map((l) => l.label) ?? [];

  switch (topic) {
    case "meta":
      return {
        title: "Modifier les meta (title & description)",
        steps: [
          "Allez dans Shopify → Produits, Collections ou Pages.",
          "Ouvrez la page concernée.",
          "Descendez jusqu'à « Aperçu du référencement naturel ».",
          "Cliquez sur « Modifier ».",
          "Renseignez le title (≤ 60 car.) et la meta description (≤ 155 car.).",
          "Enregistrez, puis relancez un scan Orkestra pour vérifier.",
        ],
        note: "Title = phrase descriptive + marque (ex. « Reformer Pilates pliable | Reformio »). Évitez « Achetez maintenant », « Qualité premium ».",
        products: products.length ? products : undefined,
        council: { label: "Générer les metas avec AI Council", href: councilLink("seo", "Donne-moi uniquement les meta titles et descriptions prêts à copier.") },
        seo: true,
      };
    case "english":
      return {
        title: "Corriger les textes en anglais",
        steps: [
          "Allez dans Shopify → Paramètres → Langues.",
          "Cliquez sur la langue active de la boutique.",
          "Cliquez sur « Modifier le contenu du thème ».",
          "Recherchez le texte anglais détecté (« Add to cart », « Sold out »…).",
          "Remplacez-le par la traduction française.",
          "Enregistrez. Vérifiez aussi les apps tierces qui ajoutent parfois du texte EN.",
        ],
        note: "Impact : un libellé anglais donne une impression de boutique incomplète et réduit la confiance (signal Merchant). Priorité : haute.",
        english: english.length ? english : undefined,
        council: { label: "Lister les corrections avec AI Council", href: councilLink("merchant", "Liste les textes anglais détectés et propose les corrections en français.") },
      };
    case "collection":
      return {
        title: "Ajouter du texte à une collection",
        steps: [
          "Allez dans Shopify → Produits → Collections.",
          `Ouvrez la collection concernée (ex. « ${coll} »).`,
          "Ajoutez un texte dans le champ « Description ».",
          "Structure recommandée : intro 150–250 mots + H2/H3 si le thème les affiche.",
          "Pour une FAQ de collection, créez une section via AI Council → Code Shopify.",
          "Enregistrez, puis vérifiez le rendu sur la page collection.",
        ],
        note: "La description de collection cible une requête transactionnelle (« acheter / choisir … »). Placez le mot-clé dans le 1er paragraphe et le H1.",
        council: { label: "Générer le contenu de collection", href: councilLink("seo", `Génère le contenu SEO complet de ma collection « ${coll} » (intro 200-300 mots, H2/H3, FAQ, mots-clés).`) },
        seo: true,
      };
    case "alt":
      return {
        title: "Ajouter / corriger les alt text des images",
        steps: [
          "Ouvrez le produit (ou la collection) dans Shopify.",
          "Section « Médias » → survolez l'image → « Modifier le texte alternatif ».",
          "Rédigez un alt descriptif et naturel (ce que montre l'image).",
          "Évitez le bourrage de mots-clés : décrivez simplement le produit en situation.",
          "Enregistrez.",
        ],
        note: "Mineur pour Merchant, mais utile pour le SEO images et l'accessibilité.",
        products: products.length ? products : undefined,
        council: { label: "Générer les alt text (SEO Studio)", href: "/seo" },
        seo: true,
      };
    case "product_type":
      return {
        title: "Renseigner le type de produit (product_type)",
        steps: [
          "Ouvrez le produit dans Shopify → Produits.",
          "Bloc « Organisation du produit » (colonne de droite).",
          "Renseignez le champ « Type de produit » (ex. « Reformer », « Lustre »).",
          "Restez cohérent d'un produit à l'autre (même nomenclature).",
          "Enregistrez.",
        ],
        note: "Le product_type fiabilise la catégorisation et le flux Google Shopping.",
        products: products.length ? products : undefined,
      };
    case "tags":
      return {
        title: "Ajouter des tags produit",
        steps: [
          "Ouvrez le produit → bloc « Organisation du produit ».",
          "Champ « Tags » : ajoutez des tags cohérents (style, usage, matériau).",
          "Réutilisez les mêmes tags pour créer des collections automatiques.",
          "Enregistrez.",
        ],
        note: "Des tags cohérents améliorent la navigation, le filtrage et le flux catalogue.",
      };
    case "h1":
      return {
        title: "Corriger les H1 multiples",
        steps: [
          "Allez dans Shopify → Boutique en ligne → Thèmes → Personnaliser.",
          "Ouvrez la page concernée (accueil, collection, produit).",
          "Vérifiez qu'un seul bloc sert de titre principal (H1).",
          "Si un logo/slogan est en H1, ajustez via les réglages de la section ou « Modifier le code ».",
          "Enregistrez et republiez.",
        ],
        note: "Un seul H1 par page = meilleure structure sémantique. Plusieurs H1 brouillent le signal pour Google.",
      };
    case "legal":
      return {
        title: "Trouver / créer les pages légales",
        steps: [
          "Politiques : Shopify → Paramètres → Politiques (retour, livraison, confidentialité, CGV).",
          "Autres pages (Contact, FAQ, À propos) : Boutique en ligne → Pages → « Ajouter une page ».",
          "Liez ces pages dans le menu du footer (Navigation).",
          "Vérifiez qu'elles sont accessibles publiquement.",
        ],
        note: "Pages de confiance essentielles pour Merchant Center : contact, retours, livraison, mentions, confidentialité.",
        missingLegal: missingLegal.length ? missingLegal : undefined,
        council: { label: "Rédiger les politiques (AI Council)", href: councilLink("merchant", "Rédige mes politiques de retour, de livraison et de confidentialité, prêtes à publier.") },
      };
    case "section":
      return {
        title: "Ajouter une section (FAQ, réassurance, hero…)",
        steps: [
          "Shopify → Boutique en ligne → Thèmes → Personnaliser.",
          "Cliquez sur « Ajouter une section » à l'endroit voulu.",
          "Pour une section sur-mesure : ⋯ → Modifier le code → Sections → nouveau fichier.",
          "Collez le code généré, configurez les réglages, puis Enregistrer.",
        ],
        note: "Pour générer une vraie section Shopify (Liquid + schema + CSS), utilisez AI Council → Code Shopify.",
        council: { label: "Générer la section (Code Shopify)", href: councilLink("code", "Crée une section FAQ premium pour ma boutique.") },
      };
    case "code":
      return {
        title: "Ajouter du code Liquid",
        steps: [
          "Shopify → Boutique en ligne → Thèmes → ⋯ → Modifier le code.",
          "Ouvrez/créez la section ou le snippet concerné.",
          "Insérez votre code Liquid.",
          "Enregistrez et vérifiez le rendu dans l'aperçu avant publication.",
        ],
        note: "Travaillez sur un thème dupliqué pour tester sans risque avant publication.",
        council: { label: "Générer du code propre (Code Shopify)", href: councilLink("code", "Génère une section Shopify propre et responsive pour ma boutique.") },
      };
    case "reviews":
      return {
        title: "Ajouter des avis clients",
        steps: [
          "Installez une app d'avis (ex. depuis l'App Store Shopify) ou utilisez le bloc avis du thème.",
          "Dans Personnaliser, ajoutez la section/bloc « Avis » sur la page produit.",
          "Affichez les avis au-dessus de la ligne de flottaison pour rassurer.",
        ],
        note: "La preuve sociale améliore la conversion et la confiance (utile aussi pour Merchant).",
      };
    default:
      return {
        title: "Procédure pas-à-pas",
        steps: [
          "Identifiez l'élément : produit, collection, page, ou élément visuel du thème.",
          "Visuel / mise en page → Boutique en ligne → Thèmes → Personnaliser.",
          "Contenu produit/collection → Produits / Collections.",
          "Réglages globaux (langues, politiques, paiement) → Paramètres.",
          "Reformulez votre question (ex. « Où modifier les meta ? ») pour une procédure précise.",
        ],
        council: { label: "Poser la question à AI Council", href: councilLink("free", q) },
      };
  }
}

export default function AssistantPage() {
  const { analysis, brand } = useOrkestra();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoRan = useRef(false);

  function send(q?: string) {
    const text = (q ?? input).trim();
    if (!text) return;
    const proc = resolveAnswer(text, analysis, brand);
    setMessages((m) => [...m, { role: "user", text }, { role: "assistant", proc }]);
    setInput("");
  }

  // Question préremplie via ?q= (depuis Merchant Shield / AI Council).
  useEffect(() => {
    if (autoRan.current) return;
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) {
      autoRan.current = true;
      send(q);
      window.history.replaceState({}, "", "/assistant");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Suggestions contextuelles basées sur les problèmes RÉELS du scan.
  const cs = analysis?.catalogStats;
  const suggestions: { label: string; q: string; icon: React.ElementType }[] = [];
  const eng = analysis?.englishTexts?.length ?? 0;
  const missMeta = analysis?.metrics?.missingMetaDescriptions ?? 0;
  const noType = cs?.noType ?? 0;
  const noAlt = cs?.imagesNoAlt ?? analysis?.metrics?.imagesWithoutAlt ?? 0;
  const missLegal = analysis?.legalPages?.filter((l) => !l.found && l.essential).length ?? 0;
  if (eng > 0) suggestions.push({ label: `Corriger les textes anglais (${eng})`, q: "Où corriger les textes anglais détectés ?", icon: Languages });
  if (missMeta > 0) suggestions.push({ label: `Meta descriptions manquantes (${missMeta})`, q: "Où ajouter les meta descriptions manquantes ?", icon: FileText });
  if (noType > 0) suggestions.push({ label: `Product_type manquants (${noType})`, q: "Où corriger les product_type manquants ?", icon: Tag });
  if (noAlt > 0) suggestions.push({ label: `Alt text manquants (${noAlt})`, q: "Où ajouter les alt text des images ?", icon: ImageIcon });
  if (brand.collections?.length || analysis) suggestions.push({ label: "Optimiser une collection", q: "Où ajouter du texte à une collection ?", icon: FolderOpen });
  suggestions.push({ label: "Corriger les H1 multiples", q: "Où corriger les H1 multiples ?", icon: Heading1 });
  if (missLegal > 0) suggestions.push({ label: "Trouver les pages légales", q: "Où trouver et créer mes pages légales ?", icon: ShieldCheck });

  // Repli générique si aucune donnée de scan.
  const fallback = [
    { label: "Où modifier les meta ?", q: "Où modifier les meta descriptions ?", icon: FileText },
    { label: "Ajouter une section", q: "Comment ajouter une section dans Shopify ?", icon: Sparkles },
    { label: "Corriger les textes anglais", q: "Où corriger les textes anglais ?", icon: Languages },
    { label: "Ajouter du texte collection", q: "Où ajouter du texte à une collection ?", icon: FolderOpen },
  ];
  const sideList = suggestions.length >= 3 ? suggestions : [...suggestions, ...fallback].slice(0, 7);

  return (
    <>
      <PageHeader
        title="Assistant Shopify"
        description="Exécution pas-à-pas : où cliquer dans Shopify, quoi modifier, et comment corriger vos problèmes détectés."
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="flex h-[600px] flex-col p-0">
            <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
              <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white"><MapPin className="h-4 w-4" /></div>
              <span className="text-sm font-semibold">Où je clique dans Shopify ?</span>
              <Badge tone="brand" className="ml-auto">Exécution</Badge>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950"><LifeBuoy className="h-7 w-7" /></div>
                  <h3 className="mt-4 text-base font-semibold">Quel problème Shopify on règle ?</h3>
                  <p className="mt-1.5 max-w-xs text-sm text-[var(--text-muted)]">Choisissez une correction détectée à droite, ou décrivez votre besoin.</p>
                </div>
              ) : (
                messages.map((m, i) =>
                  m.role === "user" ? (
                    <div key={i} className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-brand-600 px-4 py-2.5 text-sm text-white shadow-soft">{m.text}</div>
                    </div>
                  ) : (
                    <AssistantAnswer key={i} proc={m.proc} />
                  )
                )
              )}
            </div>

            <div className="border-t border-[var(--border)] p-3">
              <div className="flex items-end gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-1.5 transition focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-500/10">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder="Ex : Où modifier les meta descriptions ?"
                  className="flex-1 bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-ink-400"
                />
                <Button onClick={() => send()} icon={<Send className="h-4 w-4" />}>Demander</Button>
              </div>
            </div>
          </Card>
        </div>

        <Card className="lg:sticky lg:top-20 lg:self-start">
          <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold"><Lightbulb className="h-4 w-4 text-brand-600" /> Corrections fréquentes</h3>
          <p className="mb-3 text-xs text-[var(--text-muted)]">
            {suggestions.length >= 3 ? "Basées sur les problèmes détectés dans votre scan." : "Scannez votre boutique pour des suggestions ciblées."}
          </p>
          <div className="space-y-2">
            {sideList.map((s) => {
              const Icon = s.icon;
              return (
                <button key={s.label} onClick={() => send(s.q)} className="flex w-full items-center gap-2.5 rounded-xl border border-[var(--border)] px-3 py-2.5 text-left text-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:bg-ink-50 dark:hover:bg-ink-900">
                  <Icon className="h-4 w-4 shrink-0 text-brand-500" />
                  <span className="min-w-0 flex-1 truncate">{s.label}</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-400" />
                </button>
              );
            })}
          </div>
        </Card>
      </div>
    </>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1400); }} className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--text-muted)] transition hover:text-brand-600">
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}{copied ? "Copié" : "Copier"}
    </button>
  );
}

function AssistantAnswer({ proc }: { proc: ResolvedProc }) {
  return (
    <div className="max-w-[92%] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-soft">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300"><MapPin className="h-3.5 w-3.5" /></span>
        <h4 className="text-sm font-bold">{proc.title}</h4>
      </div>
      <ol className="space-y-1.5">
        {proc.steps.map((s, j) => (
          <li key={j} className="flex gap-2.5 text-sm leading-relaxed text-[var(--text-muted)]">
            <span className="mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-md bg-brand-50 text-[10px] font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">{j + 1}</span>
            <span className="min-w-0">{s}</span>
          </li>
        ))}
      </ol>

      {proc.note && (
        <div className="mt-3 rounded-xl border-l-[3px] border-brand-400 bg-[var(--bg)] py-2 pl-3 pr-2.5 text-xs text-[var(--text-muted)]">
          <span className="font-semibold text-[var(--text)]">À savoir : </span>{proc.note}
        </div>
      )}

      {proc.english && (
        <div className="mt-3">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">Textes anglais détectés</div>
          <div className="space-y-1.5">
            {proc.english.map((e, i) => (
              <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1.5 text-xs">
                <span className="min-w-0 truncate"><code className="font-mono text-red-600 dark:text-red-300">{e.text}</code> → <code className="font-mono text-emerald-600 dark:text-emerald-300">{e.suggestion}</code></span>
                <CopyBtn text={e.suggestion} />
              </div>
            ))}
          </div>
        </div>
      )}

      {proc.products && (
        <div className="mt-3">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">Pages / produits concernés</div>
          <div className="flex flex-wrap gap-1.5">
            {proc.products.map((p, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1 text-xs"><span className="max-w-[200px] truncate">{p.title}</span></span>
            ))}
          </div>
        </div>
      )}

      {proc.missingLegal && (
        <div className="mt-3">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">Pages manquantes détectées</div>
          <div className="flex flex-wrap gap-1.5">
            {proc.missingLegal.map((l, i) => (
              <Badge key={i} tone="bad">{l}</Badge>
            ))}
          </div>
        </div>
      )}

      {(proc.council || proc.seo) && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
          {proc.council && (
            <Link href={proc.council.href}><Button variant="secondary" size="sm" icon={<Sparkles className="h-3.5 w-3.5" />}>{proc.council.label}</Button></Link>
          )}
          {proc.seo && (
            <Link href="/seo"><Button variant="outline" size="sm" icon={<Wrench className="h-3.5 w-3.5" />}>Ouvrir SEO Studio</Button></Link>
          )}
        </div>
      )}
    </div>
  );
}

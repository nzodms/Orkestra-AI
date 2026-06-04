"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useOrkestra, connectedProviders } from "@/lib/store";
import { PageHeader, Card, Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { Markdown } from "@/components/ui/Markdown";
import { councilLink } from "@/lib/shopify";
import type { AssistantProc } from "@/lib/types";
import {
  LifeBuoy, Send, ArrowRight, Languages, Tag, FileText, ImageIcon, FolderOpen, Heading1,
  ShieldCheck, Sparkles, Wrench, MapPin, Lightbulb, Copy, Check, Trash2, HelpCircle, Package, TrendingUp, Database,
} from "lucide-react";

// ──────────────────────────────────────────────────────────────────────────
// Assistant Shopify = exécution pas-à-pas. « Où je clique dans Shopify ? »
// Réponses opérationnelles + données du scan + CTA inter-modules. Conversation
// persistée. Bascule OpenAI live pour les demandes hors-procédure (sans jamais
// prétendre avoir cherché sur internet : aucune recherche web n'est branchée).
// ──────────────────────────────────────────────────────────────────────────

function detectTopic(q: string): string {
  const t = q.toLowerCase();
  if (/anglais|english|traduire|libellé/.test(t)) return "english";
  if (/meta|référencement|balise titre|\btitle\b|description seo/.test(t)) return "meta";
  if (/collection/.test(t)) return "collection";
  if (/alt|texte alternatif|image/.test(t)) return "alt";
  if (/product.?type|type de produit|catégor/.test(t)) return "product_type";
  if (/\btags?\b|étiquette/.test(t)) return "tags";
  if (/\bh1\b|titre principal|plusieurs h1|h1 multiple/.test(t)) return "h1";
  if (/merchant|google shopping|gmc|performance max|pmax|google ads/.test(t)) return "merchant";
  if (/légal|legal|mention|cgv|retour|livraison|confidential|politique|contact|\bpage\b/.test(t)) return "legal";
  if (/faq|section|réassur|reassur|hero|bandeau|bloc/.test(t)) return "section";
  if (/liquid|\bcode\b|snippet|thème|theme/.test(t)) return "code";
  if (/avis|review|témoignage|temoignage/.test(t)) return "reviews";
  if (/\bapp\b|application|plugin|app store|installer une app|quelle app/.test(t)) return "app";
  if (/page produit|fiche produit|modifier (un|une|le|ma) produit/.test(t)) return "product";
  if (/erreur|bug|marche pas|ne fonctionne|problème (d|s)|cassé/.test(t)) return "error";
  return "generic";
}

type Analysis = ReturnType<typeof useOrkestra.getState>["analysis"];
type Brand = ReturnType<typeof useOrkestra.getState>["brand"];

function resolveAnswer(q: string, analysis: Analysis, brand: Brand): AssistantProc {
  const topic = detectTopic(q);
  const coll = brand.collections?.[0] || "votre collection";
  const english = analysis?.englishTexts?.slice(0, 6).map((e) => ({ text: e.text, suggestion: e.suggestion })) ?? [];
  const products = analysis?.priorityProducts?.slice(0, 5).map((p) => ({ title: p.title })) ?? [];
  const missingLegal = analysis?.legalPages?.filter((l) => !l.found).map((l) => l.label) ?? [];

  switch (topic) {
    case "meta":
      return {
        title: "Modifier les meta (title & description)", short: "Ça se passe dans l'« Aperçu du référencement naturel » de la page concernée.",
        steps: ["Allez dans Shopify → Produits, Collections ou Pages.", "Ouvrez la page concernée.", "Descendez jusqu'à « Aperçu du référencement naturel ».", "Cliquez sur « Modifier ».", "Renseignez le title (≤ 60 car.) et la meta description (≤ 155 car.).", "Enregistrez, puis relancez un scan Orkestra."],
        note: "Title = phrase descriptive + marque. Évitez « Achetez maintenant », « Qualité premium ».",
        products: products.length ? products : undefined,
        council: { label: "Générer les metas (Content Factory)", href: "/seo" }, seo: true,
        nextActions: [{ label: "Voir les meta manquantes", q: "Quelles meta sont manquantes et où les corriger ?" }],
      };
    case "english":
      return {
        title: "Corriger les textes en anglais", short: "Via l'éditeur de contenu du thème, dans les paramètres de langue.",
        steps: ["Allez dans Shopify → Paramètres → Langues.", "Cliquez sur la langue active de la boutique.", "Cliquez sur « Modifier le contenu du thème ».", "Recherchez le texte anglais détecté (« Add to cart »…).", "Remplacez-le par la traduction française.", "Enregistrez. Vérifiez aussi les apps tierces."],
        note: "Impact : un libellé anglais réduit la confiance (signal Merchant). Priorité : haute.",
        english: english.length ? english : undefined,
        council: { label: "Lister les corrections (AI Council)", href: councilLink("merchant", "Liste les textes anglais détectés et propose les corrections en français.") },
      };
    case "collection":
      return {
        title: "Ajouter du texte à une collection", short: "Dans le champ Description de la collection, avec une structure SEO.",
        steps: ["Allez dans Shopify → Produits → Collections.", `Ouvrez la collection concernée (ex. « ${coll} »).`, "Ajoutez un texte dans le champ « Description ».", "Structure : intro 150–250 mots + H2/H3 si le thème les affiche.", "Pour une FAQ, créez une section via AI Council → Code Shopify.", "Enregistrez et vérifiez le rendu."],
        note: "La description cible une requête transactionnelle : placez le mot-clé dans le 1er paragraphe et le H1.",
        council: { label: "Générer le contenu (Content Factory)", href: "/seo" }, seo: true,
      };
    case "alt":
      return {
        title: "Ajouter / corriger les alt text", short: "Dans la section Médias du produit.",
        steps: ["Ouvrez le produit (ou la collection) dans Shopify.", "Section « Médias » → survolez l'image → « Modifier le texte alternatif ».", "Rédigez un alt descriptif et naturel (ce que montre l'image).", "Évitez le bourrage de mots-clés.", "Enregistrez."],
        note: "Mineur pour Merchant, mais utile pour le SEO images et l'accessibilité.",
        products: products.length ? products : undefined, seo: true,
        council: { label: "Générer les alt text (Content Factory)", href: "/seo" },
      };
    case "product_type":
      return {
        title: "Renseigner le type de produit", short: "Dans le bloc « Organisation du produit ».",
        steps: ["Ouvrez le produit dans Shopify → Produits.", "Bloc « Organisation du produit » (colonne de droite).", "Renseignez « Type de produit » (ex. « Lustre », « Tapis »).", "Restez cohérent d'un produit à l'autre.", "Enregistrez."],
        note: "Le product_type fiabilise la catégorisation et le flux Google Shopping.",
        products: products.length ? products : undefined,
      };
    case "tags":
      return {
        title: "Ajouter des tags produit", short: "Dans « Organisation du produit » → Tags.",
        steps: ["Ouvrez le produit → bloc « Organisation du produit ».", "Champ « Tags » : ajoutez des tags cohérents (style, usage, matériau).", "Réutilisez-les pour des collections automatiques.", "Enregistrez."],
        note: "Des tags cohérents améliorent navigation, filtrage et flux catalogue.",
      };
    case "h1":
      return {
        title: "Corriger les H1 multiples", short: "Dans l'éditeur de thème, un seul titre principal par page.",
        steps: ["Shopify → Boutique en ligne → Thèmes → Personnaliser.", "Ouvrez la page concernée (accueil, collection, produit).", "Vérifiez qu'un seul bloc sert de titre principal (H1).", "Si un logo/slogan est en H1, ajustez via les réglages ou « Modifier le code ».", "Enregistrez et republiez."],
        note: "Un seul H1 par page = meilleure structure sémantique.",
      };
    case "legal":
      return {
        title: "Trouver / créer les pages légales", short: "Politiques dans Paramètres, autres pages dans Boutique en ligne → Pages.",
        steps: ["Politiques : Shopify → Paramètres → Politiques (retour, livraison, confidentialité, CGV).", "Autres pages (Contact, FAQ, À propos) : Boutique en ligne → Pages → « Ajouter une page ».", "Liez ces pages dans le menu du footer.", "Vérifiez qu'elles sont accessibles publiquement."],
        note: "Pages essentielles pour Merchant : contact, retours, livraison, mentions, confidentialité.",
        missingLegal: missingLegal.length ? missingLegal : undefined,
        council: { label: "Rédiger les politiques (AI Council)", href: councilLink("merchant", "Rédige mes politiques de retour, de livraison et de confidentialité, prêtes à publier.") },
      };
    case "merchant":
      return {
        title: "Préparer Google Merchant Center", short: "Passez par Merchant Shield pour l'audit complet avant soumission.",
        steps: ["Ouvrez Merchant Shield (audit basé sur le scan).", "Corrigez d'abord les risques critiques (pages légales, langue).", "Complétez les données produit (type, descriptions, meta).", "Vérifiez les promotions et la cohérence prix.", "Relancez l'audit, puis préparez le feed."],
        note: "Orkestra réduit les risques visibles. Google reste seul décisionnaire de l'approbation.",
        council: { label: "Audit Merchant (AI Council)", href: councilLink("merchant", "Fais un audit Merchant Center complet de ma boutique.") },
        nextActions: [{ label: "Ouvrir Merchant Shield", q: "" }],
      };
    case "section":
      return {
        title: "Ajouter une section (FAQ, réassurance…)", short: "Via l'éditeur de thème ou un fichier de section.",
        steps: ["Shopify → Boutique en ligne → Thèmes → Personnaliser.", "Cliquez sur « Ajouter une section » à l'endroit voulu.", "Pour du sur-mesure : ⋯ → Modifier le code → Sections → nouveau fichier.", "Collez le code généré, configurez, Enregistrez."],
        note: "Pour générer une vraie section (Liquid + schema + CSS), utilisez AI Council → Code Shopify.",
        council: { label: "Générer la section (Code Shopify)", href: councilLink("code", "Crée une section FAQ premium pour ma boutique.") },
      };
    case "code":
      return {
        title: "Ajouter du code Liquid", short: "Dans Modifier le code du thème (idéalement un thème dupliqué).",
        steps: ["Shopify → Boutique en ligne → Thèmes → ⋯ → Modifier le code.", "Ouvrez/créez la section ou le snippet.", "Insérez votre code Liquid.", "Enregistrez et vérifiez le rendu dans l'aperçu."],
        note: "Travaillez sur un thème dupliqué pour tester sans risque.",
        council: { label: "Générer du code (Code Shopify)", href: councilLink("code", "Génère une section Shopify propre et responsive.") },
      };
    case "reviews":
      return {
        title: "Ajouter des avis clients", short: "Vérifiez d'abord le bloc avis natif du thème, sinon une app d'avis.",
        steps: ["Dans Personnaliser, cherchez une section/bloc « Avis » déjà fourni par votre thème.", "Sinon, installez une app de catégorie « avis clients » depuis l'App Store Shopify.", "Ajoutez la section sur la page produit, au-dessus de la ligne de flottaison."],
        note: "Avant d'ajouter une app, vérifiez si le thème le permet nativement (plus léger). Sinon, choisissez une app de type avis clients — je ne recommande pas d'app au hasard.",
      };
    case "app":
      return {
        title: "Faut-il ajouter une app Shopify ?", short: "Privilégiez d'abord le natif Shopify ; n'ajoutez une app que si nécessaire.",
        steps: ["Vérifiez si Shopify ou votre thème le permet nativement (réglages, sections, blocs).", "Si oui : utilisez le natif (plus léger, moins de conflits).", "Si non : cherchez une app de la bonne catégorie sur l'App Store Shopify.", "Comparez avis, vitesse et impact sur la page avant d'installer."],
        note: "Catégories utiles selon le besoin : avis clients, FAQ, bundles, suivi de commande, traduction, SEO, Google & YouTube, upsell. Précisez votre besoin pour une catégorie adaptée — je n'invente pas d'app et ne promets pas qu'une app règle tout.",
      };
    case "product":
      return {
        title: "Modifier une page produit", short: "Contenu dans Produits, mise en page dans le thème.",
        steps: ["Contenu (titre, description, prix, images, type, tags) : Shopify → Produits → ouvrez le produit.", "SEO du produit : bas de page → Aperçu du référencement naturel → Modifier.", "Mise en page de la page produit : Boutique en ligne → Thèmes → Personnaliser → modèle Produit.", "Enregistrez."],
        note: "Distinguez le contenu (Produits) de la mise en page (éditeur de thème).",
        products: products.length ? products : undefined, seo: true,
      };
    case "error":
      return {
        title: "Comprendre une erreur Shopify", short: "Je raisonne avec les chemins habituels — précisez la page et le message.",
        steps: ["Notez le message exact et la page où il apparaît.", "Erreur d'affichage → Boutique en ligne → Thèmes → Personnaliser (ou Modifier le code).", "Erreur de réglage → Paramètres (paiement, expédition, taxes…).", "Erreur d'app → ouvrez l'app concernée dans Applications.", "Donnez-moi le message exact pour un chemin plus précis."],
        note: "Pas de recherche web branchée : je m'appuie sur les chemins Shopify habituels et votre scan.",
        council: { label: "Analyser avec AI Council", href: councilLink("free", q) },
      };
    default:
      return {
        title: "Où agir dans Shopify ?", short: "Selon votre demande, il y a plusieurs endroits possibles dans Shopify — voici les plus probables.",
        steps: [
          "Contenu produit (titre, prix, images, type, tags) → Produits → ouvrez le produit.",
          "Contenu collection (texte, produits liés) → Produits → Collections.",
          "Pages & politiques (contact, FAQ, retours, livraison) → Boutique en ligne → Pages / Paramètres → Politiques.",
          "Mise en page & visuel → Boutique en ligne → Thèmes → Personnaliser (ou Modifier le code).",
          "Langues & traductions → Paramètres → Langues.",
        ],
        note: "Dites-moi la page concernée (accueil, produit, collection, politique…) et je vous donne le chemin exact. Connectez OpenAI pour un raisonnement plus poussé (pas de recherche web branchée).",
        council: { label: "Analyser avec AI Council", href: councilLink("free", q) },
      };
  }
}

export default function AssistantPage() {
  const { analysis, brand, connections, assistantMessages, addAssistantTurn, clearAssistant } = useOrkestra();
  const providers = connectedProviders(connections);
  const openaiLive = Boolean(connections.openai?.connected && connections.openai?.live);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoRan = useRef(false);

  async function send(q?: string) {
    const text = (q ?? input).trim();
    if (!text || loading) return;
    setInput("");
    addAssistantTurn({ id: crypto.randomUUID(), role: "user", text });
    const topic = detectTopic(text);
    if (topic !== "generic") {
      addAssistantTurn({ id: crypto.randomUUID(), role: "assistant", proc: resolveAnswer(text, analysis, brand) });
      return;
    }
    // Demande hors-procédure : OpenAI live si connecté, sinon raisonnement prudent.
    if (openaiLive) {
      setLoading(true);
      try {
        const res = await fetch("/api/generate", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "council", mode: "free", question: text, providers, keyRefs: { openai: connections.openai?.keyId },
            context: { brandName: brand.storeName || undefined, niche: brand.niche || undefined, positioning: brand.positioning, language: brand.language, collections: brand.collections, productTypes: brand.productTypes, englishCount: analysis?.englishTexts?.length, missingMeta: analysis?.metrics?.missingMetaDescriptions, imagesNoAlt: analysis?.metrics?.imagesWithoutAlt },
          }),
        });
        const data = await res.json();
        const ai = data.ok ? (data.result.finalAnswer as string) : null;
        addAssistantTurn({ id: crypto.randomUUID(), role: "assistant", proc: ai ? { title: "Réponse Orkestra", ai, steps: [] } : resolveAnswer(text, analysis, brand) });
      } catch {
        addAssistantTurn({ id: crypto.randomUUID(), role: "assistant", proc: resolveAnswer(text, analysis, brand) });
      } finally { setLoading(false); }
    } else {
      addAssistantTurn({ id: crypto.randomUUID(), role: "assistant", proc: resolveAnswer(text, analysis, brand) });
    }
  }

  // ?q= prérempli (depuis Merchant Shield / AI Council) — auto-envoyé une fois.
  useEffect(() => {
    if (autoRan.current) return;
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) { autoRan.current = true; send(q); window.history.replaceState({}, "", "/assistant"); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [assistantMessages, loading]);

  // Suggestions contextuelles (problèmes RÉELS du scan).
  const cs = analysis?.catalogStats;
  const eng = analysis?.englishTexts?.length ?? 0;
  const missMeta = analysis?.metrics?.missingMetaDescriptions ?? 0;
  const noType = cs?.noType ?? 0;
  const noAlt = cs?.imagesNoAlt ?? analysis?.metrics?.imagesWithoutAlt ?? 0;
  const missLegal = analysis?.legalPages?.filter((l) => !l.found && l.essential).length ?? 0;
  const detected: { label: string; q: string; icon: React.ElementType }[] = [];
  if (eng > 0) detected.push({ label: `Corriger les textes anglais (${eng})`, q: "Où corriger les textes anglais détectés ?", icon: Languages });
  if (missMeta > 0) detected.push({ label: `Meta descriptions manquantes (${missMeta})`, q: "Où ajouter les meta descriptions manquantes ?", icon: FileText });
  if (noType > 0) detected.push({ label: `Product_type manquants (${noType})`, q: "Où corriger les product_type manquants ?", icon: Tag });
  if (noAlt > 0) detected.push({ label: `Alt text manquants (${noAlt})`, q: "Où ajouter les alt text des images ?", icon: ImageIcon });
  if (missLegal > 0) detected.push({ label: "Trouver les pages légales", q: "Où trouver et créer mes pages légales ?", icon: ShieldCheck });
  detected.push({ label: "Optimiser une collection", q: "Où ajouter du texte à une collection ?", icon: FolderOpen });
  detected.push({ label: "Corriger les H1 multiples", q: "Où corriger les H1 multiples ?", icon: Heading1 });

  const homeCards: { label: string; q: string; icon: React.ElementType }[] = [
    ...detected.slice(0, 5),
    { label: "Préparer Google Merchant", q: "Comment préparer ma boutique pour Google Merchant Center ?", icon: ShieldCheck },
    { label: "Modifier une page produit", q: "Où modifier une page produit dans Shopify ?", icon: Package },
    { label: "Ajouter une FAQ collection", q: "Comment ajouter une FAQ à une collection ?", icon: HelpCircle },
    { label: "Comprendre une erreur Shopify", q: "Je ne comprends pas une erreur dans Shopify, peux-tu m'aider ?", icon: Wrench },
  ];
  const bigCards = [
    { icon: Wrench, title: "Corriger un problème détecté", sub: "Textes anglais, meta, alt text, product_type, H1, politiques", q: detected[0]?.q || "Où corriger les textes anglais ?" },
    { icon: MapPin, title: "Trouver où cliquer dans Shopify", sub: "Produits, collections, pages, thème, politiques, langues", q: "Où modifier une page produit dans Shopify ?" },
    { icon: ShieldCheck, title: "Améliorer ma boutique", sub: "SEO, Merchant Center, Google Shopping, conversion", q: "Comment préparer ma boutique pour Google Merchant Center ?" },
  ];

  return (
    <>
      <PageHeader
        title="Assistant Shopify"
        description="Exécution pas-à-pas : où cliquer dans Shopify, quoi modifier, et comment corriger vos problèmes détectés."
        actions={assistantMessages.length > 0 ? <Button variant="ghost" onClick={clearAssistant} icon={<Trash2 className="h-4 w-4" />}>Effacer</Button> : undefined}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="flex h-[620px] flex-col p-0">
            <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
              <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white"><MapPin className="h-4 w-4" /></div>
              <span className="text-sm font-semibold">Où je clique dans Shopify ?</span>
              <Badge tone="brand" className="ml-auto">Exécution</Badge>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
              {assistantMessages.length === 0 ? (
                <div className="py-2 ork-rise">
                  <div className="flex flex-col items-center text-center">
                    <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-pop"><LifeBuoy className="h-7 w-7" /></div>
                    <h3 className="mt-4 text-base font-semibold">Bonjour, je suis votre assistant Shopify</h3>
                    <p className="mt-1.5 max-w-sm text-sm text-[var(--text-muted)]">Dites-moi ce que vous voulez corriger — je vous guide étape par étape.</p>
                  </div>
                  <div className="ork-stagger mt-5 grid gap-2.5 sm:grid-cols-3">
                    {bigCards.map((c) => {
                      const Icon = c.icon;
                      return (
                        <button key={c.title} onClick={() => send(c.q)} className="ork-interactive group flex flex-col gap-1 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3.5 text-left hover:border-brand-300">
                          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:scale-105 dark:bg-brand-950 dark:text-brand-300"><Icon className="h-[18px] w-[18px]" /></span>
                          <span className="mt-1 text-sm font-semibold leading-tight">{c.title}</span>
                          <span className="text-xs leading-relaxed text-[var(--text-muted)]">{c.sub}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wide text-ink-400">{detected.length >= 3 ? "Détecté dans votre scan" : "Actions fréquentes"}</div>
                  <div className="ork-stagger grid gap-2 sm:grid-cols-2">
                    {homeCards.map((c) => {
                      const Icon = c.icon;
                      return (
                        <button key={c.label} onClick={() => send(c.q)} className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] px-3.5 py-3 text-left text-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:bg-ink-50 dark:hover:bg-ink-900">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300"><Icon className="h-4 w-4" /></span>
                          <span className="min-w-0 flex-1">{c.label}</span>
                          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-400" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                assistantMessages.map((m) =>
                  m.role === "user" ? (
                    <div key={m.id} className="flex justify-end"><div className="ork-rise max-w-[85%] rounded-2xl rounded-br-md bg-brand-600 px-4 py-2.5 text-sm text-white shadow-soft">{m.text}</div></div>
                  ) : (
                    <AssistantAnswer key={m.id} proc={m.proc} onFollow={send} />
                  )
                )
              )}
              {loading && <Thinking />}
            </div>

            <div className="border-t border-[var(--border)] p-3">
              <div className="flex items-end gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-1.5 transition focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-500/10">
                <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Ex : Où modifier les meta descriptions ?" className="flex-1 bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-ink-400" />
                <Button onClick={() => send()} loading={loading} icon={!loading ? <Send className="h-4 w-4" /> : undefined}>Demander</Button>
              </div>
              {openaiLive && <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">OpenAI connecté — les demandes hors-procédure sont raisonnées par l&apos;IA (pas de recherche web).</p>}
            </div>
          </Card>
        </div>

        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold"><Lightbulb className="h-4 w-4 text-brand-600" /> Corrections fréquentes</h3>
            <p className="mb-3 text-xs text-[var(--text-muted)]">{detected.length >= 3 ? "Basées sur les problèmes détectés dans votre scan." : "Scannez votre boutique pour des suggestions ciblées."}</p>
            <div className="space-y-2">
              {detected.slice(0, 7).map((s) => {
                const Icon = s.icon;
                return (
                  <button key={s.label} onClick={() => send(s.q)} className="flex w-full items-center gap-2.5 rounded-xl border border-[var(--border)] px-3 py-2.5 text-left text-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:bg-ink-50 dark:hover:bg-ink-900">
                    <Icon className="h-4 w-4 shrink-0 text-brand-500" /><span className="min-w-0 flex-1 truncate">{s.label}</span><ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-400" />
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Vue publique vs interne — préparation API Shopify (placeholder) */}
          <Card className="border-dashed">
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Database className="h-4 w-4 text-brand-600" /> Analyse interne Shopify</h3>
              <Badge tone="neutral">Bientôt</Badge>
            </div>
            <div className="mt-2 space-y-2 text-xs text-[var(--text-muted)]">
              <p><span className="font-medium text-[var(--text)]">Vue client (actuelle) :</span> ce que Google et vos visiteurs voient.</p>
              <p><span className="font-medium text-[var(--text)]">Vue interne (API Shopify) :</span> produits, collections, meta, alt text, pages, prix, variants — pour une localisation exacte des problèmes et des corrections produit par produit.</p>
            </div>
            <Button variant="outline" size="sm" disabled className="mt-3 w-full">Connecter l&apos;API Shopify — bientôt</Button>
          </Card>
        </div>
      </div>
    </>
  );
}

function Thinking() {
  const lines = ["Je regarde le problème…", "Je vérifie le chemin Shopify le plus probable…", "Je m'appuie sur votre scan public…"];
  return (
    <div className="max-w-[92%] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-soft">
      <div className="space-y-1.5">
        {lines.map((l, i) => (
          <div key={i} className="flex items-center gap-2 text-sm text-[var(--text-muted)]" style={{ opacity: 0.5 + i * 0.2 }}>
            <Sparkles className="h-3.5 w-3.5 animate-pulse text-brand-500" /> {l}
          </div>
        ))}
      </div>
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [c, setC] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setC(true); setTimeout(() => setC(false), 1400); }} className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--text-muted)] transition hover:text-brand-600">
      {c ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}{c ? "Copié" : "Copier"}
    </button>
  );
}

function AssistantAnswer({ proc, onFollow }: { proc: AssistantProc; onFollow: (q: string) => void }) {
  // Réponse IA live (markdown) pour les demandes hors-procédure.
  if (proc.ai) {
    return (
      <div className="ork-rise max-w-[94%] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-soft">
        <div className="mb-2 flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white"><Sparkles className="h-3.5 w-3.5" /></span><h4 className="text-sm font-bold">{proc.title}</h4><Badge tone="good" className="ml-auto">OpenAI</Badge></div>
        <div className="min-w-0 break-words"><Markdown content={proc.ai} /></div>
        <p className="mt-2 text-[11px] text-[var(--text-muted)]">Raisonné par l&apos;IA à partir de votre contexte (pas de recherche web).</p>
      </div>
    );
  }
  return (
    <div className="ork-rise max-w-[92%] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-soft">
      <div className="mb-2 flex items-center gap-2"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300"><MapPin className="h-3.5 w-3.5" /></span><h4 className="text-sm font-bold">{proc.title}</h4></div>
      {proc.short && <p className="mb-2.5 text-sm text-[var(--text-muted)]">{proc.short}</p>}
      <ol className="space-y-1.5">
        {proc.steps.map((s, j) => (
          <li key={j} className="flex gap-2.5 text-sm leading-relaxed text-[var(--text-muted)]"><span className="mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-md bg-brand-50 text-[10px] font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">{j + 1}</span><span className="min-w-0">{s}</span></li>
        ))}
      </ol>

      {proc.note && <div className="mt-3 rounded-xl border-l-[3px] border-brand-400 bg-[var(--bg)] py-2 pl-3 pr-2.5 text-xs text-[var(--text-muted)]"><span className="font-semibold text-[var(--text)]">À savoir : </span>{proc.note}</div>}

      {proc.english && (
        <div className="mt-3">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">Textes anglais détectés</div>
          <div className="space-y-1.5">{proc.english.map((e, i) => (
            <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1.5 text-xs"><span className="min-w-0 truncate"><code className="font-mono text-red-600 dark:text-red-300">{e.text}</code> → <code className="font-mono text-emerald-600 dark:text-emerald-300">{e.suggestion}</code></span><CopyBtn text={e.suggestion} /></div>
          ))}</div>
        </div>
      )}
      {proc.products && (
        <div className="mt-3"><div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">Pages / produits concernés</div><div className="flex flex-wrap gap-1.5">{proc.products.map((p, i) => <span key={i} className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1 text-xs"><span className="block max-w-[200px] truncate">{p.title}</span></span>)}</div></div>
      )}
      {proc.missingLegal && (
        <div className="mt-3"><div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">Pages manquantes détectées</div><div className="flex flex-wrap gap-1.5">{proc.missingLegal.map((l, i) => <Badge key={i} tone="bad">{l}</Badge>)}</div></div>
      )}

      <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
        {proc.council && <Link href={proc.council.href}><Button variant="secondary" size="sm" icon={<Sparkles className="h-3.5 w-3.5" />}>{proc.council.label}</Button></Link>}
        {proc.seo && <Link href="/seo"><Button variant="outline" size="sm" icon={<Wrench className="h-3.5 w-3.5" />}>Ouvrir Content Factory</Button></Link>}
        <Link href={councilLink("free", `Contexte : procédure « ${proc.title} » vue dans l'Assistant Shopify. Explique uniquement l'impact SEO / Merchant / conversion de cette correction, sans refaire l'audit complet.`)}><Button variant="ghost" size="sm" icon={<TrendingUp className="h-3.5 w-3.5" />}>Expliquer l&apos;impact</Button></Link>
        {proc.nextActions?.filter((n) => n.q).map((n) => <Button key={n.label} variant="ghost" size="sm" icon={<ArrowRight className="h-3.5 w-3.5" />} onClick={() => onFollow(n.q)}>{n.label}</Button>)}
      </div>
    </div>
  );
}

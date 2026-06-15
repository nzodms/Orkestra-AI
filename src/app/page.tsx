import Link from "next/link";
import {
  Sparkles,
  ShieldCheck,
  Blocks,
  Brain,
  MessagesSquare,
  Plug,
  ArrowRight,
  Check,
} from "lucide-react";

const FEATURES = [
  { icon: Sparkles, title: "Command Center", desc: "Score santé boutique, pertes potentielles et prochaine action utile en un coup d'œil." },
  { icon: Brain, title: "Data Lens", desc: "La vérité de votre tunnel : sessions, paniers, commandes et incohérences réconciliées." },
  { icon: Blocks, title: "Product Studio", desc: "Fiches faibles détectées, corrigées et exportées en CSV prêt pour Shopify." },
  { icon: MessagesSquare, title: "Growth Actions", desc: "Une file d'actions priorisées par impact réel, applicables maintenant." },
  { icon: ShieldCheck, title: "Données fiables", desc: "Un score de confiance sur chaque source avant de décider quoi que ce soit." },
  { icon: Plug, title: "BYOK", desc: "Vos clés OpenAI, Claude, Gemini… Vos crédits, jamais les nôtres." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="text-base font-bold">Orkestra AI</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)]">
            Se connecter
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
          >
            Entrer dans l&apos;app <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-60" />
        <div className="relative mx-auto max-w-4xl px-5 py-20 text-center sm:py-28">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 dark:border-brand-900 dark:bg-brand-950 dark:text-brand-300">
            <Sparkles className="h-3.5 w-3.5" /> Données réelles + IA, une seule app premium
          </div>
          <h1 className="text-balance text-4xl font-bold leading-[1.1] tracking-tight sm:text-6xl">
            Le copilote e-commerce qui lit les <span className="text-gradient">vraies données</span> de
            votre boutique
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-[var(--text-muted)]">
            Orkestra réconcilie vos données Shopify, détecte où vous perdez de l'argent,
            puis vous donne les actions IA prêtes à appliquer — fiches produit, SEO,
            conversion et Merchant Center.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/onboarding"
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-brand-600 px-6 text-sm font-semibold text-white shadow-pop hover:bg-brand-700"
            >
              Connecter ma boutique <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex h-12 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-6 text-sm font-semibold hover:bg-ink-50 dark:hover:bg-ink-900"
            >
              Voir la démo
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-[var(--text-muted)]">
            {["BYOK — vos propres clés IA", "Sans engagement", "Pensé pour Shopify 2.0"].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-500" /> {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-5 pb-24">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="card p-6 transition hover:shadow-pop">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-[var(--text-muted)]">{f.desc}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-10 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 p-10 text-center text-white">
          <h2 className="text-2xl font-bold sm:text-3xl">Prêt à orchestrer vos IA ?</h2>
          <p className="mx-auto mt-3 max-w-xl text-brand-100">
            Rejoignez la bêta. Connectez vos clés, scannez votre boutique et générez votre
            premier contenu SEO en quelques minutes.
          </p>
          <Link
            href="/onboarding"
            className="mt-6 inline-flex h-12 items-center gap-2 rounded-xl bg-white px-6 text-sm font-semibold text-brand-700 hover:bg-brand-50"
          >
            Démarrer maintenant <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-[var(--border)] py-8 text-center text-xs text-[var(--text-muted)]">
        Orkestra AI — Le copilote multi-IA pour optimiser les boutiques Shopify.
      </footer>
    </div>
  );
}

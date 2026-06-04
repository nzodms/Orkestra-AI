"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Sparkles,
  MessagesSquare,
  ShieldCheck,
  LifeBuoy,
  Brain,
  History,
  Settings,
  Plug,
  Store,
  Boxes,
} from "lucide-react";

const NAV: { group: string; items: { href: string; label: string; icon: React.ElementType }[] }[] = [
  {
    group: "Pilotage",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/memory", label: "Mémoire boutique", icon: Brain },
    ],
  },
  {
    group: "Studios",
    items: [
      { href: "/seo", label: "Import Factory", icon: Boxes },
      { href: "/council", label: "AI Council", icon: MessagesSquare },
      { href: "/merchant", label: "Merchant Shield", icon: ShieldCheck },
      { href: "/assistant", label: "Assistant Shopify", icon: LifeBuoy },
    ],
  },
  {
    group: "Compte",
    items: [
      { href: "/connect", label: "Connecter mes IA", icon: Plug },
      { href: "/history", label: "Historique", icon: History },
      { href: "/settings", label: "Paramètres", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] lg:flex">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-soft">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-bold text-[var(--text)]">Orkestra AI</div>
          <div className="text-[10px] text-[var(--text-muted)]">Copilote multi-IA Shopify</div>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {NAV.map((section) => (
          <div key={section.group}>
            <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
              {section.group}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150 hover:translate-x-0.5",
                      active
                        ? "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-200"
                        : "text-[var(--text-muted)] hover:bg-ink-50 hover:text-[var(--text)] dark:hover:bg-ink-900"
                    )}
                  >
                    <Icon className={cn("h-[18px] w-[18px] transition-transform group-hover:scale-110", active && "text-brand-600 dark:text-brand-300")} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="m-3 rounded-2xl border border-[var(--border)] bg-gradient-to-br from-brand-50 to-transparent p-4 dark:from-brand-950/40">
        <div className="flex items-center gap-2 text-xs font-semibold text-brand-700 dark:text-brand-300">
          <Store className="h-4 w-4" /> Plan Bêta
        </div>
        <p className="mt-1 text-[11px] text-[var(--text-muted)]">
          Accès anticipé. Vos clés IA, vos crédits, votre boutique.
        </p>
      </div>
    </aside>
  );
}

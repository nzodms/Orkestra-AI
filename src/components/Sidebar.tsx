"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { VoiceSidebarEntry } from "./voice/VoiceSidebarEntry";
import {
  Gauge,
  Activity,
  Boxes,
  ListChecks,
  Settings,
  Sparkles,
  MessagesSquare,
} from "lucide-react";

const NAV: { href: string; label: string; desc: string; icon: React.ElementType }[] = [
  { href: "/command-center", label: "Command Center", desc: "Vue globale & priorités", icon: Gauge },
  { href: "/data-lens", label: "Data Lens", desc: "Tunnel & fiabilité data", icon: Activity },
  { href: "/product-studio", label: "Product Studio", desc: "Optimisation produits", icon: Boxes },
  { href: "/growth-actions", label: "Growth Actions", desc: "File d’actions priorisées", icon: ListChecks },
  { href: "/settings", label: "Réglages & connexions", desc: "Shopify · IA · data", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="relative z-10 hidden w-[264px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)]/70 backdrop-blur-xl lg:flex">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-[0_8px_20px_-8px_rgba(36,89,230,0.7)]">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-bold tracking-tight text-[var(--text)]">Orkestra</div>
          <div className="text-[10px] text-[var(--text-muted)]">Copilote e-commerce</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all",
                active
                  ? "bg-gradient-to-r from-brand-50 to-transparent dark:from-brand-950/60"
                  : "hover:bg-[var(--bg)]"
              )}
            >
              {active && <span className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-brand-600" />}
              <span
                className={cn(
                  "grid h-8 w-8 shrink-0 place-items-center rounded-lg transition",
                  active
                    ? "bg-brand-600 text-white shadow-[0_6px_16px_-6px_rgba(36,89,230,0.7)]"
                    : "bg-[var(--bg)] text-[var(--text-muted)] group-hover:text-[var(--text)]"
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-[var(--text)]">{item.label}</span>
                <span className="block truncate text-[11px] text-[var(--text-muted)]">{item.desc}</span>
              </span>
            </Link>
          );
        })}
      </nav>

      <VoiceSidebarEntry />

      <div className="px-3 pb-3">
        <Link
          href="/council"
          className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-gradient-to-br from-brand-50 to-teal-50/50 p-3 transition hover:shadow-soft dark:from-brand-950/40 dark:to-teal-950/20"
        >
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/70 text-brand-600 dark:bg-white/5 dark:text-brand-300">
            <MessagesSquare className="h-[18px] w-[18px]" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-[var(--text)]">Copilote IA</div>
            <div className="truncate text-[11px] text-[var(--text-muted)]">Posez une question à Orkestra</div>
          </div>
        </Link>
      </div>
    </aside>
  );
}

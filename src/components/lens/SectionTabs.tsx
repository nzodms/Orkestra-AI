"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface SectionTab {
  href: string;
  label: string;
}

/**
 * Barre d'onglets interne à une section (ex : Product Studio = Optimisation +
 * Import catalogue). Permet de ranger les outils existants (Import Factory,
 * Orkestra Lens) sous les 5 sections sans dupliquer la navigation principale.
 */
export function SectionTabs({ tabs }: { tabs: SectionTab[] }) {
  const pathname = usePathname();
  return (
    <div className="mb-5 inline-flex items-center gap-1 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 p-1 backdrop-blur-xl">
      {tabs.map((t) => {
        const active = pathname === t.href || pathname.startsWith(t.href + "/");
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "rounded-xl px-3.5 py-1.5 text-sm font-medium transition",
              active
                ? "bg-brand-600 text-white shadow-[0_6px_16px_-8px_rgba(36,89,230,0.7)]"
                : "text-[var(--text-muted)] hover:text-[var(--text)]"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

export const PRODUCT_STUDIO_TABS: SectionTab[] = [
  { href: "/product-studio", label: "Optimisation produits" },
  { href: "/seo", label: "Import catalogue (CSV)" },
];

export const DATA_LENS_TABS: SectionTab[] = [
  { href: "/data-lens", label: "Vue d’ensemble" },
  { href: "/lens", label: "Sourcing & analyse" },
];

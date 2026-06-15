"use client";

import { useOrkestra, connectedProviders } from "@/lib/store";
import { Moon, Sun, Search, Sparkles, CheckCircle2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Badge } from "./ui/primitives";

export function Topbar() {
  const { theme, toggleTheme, connections, brand } = useOrkestra();
  const connected = connectedProviders(connections);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--surface)]/70 px-4 backdrop-blur-xl sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <div className="hidden items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg)]/60 px-3 py-2 text-sm text-[var(--text-muted)] sm:flex md:w-80">
          <Search className="h-4 w-4" />
          <input
            placeholder="Rechercher un produit, une action, une perte…"
            className="w-full bg-transparent outline-none placeholder:text-ink-400"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-2 lg:flex">
          <span className="chip bg-teal-50 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
            <ShieldCheck className="h-3.5 w-3.5" /> Data fiable à 79 %
          </span>
          {connected.length > 0 ? (
            <Badge tone="good">
              <CheckCircle2 className="h-3.5 w-3.5" /> {connected.length} IA connectée
              {connected.length > 1 ? "s" : ""}
            </Badge>
          ) : (
            <Link href="/settings">
              <Badge tone="warn">Connectez vos IA</Badge>
            </Link>
          )}
        </div>

        <button
          onClick={toggleTheme}
          className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--border)] text-[var(--text-muted)] transition hover:text-[var(--text)]"
          aria-label="Basculer le thème"
        >
          {theme === "light" ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
        </button>

        <Link href="/council" className="btn-primary hidden sm:inline-flex">
          <Sparkles className="h-4 w-4" /> Copilote IA
        </Link>

        <div className="ml-1 grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-xs font-bold text-white">
          {(brand.storeName || "OA").slice(0, 2).toUpperCase()}
        </div>
      </div>
    </header>
  );
}

"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Sparkles, Search, Home, KeyRound, CalendarDays, Link2, Map, ListChecks, Wrench,
  Copy, Check, FileText, Activity, AlertTriangle, CheckCircle2, ShoppingBag,
  FolderOpen, ClipboardList, Megaphone,
} from "lucide-react";

// ──────────────────────────────────────────────────────────────────────────
// Rendu markdown « rapport premium » pour les réponses de l'AI Council.
// Découpe la réponse en SECTIONS (## titres) rendues en cartes, avec icône et
// ton (déjà bon = vert, à corriger = rouge…). Gère : ### sous-titres, listes
// (puces premium, cases à cocher, chips copiables), tableaux stylés, citations
// en encadrés, blocs code copiables, badges de priorité et encadrés « chemin
// Shopify ». Conserve la DA (couleurs brand/ink, arrondis, ombres).
// ──────────────────────────────────────────────────────────────────────────

type Tone = "brand" | "good" | "warn" | "bad" | "neutral";

const pill: Record<Tone, string> = {
  brand: "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300",
  good: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  warn: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  bad: "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300",
  neutral: "bg-ink-100 text-ink-600 dark:bg-ink-900 dark:text-ink-300",
};
const cardBorder: Record<Tone, string> = {
  brand: "border-[var(--border)]",
  good: "border-emerald-200/70 dark:border-emerald-900/50",
  warn: "border-amber-200/70 dark:border-amber-900/50",
  bad: "border-red-200/70 dark:border-red-900/50",
  neutral: "border-[var(--border)]",
};
const headerBg: Record<Tone, string> = {
  brand: "bg-[var(--bg)]",
  good: "bg-emerald-50/70 dark:bg-emerald-950/25",
  warn: "bg-amber-50/70 dark:bg-amber-950/20",
  bad: "bg-red-50/70 dark:bg-red-950/20",
  neutral: "bg-[var(--bg)]",
};

// Priorité / sévérité → badge coloré inline (quand un **mot** seul correspond).
const PRIORITY: Record<string, Tone> = {
  haute: "bad", "élevée": "bad", critique: "bad", urgent: "bad", urgente: "bad",
  moyenne: "warn", moyen: "warn", important: "warn", importante: "warn",
  basse: "good", mineur: "good", mineure: "good", faible: "neutral",
};

// Titre de section → icône + ton (déduit de mots-clés, sans changer le fond).
function sectionMeta(rawTitle: string): { Icon: React.ElementType; tone: Tone; badge?: string } {
  const t = rawTitle.toLowerCase();
  if (/déjà bon|ne pas (re)?touch|points? forts?|déjà optimis/.test(t)) return { Icon: CheckCircle2, tone: "good", badge: "Ne pas toucher" };
  if (/bloque|à corriger|corriger maintenant|risques? critiques?/.test(t)) return { Icon: AlertTriangle, tone: "bad", badge: "À corriger" };
  if (/priorit/.test(t)) return { Icon: ListChecks, tone: "warn", badge: "Priorités" };
  if (/diagnostic/.test(t)) return { Icon: Activity, tone: "brand" };
  if (/page d.accueil|accueil|\bhome\b/.test(t)) return { Icon: Home, tone: "brand" };
  if (/collections?/.test(t)) return { Icon: FolderOpen, tone: "brand" };
  if (/produits?/.test(t)) return { Icon: ShoppingBag, tone: "brand" };
  if (/mots?[-\s]?clés?|keywords?/.test(t)) return { Icon: KeyRound, tone: "brand" };
  if (/titles?|meta|prêts? à copier/.test(t)) return { Icon: Copy, tone: "brand" };
  if (/contenus?\b/.test(t)) return { Icon: FileText, tone: "brand" };
  if (/maillage/.test(t)) return { Icon: Link2, tone: "brand" };
  if (/calendrier|éditorial|blog/.test(t)) return { Icon: CalendarDays, tone: "brand" };
  if (/routine/.test(t)) return { Icon: ClipboardList, tone: "brand" };
  if (/roadmap|30\s*jours/.test(t)) return { Icon: Map, tone: "brand" };
  if (/plan|7\s*jours/.test(t)) return { Icon: ListChecks, tone: "brand" };
  if (/chemins? shopify|où corriger|où dans shopify/.test(t)) return { Icon: Wrench, tone: "brand" };
  if (/actions? orkestra|modules?/.test(t)) return { Icon: Sparkles, tone: "brand" };
  if (/résumé|scan/.test(t)) return { Icon: Search, tone: "brand" };
  return { Icon: Megaphone, tone: "brand" };
}

// ── Inline : gras, code, badges de priorité, encadrés « Shopify → … » ───────
function inline(text: string, keyBase: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|Shopify\s*→[^\n.;·|]*)/g);
  return parts
    .filter((p) => p !== "" && p != null)
    .map((p, i) => {
      const key = `${keyBase}-${i}`;
      if (p.startsWith("**") && p.endsWith("**")) {
        const inner = p.slice(2, -2);
        const low = inner.trim().toLowerCase();
        let tone = PRIORITY[low];
        if (!tone) {
          if (/impact (moyen|modéré)/.test(low)) tone = "warn";
          else if (/impact (faible|bas)/.test(low)) tone = "neutral";
          else if (/impact (élevé|fort|haut)/.test(low)) tone = "bad";
        }
        if (tone) {
          return (
            <span key={key} className={cn("mx-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold", pill[tone])}>
              {inner}
            </span>
          );
        }
        return <strong key={key} className="font-semibold text-[var(--text)]">{inner}</strong>;
      }
      if (p.startsWith("`") && p.endsWith("`")) {
        return (
          <code key={key} className="rounded-md bg-ink-100 px-1.5 py-0.5 font-mono text-[0.85em] text-brand-700 dark:bg-ink-900 dark:text-brand-300">
            {p.slice(1, -1)}
          </code>
        );
      }
      if (/^Shopify\s*→/.test(p)) {
        return (
          <span key={key} className="rounded-md bg-brand-50/70 px-1.5 py-0.5 font-mono text-[11px] text-brand-700 [box-decoration-break:clone] dark:bg-brand-950/40 dark:text-brand-300">
            {p.trim()}
          </span>
        );
      }
      return <React.Fragment key={key}>{p}</React.Fragment>;
    });
}

// ── Boutons / chips copiables ───────────────────────────────────────────────
function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1400); }}
      className={cn("inline-flex items-center gap-1 text-[11px] font-medium text-[var(--text-muted)] transition hover:text-brand-600", className)}
      aria-label="Copier"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copié" : "Copier"}
    </button>
  );
}

function CopyChip({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="my-1 flex min-w-0 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1.5">
      <code className="min-w-0 flex-1 break-words font-mono text-[12px] text-[var(--text)]">{value}</code>
      <button
        type="button"
        onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1400); }}
        className="shrink-0 text-[var(--text-muted)] transition hover:text-brand-600"
        aria-label="Copier"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

// ── Sous-blocs ──────────────────────────────────────────────────────────────
function ListBlock({ ordered, items, kp }: { ordered: boolean; items: { text: string; checked?: boolean }[]; kp: string }) {
  return (
    <ul className="my-2 space-y-1.5">
      {items.map((it, i) => {
        const codeOnly = it.text.trim().match(/^`([^`]+)`$/);
        if (codeOnly) {
          return <li key={i}><CopyChip value={codeOnly[1]} /></li>;
        }
        return (
          <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-[var(--text-muted)]">
            {it.checked !== undefined ? (
              <span className={cn("mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border", it.checked ? "border-emerald-400 bg-emerald-500 text-white" : "border-[var(--border)]")}>
                {it.checked && <Check className="h-3 w-3" />}
              </span>
            ) : ordered ? (
              <span className="mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-md bg-brand-50 text-[10px] font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">{i + 1}</span>
            ) : (
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
            )}
            <span className="min-w-0 flex-1">{inline(it.text, `${kp}-${i}`)}</span>
          </li>
        );
      })}
    </ul>
  );
}

function TableBlock({ rows, kp }: { rows: string[]; kp: string }) {
  const clean = rows.filter((r) => !/^\s*\|?[\s|:-]+\|?\s*$/.test(r));
  const cells = clean.map((r) =>
    r.split("|").map((c) => c.trim()).filter((c, idx, arr) => !(idx === 0 && c === "") && !(idx === arr.length - 1 && c === ""))
  );
  const [head, ...body] = cells;
  if (!head) return null;
  return (
    <div className="my-3 overflow-x-auto rounded-xl border border-[var(--border)]">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-[var(--bg)] text-left">
          <tr>{head.map((h, i) => <th key={i} className="px-3 py-2 font-semibold text-[var(--text)]">{inline(h, `${kp}-th-${i}`)}</th>)}</tr>
        </thead>
        <tbody>
          {body.map((r, i) => (
            <tr key={i} className="border-t border-[var(--border)] even:bg-[var(--bg)]">
              {r.map((c, j) => <td key={j} className="px-3 py-2 align-top text-[var(--text-muted)]">{inline(c, `${kp}-td-${i}-${j}`)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QuoteBlock({ lines, kp }: { lines: string[]; kp: string }) {
  return (
    <div className="my-2.5 rounded-r-xl border-l-[3px] border-brand-400 bg-[var(--bg)] py-2 pl-3.5 pr-3 text-sm leading-relaxed text-[var(--text-muted)]">
      {lines.map((l, i) => <p key={i} className={i ? "mt-1" : ""}>{inline(l, `${kp}-${i}`)}</p>)}
    </div>
  );
}

function CodeBlock({ lang, body }: { lang: string; body: string }) {
  return (
    <div className="my-3 overflow-hidden rounded-xl border border-[var(--border)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg)] px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wide text-[var(--text-muted)]">{lang || "code"}</span>
        <CopyButton text={body} />
      </div>
      <pre className="overflow-x-auto bg-ink-950 p-4 text-xs leading-relaxed text-ink-100"><code>{body}</code></pre>
    </div>
  );
}

// ── Rendu des blocs d'une section (sans les ## qui sont gérés au-dessus) ─────
function renderBlocks(lines: string[], kp: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let list: { ordered: boolean; items: { text: string; checked?: boolean }[] } | null = null;
  let table: string[] | null = null;
  let quote: string[] | null = null;
  let code: { lang: string; body: string[] } | null = null;

  const flushList = () => { if (list) { out.push(<ListBlock key={`b${out.length}`} ordered={list.ordered} items={list.items} kp={`${kp}-${out.length}`} />); list = null; } };
  const flushTable = () => { if (table && table.length >= 1) { out.push(<TableBlock key={`b${out.length}`} rows={table} kp={`${kp}-${out.length}`} />); } table = null; };
  const flushQuote = () => { if (quote) { out.push(<QuoteBlock key={`b${out.length}`} lines={quote} kp={`${kp}-${out.length}`} />); quote = null; } };
  const flushCode = () => { if (code) { out.push(<CodeBlock key={`b${out.length}`} lang={code.lang} body={code.body.join("\n")} />); code = null; } };

  lines.forEach((line) => {
    if (/^```/.test(line)) {
      if (code) flushCode();
      else { flushList(); flushTable(); flushQuote(); code = { lang: line.replace(/^```/, "").trim(), body: [] }; }
      return;
    }
    if (code) { code.body.push(line); return; }

    if (/^\s*\|.*\|\s*$/.test(line)) { flushList(); flushQuote(); (table ??= []).push(line); return; }
    if (table) flushTable();

    if (/^>\s?/.test(line)) { flushList(); (quote ??= []).push(line.replace(/^>\s?/, "")); return; }
    if (quote) flushQuote();

    if (/^###\s/.test(line)) {
      flushList();
      out.push(<h3 key={`b${out.length}`} className="mb-1.5 mt-3.5 text-[13px] font-semibold text-[var(--text)] first:mt-0">{inline(line.replace(/^###\s/, ""), `${kp}-h3`)}</h3>);
      return;
    }
    if (/^\s*-\s\[.\]\s/.test(line)) {
      const checked = /\[x\]/i.test(line);
      const text = line.replace(/^\s*-\s\[.\]\s/, "");
      if (!list || list.ordered) { flushList(); list = { ordered: false, items: [] }; }
      list.items.push({ text, checked });
      return;
    }
    if (/^\s*[-*]\s/.test(line)) {
      if (!list || list.ordered) { flushList(); list = { ordered: false, items: [] }; }
      list.items.push({ text: line.replace(/^\s*[-*]\s/, "") });
      return;
    }
    if (/^\s*\d+\.\s/.test(line)) {
      if (!list || !list.ordered) { flushList(); list = { ordered: true, items: [] }; }
      list.items.push({ text: line.replace(/^\s*\d+\.\s/, "") });
      return;
    }
    if (/^\s*---\s*$/.test(line)) { flushList(); out.push(<hr key={`b${out.length}`} className="my-3 border-[var(--border)]" />); return; }
    if (line.trim() === "") { flushList(); return; }

    flushList();
    out.push(<p key={`b${out.length}`} className="my-2 text-sm leading-relaxed text-[var(--text-muted)]">{inline(line, `${kp}-p`)}</p>);
  });

  flushList(); flushTable(); flushQuote(); flushCode();
  return out;
}

// ── Découpe en sections (## …) ──────────────────────────────────────────────
function splitSections(content: string): { preamble: string[]; sections: { title: string; lines: string[] }[] } {
  const lines = content.split("\n");
  const preamble: string[] = [];
  const sections: { title: string; lines: string[] }[] = [];
  let cur: { title: string; lines: string[] } | null = null;
  for (const line of lines) {
    const m = !/^###/.test(line) ? line.match(/^##\s+(.*)$/) : null;
    if (m) {
      if (cur) sections.push(cur);
      cur = { title: m[1].trim(), lines: [] };
    } else if (cur) {
      cur.lines.push(line);
    } else {
      preamble.push(line);
    }
  }
  if (cur) sections.push(cur);
  return { preamble, sections };
}

function ReportTitle({ title, body }: { title: string; body: React.ReactNode }) {
  const { Icon } = sectionMeta(title);
  return (
    <div>
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-soft">
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <h2 className="text-base font-bold leading-tight text-[var(--text)]">{title}</h2>
      </div>
      <div className="mt-2">{body}</div>
    </div>
  );
}

function SectionCard({ title, body }: { title: string; body: React.ReactNode }) {
  const { Icon, tone, badge } = sectionMeta(title);
  return (
    <section className={cn("overflow-hidden rounded-xl border", cardBorder[tone])}>
      <header className={cn("flex items-center gap-2.5 border-b px-3.5 py-2.5", cardBorder[tone], headerBg[tone])}>
        <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-lg", pill[tone])}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <h2 className="min-w-0 flex-1 text-[13px] font-bold text-[var(--text)]">{title}</h2>
        {badge && <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", pill[tone])}>{badge}</span>}
      </header>
      <div className="px-3.5 py-3 sm:px-4">{body}</div>
    </section>
  );
}

export function Markdown({ content }: { content: string }) {
  const { preamble, sections } = splitSections(content);
  const hasPreamble = preamble.some((l) => l.trim() !== "");
  return (
    <div className={sections.length > 1 ? "space-y-3 ork-stagger" : "space-y-3"}>
      {hasPreamble && <div>{renderBlocks(preamble, "pre")}</div>}
      {sections.map((s, i) =>
        i === 0 ? (
          <ReportTitle key={i} title={s.title} body={renderBlocks(s.lines, `s${i}`)} />
        ) : (
          <SectionCard key={i} title={s.title} body={renderBlocks(s.lines, `s${i}`)} />
        )
      )}
    </div>
  );
}

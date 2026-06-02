"use client";

import React from "react";

// ──────────────────────────────────────────────────────────────────────────
// Rendu markdown léger pour les réponses de l'AI Council.
// Gère : ## / ### titres, listes - et 1., **gras**, > citations, ``` code,
// tableaux simples et lignes ---. Suffisant pour des réponses structurées.
// ──────────────────────────────────────────────────────────────────────────

function inline(text: string, keyBase: string): React.ReactNode[] {
  // **gras** et `code`
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**"))
      return (
        <strong key={`${keyBase}-${i}`} className="font-semibold text-[var(--text)]">
          {p.slice(2, -2)}
        </strong>
      );
    if (p.startsWith("`") && p.endsWith("`"))
      return (
        <code key={`${keyBase}-${i}`} className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-[0.85em] text-brand-700 dark:bg-ink-900 dark:text-brand-300">
          {p.slice(1, -1)}
        </code>
      );
    return <React.Fragment key={`${keyBase}-${i}`}>{p}</React.Fragment>;
  });
}

export function Markdown({ content }: { content: string }) {
  const lines = content.split("\n");
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let code: string[] | null = null;
  let table: string[] | null = null;

  const flushList = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag
        key={`l-${blocks.length}`}
        className={`my-2 space-y-1.5 ${list.ordered ? "list-decimal" : "list-disc"} pl-5 text-sm leading-relaxed text-[var(--text-muted)]`}
      >
        {list.items.map((it, i) => (
          <li key={i}>{inline(it, `li-${blocks.length}-${i}`)}</li>
        ))}
      </Tag>
    );
    list = null;
  };

  const flushTable = () => {
    if (!table || table.length < 2) {
      table = null;
      return;
    }
    const rows = table.filter((r) => !/^\s*\|?[\s|:-]+\|?\s*$/.test(r));
    const cells = rows.map((r) => r.split("|").map((c) => c.trim()).filter((c, idx, arr) => !(idx === 0 && c === "") && !(idx === arr.length - 1 && c === "")));
    const [head, ...body] = cells;
    blocks.push(
      <div key={`t-${blocks.length}`} className="my-3 overflow-x-auto rounded-xl border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg)] text-left">
            <tr>{head.map((h, i) => <th key={i} className="px-3 py-2 font-semibold">{inline(h, `th-${i}`)}</th>)}</tr>
          </thead>
          <tbody>
            {body.map((r, i) => (
              <tr key={i} className="border-t border-[var(--border)]">
                {r.map((c, j) => <td key={j} className="px-3 py-2 text-[var(--text-muted)]">{inline(c, `td-${i}-${j}`)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    table = null;
  };

  lines.forEach((raw, idx) => {
    const line = raw;

    // Code fences
    if (/^```/.test(line)) {
      if (code) {
        blocks.push(
          <pre key={`c-${blocks.length}`} className="my-3 overflow-x-auto rounded-xl bg-ink-950 p-4 text-xs text-ink-100">
            <code>{code.join("\n")}</code>
          </pre>
        );
        code = null;
      } else {
        flushList();
        flushTable();
        code = [];
      }
      return;
    }
    if (code) {
      code.push(line);
      return;
    }

    // Tables
    if (/^\s*\|.*\|\s*$/.test(line)) {
      flushList();
      (table ??= []).push(line);
      return;
    } else if (table) {
      flushTable();
    }

    if (/^#{2}\s/.test(line)) {
      flushList();
      blocks.push(<h2 key={`h-${blocks.length}`} className="mb-2 mt-4 text-base font-bold text-[var(--text)] first:mt-0">{inline(line.replace(/^##\s/, ""), `h2-${idx}`)}</h2>);
    } else if (/^#{3}\s/.test(line)) {
      flushList();
      blocks.push(<h3 key={`h-${blocks.length}`} className="mb-1.5 mt-3.5 text-sm font-semibold text-[var(--text)]">{inline(line.replace(/^###\s/, ""), `h3-${idx}`)}</h3>);
    } else if (/^>\s/.test(line)) {
      flushList();
      blocks.push(
        <div key={`q-${blocks.length}`} className="my-3 rounded-xl border-l-2 border-brand-500 bg-brand-50 px-3.5 py-2.5 text-sm text-brand-900 dark:bg-brand-950/40 dark:text-brand-200">
          {inline(line.replace(/^>\s/, ""), `q-${idx}`)}
        </div>
      );
    } else if (/^\s*-\s\[.\]\s/.test(line)) {
      // checkbox item
      const checked = /\[x\]/i.test(line);
      const text = line.replace(/^\s*-\s\[.\]\s/, "");
      if (!list || list.ordered) { flushList(); list = { ordered: false, items: [] }; }
      list.items.push(`${checked ? "☑" : "☐"} ${text}`);
    } else if (/^\s*-\s/.test(line) || /^\s*\*\s/.test(line)) {
      if (!list || list.ordered) { flushList(); list = { ordered: false, items: [] }; }
      list.items.push(line.replace(/^\s*[-*]\s/, ""));
    } else if (/^\s*\d+\.\s/.test(line)) {
      if (!list || !list.ordered) { flushList(); list = { ordered: true, items: [] }; }
      list.items.push(line.replace(/^\s*\d+\.\s/, ""));
    } else if (/^\s*---\s*$/.test(line)) {
      flushList();
      blocks.push(<hr key={`hr-${blocks.length}`} className="my-3 border-[var(--border)]" />);
    } else if (line.trim() === "") {
      flushList();
    } else {
      flushList();
      blocks.push(<p key={`p-${blocks.length}`} className="my-2 text-sm leading-relaxed text-[var(--text-muted)]">{inline(line, `p-${idx}`)}</p>);
    }
  });
  flushList();
  flushTable();

  return <div className="space-y-0">{blocks}</div>;
}

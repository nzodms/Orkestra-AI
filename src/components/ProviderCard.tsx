"use client";

import { useState } from "react";
import { PROVIDERS } from "@/lib/providers";
import { useOrkestra } from "@/lib/store";
import type { AIProviderId } from "@/lib/types";
import { Button } from "./ui/Button";
import { Badge } from "./ui/primitives";
import { relativeDate, cn } from "@/lib/utils";
import {
  CheckCircle2,
  XCircle,
  Trash2,
  ExternalLink,
  HelpCircle,
  KeyRound,
  Clock,
  Star,
  Sparkles,
} from "lucide-react";

// Providers réellement branchés en live dans cette version.
const AVAILABLE_PROVIDERS: AIProviderId[] = ["openai", "anthropic", "gemini"];

export function ProviderCard({ id }: { id: AIProviderId }) {
  const meta = PROVIDERS[id];
  const available = AVAILABLE_PROVIDERS.includes(id);
  const conn = useOrkestra((s) => s.connections[id]);
  const setConnection = useOrkestra((s) => s.setConnection);
  const removeConnection = useOrkestra((s) => s.removeConnection);

  const [key, setKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function test() {
    setError(null);
    if (!key.trim()) {
      setError("Veuillez saisir une clé API.");
      return;
    }
    setTesting(true);
    try {
      const res = await fetch("/api/keys/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: id, apiKey: key }),
      });
      const data = await res.json();
      if (data.ok) {
        setConnection(id, {
          connected: true,
          status: "connected",
          keyId: data.keyId ?? null,
          live: Boolean(data.live),
          maskedKey: data.maskedKey,
          model: data.model || meta.defaultModel,
          lastTestedAt: new Date().toISOString(),
        });
        setKey("");
      } else {
        setConnection(id, { status: "error" });
        setError(data.error || "La connexion a échoué.");
      }
    } catch {
      setError("Erreur réseau. Réessayez.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div
      className={cn(
        "card flex flex-col p-5 transition",
        available && !conn.connected && meta.recommended && "ring-1 ring-brand-200 dark:ring-brand-900/70",
        conn.connected && "border-emerald-200 dark:border-emerald-900/60"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white shadow-soft"
            style={{ background: meta.color }}
          >
            <KeyRound className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="text-sm font-semibold">{meta.name}</h3>
              {available && !conn.connected && meta.recommended && (
                <Badge tone="brand"><Star className="h-3 w-3" /> Recommandé</Badge>
              )}
              {!available ? (
                <Badge tone="neutral"><Clock className="h-3 w-3" /> Bientôt disponible</Badge>
              ) : conn.connected ? (
                <>
                  <Badge tone="good">
                    <CheckCircle2 className="h-3 w-3 animate-pop" /> Connecté
                  </Badge>
                  {conn.live ? <Badge tone="brand" className="ork-rise">Live</Badge> : <Badge tone="neutral">Démo</Badge>}
                </>
              ) : conn.status === "error" ? (
                <Badge tone="bad">
                  <XCircle className="h-3 w-3" /> Erreur
                </Badge>
              ) : (
                <Badge tone="neutral">Non connecté</Badge>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{meta.tagline}</p>
          </div>
        </div>
      </div>

      {meta.bestFor && (
        <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-[var(--bg)] px-2.5 py-1.5 text-xs text-[var(--text-muted)]">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-brand-500" />
          Idéal pour&nbsp;: <span className="font-medium text-[var(--text)]">{meta.bestFor}</span>
        </div>
      )}

      {!available ? (
        <div className="mt-4 rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg)] px-3.5 py-3 text-xs text-[var(--text-muted)]">
          Ce provider n&apos;est pas encore branché dans cette version. Le support {meta.name} arrive prochainement — pour l&apos;instant, <strong>OpenAI</strong>, <strong>Claude</strong> et <strong>Gemini</strong> sont disponibles en live.
        </div>
      ) : conn.connected ? (
        <div className="ork-rise mt-4 flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-3">
          <div>
            <div className="font-mono text-sm">{conn.maskedKey}</div>
            <div className="mt-0.5 text-xs text-[var(--text-muted)]">
              Modèle : {conn.model} · Testé {conn.lastTestedAt ? relativeDate(conn.lastTestedAt) : ""}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon={<Trash2 className="h-4 w-4" />}
            onClick={async () => {
              if (conn.keyId) {
                await fetch("/api/keys/delete", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ keyId: conn.keyId }),
                }).catch(() => {});
              }
              removeConnection(id);
            }}
          >
            Supprimer
          </Button>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={`Clé API ${meta.name}${meta.keyPrefix ? ` (${meta.keyPrefix}…)` : ""}`}
            className="input font-mono"
            autoComplete="off"
          />
          {error && <p className="ork-rise text-xs text-red-500">{error}</p>}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowHelp((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-brand-600"
            >
              <HelpCircle className="h-3.5 w-3.5" /> Où trouver ma clé API ?
            </button>
            <Button size="sm" loading={testing} onClick={test}>
              Tester la connexion
            </Button>
          </div>
          {showHelp && (
            <div className="rounded-xl bg-brand-50 p-3 text-xs text-brand-900 dark:bg-brand-950/50 dark:text-brand-200">
              {meta.helpKey}
              <a
                href={meta.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 inline-flex items-center gap-1 font-medium text-brand-700 hover:underline dark:text-brand-300"
              >
                Ouvrir la page des clés <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

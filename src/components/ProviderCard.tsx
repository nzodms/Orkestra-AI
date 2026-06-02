"use client";

import { useState } from "react";
import { PROVIDERS } from "@/lib/providers";
import { useOrkestra } from "@/lib/store";
import type { AIProviderId } from "@/lib/types";
import { Button } from "./ui/Button";
import { Badge } from "./ui/primitives";
import { relativeDate } from "@/lib/utils";
import {
  CheckCircle2,
  XCircle,
  Trash2,
  ExternalLink,
  HelpCircle,
  KeyRound,
} from "lucide-react";

export function ProviderCard({ id }: { id: AIProviderId }) {
  const meta = PROVIDERS[id];
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
          maskedKey: data.maskedKey,
          model: meta.defaultModel,
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
    <div className="card flex flex-col p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="grid h-11 w-11 place-items-center rounded-xl text-white"
            style={{ background: meta.color }}
          >
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">{meta.name}</h3>
              {conn.connected ? (
                <Badge tone="good">
                  <CheckCircle2 className="h-3 w-3" /> Connecté
                </Badge>
              ) : conn.status === "error" ? (
                <Badge tone="bad">
                  <XCircle className="h-3 w-3" /> Erreur
                </Badge>
              ) : (
                <Badge tone="neutral">Non connecté</Badge>
              )}
            </div>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">{meta.tagline}</p>
          </div>
        </div>
      </div>

      {conn.connected ? (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-3">
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
            onClick={() => removeConnection(id)}
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
          {error && <p className="text-xs text-red-500">{error}</p>}
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

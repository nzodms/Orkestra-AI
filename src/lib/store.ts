"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AIConnection, AIProviderId, BrandMemory, GenerationRecord } from "./types";
import { PROVIDER_ORDER } from "./providers";
import { DEFAULT_BRAND_MEMORY, DEMO_HISTORY } from "./mock-data";

// ──────────────────────────────────────────────────────────────────────────
// Store client (zustand + persist localStorage).
//
// IMPORTANT BYOK : on ne stocke ici QUE des clés masquées + l'état de
// connexion. Les clés réelles sont envoyées au serveur (API route) qui les
// chiffre. Le navigateur ne conserve jamais la clé en clair.
// ──────────────────────────────────────────────────────────────────────────

function emptyConnections(): Record<AIProviderId, AIConnection> {
  const out = {} as Record<AIProviderId, AIConnection>;
  for (const id of PROVIDER_ORDER) {
    out[id] = {
      provider: id,
      maskedKey: null,
      connected: false,
      model: "",
      lastTestedAt: null,
      status: "disconnected",
    };
  }
  return out;
}

interface OrkestraState {
  onboardingComplete: boolean;
  theme: "light" | "dark";
  brand: BrandMemory;
  connections: Record<AIProviderId, AIConnection>;
  history: GenerationRecord[];
  resolvedIssues: string[];

  setOnboardingComplete: (v: boolean) => void;
  toggleTheme: () => void;
  updateBrand: (patch: Partial<BrandMemory>) => void;
  setConnection: (id: AIProviderId, patch: Partial<AIConnection>) => void;
  removeConnection: (id: AIProviderId) => void;
  addGeneration: (rec: GenerationRecord) => void;
  toggleIssue: (id: string) => void;
}

export const useOrkestra = create<OrkestraState>()(
  persist(
    (set) => ({
      onboardingComplete: false,
      theme: "light",
      brand: DEFAULT_BRAND_MEMORY,
      connections: emptyConnections(),
      history: DEMO_HISTORY,
      resolvedIssues: [],

      setOnboardingComplete: (v) => set({ onboardingComplete: v }),
      toggleTheme: () =>
        set((s) => ({ theme: s.theme === "light" ? "dark" : "light" })),
      updateBrand: (patch) => set((s) => ({ brand: { ...s.brand, ...patch } })),
      setConnection: (id, patch) =>
        set((s) => ({
          connections: { ...s.connections, [id]: { ...s.connections[id], ...patch } },
        })),
      removeConnection: (id) =>
        set((s) => ({
          connections: {
            ...s.connections,
            [id]: {
              provider: id,
              maskedKey: null,
              connected: false,
              model: "",
              lastTestedAt: null,
              status: "disconnected",
            },
          },
        })),
      addGeneration: (rec) => set((s) => ({ history: [rec, ...s.history] })),
      toggleIssue: (id) =>
        set((s) => ({
          resolvedIssues: s.resolvedIssues.includes(id)
            ? s.resolvedIssues.filter((x) => x !== id)
            : [...s.resolvedIssues, id],
        })),
    }),
    { name: "orkestra-store" }
  )
);

/** Liste des providers connectés (helper). */
export function connectedProviders(
  connections: Record<AIProviderId, AIConnection>
): AIProviderId[] {
  return PROVIDER_ORDER.filter((id) => connections[id]?.connected);
}

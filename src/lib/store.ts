"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AIConnection,
  AIProviderId,
  BrandMemory,
  GenerationRecord,
  CouncilTurn,
  StoreAnalysis,
  AssistantTurn,
  ProductSeoResult,
  GenMeta,
} from "./types";
import type { CollectionSeoResult, MetaVariant, BlogOutlineResult, AltTextItem } from "./ai/engine";
import { PROVIDER_ORDER } from "./providers";
import { DEFAULT_BRAND_MEMORY } from "./mock-data";

// État persisté de Content Factory : dernières générations par workflow.
export interface SeoStudioState {
  product: ProductSeoResult | null;
  productMeta: GenMeta | null;
  collection: CollectionSeoResult | null;
  meta: MetaVariant[] | null;
  alt: AltTextItem[] | null;
  altSubject: string;
  blog: BlogOutlineResult | null;
}
const EMPTY_SEO: SeoStudioState = { product: null, productMeta: null, collection: null, meta: null, alt: null, altSubject: "", blog: null };

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
  /** Le guide « Comment utiliser Orkestra » a-t-il été masqué ? */
  guideHidden: boolean;
  /** La boutique a-t-elle été scannée/renseignée ? Pilote l'état neutre du dashboard. */
  storeScanned: boolean;
  theme: "light" | "dark";
  brand: BrandMemory;
  /** Analyse de la boutique active (scores/métriques/problèmes). null = non analysée. */
  analysis: StoreAnalysis | null;
  connections: Record<AIProviderId, AIConnection>;
  history: GenerationRecord[];
  resolvedIssues: string[];
  /** Conversation AI Council persistée (survit à la navigation). */
  councilMessages: CouncilTurn[];
  // ── Merchant Shield (persisté) ──
  /** Date du dernier audit Merchant lancé (ISO) ou null. */
  merchantAuditAt: string | null;
  /** Clés des items Merchant marqués comme corrigés. */
  merchantResolved: string[];
  // ── Assistant Shopify (persisté) ──
  assistantMessages: AssistantTurn[];
  // ── Content Factory (persisté) ──
  seo: SeoStudioState;

  setOnboardingComplete: (v: boolean) => void;
  setGuideHidden: (v: boolean) => void;
  setStoreScanned: (v: boolean) => void;
  setAnalysis: (a: StoreAnalysis | null) => void;
  toggleTheme: () => void;
  updateBrand: (patch: Partial<BrandMemory>) => void;
  setConnection: (id: AIProviderId, patch: Partial<AIConnection>) => void;
  removeConnection: (id: AIProviderId) => void;
  addGeneration: (rec: GenerationRecord) => void;
  toggleIssue: (id: string) => void;
  addCouncilTurn: (turn: CouncilTurn) => void;
  clearCouncil: () => void;
  setMerchantAudited: () => void;
  toggleMerchantResolved: (key: string) => void;
  addAssistantTurn: (turn: AssistantTurn) => void;
  clearAssistant: () => void;
  setSeo: (patch: Partial<SeoStudioState>) => void;
}

export const useOrkestra = create<OrkestraState>()(
  persist(
    (set) => ({
      onboardingComplete: false,
      guideHidden: false,
      storeScanned: false,
      theme: "light",
      brand: DEFAULT_BRAND_MEMORY,
      analysis: null,
      connections: emptyConnections(),
      history: [],
      resolvedIssues: [],
      councilMessages: [],
      merchantAuditAt: null,
      merchantResolved: [],
      assistantMessages: [],
      seo: EMPTY_SEO,

      setOnboardingComplete: (v) => set({ onboardingComplete: v }),
      setGuideHidden: (v) => set({ guideHidden: v }),
      setStoreScanned: (v) => set({ storeScanned: v }),
      setAnalysis: (a) => set({ analysis: a }),
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
      addCouncilTurn: (turn) =>
        set((s) => ({ councilMessages: [...s.councilMessages, turn] })),
      clearCouncil: () => set({ councilMessages: [] }),
      setMerchantAudited: () => set({ merchantAuditAt: new Date().toISOString() }),
      toggleMerchantResolved: (key) =>
        set((s) => ({
          merchantResolved: s.merchantResolved.includes(key)
            ? s.merchantResolved.filter((x) => x !== key)
            : [...s.merchantResolved, key],
        })),
      addAssistantTurn: (turn) =>
        set((s) => ({ assistantMessages: [...s.assistantMessages, turn] })),
      clearAssistant: () => set({ assistantMessages: [] }),
      setSeo: (patch) => set((s) => ({ seo: { ...s.seo, ...patch } })),
    }),
    {
      name: "orkestra-store",
      // v2 : purge des données de démo hardcodées. v3 : nouveau format seo.alt
      // (string[] → AltTextItem[]) → on réinitialise le slice seo.
      version: 3,
      migrate: (persisted: unknown, version: number) => {
        const state = (persisted ?? {}) as Partial<OrkestraState>;
        if (version < 2) {
          return {
            ...state,
            brand: DEFAULT_BRAND_MEMORY,
            analysis: null,
            storeScanned: false,
            history: [],
            councilMessages: [],
            resolvedIssues: [],
            seo: EMPTY_SEO,
          } as OrkestraState;
        }
        if (version < 3) {
          return { ...state, seo: EMPTY_SEO } as OrkestraState;
        }
        return state as OrkestraState;
      },
    }
  )
);

/** Liste des providers connectés (helper). */
export function connectedProviders(
  connections: Record<AIProviderId, AIConnection>
): AIProviderId[] {
  return PROVIDER_ORDER.filter((id) => connections[id]?.connected);
}

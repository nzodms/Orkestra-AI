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
import type { FactoryStatus, FactoryOutput } from "./factory";
import type { ImportRules } from "./import-factory";
import { PROVIDER_ORDER } from "./providers";
import { DEFAULT_BRAND_MEMORY } from "./mock-data";

// État persisté de Import Factory : dernières générations par workflow.
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

// Mémoire Import Factory : évite les doublons (noms brandés, handles, ancres),
// retient les collections et les dernières règles de transformation.
export interface ImportFactoryMemory {
  brandNames: string[];
  handles: string[];
  anchors: string[];
  collections: string[];
  lastRules: ImportRules | null;
  transformedCount: number;
}
const EMPTY_IMPORT: ImportFactoryMemory = { brandNames: [], handles: [], anchors: [], collections: [], lastRules: null, transformedCount: 0 };

export interface RememberImportPatch {
  brandNames?: string[];
  handles?: string[];
  anchors?: string[];
  collections?: string[];
  rules?: ImportRules;
  count?: number;
}

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
  // ── Import Factory (persisté) ──
  seo: SeoStudioState;
  /** Statut de production par tâche (héritage Import Factory). */
  factoryStatus: Record<string, FactoryStatus>;
  /** Feed « Sorties récentes » (héritage Import Factory). */
  factoryOutputs: FactoryOutput[];
  // ── Import Factory (persisté) ──
  importMemory: ImportFactoryMemory;
  /** Profil boutique cible sélectionné dans Import Factory. */
  selectedProfileId: string;

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
  setFactoryStatus: (id: string, status: FactoryStatus) => void;
  addFactoryOutput: (output: FactoryOutput) => void;
  clearFactoryOutputs: () => void;
  rememberImport: (patch: RememberImportPatch) => void;
  resetImportMemory: () => void;
  setImportProfile: (id: string) => void;
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
      factoryStatus: {},
      factoryOutputs: [],
      importMemory: EMPTY_IMPORT,
      selectedProfileId: "custom",

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
      setFactoryStatus: (id, status) =>
        set((s) => ({ factoryStatus: { ...s.factoryStatus, [id]: status } })),
      addFactoryOutput: (output) =>
        set((s) => {
          // Upsert par taskId (sinon par id) : la dernière production remonte en tête.
          const matchKey = output.taskId ?? output.id;
          const rest = s.factoryOutputs.filter((o) => (o.taskId ?? o.id) !== matchKey);
          return { factoryOutputs: [output, ...rest].slice(0, 12) };
        }),
      clearFactoryOutputs: () => set({ factoryOutputs: [] }),
      rememberImport: (patch) =>
        set((s) => {
          const merge = (a: string[], b?: string[]) => Array.from(new Set([...a, ...(b ?? []).filter(Boolean)])).slice(0, 800);
          return {
            importMemory: {
              brandNames: merge(s.importMemory.brandNames, patch.brandNames),
              handles: merge(s.importMemory.handles, patch.handles),
              anchors: merge(s.importMemory.anchors, patch.anchors),
              collections: patch.collections && patch.collections.length ? Array.from(new Set(patch.collections)) : s.importMemory.collections,
              lastRules: patch.rules ?? s.importMemory.lastRules,
              transformedCount: s.importMemory.transformedCount + (patch.count ?? 0),
            },
          };
        }),
      resetImportMemory: () => set({ importMemory: EMPTY_IMPORT }),
      setImportProfile: (id) => set({ selectedProfileId: id }),
    }),
    {
      name: "orkestra-store",
      // v2 : purge des données de démo hardcodées. v3 : nouveau format seo.alt
      // (string[] → AltTextItem[]) → on réinitialise le slice seo.
      // v4 : atelier Import Factory (statuts + sorties récentes).
      // v5 : Import Factory (mémoire d'import : noms brandés, handles, règles).
      version: 5,
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
            factoryStatus: {},
            factoryOutputs: [],
            importMemory: EMPTY_IMPORT,
          } as OrkestraState;
        }
        if (version < 3) {
          return { ...state, seo: EMPTY_SEO, factoryStatus: {}, factoryOutputs: [], importMemory: EMPTY_IMPORT } as OrkestraState;
        }
        if (version < 4) {
          return { ...state, factoryStatus: {}, factoryOutputs: [], importMemory: EMPTY_IMPORT } as OrkestraState;
        }
        if (version < 5) {
          return { ...state, importMemory: EMPTY_IMPORT } as OrkestraState;
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

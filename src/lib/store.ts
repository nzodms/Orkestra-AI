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
import type { ImportRules, ProfileCollection } from "./import-factory";
import type { ImportStyleAnalysis } from "./import-analyze";
import type { ProfileConfig } from "./import-profiles";
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

// Mémoire SÉPARÉE PAR PROFIL boutique : noms brandés, handles, ancres, termes
// interdits, réglages privés (saisis par l'utilisateur) et dernières règles.
// Structure prête pour une future bascule en base de données.
export interface ProfileMemory {
  brandNames: string[];
  titles: string[];
  handles: string[];
  anchors: string[];
  collections: string[];
  productTypes: string[];
  tags: string[];
  forbiddenTerms: string[];
  forbiddenDomains: string[];
  // réglages privés saisis par l'utilisateur (jamais codés en dur)
  brand: string;
  metaSuffix: string;
  configCollections: ProfileCollection[];
  lastRules: ImportRules | null;
  lastImportAt: string | null;
  transformedCount: number;
}
export function emptyProfileMemory(): ProfileMemory {
  return { brandNames: [], titles: [], handles: [], anchors: [], collections: [], productTypes: [], tags: [], forbiddenTerms: [], forbiddenDomains: [], brand: "", metaSuffix: "", configCollections: [], lastRules: null, lastImportAt: null, transformedCount: 0 };
}
export interface ProfileImportPatch {
  brandNames?: string[]; titles?: string[]; handles?: string[]; anchors?: string[];
  collections?: string[]; productTypes?: string[]; tags?: string[];
  rules?: ImportRules; count?: number;
}

// Presets d'import sauvegardés par l'utilisateur (privés). Structure prête pour
// une bascule en base de données. AUCUN preset privé n'est codé en dur dans l'UI.
export interface ImportPreset {
  id: string;
  name: string;
  description?: string;
  /** user = créé depuis les réglages courants · analyzed = depuis un CSV exemple · duplicated = copié d'un preset recommandé */
  origin: "user" | "analyzed" | "duplicated";
  /** id du preset recommandé d'origine si dupliqué. */
  builtinId?: string;
  /** profil boutique associé (générique). */
  profileId?: string;
  isDefault?: boolean;
  createdAt: string;
  rules: ImportRules;
  collectionsText?: string;
  analysis?: ImportStyleAnalysis | null;
}

// Historique des imports (réutilisation rapide des réglages).
export interface RecentImport {
  id: string;
  date: string;
  fileName: string;
  products: number;
  variants: number;
  images: number;
  presetId?: string;
  presetName?: string;
  profileId: string;
  status: "ok" | "warning" | "risk" | "failed";
  warnings: number;
  risks: number;
  failed: number;
  rules: ImportRules;
  collectionsText?: string;
  /** Verdict CSV (ready/verify/risky/partial) + raisons agrégées (pour Merchant Shield). */
  verdict?: string;
  riskReasons?: string[];
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
  /** Mémoire séparée par profil boutique. */
  importProfiles: Record<string, ProfileMemory>;
  /** Profil boutique cible sélectionné dans Import Factory. */
  selectedProfileId: string;
  /** Presets d'import privés (sauvegardés / analysés / dupliqués). */
  importPresets: ImportPreset[];
  /** Derniers imports (réutilisation rapide). */
  recentImports: RecentImport[];
  /** Demande ciblée en attente pour AI Council (depuis un autre module). */
  pendingCouncil: { mode: string; question: string } | null;

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
  rememberImportFor: (profileId: string, patch: ProfileImportPatch) => void;
  setProfileConfig: (profileId: string, config: ProfileConfig) => void;
  addForbidden: (profileId: string, v: { term?: string; domain?: string }) => void;
  resetProfileMemory: (profileId: string) => void;
  // ── Presets & derniers imports ──
  addImportPreset: (preset: ImportPreset) => void;
  updateImportPreset: (id: string, patch: Partial<ImportPreset>) => void;
  deleteImportPreset: (id: string) => void;
  duplicateImportPreset: (id: string) => void;
  setDefaultImportPreset: (id: string) => void;
  addRecentImport: (rec: RecentImport) => void;
  clearRecentImports: () => void;
  setPendingCouncil: (p: { mode: string; question: string }) => void;
  clearPendingCouncil: () => void;
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
      importProfiles: {},
      selectedProfileId: "custom",
      importPresets: [],
      recentImports: [],
      pendingCouncil: null,

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
      rememberImportFor: (profileId, patch) =>
        set((s) => {
          const cur = s.importProfiles[profileId] ?? emptyProfileMemory();
          const merge = (a: string[], b?: string[]) => Array.from(new Set([...a, ...(b ?? []).filter(Boolean)])).slice(0, 3000);
          return {
            importProfiles: {
              ...s.importProfiles,
              [profileId]: {
                ...cur,
                brandNames: merge(cur.brandNames, patch.brandNames),
                titles: merge(cur.titles, patch.titles),
                handles: merge(cur.handles, patch.handles),
                anchors: merge(cur.anchors, patch.anchors),
                collections: merge(cur.collections, patch.collections),
                productTypes: merge(cur.productTypes, patch.productTypes),
                tags: merge(cur.tags, patch.tags),
                lastRules: patch.rules ?? cur.lastRules,
                lastImportAt: patch.count ? new Date().toISOString() : cur.lastImportAt,
                transformedCount: cur.transformedCount + (patch.count ?? 0),
              },
            },
          };
        }),
      setProfileConfig: (profileId, config) =>
        set((s) => {
          const cur = s.importProfiles[profileId] ?? emptyProfileMemory();
          return {
            importProfiles: {
              ...s.importProfiles,
              [profileId]: { ...cur, brand: config.brand ?? cur.brand, metaSuffix: config.metaSuffix ?? cur.metaSuffix, configCollections: config.collections ?? cur.configCollections },
            },
          };
        }),
      addForbidden: (profileId, { term, domain }) =>
        set((s) => {
          const cur = s.importProfiles[profileId] ?? emptyProfileMemory();
          return {
            importProfiles: {
              ...s.importProfiles,
              [profileId]: {
                ...cur,
                forbiddenTerms: term && term.trim() ? Array.from(new Set([...cur.forbiddenTerms, term.trim()])) : cur.forbiddenTerms,
                forbiddenDomains: domain && domain.trim() ? Array.from(new Set([...cur.forbiddenDomains, domain.trim()])) : cur.forbiddenDomains,
              },
            },
          };
        }),
      resetProfileMemory: (profileId) => set((s) => ({ importProfiles: { ...s.importProfiles, [profileId]: emptyProfileMemory() } })),
      addImportPreset: (preset) =>
        set((s) => ({ importPresets: [preset, ...s.importPresets.filter((p) => p.id !== preset.id)] })),
      updateImportPreset: (id, patch) =>
        set((s) => ({ importPresets: s.importPresets.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      deleteImportPreset: (id) =>
        set((s) => ({ importPresets: s.importPresets.filter((p) => p.id !== id) })),
      duplicateImportPreset: (id) =>
        set((s) => {
          const src = s.importPresets.find((p) => p.id === id);
          if (!src) return {} as Partial<OrkestraState>;
          const copy: ImportPreset = { ...src, id: `pr_${Date.now().toString(36)}`, name: `${src.name} (copie)`, isDefault: false, createdAt: new Date().toISOString() };
          return { importPresets: [copy, ...s.importPresets] };
        }),
      setDefaultImportPreset: (id) =>
        set((s) => ({ importPresets: s.importPresets.map((p) => ({ ...p, isDefault: p.id === id })) })),
      addRecentImport: (rec) =>
        set((s) => ({ recentImports: [rec, ...s.recentImports].slice(0, 20) })),
      clearRecentImports: () => set({ recentImports: [] }),
      setPendingCouncil: (p) => set({ pendingCouncil: p }),
      clearPendingCouncil: () => set({ pendingCouncil: null }),
    }),
    {
      name: "orkestra-store",
      // v2 : purge des données de démo hardcodées. v3 : nouveau format seo.alt
      // (string[] → AltTextItem[]) → on réinitialise le slice seo.
      // v4 : atelier Import Factory (statuts + sorties récentes).
      // v5 : Import Factory (mémoire d'import : noms brandés, handles, règles).
      // v6 : presets d'import privés + derniers imports.
      version: 6,
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
          return { ...state, importMemory: EMPTY_IMPORT, importPresets: [], recentImports: [] } as OrkestraState;
        }
        if (version < 6) {
          return { ...state, importPresets: [], recentImports: [] } as OrkestraState;
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

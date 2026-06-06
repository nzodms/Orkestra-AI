"use client";

// ──────────────────────────────────────────────────────────────────────────
// Orkestra Lens — types partagés + hook de persistance (résultats sauvegardés
// + brouillon d'envoi vers Import Factory). Aucun secret ici : l'analyse réelle
// (vision) passe par /api/lens/analyze côté serveur avec la clé BYOK.
// ──────────────────────────────────────────────────────────────────────────

import { useOrkestra, type ImportDraft } from "./store";

export type { ImportDraft };
export type LensInputKind = "upload" | "image_url" | "product_url" | "clipper";

/** Analyse produit d'une image / page (vision OpenAI ou simulation). */
export interface LensAnalysis {
  productType: string;
  niche: string;
  form?: string;
  color?: string;
  material?: string;
  style?: string;
  usage?: string;
  distinctive: string[];
  variants: string[];
  keywordsFr: string[];
  keywordsEn: string[];
  keywordsSupplier: string[];
  summary?: string;
  /** Analyse réelle (vision) ou simulée (pas de clé / mode démo). */
  live: boolean;
  /** Aperçu de l'entrée (data URL image, URL ou marqueur). */
  preview?: string;
  sourceUrl?: string;
}

/** Un résultat fournisseur (V1 : simulé, étiqueté). */
export interface SupplierResult {
  id: string;
  title: string;
  source: string;            // Alibaba · AliExpress · …
  hue: number;               // teinte du visuel placeholder (0-360)
  image?: string;            // URL réelle si disponible (V2)
  price?: string;
  moq?: string;
  vendor?: string;
  rating?: number;           // 0-5
  reviews?: number;
  shipping?: string;
  variantsCount?: number;
  url: string;
  similarity: number;        // 0-100
  score: number;             // Score fournisseur Orkestra 0-100
  scoreReason: string;
  simulated: boolean;
}

export interface LensSavedItem {
  id: string;
  date: string;
  analysis: LensAnalysis;
  supplier: SupplierResult;
}

/** Hook Lens : sélectionne l'état persisté (sauvegardes + brouillon) du store principal. */
export function useLens() {
  const lensSaved = useOrkestra((s) => s.lensSaved);
  const saveLens = useOrkestra((s) => s.saveLens);
  const removeLens = useOrkestra((s) => s.removeLens);
  const clearLens = useOrkestra((s) => s.clearLens);
  const importDraft = useOrkestra((s) => s.importDraft);
  const setImportDraft = useOrkestra((s) => s.setImportDraft);
  const clearImportDraft = useOrkestra((s) => s.clearImportDraft);
  return { lensSaved, saveLens, removeLens, clearLens, importDraft, setImportDraft, clearImportDraft };
}

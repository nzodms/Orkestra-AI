"use client";

// ──────────────────────────────────────────────────────────────────────────
// Orkestra Lens — hook client (résultats sauvegardés + brouillon Import Factory).
// Les TYPES vivent dans ./lens-types (purs, partagés serveur/client). Aucun secret
// ici : l'analyse vision et la recherche fournisseur réelle passent par les API.
// ──────────────────────────────────────────────────────────────────────────

import { useOrkestra, type ImportDraft } from "./store";

export type { ImportDraft };
export type {
  LensInputKind,
  SupplierSearchProvider,
  SupplierSearchMethod,
  SearchLink,
  AssistedQuery,
  LensAnalysis,
  SupplierResult,
  SupplierSearchResponse,
  LensSavedItem,
} from "./lens-types";

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

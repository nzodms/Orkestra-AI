import type { AIProviderId } from "../types";

// ──────────────────────────────────────────────────────────────────────────
// Adaptateur provider IA.
//
// Chaque provider implémente `complete()`. En V1, le mode mock (ORKESTRA_MOCK
// _MODE=true) renvoie des réponses simulées réalistes pour permettre une démo
// complète sans consommer les crédits du client. L'architecture est prête à
// brancher les vrais SDK : il suffit de remplacer le corps de `liveComplete`.
// ──────────────────────────────────────────────────────────────────────────

export interface CompletionRequest {
  system: string;
  prompt: string;
  /** clé API déchiffrée côté serveur (jamais loggée) */
  apiKey?: string;
  model: string;
  temperature?: number;
}

export interface CompletionResponse {
  provider: AIProviderId;
  text: string;
  model: string;
  /** estimation tokens pour la télémétrie */
  tokens: number;
  mocked: boolean;
}

export function isMockMode(): boolean {
  return process.env.ORKESTRA_MOCK_MODE !== "false";
}

/**
 * Point d'entrée unique. Bascule mock/live selon l'environnement et la
 * présence d'une clé API.
 */
export async function complete(
  provider: AIProviderId,
  req: CompletionRequest
): Promise<CompletionResponse> {
  if (isMockMode() || !req.apiKey) {
    return mockComplete(provider, req);
  }
  return liveComplete(provider, req);
}

async function mockComplete(
  provider: AIProviderId,
  req: CompletionRequest
): Promise<CompletionResponse> {
  // Latence simulée pour une UX réaliste.
  await new Promise((r) => setTimeout(r, 300 + Math.random() * 500));
  return {
    provider,
    text: `[${provider}] ${req.prompt.slice(0, 80)}…`,
    model: req.model,
    tokens: Math.round(req.prompt.length / 3),
    mocked: true,
  };
}

/**
 * Implémentation live — à brancher avec les SDK officiels.
 * Laissée volontairement en TODO pour la V1 BYOK.
 */
async function liveComplete(
  provider: AIProviderId,
  req: CompletionRequest
): Promise<CompletionResponse> {
  // TODO V1.1 : brancher openai / @anthropic-ai/sdk / @google/generative-ai
  // selon `provider`, en utilisant req.apiKey (déjà déchiffrée).
  // Exemple structure :
  //   switch (provider) {
  //     case "openai": return callOpenAI(req);
  //     case "anthropic": return callAnthropic(req);
  //     ...
  //   }
  return mockComplete(provider, req);
}

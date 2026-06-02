import type { AIProviderMeta, AIProviderId } from "./types";

// Métadonnées des providers IA supportés en BYOK.
export const PROVIDERS: Record<AIProviderId, AIProviderMeta> = {
  openai: {
    id: "openai",
    name: "OpenAI",
    tagline: "ChatGPT — GPT-4o, raisonnement et rédaction",
    color: "#10a37f",
    docsUrl: "https://platform.openai.com/api-keys",
    helpKey:
      "Connectez-vous à platform.openai.com → API keys → Create new secret key. La clé commence par « sk- ».",
    keyPrefix: "sk-",
    defaultModel: "gpt-4o",
  },
  anthropic: {
    id: "anthropic",
    name: "Anthropic",
    tagline: "Claude — rédaction premium et code Shopify",
    color: "#d97757",
    docsUrl: "https://console.anthropic.com/settings/keys",
    helpKey:
      "Connectez-vous à console.anthropic.com → Settings → API Keys. La clé commence par « sk-ant- ».",
    keyPrefix: "sk-ant-",
    defaultModel: "claude-sonnet-4-6",
  },
  gemini: {
    id: "gemini",
    name: "Google Gemini",
    tagline: "Gemini — analyse et multimodal",
    color: "#4285f4",
    docsUrl: "https://aistudio.google.com/app/apikey",
    helpKey:
      "Allez sur aistudio.google.com → Get API key → Create API key. Copiez la clé générée.",
    keyPrefix: "AIza",
    defaultModel: "gemini-1.5-pro",
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    tagline: "Accès unifié à des dizaines de modèles",
    color: "#6566f1",
    docsUrl: "https://openrouter.ai/keys",
    helpKey:
      "Sur openrouter.ai → Keys → Create Key. Pratique pour router vers plusieurs modèles avec une seule clé.",
    keyPrefix: "sk-or-",
    defaultModel: "openrouter/auto",
  },
  mistral: {
    id: "mistral",
    name: "Mistral",
    tagline: "Modèles européens rapides et efficaces",
    color: "#fa520f",
    docsUrl: "https://console.mistral.ai/api-keys",
    helpKey:
      "Sur console.mistral.ai → API Keys → Create new key. Idéal pour le contenu en français.",
    defaultModel: "mistral-large-latest",
  },
};

export const PROVIDER_ORDER: AIProviderId[] = [
  "openai",
  "anthropic",
  "gemini",
  "openrouter",
  "mistral",
];

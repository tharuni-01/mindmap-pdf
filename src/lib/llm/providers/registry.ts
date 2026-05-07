import { AnthropicProvider } from "./anthropic";
import { OpenAIProvider } from "./openai";
import { OllamaProvider } from "./ollama";
import { LLMError, type LLMProvider, type ProviderInfo, type ProviderName } from "../types";

// Lazily instantiate providers — env-var checks happen inside info()/generate(),
// so constructing them is cheap and side-effect-free.
const providers: Record<Exclude<ProviderName, "heuristic">, LLMProvider> = {
  anthropic: new AnthropicProvider(),
  openai: new OpenAIProvider(),
  ollama: new OllamaProvider(),
};

export function getProvider(name: ProviderName): LLMProvider {
  if (name === "heuristic") {
    throw new LLMError(
      "Heuristic mode is not an LLM provider; the API route handles it directly.",
    );
  }
  const provider = providers[name];
  if (!provider) throw new LLMError(`Unknown provider: ${name}`);
  return provider;
}

export function listProviderInfo(): ProviderInfo[] {
  return [
    providers.anthropic.info(),
    providers.openai.info(),
    providers.ollama.info(),
    {
      name: "heuristic",
      label: "Heuristic (no LLM)",
      model: "rule-based",
      configured: true,
      notConfiguredHint: undefined,
    },
  ];
}

// Resolve which provider to use given an explicit choice from the request,
// falling back to LLM_PROVIDER env, then to the first configured provider,
// then to the heuristic fallback.
export function resolveProvider(requested: string | null | undefined): ProviderName {
  if (requested && isProviderName(requested)) return requested;
  const envChoice = process.env.LLM_PROVIDER;
  if (envChoice && isProviderName(envChoice)) return envChoice;

  if (providers.anthropic.info().configured) return "anthropic";
  if (providers.openai.info().configured) return "openai";
  if (providers.ollama.info().configured) return "ollama";
  return "heuristic";
}

function isProviderName(s: string): s is ProviderName {
  return s === "anthropic" || s === "openai" || s === "ollama" || s === "heuristic";
}

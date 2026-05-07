import type { MindMapPayload } from "@/lib/schema";

export type ProviderName = "anthropic" | "openai" | "ollama" | "heuristic";

export interface ProviderInfo {
  name: ProviderName;
  label: string;
  model: string;
  configured: boolean;
  // Human-readable note when not configured (e.g. "Set ANTHROPIC_API_KEY").
  notConfiguredHint?: string;
}

export interface LLMProvider {
  name: ProviderName;
  info(): ProviderInfo;
  generate(systemPrompt: string, userPrompt: string): Promise<MindMapPayload>;
}

export class LLMError extends Error {
  constructor(message: string, readonly providerName?: ProviderName, readonly cause?: unknown) {
    super(message);
    this.name = "LLMError";
  }
}

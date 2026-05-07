import { chunkText, fitsSinglePass } from "@/lib/pdf";
import type { MindMapPayload } from "@/lib/schema";
import {
  SYSTEM_PROMPT,
  MERGE_SYSTEM_PROMPT,
  buildUserPrompt,
  buildChunkUserPrompt,
  buildMergeUserPrompt,
} from "./prompts";
import { getProvider } from "./providers/registry";
import { LLMError, type ProviderName } from "./types";

export { LLMError } from "./types";
export type { ProviderName, ProviderInfo, LLMProvider } from "./types";
export { listProviderInfo, resolveProvider } from "./providers/registry";

export interface GenerateOptions {
  provider: ProviderName;
  text: string;
  // Optional fallback chain: if the primary provider fails, try these in order.
  // Useful for local-first setups (Ollama → OpenAI). Set via LLM_FALLBACK env.
  fallbacks?: ProviderName[];
}

export interface GenerateResult {
  payload: MindMapPayload;
  chunks: number;
  providerUsed: ProviderName;
  model: string;
}

// Single public entry point for all providers. Handles chunking, multi-pass
// merging, and optional fallback chain.
export async function generateMindMap(opts: GenerateOptions): Promise<GenerateResult> {
  const { text, provider } = opts;
  if (!text.trim()) {
    throw new LLMError("Document contained no extractable text");
  }
  if (provider === "heuristic") {
    throw new LLMError("generateMindMap should not be called for heuristic mode");
  }

  const tryProvider = async (name: ProviderName): Promise<GenerateResult> => {
    const p = getProvider(name);
    const info = p.info();

    if (fitsSinglePass(text)) {
      const payload = await p.generate(SYSTEM_PROMPT, buildUserPrompt(text));
      return { payload, chunks: 1, providerUsed: name, model: info.model };
    }

    const chunks = chunkText(text);
    const partials = await Promise.all(
      chunks.map((chunk, i) =>
        p.generate(SYSTEM_PROMPT, buildChunkUserPrompt(chunk, i, chunks.length)),
      ),
    );
    const merged = await p.generate(
      MERGE_SYSTEM_PROMPT,
      buildMergeUserPrompt(
        partials.map((p) => ({ title: p.title, summary: p.summary, children: p.children })),
      ),
    );
    return { payload: merged, chunks: chunks.length, providerUsed: name, model: info.model };
  };

  try {
    return await tryProvider(provider);
  } catch (primaryErr) {
    const fallbacks = opts.fallbacks ?? [];
    for (const next of fallbacks) {
      if (next === provider) continue;
      try {
        const result = await tryProvider(next);
        // Success on a fallback — log so operators know the primary is failing.
        console.warn(
          `[llm] primary provider "${provider}" failed; recovered via fallback "${next}"`,
        );
        return result;
      } catch {
        // Try the next fallback.
      }
    }
    throw primaryErr;
  }
}

// Read the LLM_FALLBACK env into a typed list. Format: comma-separated names.
// Example: LLM_FALLBACK=openai,anthropic
export function parseFallbackEnv(): ProviderName[] {
  const raw = process.env.LLM_FALLBACK;
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is ProviderName =>
      s === "anthropic" || s === "openai" || s === "ollama",
    );
}

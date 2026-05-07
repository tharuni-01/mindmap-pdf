import { MindMapPayloadSchema, type MindMapPayload } from "@/lib/schema";
import { withRetry, withTimeout } from "../retry";
import { LLMError, type LLMProvider, type ProviderInfo } from "../types";

const DEFAULT_BASE_URL = "http://localhost:11434";
const DEFAULT_MODEL = "llama3";
// Ollama on a laptop CPU can take 30-90s for an 8B model; give it generous headroom.
const REQUEST_TIMEOUT_MS = 180_000;

export class OllamaProvider implements LLMProvider {
  readonly name = "ollama" as const;
  private readonly model = process.env.OLLAMA_MODEL || DEFAULT_MODEL;
  private readonly baseUrl = (process.env.OLLAMA_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");

  info(): ProviderInfo {
    // Ollama is opt-in: only treat it as configured when the user has set
    // OLLAMA_BASE_URL. We can't synchronously verify it's running here, so
    // actual reachability is surfaced as an error at request time.
    const configured = !!process.env.OLLAMA_BASE_URL;
    return {
      name: this.name,
      label: "Ollama (local)",
      model: this.model,
      configured,
      notConfiguredHint: configured
        ? undefined
        : "Set OLLAMA_BASE_URL=http://localhost:11434 in .env.local (Ollama must be running locally)",
    };
  }

  async generate(systemPrompt: string, userPrompt: string): Promise<MindMapPayload> {
    return withRetry(() => this.callOnce(systemPrompt, userPrompt), {
      attempts: 2,
      // Connection-refused (Ollama not running) and 4xx schema mismatches are
      // permanent — no point retrying.
      isPermanent: (err) => {
        if (err instanceof LLMError && /not reachable|not found|invalid/i.test(err.message)) {
          return true;
        }
        return false;
      },
    });
  }

  private async callOnce(systemPrompt: string, userPrompt: string): Promise<MindMapPayload> {
    const url = `${this.baseUrl}/api/generate`;
    const { signal, cancel } = withTimeout(REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          model: this.model,
          system: systemPrompt,
          prompt: userPrompt,
          // Forces the model to emit valid JSON; Ollama refuses to terminate
          // the response until JSON is well-formed.
          format: "json",
          stream: false,
          options: {
            temperature: 0.3,
            num_ctx: 8192,
          },
        }),
      });
    } catch (err) {
      cancel();
      if (err instanceof Error && err.name === "AbortError") {
        throw new LLMError(
          `Ollama request timed out after ${REQUEST_TIMEOUT_MS / 1000}s. The model may be too large for available memory.`,
          this.name,
          err,
        );
      }
      // Connection failures surface differently across runtimes:
      //   - Node/undici: TypeError("fetch failed") with cause.code === "ECONNREFUSED"
      //   - Bun: Error with messages like "Unable to connect", "ConnectionRefused"
      const reason = (err as { cause?: { code?: string } })?.cause?.code;
      const message = (err as Error)?.message ?? "";
      const looksLikeConnectionRefused =
        reason === "ECONNREFUSED" ||
        reason === "ENOTFOUND" ||
        /ECONNREFUSED|ENOTFOUND|ConnectionRefused|unable to connect/i.test(message);
      if (looksLikeConnectionRefused) {
        throw new LLMError(
          `Ollama is not reachable at ${this.baseUrl}. Start it with \`ollama serve\` and pull the model with \`ollama pull ${this.model}\`.`,
          this.name,
          err,
        );
      }
      throw new LLMError(`Ollama request failed: ${message}`, this.name, err);
    } finally {
      cancel();
    }

    if (response.status === 404) {
      throw new LLMError(
        `Ollama model "${this.model}" not found. Run \`ollama pull ${this.model}\` first.`,
        this.name,
      );
    }
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new LLMError(
        `Ollama returned HTTP ${response.status}: ${text.slice(0, 200)}`,
        this.name,
      );
    }

    const data = (await response.json()) as { response?: string; error?: string };
    if (data.error) {
      throw new LLMError(`Ollama error: ${data.error}`, this.name);
    }
    if (!data.response) {
      throw new LLMError("Ollama returned no response field", this.name);
    }

    let json: unknown;
    try {
      json = JSON.parse(data.response);
    } catch (err) {
      throw new LLMError(
        `Ollama returned invalid JSON: ${data.response.slice(0, 120)}…`,
        this.name,
        err,
      );
    }

    const parsed = MindMapPayloadSchema.safeParse(json);
    if (!parsed.success) {
      throw new LLMError(
        `Ollama output failed schema validation: ${parsed.error.message}`,
        this.name,
      );
    }
    return parsed.data;
  }
}

import OpenAI from "openai";
import {
  MindMapPayloadSchema,
  mindMapJsonSchemaStrict,
  type MindMapPayload,
} from "@/lib/schema";
import { withRetry } from "../retry";
import { LLMError, type LLMProvider, type ProviderInfo } from "../types";

const DEFAULT_MODEL = "gpt-4o-mini";

export class OpenAIProvider implements LLMProvider {
  readonly name = "openai" as const;
  private readonly model = process.env.OPENAI_MODEL || DEFAULT_MODEL;

  info(): ProviderInfo {
    const configured = !!process.env.OPENAI_API_KEY;
    return {
      name: this.name,
      label: "OpenAI",
      model: this.model,
      configured,
      notConfiguredHint: configured ? undefined : "Set OPENAI_API_KEY in .env.local",
    };
  }

  async generate(systemPrompt: string, userPrompt: string): Promise<MindMapPayload> {
    if (!process.env.OPENAI_API_KEY) {
      throw new LLMError("OPENAI_API_KEY is not set", this.name);
    }
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    return withRetry(() => this.callOnce(client, systemPrompt, userPrompt), {
      attempts: 3,
      isPermanent: (err) => {
        if (err instanceof OpenAI.APIError) {
          return !!err.status && err.status < 500 && err.status !== 429;
        }
        return false;
      },
    });
  }

  private async callOnce(
    client: OpenAI,
    systemPrompt: string,
    userPrompt: string,
  ): Promise<MindMapPayload> {
    const response = await client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "mindmap",
          strict: true,
          schema: mindMapJsonSchemaStrict as unknown as Record<string, unknown>,
        },
      },
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new LLMError("OpenAI returned no content", this.name);
    }

    let json: unknown;
    try {
      json = JSON.parse(content);
    } catch (err) {
      throw new LLMError(`OpenAI returned non-JSON content: ${content.slice(0, 120)}…`, this.name, err);
    }

    // Strict mode required `summary: string | null` and `children: array | null`
    // on every node. Normalise nulls to undefined so the lax Zod schema accepts.
    const normalised = stripNulls(json);

    const parsed = MindMapPayloadSchema.safeParse(normalised);
    if (!parsed.success) {
      throw new LLMError(
        `OpenAI output failed schema validation: ${parsed.error.message}`,
        this.name,
      );
    }
    return parsed.data;
  }
}

function stripNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripNulls);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === null) continue;
      out[k] = stripNulls(v);
    }
    return out;
  }
  return value;
}

import Anthropic from "@anthropic-ai/sdk";
import { MindMapPayloadSchema, mindMapJsonSchema, type MindMapPayload } from "@/lib/schema";
import { withRetry } from "../retry";
import { LLMError, type LLMProvider, type ProviderInfo } from "../types";

const TOOL_NAME = "render_mindmap";
const DEFAULT_MODEL = "claude-sonnet-4-6";

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic" as const;
  private readonly model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

  info(): ProviderInfo {
    const configured = !!process.env.ANTHROPIC_API_KEY;
    return {
      name: this.name,
      label: "Anthropic Claude",
      model: this.model,
      configured,
      notConfiguredHint: configured ? undefined : "Set ANTHROPIC_API_KEY in .env.local",
    };
  }

  async generate(systemPrompt: string, userPrompt: string): Promise<MindMapPayload> {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new LLMError("ANTHROPIC_API_KEY is not set", this.name);
    }
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    return withRetry(() => this.callOnce(client, systemPrompt, userPrompt), {
      attempts: 3,
      isPermanent: (err) => {
        if (err instanceof Anthropic.APIError) {
          return !!err.status && err.status < 500 && err.status !== 429;
        }
        return false;
      },
    });
  }

  private async callOnce(
    client: Anthropic,
    systemPrompt: string,
    userPrompt: string,
  ): Promise<MindMapPayload> {
    const response = await client.messages.create({
      model: this.model,
      max_tokens: 8192,
      system: systemPrompt,
      tools: [
        {
          name: TOOL_NAME,
          description: "Render a hierarchical mind map of the document.",
          input_schema: mindMapJsonSchema as unknown as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: "tool", name: TOOL_NAME },
      messages: [{ role: "user", content: userPrompt }],
    });

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new LLMError(`Model did not call the ${TOOL_NAME} tool`, this.name);
    }
    const parsed = MindMapPayloadSchema.safeParse(toolUse.input);
    if (!parsed.success) {
      throw new LLMError(
        `Tool output failed schema validation: ${parsed.error.message}`,
        this.name,
      );
    }
    return parsed.data;
  }
}

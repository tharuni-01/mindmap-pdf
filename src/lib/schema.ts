import { z } from "zod";
import type { MindMapNode } from "@/types/mindmap";

// Hard limits enforced both in the prompt (soft guidance) and in validation.
const MAX_DEPTH = 4;
const MAX_CHILDREN = 8;
const MAX_TITLE_CHARS = 160;
const MAX_NODE_TITLE_CHARS = 100;

const baseNode = z.object({
  title: z.string().min(1).max(MAX_NODE_TITLE_CHARS),
});

export const MindMapNodeSchema: z.ZodType<MindMapNode> = z.lazy(() =>
  baseNode.extend({
    children: z.array(MindMapNodeSchema).max(MAX_CHILDREN).optional(),
  }),
);

// Summary is optional — the spec only requires {title, children}, but
// providers may include it and the canvas surfaces it as a banner.
export const MindMapPayloadSchema = z.object({
  title: z.string().min(1).max(MAX_TITLE_CHARS),
  summary: z.string().max(2000).optional(),
  children: z.array(MindMapNodeSchema).max(MAX_CHILDREN),
});

export type MindMapPayload = z.infer<typeof MindMapPayloadSchema>;

// Truncate any sub-tree deeper than MAX_DEPTH so a runaway LLM
// can't produce an unrenderable structure. Returns a depth-bounded copy.
export function clampDepth(node: MindMapNode, depth = 0): MindMapNode {
  if (depth >= MAX_DEPTH || !node.children?.length) {
    return { title: node.title };
  }
  return {
    title: node.title,
    children: node.children.map((c) => clampDepth(c, depth + 1)),
  };
}

// Loose JSON Schema, used in Anthropic tool_use input_schema and as schema
// hints in Ollama prompts. Permissive: optional fields are omitted instead
// of nulled, which is what most providers handle natively.
export const mindMapJsonSchema = {
  type: "object",
  required: ["title", "children"],
  properties: {
    title: {
      type: "string",
      description: "Document's overall title — root of the mind map.",
    },
    summary: {
      type: "string",
      description: "Optional 2-4 sentence overview of the document.",
    },
    children: {
      type: "array",
      maxItems: MAX_CHILDREN,
      description: "Top-level branches. Each becomes a primary topic.",
      items: { $ref: "#/$defs/node" },
    },
  },
  $defs: {
    node: {
      type: "object",
      required: ["title"],
      properties: {
        title: {
          type: "string",
          description: "Short label, ≤10 words, no trailing punctuation.",
        },
        children: {
          type: "array",
          maxItems: MAX_CHILDREN,
          description: "Sub-points. Omit for leaf nodes.",
          items: { $ref: "#/$defs/node" },
        },
      },
    },
  },
} as const;

// Strict JSON Schema for OpenAI structured outputs. Strict mode requires
// every property to be in `required` and `additionalProperties: false`
// throughout. Optional fields use `["string", "null"]` typing.
export const mindMapJsonSchemaStrict = {
  type: "object",
  additionalProperties: false,
  required: ["title", "summary", "children"],
  properties: {
    title: { type: "string", description: "Document's overall title." },
    summary: {
      type: ["string", "null"],
      description: "2-4 sentence overview, or null if not produced.",
    },
    children: {
      type: "array",
      items: { $ref: "#/$defs/node" },
    },
  },
  $defs: {
    node: {
      type: "object",
      additionalProperties: false,
      required: ["title", "children"],
      properties: {
        title: {
          type: "string",
          description: "Short label, ≤10 words, no trailing punctuation.",
        },
        children: {
          type: ["array", "null"],
          items: { $ref: "#/$defs/node" },
        },
      },
    },
  },
} as const;

export const SCHEMA_LIMITS = {
  MAX_DEPTH,
  MAX_CHILDREN,
  MAX_TITLE_CHARS,
  MAX_NODE_TITLE_CHARS,
} as const;

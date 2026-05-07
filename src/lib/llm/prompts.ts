import { mindMapJsonSchema } from "@/lib/schema";

// Shared system prompt used by every provider. Intentionally provider-agnostic:
// each provider enforces JSON output with its own native mechanism (tool use
// for Anthropic, response_format for OpenAI, format:"json" for Ollama). The
// prompt itself only describes the SHAPE of the output and the constraints.
export const SYSTEM_PROMPT = `You convert documents into structured hierarchical mind maps.

Output a JSON object with these fields:
  - title: the document's overall title (string)
  - summary: a 2-4 sentence overview of the document (string, optional but encouraged)
  - children: an array of top-level branches

Each branch is a recursive node: { "title": string, "children": [ ... ] }

Rules:
  - 4 to 8 top-level branches that capture the document's primary divisions.
  - 2 to 6 children under each branch as appropriate; not everything needs depth.
  - Maximum nesting depth is 4 levels below the root.
  - Each "title" is short and scannable: at most 10 words, no trailing punctuation.
  - Group related ideas into themes; do not just list paragraph headings verbatim.
  - Omit "children" or pass an empty array for leaf nodes.

Return ONLY valid JSON matching the schema. Do not include any prose, code fences,
or commentary outside the JSON object.`;

// Used in multi-pass mode after each chunk has produced a partial outline.
export const MERGE_SYSTEM_PROMPT = `You merge partial mind-map outlines into a single coherent mind map.

You will receive several partial outlines, each generated from one chunk of a longer document.

Your job:
  - Identify the overall document title and write a 2-4 sentence summary.
  - Deduplicate overlapping topics across outlines.
  - Group related branches under unified top-level themes.
  - Produce a clean, balanced mind map (4-8 top-level branches; depth at most 4 below root).

Output rules are identical to the original prompt: JSON only, each title ≤10 words,
no trailing punctuation, no prose outside the JSON.`;

// User-prompt builder for a single-pass call.
export function buildUserPrompt(documentText: string): string {
  return `Schema (informational; the runtime enforces JSON output):
${JSON.stringify(mindMapJsonSchema, null, 2)}

Document text:

${documentText}`;
}

// User-prompt builder for one chunk in multi-pass mode.
export function buildChunkUserPrompt(chunk: string, index: number, total: number): string {
  return `This is chunk ${index + 1} of ${total} from a longer document. Produce a partial mind map covering only the topics in this chunk. The full document title may not be evident yet — give your best guess.

Schema (informational):
${JSON.stringify(mindMapJsonSchema, null, 2)}

Chunk text:

${chunk}`;
}

// User-prompt builder for the final merge step.
export function buildMergeUserPrompt(
  partials: Array<{ title: string; summary?: string; children: unknown }>,
): string {
  const formatted = partials
    .map(
      (p, i) =>
        `--- Outline ${i + 1} of ${partials.length} ---
Title guess: ${p.title}
Summary: ${p.summary ?? "(none)"}
Branches:
${JSON.stringify(p.children, null, 2)}`,
    )
    .join("\n\n");

  return `Merge these ${partials.length} partial outlines into one mind map.

${formatted}`;
}

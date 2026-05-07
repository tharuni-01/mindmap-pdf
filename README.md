# Mind Map PDF

Convert PDF documents into interactive mind maps. Built with Next.js 14, React Flow, Tailwind, and a pluggable LLM layer that supports **Anthropic Claude**, **OpenAI**, **Ollama (local)**, and a no-LLM rule-based fallback.

## Features

- Drag-and-drop PDF upload (up to 15MB) with live progress
- Server-side text extraction (`pdf-parse`) with paragraph-aware chunking for long documents
- **Multi-provider LLM layer** with a unified `generateMindMap()` entry point and a frontend dropdown to pick the provider per upload
- Hierarchical mind map output, validated against a Zod schema (depth ≤4, ≤8 children per node, ≤10 words per title)
- Interactive React Flow canvas: pan, zoom, drag nodes, expand/collapse subtrees
- Double-click any node to rename it
- Export the canvas as PNG or SVG (high-res, theme-aware background)
- Light / dark mode

## Folder structure

```
mindmap-pdf/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── process-pdf/route.ts   # POST endpoint: validates + extracts + delegates to LLM layer
│   │   │   └── providers/route.ts     # GET endpoint: returns provider list & default for the dropdown
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx                   # Provider dropdown + uploader ↔ canvas state machine
│   ├── components/
│   │   ├── mind-map.tsx               # React Flow canvas + export
│   │   ├── mind-map-node.tsx          # Custom node (collapse, rename)
│   │   ├── pdf-uploader.tsx           # Dropzone + XHR upload progress; sends provider in FormData
│   │   ├── provider-select.tsx       # Dropdown wired to /api/providers
│   │   ├── theme-provider.tsx
│   │   ├── theme-toggle.tsx
│   │   └── ui/button.tsx
│   ├── lib/
│   │   ├── llm/
│   │   │   ├── index.ts               # Public: generateMindMap(), resolveProvider(), listProviderInfo()
│   │   │   ├── prompts.ts             # SHARED prompts used by every provider
│   │   │   ├── retry.ts               # withRetry() + withTimeout()
│   │   │   ├── types.ts               # LLMProvider interface, ProviderName, LLMError
│   │   │   └── providers/
│   │   │       ├── anthropic.ts       # tool_use forced JSON
│   │   │       ├── openai.ts          # response_format json_schema (strict)
│   │   │       ├── ollama.ts          # POST /api/generate with format:"json"
│   │   │       └── registry.ts        # Provider lookup + default resolution
│   │   ├── pdf.ts                     # Extract + chunk text
│   │   ├── heuristic-mindmap.ts       # No-LLM rule-based fallback
│   │   ├── sample-mindmap.ts          # Hardcoded data for the demo button
│   │   ├── schema.ts                  # Zod + JSON Schema (lax + OpenAI-strict)
│   │   ├── layout.ts                  # Tree → ReactFlow nodes/edges via dagre
│   │   └── utils.ts                   # cn helper
│   └── types/mindmap.ts
├── .env.example
├── next.config.mjs
├── tailwind.config.ts
└── package.json
```

## Setup

Requires Node 18.17+ **or** Bun 1.x.

```bash
# 1. Install deps
bun install
# or: npm install

# 2. Configure at least one provider
cp .env.example .env.local
# Edit .env.local — set ANTHROPIC_API_KEY, OPENAI_API_KEY, or OLLAMA_BASE_URL

# 3. Run the dev server
bun run dev
# or: npm run dev
```

Open http://localhost:3000 and pick a provider from the dropdown before uploading.

### Provider setup

#### Anthropic
1. Get a key at https://console.anthropic.com/
2. Add to `.env.local`:
   ```env
   ANTHROPIC_API_KEY=sk-ant-...
   # ANTHROPIC_MODEL=claude-sonnet-4-6   # optional override
   ```

#### OpenAI
1. Get a key at https://platform.openai.com/api-keys
2. Add to `.env.local`:
   ```env
   OPENAI_API_KEY=sk-...
   # OPENAI_MODEL=gpt-4o-mini             # optional override
   ```

#### Ollama (local, no API key)
1. Install Ollama from https://ollama.com/download
2. Pull a model and start the server:
   ```bash
   ollama pull llama3
   ollama serve   # listens on http://localhost:11434
   ```
3. Add to `.env.local` (the env var is the opt-in signal):
   ```env
   OLLAMA_BASE_URL=http://localhost:11434
   # OLLAMA_MODEL=llama3                  # optional; any model you've pulled
   ```

#### No provider (heuristic mode)
Don't set anything. The app falls back to a rule-based heuristic — output varies per PDF but quality is rough compared to a real LLM.

### Environment variables

| Variable            | Required | Default              | Notes                                                  |
|---------------------|----------|----------------------|--------------------------------------------------------|
| `ANTHROPIC_API_KEY` | One of   | —                    | https://console.anthropic.com                          |
| `ANTHROPIC_MODEL`   | No       | `claude-sonnet-4-6`  |                                                        |
| `OPENAI_API_KEY`    | One of   | —                    | https://platform.openai.com/api-keys                   |
| `OPENAI_MODEL`      | No       | `gpt-4o-mini`        |                                                        |
| `OLLAMA_BASE_URL`   | One of   | —                    | Setting this opts into Ollama; e.g. http://localhost:11434 |
| `OLLAMA_MODEL`      | No       | `llama3`             | Any model you've `ollama pull`'d                       |
| `LLM_PROVIDER`      | No       | (auto)               | Default provider when frontend doesn't specify one     |
| `LLM_FALLBACK`      | No       | —                    | Comma-separated list, e.g. `LLM_FALLBACK=openai`       |
| `MAX_UPLOAD_MB`     | No       | `15`                 | Per-file upload limit                                  |

## How it works

1. **Upload** — `PdfUploader` posts the file (and the chosen provider) via `XMLHttpRequest` to `/api/process-pdf`.
2. **Extract** — `extractPdf` runs `pdf-parse` on the buffer and normalises whitespace.
3. **Provider resolution** — `resolveProvider()` picks: explicit request > `LLM_PROVIDER` env > first configured provider > `heuristic`.
4. **Heuristic shortcut** — if the resolved provider is `heuristic`, `buildHeuristicMindMap()` is used and no LLM call is made.
5. **Chunk** — If the document fits in one LLM pass (~80k tokens), we send it whole. Otherwise `chunkText` splits on paragraph boundaries into ~25k-token chunks.
6. **LLM** — `generateMindMap()` calls the chosen provider's `generate(systemPrompt, userPrompt)` once per chunk. Each provider enforces JSON output natively (Anthropic tool_use, OpenAI `response_format: json_schema`, Ollama `format: "json"`).
7. **Multi-pass merge** — for chunked documents, partial outlines from each chunk are sent through one final merge call to produce a unified mind map.
8. **Validate** — Output is parsed through `MindMapPayloadSchema` (Zod). Validation failures retry once before surfacing the error. Depth is then clamped to 4 levels.
9. **Render** — `buildMindMapGraph` flattens the tree to React Flow nodes/edges and runs `dagre` for left-to-right hierarchical layout.
10. **Export** — `html-to-image` captures the React Flow viewport (minus controls/minimap) at 2× pixel ratio.

### Adding a new provider

1. Create `src/lib/llm/providers/myprovider.ts` implementing the `LLMProvider` interface from `../types`.
2. Register it in `src/lib/llm/providers/registry.ts`.
3. Add it to the `ProviderName` union in `src/lib/llm/types.ts`.

The shared prompt template (`src/lib/llm/prompts.ts`) is provider-agnostic — only the JSON-output enforcement differs per provider.

## Limitations / next steps

- **OCR:** scanned PDFs return no text. Adding Tesseract or routing to PyMuPDF/Poppler would handle these.
- **No persistence:** results live in browser state only. Adding Postgres + auth + shareable links is a follow-up.
- **No streaming progress for the LLM step:** the UI shows a spinner until the full result arrives. Server-Sent Events on the API route is a clean upgrade path.
- **Edits are not persisted:** rename and collapse state is lost on refresh.

## License

MIT

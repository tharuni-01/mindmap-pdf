import { NextRequest, NextResponse } from "next/server";
import { extractPdf } from "@/lib/pdf";
import {
  generateMindMap,
  resolveProvider,
  parseFallbackEnv,
  LLMError,
  type ProviderName,
} from "@/lib/llm";
import { buildHeuristicMindMap } from "@/lib/heuristic-mindmap";
import { clampDepth } from "@/lib/schema";
import type { MindMapResult } from "@/types/mindmap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB ?? 15);
const MAX_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

function bad(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return bad(400, "Expected multipart/form-data with a 'file' field");
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return bad(400, "Missing 'file' field");
  }
  if (file.type && file.type !== "application/pdf") {
    return bad(415, `Unsupported file type: ${file.type}. Upload a PDF.`);
  }
  if (file.size === 0) return bad(400, "Uploaded file is empty");
  if (file.size > MAX_BYTES) return bad(413, `File exceeds ${MAX_UPLOAD_MB}MB limit`);

  const requestedProvider = (formData.get("provider") as string | null) ?? null;
  const provider: ProviderName = resolveProvider(requestedProvider);

  const buffer = Buffer.from(await file.arrayBuffer());

  let extracted;
  try {
    extracted = await extractPdf(buffer);
  } catch (err) {
    console.error("[process-pdf] extraction failed", err);
    return bad(422, "Could not parse PDF. The file may be corrupted or password-protected.");
  }
  if (!extracted.text.trim()) {
    return bad(
      422,
      "No extractable text found. This PDF may be scanned/image-only — OCR is not enabled in this build.",
    );
  }

  if (provider === "heuristic") {
    const payload = buildHeuristicMindMap(extracted.text);
    const result: MindMapResult = {
      mindmap: clampDepth({ title: payload.title, children: payload.children }),
      summary: payload.summary ?? "",
      meta: {
        pages: extracted.pages,
        chars: extracted.text.length,
        chunks: 0,
        model: "heuristic",
      },
    };
    return NextResponse.json(result);
  }

  try {
    const { payload, chunks, providerUsed, model } = await generateMindMap({
      provider,
      text: extracted.text,
      fallbacks: parseFallbackEnv(),
    });

    const result: MindMapResult = {
      mindmap: clampDepth({ title: payload.title, children: payload.children }),
      summary: payload.summary ?? "",
      meta: {
        pages: extracted.pages,
        chars: extracted.text.length,
        chunks,
        model: providerUsed === provider ? model : `${model} (fallback from ${provider})`,
      },
    };
    return NextResponse.json(result);
  } catch (err) {
    console.error("[process-pdf] LLM failure", err);
    if (err instanceof LLMError) {
      return bad(502, `${provider}: ${err.message}`);
    }
    return bad(500, "Unexpected server error while building mind map");
  }
}

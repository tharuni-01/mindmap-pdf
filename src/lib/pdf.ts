// Direct import path avoids pdf-parse's module-load debug code that
// otherwise tries to read a test fixture from node_modules and crashes.
import pdfParse from "pdf-parse/lib/pdf-parse.js";

export interface ExtractedPdf {
  text: string;
  pages: number;
}

export async function extractPdf(buffer: Buffer): Promise<ExtractedPdf> {
  const result = await pdfParse(buffer);
  const text = cleanText(result.text ?? "");
  return { text, pages: result.numpages ?? 0 };
}

function cleanText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

const CHARS_PER_TOKEN = 4;
const MAX_SINGLE_PASS_TOKENS = 80_000;
const CHUNK_TARGET_TOKENS = 25_000;

export function approxTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function fitsSinglePass(text: string): boolean {
  return approxTokens(text) <= MAX_SINGLE_PASS_TOKENS;
}

// Split into roughly-equal chunks on paragraph boundaries.
// Falls back to sentence and then hard-character splits to bound chunk size.
export function chunkText(text: string, targetTokens = CHUNK_TARGET_TOKENS): string[] {
  const targetChars = targetTokens * CHARS_PER_TOKEN;
  if (text.length <= targetChars) return [text];

  const paragraphs = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let buffer = "";

  const flush = () => {
    if (buffer.trim()) chunks.push(buffer.trim());
    buffer = "";
  };

  for (const p of paragraphs) {
    if (p.length > targetChars) {
      // Single oversized paragraph — split on sentence boundaries.
      flush();
      for (const piece of splitOversized(p, targetChars)) chunks.push(piece);
      continue;
    }
    if (buffer.length + p.length + 2 > targetChars) flush();
    buffer += (buffer ? "\n\n" : "") + p;
  }
  flush();
  return chunks;
}

function splitOversized(paragraph: string, targetChars: number): string[] {
  const sentences = paragraph.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) ?? [paragraph];
  const out: string[] = [];
  let buffer = "";
  for (const s of sentences) {
    if (s.length > targetChars) {
      // Hard-split absurdly long "sentence" (e.g. tables flattened to one line).
      if (buffer) {
        out.push(buffer);
        buffer = "";
      }
      for (let i = 0; i < s.length; i += targetChars) {
        out.push(s.slice(i, i + targetChars));
      }
      continue;
    }
    if (buffer.length + s.length > targetChars) {
      out.push(buffer);
      buffer = "";
    }
    buffer += s;
  }
  if (buffer) out.push(buffer);
  return out;
}

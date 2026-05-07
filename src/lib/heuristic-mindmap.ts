import type { MindMapPayload } from "./schema";

// Rule-based mind-map generator used when no LLM is configured.
// It will never match the quality of an LLM, but it produces output
// that varies meaningfully per document instead of returning a static stub.

const MAX_BRANCHES = 7;
const MAX_CHILDREN = 5;
const MAX_LABEL = 80;
const MAX_TITLE = 120;
const MAX_SUMMARY = 400;

interface Section {
  heading: string;
  body: string[];
}

export function buildHeuristicMindMap(text: string): MindMapPayload {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return {
      title: "Empty document",
      summary: "No text could be extracted from this PDF.",
      children: [],
    };
  }

  const sections = detectSections(paragraphs);
  const title = inferTitle(paragraphs, sections);
  const summary = inferSummary(paragraphs, title);

  const children = sections
    .slice(0, MAX_BRANCHES)
    .map((s) => {
      const headingShort = shorten(s.heading, MAX_LABEL);
      const headingKey = normalise(headingShort);
      const seen = new Set<string>([headingKey]);
      const bullets = extractBullets(s.body)
        .map((b) => shorten(b, MAX_LABEL))
        .filter((b) => {
          const key = normalise(b);
          if (!key || seen.has(key)) return false;
          // Skip children that just repeat or extend the heading text.
          if (key.startsWith(headingKey) || headingKey.startsWith(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, MAX_CHILDREN)
        .map((b) => ({ title: b }));
      return {
        title: headingShort,
        ...(bullets.length ? { children: bullets } : {}),
      };
    })
    .filter((s) => s.title.length > 0);

  return {
    title: shorten(title, MAX_TITLE),
    summary: shorten(summary, MAX_SUMMARY),
    children,
  };
}

// Walk paragraphs, classifying each as heading or body. Body paragraphs
// belong to the most recently seen heading. If we don't find at least two
// headings, fall back to chunking paragraphs into N pseudo-sections.
function detectSections(paragraphs: string[]): Section[] {
  const sections: Section[] = [];
  let current: Section | null = null;

  for (const p of paragraphs) {
    if (isLikelyHeading(p)) {
      if (current) sections.push(current);
      current = { heading: p, body: [] };
    } else if (current) {
      current.body.push(p);
    }
    // Body paragraphs before the first heading are intentionally dropped —
    // they typically belong to a title page or abstract and are surfaced via
    // the summary instead.
  }
  if (current) sections.push(current);

  if (sections.length >= 2) return sections;

  // Fallback: chunk paragraphs into MAX_BRANCHES groups, use the first
  // sentence of each group as a synthetic heading.
  const fallback: Section[] = [];
  const chunkSize = Math.max(1, Math.ceil(paragraphs.length / MAX_BRANCHES));
  for (let i = 0; i < paragraphs.length && fallback.length < MAX_BRANCHES; i += chunkSize) {
    const slice = paragraphs.slice(i, i + chunkSize);
    const first = slice[0] ?? "";
    fallback.push({
      heading: firstSentence(first) || `Section ${fallback.length + 1}`,
      body: slice,
    });
  }
  return fallback;
}

function isLikelyHeading(paragraph: string): boolean {
  // PDFs occasionally fold a heading into a one-paragraph block, but multi-line
  // headings are rare enough to ignore — they cause more false positives than
  // they help.
  const lines = paragraph.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length !== 1) return false;

  const line = lines[0]!;
  if (line.length < 3 || line.length > 80) return false;
  // Sentences end with .!?,; — headings rarely do (a trailing colon is fine).
  if (/[.!?;,]$/.test(line)) return false;
  // Reject anything that contains common sentence connectives — these slip
  // through capitalisation checks otherwise.
  if (/\b(?:the|of|and|is|are|was|were|shall|will|may|that|this|these|those|with|from|to|by|as|in|on|at|for)\b\s+\w/i.test(line)) {
    // Allow if heading also matches a numbered/sectioned pattern.
    if (!/^(\d+[.)]\s|[IVX]+\.\s|Section\s|Chapter\s|Article\s|Part\s|Item\s)/i.test(line)) {
      return false;
    }
  }

  // Numbered / sectioned patterns.
  if (/^(\d+[.)]\s|[IVX]+\.\s|Section\s+\d|Chapter\s+\d|Article\s+\w+|Part\s+\d|Item\s+\d)/i.test(line)) {
    return true;
  }

  // Trailing colon — common heading marker.
  if (line.endsWith(":")) return true;

  // All-caps (with at least 3 alphabetical characters).
  const letters = line.replace(/[^A-Za-z]/g, "");
  if (letters.length >= 3 && letters === letters.toUpperCase()) return true;

  return false;
}

function inferTitle(paragraphs: string[], sections: Section[]): string {
  // 1. Prefer a contiguous run of ALL-CAPS lines at the top of the document.
  //    Multi-line all-caps blocks ("UNANIMOUS WRITTEN CONSENT / OF THE BOARD")
  //    are common in legal/financial PDFs.
  for (const p of paragraphs.slice(0, 5)) {
    const lines = p.split("\n").map((l) => l.trim()).filter(Boolean);
    const allCaps: string[] = [];
    for (const line of lines) {
      if (allCaps.length >= 4) break;
      if (line.length < 3 || line.length > MAX_TITLE) break;
      const letters = line.replace(/[^A-Za-z]/g, "");
      if (letters.length < 3 || letters !== letters.toUpperCase()) break;
      allCaps.push(line);
    }
    if (allCaps.length > 0) {
      const merged = allCaps.join(" ");
      if (merged.length <= MAX_TITLE) return merged;
      return allCaps[0]!;
    }
  }
  // 2. First non-empty line of the first paragraph, if short and title-like.
  const firstLine = paragraphs[0]!.split("\n").map((l) => l.trim()).find(Boolean);
  if (firstLine && firstLine.length <= MAX_TITLE && !/[.!?]$/.test(firstLine)) {
    return firstLine;
  }
  // 3. First detected section heading.
  if (sections[0]) return sections[0].heading;
  // 4. Fall back to first ~MAX_TITLE chars of the document.
  return paragraphs[0]!;
}

function inferSummary(paragraphs: string[], title: string): string {
  const candidate = paragraphs.find(
    (p) => p.replace(/\s+/g, " ") !== title && p.length >= 60,
  );
  const source = candidate ?? paragraphs[0] ?? "";
  return firstSentences(source, 3);
}

// Try explicit bullet markers first (•, -, *, "1.", "a)", "iv."). If we find
// at least two, use them. Otherwise fall back to splitting the joined body
// into sentences.
function extractBullets(body: string[]): string[] {
  const text = body.join("\n");
  const bullets: string[] = [];
  const bulletRegex = /(?:^|\n)\s*(?:[•\-\*]|\d+[.)]|[a-z]\)|[ivx]+\.)\s+([^\n]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = bulletRegex.exec(text))) {
    const captured = m[1]?.trim();
    if (captured) bullets.push(captured);
  }
  if (bullets.length >= 2) return bullets;
  return splitSentences(text).filter((s) => s.length > 10);
}

function firstSentence(text: string): string {
  return splitSentences(text)[0] ?? text.replace(/\s+/g, " ").trim();
}

function firstSentences(text: string, n: number): string {
  return splitSentences(text).slice(0, n).join(" ").trim();
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z(])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function shorten(text: string, max: number): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return cleaned.slice(0, max - 1).trimEnd() + "…";
}

function normalise(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

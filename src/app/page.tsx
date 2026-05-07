"use client";

import * as React from "react";
import { Brain, Sparkles } from "lucide-react";
import { PdfUploader } from "@/components/pdf-uploader";
import { MindMap } from "@/components/mind-map";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { ProviderSelect, type ProviderName } from "@/components/provider-select";
import { SAMPLE_MINDMAP } from "@/lib/sample-mindmap";
import type { MindMapResult } from "@/types/mindmap";

export default function HomePage() {
  const [result, setResult] = React.useState<MindMapResult | null>(null);
  const [fileName, setFileName] = React.useState<string>("");
  const [provider, setProvider] = React.useState<ProviderName | null>(null);

  const handleResult = React.useCallback((r: MindMapResult, name: string) => {
    setResult(r);
    setFileName(name);
  }, []);

  const handleReset = React.useCallback(() => {
    setResult(null);
    setFileName("");
  }, []);

  return (
    <main className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Brain className="size-5" />
          </div>
          <span className="text-base font-semibold">Mind Map PDF</span>
        </div>
        <ThemeToggle />
      </header>

      {result ? (
        <div className="flex-1 min-h-0">
          <MindMap result={result} fileName={fileName} onReset={handleReset} />
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
          <div className="max-w-xl text-center">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Turn any PDF into a mind map
            </h1>
            <p className="mt-3 text-muted-foreground">
              Upload a document and an LLM will extract its structure into an
              interactive, editable, exportable mind map.
            </p>
          </div>

          <ProviderSelect value={provider} onChange={setProvider} />

          <PdfUploader onResult={handleResult} provider={provider} />

          <div className="flex flex-col items-center gap-2 text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleResult(SAMPLE_MINDMAP, "Sample document.pdf")}
            >
              <Sparkles className="size-4" />
              Try with sample data
            </Button>
            <p className="text-xs text-muted-foreground">
              No upload, no API key — opens a pre-built mind map so you can poke at the canvas.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}

"use client";

import * as React from "react";
import { Brain, Clock, Sparkles, X } from "lucide-react";
import { PdfUploader } from "@/components/pdf-uploader";
import { MindMap } from "@/components/mind-map";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { ProviderSelect, type ProviderName } from "@/components/provider-select";
import { SAMPLE_MINDMAP } from "@/lib/sample-mindmap";
import type { MindMapResult } from "@/types/mindmap";
import { saveMap, loadHistory, deleteHistoryEntry, type HistoryEntry } from "@/lib/storage";

export default function HomePage() {
  const [result, setResult] = React.useState<MindMapResult | null>(null);
  const [fileName, setFileName] = React.useState<string>("");
  const [provider, setProvider] = React.useState<ProviderName | null>(null);
  const [originalFile, setOriginalFile] = React.useState<File | null>(null);
  const [regenerateFile, setRegenerateFile] = React.useState<File | null>(null);
  const [history, setHistory] = React.useState<HistoryEntry[]>([]);

  React.useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const handleResult = React.useCallback(
    (r: MindMapResult, name: string, file?: File) => {
      setResult(r);
      setFileName(name);
      if (file) setOriginalFile(file);
      setRegenerateFile(null);
      saveMap(name, r);
      setHistory(loadHistory());
    },
    [],
  );

  const handleReset = React.useCallback(() => {
    setResult(null);
    setFileName("");
    setOriginalFile(null);
  }, []);

  const handleRegenerate = React.useCallback(() => {
    if (!originalFile) return;
    setRegenerateFile(originalFile);
    setResult(null);
  }, [originalFile]);

  const handleDeleteHistory = React.useCallback((id: string) => {
    deleteHistoryEntry(id);
    setHistory(loadHistory());
  }, []);

  const handleRestoreHistory = React.useCallback((entry: HistoryEntry) => {
    setResult(entry.result);
    setFileName(entry.filename);
    setOriginalFile(null);
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
          <MindMap
            result={result}
            fileName={fileName}
            onReset={handleReset}
            onRegenerate={originalFile ? handleRegenerate : undefined}
          />
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-12 overflow-y-auto">
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

          <PdfUploader
            key={regenerateFile ? `regen-${regenerateFile.name}-${regenerateFile.lastModified}` : "default"}
            onResult={handleResult}
            provider={provider}
            defaultFile={regenerateFile ?? undefined}
          />

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

          {history.length > 0 && (
            <div className="w-full max-w-xl">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">Recent</span>
              </div>
              <div className="flex flex-col gap-2">
                {history.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm"
                  >
                    <button
                      type="button"
                      className="flex-1 text-left hover:text-primary transition-colors truncate"
                      onClick={() => handleRestoreHistory(entry)}
                    >
                      <span className="font-medium block truncate">{entry.filename}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(entry.timestamp).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteHistory(entry.id)}
                      className="ml-3 shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                      title="Remove from history"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

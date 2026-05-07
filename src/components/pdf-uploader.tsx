"use client";

import * as React from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { FileUp, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MindMapResult } from "@/types/mindmap";

interface Props {
  onResult: (result: MindMapResult, fileName: string, file: File) => void;
  disabled?: boolean;
  provider?: string | null;
  defaultFile?: File;
}

type UploadState =
  | { status: "idle" }
  | { status: "uploading"; progress: number; fileName: string }
  | { status: "processing"; fileName: string }
  | { status: "error"; message: string };

const MAX_MB = 15;

export function PdfUploader({ onResult, disabled, provider, defaultFile }: Props) {
  const [state, setState] = React.useState<UploadState>({ status: "idle" });
  const xhrRef = React.useRef<XMLHttpRequest | null>(null);
  const providerRef = React.useRef<string | null | undefined>(provider);
  React.useEffect(() => {
    providerRef.current = provider;
  }, [provider]);

  const upload = React.useCallback(
    (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      if (providerRef.current) formData.append("provider", providerRef.current);

      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;
      xhr.open("POST", "/api/process-pdf");

      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        const progress = Math.round((e.loaded / e.total) * 100);
        setState({ status: "uploading", progress, fileName: file.name });
      };

      xhr.upload.onload = () => {
        setState({ status: "processing", fileName: file.name });
      };

      xhr.onload = () => {
        xhrRef.current = null;
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const result = JSON.parse(xhr.responseText) as MindMapResult;
            setState({ status: "idle" });
            onResult(result, file.name, file);
          } catch {
            setState({ status: "error", message: "Malformed response from server" });
          }
        } else {
          let message = `Request failed (${xhr.status})`;
          try {
            const body = JSON.parse(xhr.responseText);
            if (body?.error) message = body.error;
          } catch {
            /* ignore */
          }
          setState({ status: "error", message });
        }
      };

      xhr.onerror = () => {
        xhrRef.current = null;
        setState({ status: "error", message: "Network error during upload" });
      };

      xhr.onabort = () => {
        xhrRef.current = null;
        setState({ status: "idle" });
      };

      setState({ status: "uploading", progress: 0, fileName: file.name });
      xhr.send(formData);
    },
    [onResult],
  );

  // Auto-trigger upload when a defaultFile is provided (e.g. regenerate)
  React.useEffect(() => {
    if (defaultFile) upload(defaultFile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDrop = React.useCallback(
    (accepted: File[], rejected: FileRejection[]) => {
      if (rejected.length > 0) {
        const first = rejected[0]!.errors[0];
        setState({ status: "error", message: first?.message ?? "File rejected" });
        return;
      }
      const file = accepted[0];
      if (!file) return;
      upload(file);
    },
    [upload],
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    maxSize: MAX_MB * 1024 * 1024,
    noClick: state.status !== "idle",
    disabled: disabled || state.status === "uploading" || state.status === "processing",
  });

  const cancel = () => {
    xhrRef.current?.abort();
  };

  const isWorking = state.status === "uploading" || state.status === "processing";

  return (
    <div className="w-full max-w-xl mx-auto">
      <div
        {...getRootProps()}
        className={cn(
          "rounded-xl border-2 border-dashed border-muted-foreground/30 bg-card p-10 text-center transition-colors",
          isDragActive && "border-primary bg-primary/5",
          isWorking && "cursor-default",
          !isWorking && !disabled && "cursor-pointer hover:border-muted-foreground/60",
        )}
      >
        <input {...getInputProps()} />

        {state.status === "idle" && (
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-full bg-muted p-3">
              <FileUp className="size-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-base font-medium">Drop a PDF here, or click to browse</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Up to {MAX_MB}MB. Text-based PDFs work best.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={open} disabled={disabled}>
              Choose file
            </Button>
          </div>
        )}

        {state.status === "uploading" && (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
            <div className="w-full">
              <p className="text-sm font-medium truncate">{state.fileName}</p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-[width] duration-150"
                  style={{ width: `${state.progress}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Uploading… {state.progress}%</p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={cancel}>
              <X className="size-4" /> Cancel
            </Button>
          </div>
        )}

        {state.status === "processing" && (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="size-6 animate-spin text-primary" />
            <div>
              <p className="text-sm font-medium truncate">{state.fileName}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Extracting text and generating mind map…
              </p>
            </div>
          </div>
        )}

        {state.status === "error" && (
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-full bg-destructive/10 p-3">
              <X className="size-6 text-destructive" />
            </div>
            <div>
              <p className="text-base font-medium text-destructive">Something went wrong</p>
              <p className="mt-1 text-sm text-muted-foreground">{state.message}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setState({ status: "idle" })}
            >
              Try again
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import * as React from "react";
import { Cpu, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ProviderName = "anthropic" | "openai" | "ollama" | "heuristic";

export interface ProviderInfo {
  name: ProviderName;
  label: string;
  model: string;
  configured: boolean;
  notConfiguredHint?: string;
}

interface Props {
  value: ProviderName | null;
  onChange: (next: ProviderName) => void;
  disabled?: boolean;
}

interface ProvidersResponse {
  providers: ProviderInfo[];
  default: ProviderName;
}

export function ProviderSelect({ value, onChange, disabled }: Props) {
  const [data, setData] = React.useState<ProvidersResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/providers")
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as ProvidersResponse;
      })
      .then((d) => {
        if (cancelled) return;
        setData(d);
        // Initialise the parent state with the server-suggested default.
        if (value === null) onChange(d.default);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load providers");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = data?.providers.find((p) => p.name === value);

  return (
    <div className="flex w-full max-w-xl flex-col gap-1.5">
      <label className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Cpu className="size-3.5" /> LLM provider
        </span>
        {selected && !selected.configured && (
          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="size-3.5" />
            Not configured
          </span>
        )}
      </label>

      <select
        value={value ?? ""}
        disabled={disabled || !data}
        onChange={(e) => onChange(e.target.value as ProviderName)}
        className={cn(
          "h-10 rounded-md border border-input bg-background px-3 text-sm",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        {!data && <option value="">Loading providers…</option>}
        {data?.providers.map((p) => (
          <option key={p.name} value={p.name}>
            {p.label} — {p.model}
            {p.configured ? "" : " (not configured)"}
          </option>
        ))}
      </select>

      {error && (
        <p className="text-xs text-destructive">Failed to load providers: {error}</p>
      )}
      {selected?.notConfiguredHint && !selected.configured && (
        <p className="text-xs text-muted-foreground">{selected.notConfiguredHint}</p>
      )}
      {selected?.configured && selected.name !== "heuristic" && (
        <p className="text-xs text-muted-foreground">
          Using <span className="font-medium">{selected.label}</span> ({selected.model}).
        </p>
      )}
      {selected?.name === "heuristic" && (
        <p className="text-xs text-muted-foreground">
          Rule-based — no LLM call. Quality is rough; configure a provider for real results.
        </p>
      )}
    </div>
  );
}

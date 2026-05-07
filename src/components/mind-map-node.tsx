"use client";

import * as React from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FlowNodeData } from "@/lib/layout";

interface MindMapNodeProps extends NodeProps<FlowNodeData> {}

interface CallbackContextValue {
  onToggle: (id: string) => void;
  onRename: (id: string, label: string) => void;
}

export const NodeCallbackContext = React.createContext<CallbackContextValue | null>(null);

export function MindMapNodeView({ id, data, isConnectable }: MindMapNodeProps) {
  const ctx = React.useContext(NodeCallbackContext);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(data.label);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setDraft(data.label);
  }, [data.label]);

  React.useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== data.label) ctx?.onRename(id, trimmed);
    else setDraft(data.label);
  };

  const isRoot = data.level === 0;

  return (
    <div
      className={cn(
        "group relative rounded-lg border bg-card text-card-foreground shadow-sm transition-shadow hover:shadow-md",
        isRoot
          ? "border-primary/40 bg-primary/5 px-4 py-3 min-w-[220px]"
          : data.level === 1
            ? "border-foreground/20 px-3 py-2 min-w-[200px]"
            : "border-foreground/10 px-3 py-1.5 min-w-[180px]",
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={isConnectable}
        className="!bg-muted-foreground/40"
      />
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
        className="!bg-muted-foreground/40"
      />

      <div className="flex items-center gap-2">
        {data.hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              ctx?.onToggle(id);
            }}
            className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={data.collapsed ? "Expand" : "Collapse"}
          >
            {data.collapsed ? (
              <ChevronRight className="size-4" />
            ) : (
              <ChevronDown className="size-4" />
            )}
          </button>
        ) : (
          <span className="size-5 shrink-0" />
        )}

        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setDraft(data.label);
                setEditing(false);
              }
            }}
            className="w-full bg-transparent text-sm font-medium outline-none ring-1 ring-ring rounded px-1 -mx-1"
          />
        ) : (
          <span
            onDoubleClick={() => setEditing(true)}
            className={cn(
              "select-none text-sm leading-snug",
              isRoot ? "font-semibold" : "font-medium",
            )}
            title="Double-click to rename"
          >
            {data.label}
          </span>
        )}
      </div>
    </div>
  );
}

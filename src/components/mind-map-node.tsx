"use client";

import * as React from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FlowNodeData } from "@/lib/layout";

interface MindMapNodeProps extends NodeProps<FlowNodeData> {}

interface CallbackContextValue {
  onToggle: (id: string) => void;
  onRename: (id: string, label: string) => void;
  onAddChild: (id: string) => void;
  onDeleteNode: (id: string) => void;
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

  const themeStyle: React.CSSProperties | undefined = data.themeColor
    ? {
        borderColor: `${data.themeColor}99`,
        backgroundColor: `${data.themeColor}18`,
      }
    : undefined;

  return (
    <div
      className={cn(
        "group relative rounded-lg border bg-card text-card-foreground shadow-sm transition-all hover:shadow-md w-full",
        isRoot
          ? "border-primary/40 bg-primary/5 px-4 py-3"
          : data.level === 1
            ? "border-foreground/20 px-3 py-2"
            : "border-foreground/10 px-3 py-1.5",
        data.highlighted && "ring-2 ring-yellow-400 ring-offset-1",
        data.dimmed && "opacity-30",
      )}
      style={themeStyle}
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

      {/* Add / delete buttons shown on hover */}
      <div className="absolute -top-2 -right-2 hidden group-hover:flex gap-1 z-10">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); ctx?.onAddChild(id); }}
          className="flex size-5 items-center justify-center rounded-full bg-green-500 text-white shadow hover:bg-green-600"
          title="Add child node"
        >
          <Plus className="size-3" />
        </button>
        {!isRoot && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); ctx?.onDeleteNode(id); }}
            className="flex size-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow hover:opacity-80"
            title="Delete node"
          >
            <Trash2 className="size-3" />
          </button>
        )}
      </div>

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
            className="min-w-0 w-full bg-transparent text-sm font-medium outline-none ring-1 ring-ring rounded px-1 -mx-1"
          />
        ) : (
          <span
            onDoubleClick={() => setEditing(true)}
            className={cn(
              "min-w-0 select-none text-sm leading-snug break-words",
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

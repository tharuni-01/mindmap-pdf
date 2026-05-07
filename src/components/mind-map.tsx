"use client";

import * as React from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from "reactflow";
import "reactflow/dist/style.css";
import { Download, Image as ImageIcon, RefreshCw, RotateCcw, Search, Undo2, Redo2, X } from "lucide-react";
import { toPng, toSvg } from "html-to-image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  applyCollapsed,
  buildMindMapGraph,
  type FlowNodeData,
  type MindMapGraph,
} from "@/lib/layout";
import { MindMapNodeView, NodeCallbackContext } from "@/components/mind-map-node";
import type { MindMapNode, MindMapResult } from "@/types/mindmap";
import { useTheme } from "next-themes";
import { THEMES, getThemeColor } from "@/lib/themes";

interface Props {
  result: MindMapResult;
  fileName: string;
  onReset: () => void;
  onRegenerate?: () => void;
}

const nodeTypes = { mindmap: MindMapNodeView };

// ----- Tree manipulation helpers (IDs are "root", "root-0", "root-0-1", …) -----

function idToPath(id: string): number[] {
  if (id === "root") return [];
  return id.slice("root-".length).split("-").map(Number);
}

function updateAtPath(
  node: MindMapNode,
  path: number[],
  updater: (n: MindMapNode) => MindMapNode,
): MindMapNode {
  if (path.length === 0) return updater(node);
  const [head, ...tail] = path as [number, ...number[]];
  const children = [...(node.children ?? [])];
  children[head] = updateAtPath(children[head]!, tail, updater);
  return { ...node, children };
}

function deleteAtPath(node: MindMapNode, path: number[]): MindMapNode {
  if (path.length === 0) return node;
  if (path.length === 1) {
    const [idx] = path as [number];
    return { ...node, children: (node.children ?? []).filter((_, i) => i !== idx) };
  }
  const [head, ...tail] = path as [number, ...number[]];
  const children = [...(node.children ?? [])];
  children[head] = deleteAtPath(children[head]!, tail);
  return { ...node, children };
}

// ----- Undo / redo reducer -----

interface HistoryState {
  past: MindMapNode[];
  present: MindMapNode;
  future: MindMapNode[];
}

type HistoryAction =
  | { type: "RENAME"; id: string; label: string }
  | { type: "ADD_CHILD"; parentId: string }
  | { type: "DELETE"; id: string }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "RESET"; tree: MindMapNode };

const MAX_HISTORY = 30;

function pushHistory(state: HistoryState, next: MindMapNode): HistoryState {
  return {
    past: [...state.past.slice(-(MAX_HISTORY - 1)), state.present],
    present: next,
    future: [],
  };
}

function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case "RESET":
      return { past: [], present: action.tree, future: [] };
    case "RENAME": {
      const next = updateAtPath(state.present, idToPath(action.id), (n) => ({
        ...n,
        title: action.label,
      }));
      return pushHistory(state, next);
    }
    case "ADD_CHILD": {
      const next = updateAtPath(state.present, idToPath(action.parentId), (n) => ({
        ...n,
        children: [...(n.children ?? []), { title: "New node" }],
      }));
      return pushHistory(state, next);
    }
    case "DELETE": {
      if (action.id === "root") return state;
      return pushHistory(state, deleteAtPath(state.present, idToPath(action.id)));
    }
    case "UNDO": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1]!;
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
      };
    }
    case "REDO": {
      if (state.future.length === 0) return state;
      const next = state.future[0]!;
      return {
        past: [...state.past, state.present],
        present: next,
        future: state.future.slice(1),
      };
    }
    default:
      return state;
  }
}

// ----- Utility -----

function downloadDataUrl(dataUrl: string, fileName: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ----- Main component -----

function MindMapInner({ result, fileName, onReset, onRegenerate }: Props) {
  const { resolvedTheme } = useTheme();

  const [history, dispatch] = React.useReducer(historyReducer, {
    past: [],
    present: result.mindmap,
    future: [],
  });

  // Reset history when a new result arrives
  const prevResultRef = React.useRef(result);
  React.useEffect(() => {
    if (result !== prevResultRef.current) {
      prevResultRef.current = result;
      dispatch({ type: "RESET", tree: result.mindmap });
    }
  }, [result]);

  const currentTree = history.present;

  const fullGraph = React.useMemo<MindMapGraph>(
    () => buildMindMapGraph(currentTree),
    [currentTree],
  );

  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = React.useState("");
  const [activeThemeIdx, setActiveThemeIdx] = React.useState(0);

  const matchingIds = React.useMemo<Set<string> | null>(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    const matches = new Set<string>();
    for (const node of fullGraph.nodes) {
      if (node.data.label.toLowerCase().includes(q)) matches.add(node.id);
    }
    return matches;
  }, [searchQuery, fullGraph]);

  const activeTheme = THEMES[activeThemeIdx]!;

  const { nodes: visibleNodes, edges: visibleEdges } = React.useMemo(() => {
    const view = applyCollapsed(fullGraph, collapsed);
    return {
      nodes: view.nodes.map((n) => ({
        ...n,
        data: {
          ...n.data,
          highlighted: matchingIds ? matchingIds.has(n.id) : false,
          dimmed: matchingIds ? !matchingIds.has(n.id) : false,
          themeColor: getThemeColor(activeTheme, n.data.level),
        },
      })),
      edges: view.edges,
    };
  }, [fullGraph, collapsed, matchingIds, activeTheme]);

  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNodeData>(visibleNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(visibleEdges);

  React.useEffect(() => {
    setNodes(visibleNodes);
    setEdges(visibleEdges);
  }, [visibleNodes, visibleEdges, setNodes, setEdges]);

  // Keyboard shortcuts: Cmd+Z / Cmd+Shift+Z
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === "z") {
        e.preventDefault();
        dispatch(e.shiftKey ? { type: "REDO" } : { type: "UNDO" });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleToggle = React.useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleRename = React.useCallback((id: string, label: string) => {
    dispatch({ type: "RENAME", id, label });
  }, []);

  const handleAddChild = React.useCallback((id: string) => {
    dispatch({ type: "ADD_CHILD", parentId: id });
  }, []);

  const handleDeleteNode = React.useCallback((id: string) => {
    dispatch({ type: "DELETE", id });
    // Clear collapsed to avoid stale IDs after sibling indices shift
    setCollapsed(new Set());
  }, []);

  const callbackValue = React.useMemo(
    () => ({
      onToggle: handleToggle,
      onRename: handleRename,
      onAddChild: handleAddChild,
      onDeleteNode: handleDeleteNode,
    }),
    [handleToggle, handleRename, handleAddChild, handleDeleteNode],
  );

  const flowRef = React.useRef<HTMLDivElement>(null);

  const exportImage = async (format: "png" | "svg") => {
    if (!flowRef.current) return;
    const target = flowRef.current.querySelector<HTMLElement>(".react-flow__viewport");
    if (!target) return;
    const bg = resolvedTheme === "dark" ? "#0a0a0a" : "#ffffff";
    const exporter = format === "png" ? toPng : toSvg;
    const dataUrl = await exporter(target, {
      backgroundColor: bg,
      pixelRatio: 2,
      filter: (node) => {
        if (!(node instanceof HTMLElement)) return true;
        return (
          !node.classList?.contains("react-flow__minimap") &&
          !node.classList?.contains("react-flow__controls") &&
          !node.classList?.contains("react-flow__attribution")
        );
      },
    });
    const safeName = fileName.replace(/\.pdf$/i, "").replace(/[^a-z0-9-_]+/gi, "-");
    downloadDataUrl(dataUrl, `${safeName || "mindmap"}.${format}`);
  };

  return (
    <NodeCallbackContext.Provider value={callbackValue}>
      <div className="flex h-full flex-col">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-background/95 px-4 py-2 backdrop-blur">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">{currentTree.title}</h2>
            <p className="truncate text-xs text-muted-foreground">
              {fileName} · {result.meta.pages} pages · {result.meta.chunks} chunk
              {result.meta.chunks === 1 ? "" : "s"} · {result.meta.model}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative flex items-center">
              <Search className="absolute left-2 size-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search nodes…"
                className="h-8 w-36 rounded-md border bg-background pl-7 pr-7 text-sm outline-none focus:ring-1 focus:ring-ring"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Color theme palette */}
            <div className="flex items-center gap-1" title="Color theme">
              {THEMES.map((theme, i) => (
                <button
                  key={theme.name}
                  type="button"
                  onClick={() => setActiveThemeIdx(i)}
                  className={cn(
                    "size-5 rounded-full border-2 transition-transform hover:scale-110",
                    activeThemeIdx === i ? "border-foreground scale-110" : "border-transparent",
                  )}
                  style={{ backgroundColor: theme.root }}
                  title={theme.name}
                />
              ))}
            </div>

            {/* Undo / Redo */}
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => dispatch({ type: "UNDO" })}
              disabled={history.past.length === 0}
              title="Undo (⌘Z)"
            >
              <Undo2 className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => dispatch({ type: "REDO" })}
              disabled={history.future.length === 0}
              title="Redo (⌘⇧Z)"
            >
              <Redo2 className="size-4" />
            </Button>

            <Button variant="outline" size="sm" onClick={() => exportImage("png")}>
              <ImageIcon className="size-4" /> PNG
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportImage("svg")}>
              <Download className="size-4" /> SVG
            </Button>
            {onRegenerate && (
              <Button variant="outline" size="sm" onClick={onRegenerate}>
                <RefreshCw className="size-4" /> Regenerate
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onReset}>
              <RotateCcw className="size-4" /> New PDF
            </Button>
          </div>
        </div>

        {result.summary && (
          <div className="border-b bg-muted/30 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
            {result.summary}
          </div>
        )}

        <div ref={flowRef} className="flex-1 min-h-0">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            proOptions={{ hideAttribution: true }}
            minZoom={0.1}
            maxZoom={2}
            nodesDraggable
            nodesConnectable={false}
            elementsSelectable
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable className="!bg-card" />
          </ReactFlow>
        </div>
      </div>
    </NodeCallbackContext.Provider>
  );
}

export function MindMap(props: Props) {
  return (
    <ReactFlowProvider>
      <MindMapInner {...props} />
    </ReactFlowProvider>
  );
}

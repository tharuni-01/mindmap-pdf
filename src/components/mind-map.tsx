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
  type Edge,
  type Node,
} from "reactflow";
import "reactflow/dist/style.css";
import { Download, Image as ImageIcon, RotateCcw } from "lucide-react";
import { toPng, toSvg } from "html-to-image";
import { Button } from "@/components/ui/button";
import {
  applyCollapsed,
  buildMindMapGraph,
  type FlowNodeData,
  type MindMapGraph,
} from "@/lib/layout";
import { MindMapNodeView, NodeCallbackContext } from "@/components/mind-map-node";
import type { MindMapResult } from "@/types/mindmap";
import { useTheme } from "next-themes";

interface Props {
  result: MindMapResult;
  fileName: string;
  onReset: () => void;
}

const nodeTypes = { mindmap: MindMapNodeView };

function downloadDataUrl(dataUrl: string, fileName: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function MindMapInner({ result, fileName, onReset }: Props) {
  const { resolvedTheme } = useTheme();

  // Build the full graph from the LLM result. Recompute when result changes.
  const fullGraph = React.useMemo<MindMapGraph>(
    () =>
      buildMindMapGraph({
        title: result.mindmap.title,
        children: result.mindmap.children,
      }),
    [result],
  );

  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());
  const [renames, setRenames] = React.useState<Record<string, string>>({});

  // Apply collapse + rename overlay to derive the visible nodes/edges.
  const { nodes: visibleNodes, edges: visibleEdges } = React.useMemo(() => {
    const view = applyCollapsed(fullGraph, collapsed);
    return {
      nodes: view.nodes.map((n) => ({
        ...n,
        data: { ...n.data, label: renames[n.id] ?? n.data.label },
      })),
      edges: view.edges,
    };
  }, [fullGraph, collapsed, renames]);

  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNodeData>(visibleNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(visibleEdges);

  // Sync derived view into reactflow's internal state when collapse/rename/result changes.
  React.useEffect(() => {
    setNodes(visibleNodes);
    setEdges(visibleEdges);
  }, [visibleNodes, visibleEdges, setNodes, setEdges]);

  const handleToggle = React.useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleRename = React.useCallback((id: string, label: string) => {
    setRenames((prev) => ({ ...prev, [id]: label }));
  }, []);

  const callbackValue = React.useMemo(
    () => ({ onToggle: handleToggle, onRename: handleRename }),
    [handleToggle, handleRename],
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
        // Strip reactflow controls/minimap/attribution from exported image.
        if (!(node instanceof HTMLElement)) return true;
        return !node.classList?.contains("react-flow__minimap") &&
          !node.classList?.contains("react-flow__controls") &&
          !node.classList?.contains("react-flow__attribution");
      },
    });

    const safeName = fileName.replace(/\.pdf$/i, "").replace(/[^a-z0-9-_]+/gi, "-");
    downloadDataUrl(dataUrl, `${safeName || "mindmap"}.${format}`);
  };

  return (
    <NodeCallbackContext.Provider value={callbackValue}>
      <div className="flex h-full flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">{result.mindmap.title}</h2>
            <p className="truncate text-xs text-muted-foreground">
              {fileName} · {result.meta.pages} pages · {result.meta.chunks} chunk
              {result.meta.chunks === 1 ? "" : "s"} · {result.meta.model}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => exportImage("png")}>
              <ImageIcon className="size-4" /> PNG
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportImage("svg")}>
              <Download className="size-4" /> SVG
            </Button>
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

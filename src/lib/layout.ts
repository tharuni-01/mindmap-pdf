import dagre from "dagre";
import { Position, type Edge, type Node } from "reactflow";
import type { MindMapNode } from "@/types/mindmap";

export interface FlowNodeData {
  label: string;
  level: number;
  hasChildren: boolean;
  collapsed: boolean;
  highlighted?: boolean;
  dimmed?: boolean;
  themeColor?: string;
}

export interface MindMapGraph {
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  // Maps each node id to the set of descendant ids (for collapse logic).
  descendants: Record<string, string[]>;
  // Maps each node id to its direct children ids.
  children: Record<string, string[]>;
}

const MAX_NODE_WIDTH = 260;
const RANK_SEP = 80;
const NODE_SEP = 32;

// Estimate node dimensions based on label length so dagre spaces nodes correctly.
function estimateNodeDimensions(label: string, level: number): { width: number; height: number } {
  const ICON_W = 28;       // size-5 icon (20px) + gap-2 (8px)
  const PADDING_X = level === 0 ? 32 : 24;  // px-4 vs px-3
  const PADDING_Y = level === 0 ? 24 : level === 1 ? 16 : 12; // py-3 vs py-2 vs py-1.5
  const CHAR_W = 7.5;      // approximate px per character at text-sm
  const LINE_H = 20;       // text-sm leading-snug line height

  const availableTextPx = MAX_NODE_WIDTH - PADDING_X - ICON_W;
  const textPx = label.length * CHAR_W;
  const lines = Math.max(1, Math.ceil(textPx / availableTextPx));
  const height = PADDING_Y + lines * LINE_H + 4;

  return { width: MAX_NODE_WIDTH, height };
}

// Convert the hierarchical mindmap into a flat list of nodes/edges, then
// compute left-to-right tree positions with dagre.
export function buildMindMapGraph(root: MindMapNode): MindMapGraph {
  const nodes: Node<FlowNodeData>[] = [];
  const edges: Edge[] = [];
  const childrenMap: Record<string, string[]> = {};
  const descendantsMap: Record<string, string[]> = {};

  const visit = (node: MindMapNode, parentId: string | null, level: number, idx: number): string => {
    const id = parentId ? `${parentId}-${idx}` : "root";
    const childIds: string[] = [];
    const descendants: string[] = [];

    const children = node.children ?? [];
    children.forEach((child, i) => {
      const childId = visit(child, id, level + 1, i);
      childIds.push(childId);
      descendants.push(childId, ...(descendantsMap[childId] ?? []));
    });

    nodes.push({
      id,
      type: "mindmap",
      position: { x: 0, y: 0 },
      data: {
        label: node.title,
        level,
        hasChildren: childIds.length > 0,
        collapsed: false,
      },
    });

    if (parentId) {
      edges.push({
        id: `${parentId}->${id}`,
        source: parentId,
        target: id,
        type: "smoothstep",
        animated: false,
      });
    }

    childrenMap[id] = childIds;
    descendantsMap[id] = descendants;
    return id;
  };

  visit(root, null, 0, 0);

  const positioned = layoutWithDagre(nodes, edges);
  return { nodes: positioned, edges, descendants: descendantsMap, children: childrenMap };
}

function layoutWithDagre(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
): Node<FlowNodeData>[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", ranksep: RANK_SEP, nodesep: NODE_SEP });

  for (const node of nodes) {
    const { width, height } = estimateNodeDimensions(node.data.label, node.data.level);
    g.setNode(node.id, { width, height });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }
  dagre.layout(g);

  return nodes.map((node) => {
    const { width, height } = estimateNodeDimensions(node.data.label, node.data.level);
    const pos = g.node(node.id);
    return {
      ...node,
      position: { x: pos.x - width / 2, y: pos.y - height / 2 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: { width },
    };
  });
}

// Given the full node list and a set of currently-collapsed node ids,
// return only the nodes/edges that should be visible.
export function applyCollapsed(
  graph: MindMapGraph,
  collapsedIds: Set<string>,
): { nodes: Node<FlowNodeData>[]; edges: Edge[] } {
  const hidden = new Set<string>();
  for (const id of collapsedIds) {
    for (const desc of graph.descendants[id] ?? []) hidden.add(desc);
  }

  const nodes = graph.nodes
    .filter((n) => !hidden.has(n.id))
    .map((n) => ({
      ...n,
      data: { ...n.data, collapsed: collapsedIds.has(n.id) },
    }));

  const edges = graph.edges.filter(
    (e) => !hidden.has(e.source) && !hidden.has(e.target),
  );
  return { nodes, edges };
}

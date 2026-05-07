import dagre from "dagre";
import { Position, type Edge, type Node } from "reactflow";
import type { MindMapNode } from "@/types/mindmap";

export interface FlowNodeData {
  label: string;
  level: number;
  hasChildren: boolean;
  collapsed: boolean;
}

export interface MindMapGraph {
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  // Maps each node id to the set of descendant ids (for collapse logic).
  descendants: Record<string, string[]>;
  // Maps each node id to its direct children ids.
  children: Record<string, string[]>;
}

const NODE_WIDTH = 220;
const NODE_HEIGHT = 56;
const RANK_SEP = 80;
const NODE_SEP = 24;

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
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }
  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
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

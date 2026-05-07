export interface MindMapNode {
  title: string;
  children?: MindMapNode[];
}

export interface MindMapResult {
  mindmap: MindMapNode;
  summary: string;
  meta: {
    pages: number;
    chars: number;
    chunks: number;
    model: string;
  };
}

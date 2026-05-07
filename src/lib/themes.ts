export interface Theme {
  name: string;
  root: string;
  l1: string;
  l2: string;
  deep: string;
}

export const THEMES: Theme[] = [
  { name: "Default", root: "#6366f1", l1: "#8b5cf6", l2: "#64748b", deep: "#94a3b8" },
  { name: "Ocean",   root: "#0ea5e9", l1: "#06b6d4", l2: "#0891b2", deep: "#67e8f9" },
  { name: "Forest",  root: "#16a34a", l1: "#15803d", l2: "#4ade80", deep: "#86efac" },
  { name: "Sunset",  root: "#f97316", l1: "#ef4444", l2: "#fb923c", deep: "#fca5a5" },
  { name: "Mono",    root: "#1e293b", l1: "#334155", l2: "#475569", deep: "#94a3b8" },
];

export function getThemeColor(theme: Theme, level: number): string {
  if (level === 0) return theme.root;
  if (level === 1) return theme.l1;
  if (level === 2) return theme.l2;
  return theme.deep;
}

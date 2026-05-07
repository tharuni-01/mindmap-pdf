import type { MindMapResult } from "@/types/mindmap";

export interface HistoryEntry {
  id: string;
  filename: string;
  timestamp: number;
  result: MindMapResult;
}

const STORAGE_KEY = "mindmap-history";
const MAX_ENTRIES = 10;

export function saveMap(filename: string, result: MindMapResult): void {
  const entry: HistoryEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    filename,
    timestamp: Date.now(),
    result,
  };
  try {
    const existing = loadHistory();
    const updated = [entry, ...existing].slice(0, MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // localStorage may be unavailable (SSR, private mode)
  }
}

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HistoryEntry[];
  } catch {
    return [];
  }
}

export function deleteHistoryEntry(id: string): void {
  try {
    const updated = loadHistory().filter((e) => e.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {}
}

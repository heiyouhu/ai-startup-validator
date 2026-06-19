import type { HistoryItem } from "./types";

const KEY = "asv_history";
const MAX = 50;

export function loadHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as HistoryItem[];
    return Array.isArray(data) ? data.sort((a, b) => b.timestamp - a.timestamp) : [];
  } catch {
    return [];
  }
}

export function saveHistory(item: HistoryItem): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const list = loadHistory();
    const next = [item, ...list].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
    return next;
  } catch {
    return loadHistory();
  }
}

export function deleteHistory(id: string): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const list = loadHistory().filter((x) => x.id !== id);
    localStorage.setItem(KEY, JSON.stringify(list));
    return list;
  } catch {
    return loadHistory();
  }
}

export function clearHistory(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

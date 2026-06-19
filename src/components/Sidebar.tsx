"use client";

import type { HistoryItem } from "@/lib/types";

interface SidebarProps {
  history: HistoryItem[];
  viewingId: string | null;
  onSelect: (item: HistoryItem) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  onNew: () => void;
  onSettings: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const VERDICT_STYLE: Record<HistoryItem["verdict"], { label: string; cls: string; dot: string }> = {
  go: { label: "推进", cls: "text-emerald-700 bg-emerald-50", dot: "bg-emerald-500" },
  caution: { label: "谨慎", cls: "text-amber-700 bg-amber-50", dot: "bg-amber-500" },
  "no-go": { label: "不建议", cls: "text-red-700 bg-red-50", dot: "bg-red-500" },
};

function scoreColor(n: number): string {
  if (n >= 7) return "text-emerald-600";
  if (n >= 4) return "text-amber-600";
  return "text-red-600";
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} 天前`;
  return new Date(ts).toLocaleDateString();
}

export function Sidebar({
  history,
  viewingId,
  onSelect,
  onDelete,
  onClear,
  onNew,
  onSettings,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 md:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`
          fixed md:sticky top-0 left-0 z-40 md:z-auto
          h-full md:h-screen w-[280px] shrink-0
          bg-white border-r border-border flex flex-col
          transition-transform duration-300 ease-out
          ${mobileOpen ? "translate-x-0 slide-in" : "-translate-x-full md:translate-x-0"}
        `}
      >
        <div className="px-5 py-5 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-accent flex items-center justify-center">
                <span className="text-accent-foreground text-xs font-bold">A</span>
              </div>
              <span className="font-semibold text-foreground text-sm">AI Validator</span>
            </div>
            <button
              onClick={onCloseMobile}
              className="md:hidden text-muted-foreground hover:text-foreground text-lg leading-none"
              aria-label="关闭"
            >
              ×
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onNew}
              className="flex-1 rounded-lg bg-accent text-accent-foreground text-sm font-medium px-3 py-2 hover:opacity-90 transition-opacity"
            >
              新建验证
            </button>
            <button
              onClick={onSettings}
              className="rounded-lg border border-border px-2.5 py-2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="设置"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {history.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground py-12">
              暂无历史记录
            </div>
          ) : (
            <div className="space-y-1.5">
              {history.map((item) => {
                const v = VERDICT_STYLE[item.verdict];
                const active = item.id === viewingId;
                return (
                  <div
                    key={item.id}
                    onClick={() => onSelect(item)}
                    className={`group relative rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                      active
                        ? "border-accent/40 bg-accent/5"
                        : "border-transparent hover:bg-muted/60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${v.dot}`} />
                        <span className="text-xs text-muted-foreground shrink-0">{timeAgo(item.timestamp)}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(item.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 text-xs transition-opacity shrink-0"
                        aria-label="删除"
                      >
                        删除
                      </button>
                    </div>
                    <div className={`text-sm font-medium truncate mb-1.5 ${active ? "text-accent" : "text-foreground"}`}>
                      {item.idea}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-lg font-bold tabular-nums ${scoreColor(item.scores.overall)}`}>
                        {item.scores.overall}
                      </span>
                      <span className="text-xs text-muted-foreground">/ 10</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${v.cls} ml-auto`}>
                        {v.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {history.length > 0 && (
          <div className="px-3 py-3 border-t border-border">
            <button
              onClick={onClear}
              className="w-full text-xs text-muted-foreground hover:text-red-500 py-1.5 transition-colors"
            >
              清空历史
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

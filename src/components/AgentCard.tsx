"use client";

import { useState } from "react";
import { Markdown } from "./Markdown";
import type { AgentInfo, AgentStatus } from "@/lib/types";

export interface AgentState {
  status: AgentStatus;
  markdown?: string;
  error?: string;
}

interface AgentCardProps {
  info: AgentInfo;
  state: AgentState;
}

const DOT_CLASS: Record<AgentStatus, string> = {
  pending: "bg-gray-300",
  running: "bg-amber-500 dot-running",
  done: "bg-emerald-500",
  error: "bg-red-500",
};

const STATUS_TEXT: Record<AgentStatus, string> = {
  pending: "待开始",
  running: "分析中…",
  done: "已完成",
  error: "失败",
};

const PREVIEW_LINES = 4;

function previewOf(md: string): string {
  return md.split("\n").slice(0, PREVIEW_LINES).join("\n");
}

export function AgentCard({ info, state }: AgentCardProps) {
  const [open, setOpen] = useState(false);
  const isRunning = state.status === "running";
  const isDone = state.status === "done";
  const hasStream = isRunning && !!state.markdown;
  const hasContent = (isDone || hasStream) && !!state.markdown;
  const showError = state.status === "error";
  const isTruncated = !!state.markdown && state.markdown.split("\n").length > PREVIEW_LINES;

  return (
    <div className="relative rounded-xl border border-border bg-white shadow-soft overflow-hidden card-hover">
      {isRunning && (
        <div className="scan-line absolute top-0 left-0 right-0 h-px overflow-hidden" />
      )}

      <div className="flex items-center gap-3 px-4 py-3.5">
        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${DOT_CLASS[state.status]}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-foreground truncate">{info.name}</span>
            <span className="text-xs text-muted-foreground truncate">{info.nameZh}</span>
          </div>
          <div className="text-xs text-muted-foreground truncate">{info.role}</div>
        </div>
        <span className="text-xs text-muted-foreground shrink-0">{STATUS_TEXT[state.status]}</span>
      </div>

      {isRunning && !hasStream && (
        <div className="px-4 pb-4">
          <div className="h-3 w-2/3 rounded bg-muted animate-fade-in" />
        </div>
      )}

      {showError && (
        <div className="px-4 pb-4">
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
            {state.error || "分析失败"}
          </div>
        </div>
      )}

      {hasContent && !open && (
        <div className="relative border-t border-border/60 mt-1">
          <div className="px-5 pt-3 pb-4">
            <Markdown content={previewOf(state.markdown!)} />
            {isRunning && <span className="stream-cursor" />}
          </div>
          {isTruncated && (
            <>
              <div className="pointer-events-none absolute bottom-12 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent" />
              <button
                onClick={() => setOpen(true)}
                className="block w-full text-center text-xs text-accent hover:text-accent/80 py-2.5 border-t border-border/60 bg-white"
              >
                展开查看完整分析 ↓
              </button>
            </>
          )}
        </div>
      )}

      {hasContent && open && (
        <div className="px-5 pb-5 pt-1 border-t border-border/60 mt-1">
          <Markdown content={state.markdown!} />
          {isRunning && <span className="stream-cursor" />}
          {!isRunning && isTruncated && (
            <button
              onClick={() => setOpen(false)}
              className="mt-3 text-xs text-muted-foreground hover:text-foreground"
            >
              收起 ↑
            </button>
          )}
        </div>
      )}
    </div>
  );
}

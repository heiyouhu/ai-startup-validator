import { Markdown } from "./Markdown";
import { AGENTS, type ReportSummary } from "@/lib/types";
import type { AgentState } from "./AgentCard";

interface JudgeReportProps {
  state: AgentState;
  summary: ReportSummary | null;
}

const SCORE_ROWS: { key: keyof ReportSummary["scores"]; label: string; sub: string }[] = [
  { key: "market", label: "市场", sub: "Market" },
  { key: "competition", label: "竞争", sub: "Competition" },
  { key: "monetization", label: "变现", sub: "Monetization" },
  { key: "technical", label: "技术可行性", sub: "Technical" },
];

function scoreColor(n: number): string {
  if (n >= 7) return "bg-emerald-500";
  if (n >= 4) return "bg-amber-500";
  return "bg-red-500";
}

function textColor(n: number): string {
  if (n >= 7) return "text-emerald-600";
  if (n >= 4) return "text-amber-600";
  return "text-red-600";
}

const VERDICT: Record<ReportSummary["verdict"], { zh: string; cls: string }> = {
  go: { zh: "建议推进", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  caution: { zh: "谨慎推进", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  "no-go": { zh: "不建议", cls: "bg-red-50 text-red-700 border-red-200" },
};

export function JudgeReport({ state, summary }: JudgeReportProps) {
  const info = AGENTS.find((a) => a.id === "judge")!;

  if (state.status === "running") {
    return (
      <div className="relative rounded-xl border border-border bg-white shadow-soft overflow-hidden card-enter card-hover">
        <div className="scan-line absolute top-0 left-0 right-0 h-px overflow-hidden" />
        <div className="flex items-center gap-3 px-4 py-3.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500 dot-running" />
          <span className="font-semibold text-foreground">{info.name}</span>
          <span className="text-xs text-muted-foreground ml-auto">综合评审中…</span>
        </div>
        <div className="px-4 pb-4 space-y-2">
          <div className="h-3 w-1/2 rounded bg-muted shimmer" />
          <div className="h-3 w-full rounded bg-muted shimmer" />
          <div className="h-3 w-3/4 rounded bg-muted shimmer" />
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="rounded-xl border border-border bg-white shadow-soft overflow-hidden card-enter">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
          <span className="font-semibold text-foreground">{info.name}</span>
        </div>
        <div className="px-4 pb-4">
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
            {state.error || "评审失败"}
          </div>
        </div>
      </div>
    );
  }

  if (state.status !== "done" || !summary) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/40 p-8 text-center text-sm text-muted-foreground">
        最终评审报告将在此处生成
      </div>
    );
  }

  const v = VERDICT[summary.verdict];
  const overall = summary.scores.overall;

  return (
    <div className="rounded-xl border border-border bg-white shadow-soft overflow-hidden card-enter card-hover">
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
        <span className="font-semibold text-foreground">{info.name}</span>
        <span className="text-xs text-muted-foreground">{info.nameZh}</span>
        <span className="ml-auto text-xs text-muted-foreground">已完成</span>
      </div>

      <div className="px-5 py-5 space-y-5">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-baseline gap-1">
            <span className={`text-5xl font-bold tabular-nums ${textColor(overall)}`}>{overall}</span>
            <span className="text-lg text-muted-foreground">/ 10</span>
          </div>
          <span className={`rounded-full border px-3 py-1 text-sm font-medium ${v.cls}`}>
            {v.zh}
          </span>
          <span className="text-sm text-muted-foreground ml-auto">总评分</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          {SCORE_ROWS.map((row) => {
            const n = summary.scores[row.key];
            return (
              <div key={row.key}>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-sm text-foreground">
                    {row.label} <span className="text-muted-foreground text-xs">{row.sub}</span>
                  </span>
                  <span className={`text-sm font-semibold tabular-nums ${textColor(n)}`}>{n}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${scoreColor(n)} transition-[width] duration-500 ease-linear`}
                    style={{ width: `${n * 10}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {summary.recommendation && (
          <div className="rounded-lg border border-border bg-muted/50 px-4 py-3">
            <div className="text-xs text-muted-foreground mb-1">最终建议</div>
            <div className="text-sm text-foreground leading-relaxed">{summary.recommendation}</div>
          </div>
        )}

        {state.markdown && (
          <div className="pt-2 border-t border-border/60">
            <Markdown content={state.markdown} />
          </div>
        )}
      </div>
    </div>
  );
}

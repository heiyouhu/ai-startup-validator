import type { AgentId, AgentResult, Scores } from "@/lib/types";
import { AGENTS } from "@/lib/types";
import type { Depth, Provider } from "@/lib/settings";
import type { SerpResult } from "@/lib/serpapi";
import {
  getSystemPrompt,
  userPromptFor,
  competitorUserPrompt,
  judgeUserPrompt,
} from "@/lib/prompts";
import { DEPTH_TOKENS } from "@/lib/settings";
import { chatTextStream } from "@/lib/llm";
import { searchMulti } from "@/lib/serpapi";

export interface AgentRunOptions {
  signal?: AbortSignal;
  provider: Provider;
  model: string;
  depth: Depth;
}

export interface CompetitorRunOptions extends AgentRunOptions {
  searchEnabled?: boolean;
  searchQueries?: number;
  searchResultsPerQuery?: number;
  searchResultsToLLM?: number;
  serpapiKey?: string;
}

export interface AgentSpec {
  id: AgentId;
  info: (typeof AGENTS)[number];
  defaultEnabled: boolean;
  isJudge: boolean;
  scoreKey?: keyof Scores;
  buildSystemPrompt: (depth: Depth) => string;
  buildUserPrompt: (idea: string, context: { results?: SerpResult[]; limit?: number; analystResults?: AgentResult[] }) => string;
  run: (idea: string, onChunk: (delta: string) => void, opts: AgentRunOptions | CompetitorRunOptions) => Promise<AgentResult>;
}

const QUERY_TEMPLATES = [
  (idea: string) => `${idea} AI product tool`,
  (idea: string) => `${idea} alternatives competitors best`,
  (idea: string) => `${idea} 替代品 竞品 对比`,
  (idea: string) => `best AI tools for ${idea}`,
  (idea: string) => `${idea} review pricing`,
];

function analystRunner(id: AgentId, buildSystem: (d: Depth) => string, buildUser: (idea: string) => string) {
  return async (idea: string, onChunk: (delta: string) => void, opts: AgentRunOptions): Promise<AgentResult> => {
    const markdown = await chatTextStream(buildSystem(opts.depth), buildUser(idea), onChunk, {
      provider: opts.provider,
      model: opts.model,
      signal: opts.signal,
      maxTokens: DEPTH_TOKENS[opts.depth].analyst,
    });
    return { id, markdown: markdown.trim() };
  };
}

const info = (id: AgentId) => AGENTS.find((a) => a.id === id)!;

export const REGISTRY: AgentSpec[] = [
  {
    id: "ceo",
    info: info("ceo"),
    defaultEnabled: true,
    isJudge: false,
    scoreKey: undefined,
    buildSystemPrompt: (d) => getSystemPrompt("ceo", d),
    buildUserPrompt: (idea) => userPromptFor(idea),
    run: analystRunner("ceo", (d) => getSystemPrompt("ceo", d), (idea) => userPromptFor(idea)),
  },
  {
    id: "market",
    info: info("market"),
    defaultEnabled: true,
    isJudge: false,
    scoreKey: "market",
    buildSystemPrompt: (d) => getSystemPrompt("market", d),
    buildUserPrompt: (idea) => userPromptFor(idea),
    run: analystRunner("market", (d) => getSystemPrompt("market", d), (idea) => userPromptFor(idea)),
  },
  {
    id: "competitor",
    info: info("competitor"),
    defaultEnabled: true,
    isJudge: false,
    scoreKey: "competition",
    buildSystemPrompt: (d) => getSystemPrompt("competitor", d),
    buildUserPrompt: (idea, ctx) => competitorUserPrompt(idea, ctx.results ?? [], ctx.limit ?? 20),
    run: async (idea, onChunk, opts) => {
      const o = opts as CompetitorRunOptions;
      let results: SerpResult[] = [];
      if (o.searchEnabled !== false) {
        const count = Math.max(2, Math.min(5, o.searchQueries ?? 5));
        const queries = QUERY_TEMPLATES.slice(0, count).map((fn) => fn(idea));
        try {
          results = await searchMulti(queries, o.searchResultsPerQuery ?? 8, o.serpapiKey);
        } catch {
          results = [];
        }
      }
      const limit = o.searchResultsToLLM ?? 20;
      const used = results.slice(0, limit);
      const markdown = await chatTextStream(
        getSystemPrompt("competitor", o.depth),
        competitorUserPrompt(idea, results, limit),
        onChunk,
        { provider: o.provider, model: o.model, signal: o.signal, maxTokens: DEPTH_TOKENS[o.depth].analyst }
      );
      const sources = used.length
        ? "\n\n---\n\n## 来源\n\n" +
          used
            .map((r, i) => `${i + 1}. [${r.title || "（无标题）"}](${r.link || "#"})${r.snippet ? ` — ${r.snippet.slice(0, 120)}` : ""}`)
            .join("\n")
        : "";
      return { id: "competitor", markdown: (markdown.trim() + sources).trim() };
    },
  },
  {
    id: "revenue",
    info: info("revenue"),
    defaultEnabled: true,
    isJudge: false,
    scoreKey: "monetization",
    buildSystemPrompt: (d) => getSystemPrompt("revenue", d),
    buildUserPrompt: (idea) => userPromptFor(idea),
    run: analystRunner("revenue", (d) => getSystemPrompt("revenue", d), (idea) => userPromptFor(idea)),
  },
  {
    id: "technical",
    info: info("technical"),
    defaultEnabled: true,
    isJudge: false,
    scoreKey: "technical",
    buildSystemPrompt: (d) => getSystemPrompt("technical", d),
    buildUserPrompt: (idea) => userPromptFor(idea),
    run: analystRunner("technical", (d) => getSystemPrompt("technical", d), (idea) => userPromptFor(idea)),
  },
  {
    id: "judge",
    info: info("judge"),
    defaultEnabled: true,
    isJudge: true,
    scoreKey: "overall",
    buildSystemPrompt: (d) => getSystemPrompt("judge", d),
    buildUserPrompt: (idea, ctx) => judgeUserPrompt(idea, ctx.analystResults ?? []),
    run: async (_idea, _onChunk, _opts) => {
      // Judge is invoked via runJudgeAgent in route for scoring; this generic run
      // is provided for completeness but route uses the dedicated judge runner.
      throw new Error("Judge agent should be run via runJudgeAgent");
    },
  },
];

export const ANALYST_SPECS: AgentSpec[] = REGISTRY.filter((s) => !s.isJudge);
export const JUDGE_SPEC: AgentSpec = REGISTRY.find((s) => s.isJudge)!;

export function specById(id: AgentId): AgentSpec | undefined {
  return REGISTRY.find((s) => s.id === id);
}

export function defaultEnabledAgents(): Record<AgentId, boolean> {
  const r = {} as Record<AgentId, boolean>;
  for (const s of REGISTRY) r[s.id] = s.defaultEnabled;
  return r;
}

export function analystLabel(id: Exclude<AgentId, "judge">): string {
  const labels: Record<Exclude<AgentId, "judge">, string> = {
    ceo: "CEO 分析师",
    market: "市场分析师",
    competitor: "竞品分析师",
    revenue: "变现分析师",
    technical: "技术分析师",
  };
  return labels[id];
}

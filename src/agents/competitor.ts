import { chatTextStream } from "@/lib/llm";
import { getSystemPrompt, competitorUserPrompt } from "@/lib/prompts";
import { searchMulti, type SerpResult } from "@/lib/serpapi";
import { DEPTH_TOKENS, type Depth, type Provider } from "@/lib/settings";
import type { AgentResult } from "@/lib/types";

interface CompetitorOptions {
  signal?: AbortSignal;
  provider?: Provider;
  model?: string;
  depth?: Depth;
  searchEnabled?: boolean;
  searchQueries?: number;
  searchResultsPerQuery?: number;
  searchResultsToLLM?: number;
  serpapiKey?: string;
}

const QUERY_TEMPLATES = [
  (idea: string) => `${idea} AI product tool`,
  (idea: string) => `${idea} alternatives competitors best`,
  (idea: string) => `${idea} 替代品 竞品 对比`,
  (idea: string) => `best AI tools for ${idea}`,
  (idea: string) => `${idea} review pricing`,
];

export async function runCompetitorAgent(
  idea: string,
  onChunk: (delta: string) => void,
  opts: CompetitorOptions = {}
): Promise<AgentResult> {
  const {
    signal,
    provider,
    model,
    depth = "balanced",
    searchEnabled = true,
    searchQueries = 5,
    searchResultsPerQuery = 8,
    searchResultsToLLM = 20,
    serpapiKey,
  } = opts;

  if (!provider) throw new Error("未选择模型供应商");

  let results: SerpResult[] = [];
  if (searchEnabled) {
    const count = Math.max(2, Math.min(5, searchQueries));
    const queries = QUERY_TEMPLATES.slice(0, count).map((fn) => fn(idea));
    try {
      results = await searchMulti(queries, searchResultsPerQuery, serpapiKey);
    } catch {
      results = [];
    }
  }

  const markdown = await chatTextStream(
    getSystemPrompt("competitor", depth),
    competitorUserPrompt(idea, results, searchResultsToLLM),
    onChunk,
    {
      provider,
      model: model || provider.models[0] || "",
      signal,
      maxTokens: DEPTH_TOKENS[depth].analyst,
    }
  );
  return { id: "competitor", markdown: markdown.trim() };
}

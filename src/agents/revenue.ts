import { chatTextStream } from "@/lib/llm";
import { getSystemPrompt, userPromptFor } from "@/lib/prompts";
import { DEPTH_TOKENS, type Depth, type Provider } from "@/lib/settings";
import type { AgentResult } from "@/lib/types";

interface RevenueOptions {
  signal?: AbortSignal;
  provider?: Provider;
  model?: string;
  depth?: Depth;
}

export async function runRevenueAgent(
  idea: string,
  onChunk: (delta: string) => void,
  opts: RevenueOptions = {}
): Promise<AgentResult> {
  const { signal, provider, model, depth = "balanced" } = opts;
  if (!provider) throw new Error("未选择模型供应商");
  const markdown = await chatTextStream(
    getSystemPrompt("revenue", depth),
    userPromptFor(idea),
    onChunk,
    {
      provider,
      model: model || provider.models[0] || "",
      signal,
      maxTokens: DEPTH_TOKENS[depth].analyst,
    }
  );
  return { id: "revenue", markdown: markdown.trim() };
}

import { chatJSON } from "@/lib/llm";
import { getSystemPrompt, judgeUserPrompt } from "@/lib/prompts";
import { DEPTH_TOKENS, type Depth, type Provider } from "@/lib/settings";
import type { AgentResult, ReportSummary, Scores } from "@/lib/types";
import {
  JudgeOutputSchema,
  deriveVerdict,
  clampScore,
  type JudgeOutputParsed,
} from "./judge-schema";

interface JudgeOptions {
  signal?: AbortSignal;
  provider?: Provider;
  model?: string;
  depth?: Depth;
}

interface RawJudgeOutput {
  scores?: Partial<Scores>;
  verdict?: string;
  recommendation?: string;
  markdown?: string;
}

export interface JudgeOutcome {
  result: AgentResult;
  summary: ReportSummary;
}

export async function runJudgeAgent(
  idea: string,
  results: AgentResult[],
  opts: JudgeOptions = {}
): Promise<JudgeOutcome> {
  const { signal, provider, model, depth = "balanced" } = opts;
  if (!provider) throw new Error("未选择模型供应商");
  const raw = await chatJSON<RawJudgeOutput>(
    getSystemPrompt("judge", depth),
    judgeUserPrompt(idea, results),
    {
      provider,
      model: model || provider.models[0] || "",
      signal,
      maxTokens: DEPTH_TOKENS[depth].judge,
    }
  );

  const parsed = parseAndValidate(raw);
  const scores: Scores = {
    market: parsed.scores.market,
    competition: parsed.scores.competition,
    monetization: parsed.scores.monetization,
    technical: parsed.scores.technical,
    overall: parsed.scores.overall,
  };
  const verdict: ReportSummary["verdict"] = deriveVerdict(scores.overall);
  const recommendation = parsed.recommendation;
  const markdown = parsed.markdown;

  return {
    result: { id: "judge", markdown },
    summary: { idea, scores, recommendation, verdict },
  };
}

function parseAndValidate(raw: RawJudgeOutput): JudgeOutputParsed {
  const scores: Scores = {
    market: clampScore(raw.scores?.market),
    competition: clampScore(raw.scores?.competition),
    monetization: clampScore(raw.scores?.monetization),
    technical: clampScore(raw.scores?.technical),
    overall: clampScore(raw.scores?.overall),
  };

  const candidate = {
    scores,
    verdict: (raw.verdict ?? "caution") as "go" | "caution" | "no-go",
    recommendation: String(raw.recommendation || "").trim(),
    markdown: String(raw.markdown || "").trim(),
  };

  const result = JudgeOutputSchema.safeParse(candidate);
  if (result.success) {
    return result.data;
  }

  // Schema failed (e.g. verdict not in enum); fall back to clamped values
  // and derive verdict from overall to guarantee consistency.
  return {
    scores,
    verdict: deriveVerdict(scores.overall),
    recommendation: candidate.recommendation || "无法解析建议，请参考评分。",
    markdown: candidate.markdown || "评审未能生成结构化报告，仅返回评分。",
  };
}

export { clampScore, deriveVerdict };

import { z } from "zod";

export const VerdictSchema = z.enum(["go", "caution", "no-go"]);

export const ScoresSchema = z.object({
  market: z.number(),
  competition: z.number(),
  monetization: z.number(),
  technical: z.number(),
  overall: z.number(),
});

export const JudgeOutputSchema = z.object({
  scores: ScoresSchema,
  verdict: VerdictSchema,
  recommendation: z.string(),
  markdown: z.string(),
});

export type JudgeOutputParsed = z.infer<typeof JudgeOutputSchema>;

export const VERDICT_FROM_OVERALL: Record<number, "go" | "caution" | "no-go"> = {};
// helper not used inline; see deriveVerdict below.

export function deriveVerdict(overall: number): "go" | "caution" | "no-go" {
  if (overall >= 7) return "go";
  if (overall >= 4) return "caution";
  return "no-go";
}

export function clampScore(n: unknown): number {
  return Math.max(0, Math.min(10, Math.round(Number(n) || 0)));
}

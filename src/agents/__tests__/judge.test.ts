import { describe, it, expect } from "vitest";
import { clampScore, deriveVerdict, JudgeOutputSchema } from "@/agents/judge-schema";

describe("clampScore", () => {
  it("clamps below 0 to 0", () => {
    expect(clampScore(-3)).toBe(0);
  });

  it("clamps above 10 to 10", () => {
    expect(clampScore(15)).toBe(10);
  });

  it("rounds to integer", () => {
    expect(clampScore(7.6)).toBe(8);
  });

  it("returns 0 for non-numeric", () => {
    expect(clampScore("abc")).toBe(0);
    expect(clampScore(null)).toBe(0);
    expect(clampScore(undefined)).toBe(0);
  });
});

describe("deriveVerdict", () => {
  it("returns go for overall >= 7", () => {
    expect(deriveVerdict(7)).toBe("go");
    expect(deriveVerdict(10)).toBe("go");
  });

  it("returns caution for overall 4-6", () => {
    expect(deriveVerdict(4)).toBe("caution");
    expect(deriveVerdict(6)).toBe("caution");
  });

  it("returns no-go for overall < 4", () => {
    expect(deriveVerdict(3)).toBe("no-go");
    expect(deriveVerdict(0)).toBe("no-go");
  });
});

describe("JudgeOutputSchema", () => {
  it("validates a well-formed output", () => {
    const ok = JudgeOutputSchema.safeParse({
      scores: { market: 8, competition: 6, monetization: 7, technical: 5, overall: 7 },
      verdict: "go",
      recommendation: "建议推进",
      markdown: "## 报告",
    });
    expect(ok.success).toBe(true);
  });

  it("rejects unknown verdict", () => {
    const bad = JudgeOutputSchema.safeParse({
      scores: { market: 8, competition: 6, monetization: 7, technical: 5, overall: 7 },
      verdict: "maybe",
      recommendation: "x",
      markdown: "y",
    });
    expect(bad.success).toBe(false);
  });

  it("rejects missing score field", () => {
    const bad = JudgeOutputSchema.safeParse({
      scores: { market: 8, competition: 6, monetization: 7, technical: 5 },
      verdict: "go",
      recommendation: "x",
      markdown: "y",
    });
    expect(bad.success).toBe(false);
  });
});

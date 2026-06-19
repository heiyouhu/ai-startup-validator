import { describe, it, expect } from "vitest";
import { sseEncode, sseDone } from "@/lib/sse";

describe("sseEncode", () => {
  it("encodes a plan event as data: JSON\\n\\n", () => {
    const out = new TextDecoder().decode(
      sseEncode({ type: "plan", idea: "foo", agents: ["ceo"] })
    );
    expect(out).toContain("data: ");
    expect(out).toContain('"type":"plan"');
    expect(out.endsWith("\n\n")).toBe(true);
  });

  it("encodes agent:chunk with delta", () => {
    const out = new TextDecoder().decode(
      sseEncode({ type: "agent:chunk", id: "ceo", delta: "hi" })
    );
    expect(out).toContain('"delta":"hi"');
  });
});

describe("sseDone", () => {
  it("emits [DONE] frame", () => {
    const out = new TextDecoder().decode(sseDone());
    expect(out).toBe("data: [DONE]\n\n");
  });
});

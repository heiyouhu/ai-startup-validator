import { describe, it, expect, beforeEach } from "vitest";

describe("settings migration (legacy -> providers)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("migrates legacy apiKeys.deepseek + model into a DeepSeek provider", async () => {
    localStorage.setItem(
      "asv_settings",
      JSON.stringify({
        model: "deepseek-v4-pro",
        apiKeys: { deepseek: "sk-legacy", serpapi: "serp-legacy" },
        depth: "concise",
        searchEnabled: false,
      })
    );
    const mod = await import("@/lib/settings");
    const s = mod.loadSettings();
    expect(s.providers).toHaveLength(1);
    const p = s.providers[0]!;
    expect(p.id).toBe("deepseek");
    expect(p.apiKey).toBe("sk-legacy");
    expect(s.selectedModel).toBe("deepseek-v4-pro");
    expect(s.selectedProviderId).toBe("deepseek");
    expect(s.apiKeys.serpapi).toBe("serp-legacy");
    expect(s.depth).toBe("concise");
    expect(s.searchEnabled).toBe(false);
  });

  it("uses defaults when nothing stored", async () => {
    const mod = await import("@/lib/settings");
    const s = mod.loadSettings();
    expect(s.providers).toHaveLength(1);
    expect(s.selectedProviderId).toBe("deepseek");
    expect(s.enabledAgents.judge).toBe(true);
  });
});

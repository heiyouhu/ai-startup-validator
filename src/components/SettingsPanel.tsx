"use client";

import { useEffect, useState } from "react";
import { AGENTS, type AgentId } from "@/lib/types";
import {
  DEFAULT_SETTINGS,
  saveSettings,
  type AppSettings,
  type Depth,
  type Provider,
  type ApiFormat,
} from "@/lib/settings";

interface ServerConfig {
  deepseek: boolean;
  serpapi: boolean;
}

interface SettingsPanelProps {
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
  open: boolean;
  onClose: () => void;
  serverConfig: ServerConfig | null;
}

const ANALYST_IDS = AGENTS.filter((a) => a.id !== "judge").map((a) => a.id);
const AGENT_NAMES: Record<AgentId, string> = {
  ceo: "CEO",
  market: "Market",
  competitor: "Competitor",
  revenue: "Revenue",
  technical: "Technical",
  judge: "Judge",
};

const FORMAT_LABELS: Record<ApiFormat, string> = {
  openai: "OpenAI 兼容 (/v1/chat/completions)",
  anthropic: "Anthropic Messages (/v1/messages)",
};

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function emptyProvider(): Provider {
  return {
    id: genId(),
    name: "",
    baseUrl: "",
    apiKey: "",
    format: "openai",
    models: [""],
  };
}

function isBuiltIn(p: Provider): boolean {
  return p.id === "deepseek";
}

function providerReady(p: Provider, serverConfig: ServerConfig | null): boolean {
  if (p.apiKey.trim()) return true;
  if (p.id === "deepseek") return !!serverConfig?.deepseek;
  return false;
}

export function SettingsPanel({ settings, onChange, open, onClose, serverConfig }: SettingsPanelProps) {
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (open) setDraft(settings);
  }, [open, settings]);

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const updateAgent = (id: AgentId, enabled: boolean) => {
    setDraft((d) => ({
      ...d,
      enabledAgents: { ...d.enabledAgents, [id]: enabled },
    }));
  };

  const updateApiKey = (key: "serpapi", value: string) => {
    setDraft((d) => ({
      ...d,
      apiKeys: { ...d.apiKeys, [key]: value },
    }));
  };

  const updateProvider = (id: string, patch: Partial<Provider>) => {
    setDraft((d) => ({
      ...d,
      providers: d.providers.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  };

  const updateProviderModel = (providerId: string, index: number, value: string) => {
    setDraft((d) => ({
      ...d,
      providers: d.providers.map((p) => {
        if (p.id !== providerId) return p;
        const models = [...p.models];
        models[index] = value;
        return { ...p, models };
      }),
    }));
  };

  const addProviderModel = (providerId: string) => {
    setDraft((d) => ({
      ...d,
      providers: d.providers.map((p) =>
        p.id === providerId ? { ...p, models: [...p.models, ""] } : p
      ),
    }));
  };

  const removeProviderModel = (providerId: string, index: number) => {
    setDraft((d) => ({
      ...d,
      providers: d.providers.map((p) => {
        if (p.id !== providerId) return p;
        const models = p.models.filter((_, i) => i !== index);
        return { ...p, models: models.length ? models : [""] };
      }),
    }));
  };

  const addProvider = () => {
    const p = emptyProvider();
    setDraft((d) => ({
      ...d,
      providers: [...d.providers, p],
      selectedProviderId: p.id,
      selectedModel: p.models[0],
    }));
    setEditingId(p.id);
  };

  const deleteProvider = (id: string) => {
    setDraft((d) => {
      const providers = d.providers.filter((p) => p.id !== id);
      const next: AppSettings = { ...d, providers };
      if (d.selectedProviderId === id && providers.length > 0) {
        next.selectedProviderId = providers[0].id;
        next.selectedModel = providers[0].models[0] || "";
      }
      return next;
    });
    if (editingId === id) setEditingId(null);
  };

  const handleSave = () => {
    saveSettings(draft);
    onChange(draft);
    onClose();
  };

  const handleReset = () => {
    setDraft(DEFAULT_SETTINGS);
    saveSettings(DEFAULT_SETTINGS);
    onChange(DEFAULT_SETTINGS);
  };

  if (!open) return null;

  const serpapiReady = !!draft.apiKeys.serpapi || !!serverConfig?.serpapi;

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 z-50 h-full w-[360px] sm:w-[420px] bg-background border-l border-border shadow-2xl slide-in flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <span className="font-semibold text-foreground">设置</span>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-xl leading-none"
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-7">
          {/* 模型供应商 */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">模型供应商</h3>
              <button
                onClick={addProvider}
                className="text-xs rounded-lg border border-border px-2 py-1 text-foreground hover:bg-muted transition-colors"
              >
                + 添加
              </button>
            </div>

            <div className="space-y-3">
              {draft.providers.map((p) => {
                const isEditing = editingId === p.id;
                const ready = providerReady(p, serverConfig);
                const builtIn = isBuiltIn(p);

                return (
                  <div
                    key={p.id}
                    className="rounded-xl border border-border bg-muted p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{p.name || "未命名"}</span>
                          {builtIn && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground">
                              内置
                            </span>
                          )}
                          {!ready && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-100">
                              未配置
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 truncate">{p.baseUrl || "-"}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {p.models.filter(Boolean).length} 个模型
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setEditingId(isEditing ? null : p.id)}
                          className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
                        >
                          {isEditing ? "收起" : "编辑"}
                        </button>
                        {!builtIn && (
                          <button
                            onClick={() => deleteProvider(p.id)}
                            className="text-xs text-red-600 hover:text-red-700 px-2 py-1"
                          >
                            删除
                          </button>
                        )}
                      </div>
                    </div>

                    {isEditing && (
                      <div className="mt-3 space-y-3 border-t border-border pt-3">
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">名称</label>
                          <input
                            type="text"
                            value={p.name}
                            onChange={(e) => updateProvider(p.id, { name: e.target.value })}
                            placeholder="如：智谱 GLM"
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Base URL</label>
                          <input
                            type="text"
                            value={p.baseUrl}
                            onChange={(e) => updateProvider(p.id, { baseUrl: e.target.value })}
                            placeholder="https://api.example.com/v1"
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">API Key</label>
                          <input
                            type="password"
                            value={p.apiKey}
                            onChange={(e) => updateProvider(p.id, { apiKey: e.target.value })}
                            placeholder="输入 API Key"
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                          />
                          {builtIn && serverConfig?.deepseek && !p.apiKey && (
                            <p className="mt-1 text-[11px] text-emerald-700">.env.local 已配置 DEEPSEEK_API_KEY</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">API 格式</label>
                          <select
                            value={p.format}
                            onChange={(e) => updateProvider(p.id, { format: e.target.value as ApiFormat })}
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                          >
                            <option value="openai">{FORMAT_LABELS.openai}</option>
                            <option value="anthropic">{FORMAT_LABELS.anthropic}</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1.5">模型列表</label>
                          <div className="space-y-2">
                            {p.models.map((m, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={m}
                                  onChange={(e) => updateProviderModel(p.id, i, e.target.value)}
                                  placeholder="模型名"
                                  className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-accent"
                                />
                                {p.models.length > 1 && (
                                  <button
                                    onClick={() => removeProviderModel(p.id, i)}
                                    className="text-xs text-red-600 hover:text-red-700 px-2"
                                  >
                                    删除
                                  </button>
                                )}
                              </div>
                            ))}
                            <button
                              onClick={() => addProviderModel(p.id)}
                              className="text-xs rounded-lg border border-border px-2.5 py-1.5 text-foreground hover:bg-muted transition-colors"
                            >
                              + 添加模型
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* 搜索 */}
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-3">搜索</h3>
            <label className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                checked={draft.searchEnabled}
                onChange={(e) => update("searchEnabled", e.target.checked)}
                className="h-4 w-4 rounded border-border accent-accent"
              />
              <span className="text-sm text-foreground">启用 SerpApi 竞品搜索</span>
            </label>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">查询数量</label>
                <select
                  value={draft.searchQueries}
                  onChange={(e) => update("searchQueries", Number(e.target.value) as 2 | 3 | 5)}
                  disabled={!draft.searchEnabled}
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none focus:border-accent disabled:opacity-50"
                >
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={5}>5</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">每查询结果数</label>
                <select
                  value={draft.searchResultsPerQuery}
                  onChange={(e) => update("searchResultsPerQuery", Number(e.target.value) as 5 | 8 | 10)}
                  disabled={!draft.searchEnabled}
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none focus:border-accent disabled:opacity-50"
                >
                  <option value={5}>5</option>
                  <option value={8}>8</option>
                  <option value={10}>10</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">喂给 LLM 的结果数</label>
                <select
                  value={draft.searchResultsToLLM}
                  onChange={(e) => update("searchResultsToLLM", Number(e.target.value) as 10 | 15 | 20)}
                  disabled={!draft.searchEnabled}
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none focus:border-accent disabled:opacity-50"
                >
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={20}>20</option>
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs text-muted-foreground">SerpApi Key</label>
                  {serverConfig?.serpapi && (
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                      .env 已配置
                    </span>
                  )}
                </div>
                <input
                  type="password"
                  value={draft.apiKeys.serpapi}
                  onChange={(e) => updateApiKey("serpapi", e.target.value)}
                  placeholder="..."
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                />
                {!serpapiReady && (
                  <p className="mt-1 text-[11px] text-muted-foreground">未配置，竞品 Agent 将跳过联网搜索</p>
                )}
              </div>
            </div>
          </section>

          {/* 分析 */}
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-3">分析</h3>
            <label className="block text-xs text-muted-foreground mb-1.5">分析深度</label>
            <select
              value={draft.depth}
              onChange={(e) => update("depth", e.target.value as Depth)}
              className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none focus:border-accent mb-4"
            >
              <option value="concise">精简（省 token）</option>
              <option value="balanced">标准</option>
              <option value="detailed">详细</option>
            </select>

            <label className="block text-xs text-muted-foreground mb-1.5">启用 Agent</label>
            <div className="grid grid-cols-2 gap-2">
              {ANALYST_IDS.map((id) => (
                <label key={id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.enabledAgents[id]}
                    onChange={(e) => updateAgent(id, e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-accent"
                  />
                  <span className="text-sm text-foreground">{AGENT_NAMES[id]}</span>
                </label>
              ))}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.enabledAgents.judge}
                  onChange={(e) => updateAgent("judge", e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-accent"
                />
                <span className="text-sm text-foreground">{AGENT_NAMES.judge}</span>
              </label>
            </div>
          </section>
        </div>

        <div className="px-5 py-4 border-t border-border space-y-2">
          <button
            onClick={handleSave}
            className="w-full rounded-lg bg-accent text-accent-foreground text-sm font-medium px-3 py-2.5 hover:opacity-90 transition-opacity"
          >
            保存
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="flex-1 rounded-lg border border-border text-muted-foreground text-sm px-3 py-2 hover:text-foreground transition-colors"
            >
              恢复默认
            </button>
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-border text-muted-foreground text-sm px-3 py-2 hover:text-foreground transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

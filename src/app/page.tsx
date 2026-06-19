"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IdeaInput } from "@/components/IdeaInput";
import { AgentPanel } from "@/components/AgentPanel";
import { JudgeReport } from "@/components/JudgeReport";
import { Sidebar } from "@/components/Sidebar";
import { SettingsPanel } from "@/components/SettingsPanel";
import type { AgentState } from "@/components/AgentCard";
import {
  AGENTS,
  type AgentId,
  type AgentResult,
  type HistoryItem,
  type ReportSummary,
  type SSEEvent,
} from "@/lib/types";
import { loadHistory, saveHistory, deleteHistory, clearHistory } from "@/lib/history";
import { loadSettings, saveSettings, selectedProvider, isProviderReady, type AppSettings } from "@/lib/settings";
import { streamValidation, type StreamHandle } from "@/lib/client-stream";

type Phase = "home" | "analyzing" | "viewing";

interface ServerConfig {
  deepseek: boolean;
  serpapi: boolean;
}

function initAgents(): Record<AgentId, AgentState> {
  const r = {} as Record<AgentId, AgentState>;
  for (const a of AGENTS) r[a.id] = { status: "pending" };
  return r;
}

function emptyBuffers(): Record<AgentId, string> {
  const r = {} as Record<AgentId, string>;
  for (const a of AGENTS) r[a.id] = "";
  return r;
}

function agentsFromHistory(item: HistoryItem): Record<AgentId, AgentState> {
  const r = initAgents();
  for (const a of item.agents) {
    r[a.id] = { status: "done", markdown: a.markdown };
  }
  return r;
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>("home");
  const [idea, setIdea] = useState("");
  const [agents, setAgents] = useState<Record<AgentId, AgentState>>(initAgents);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [viewingTime, setViewingTime] = useState<number | null>(null);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [serverConfig, setServerConfig] = useState<ServerConfig | null>(null);

  const streamRef = useRef<StreamHandle | null>(null);
  const bufferRef = useRef<Record<AgentId, string>>(emptyBuffers());
  const dirtyRef = useRef<Set<AgentId>>(new Set());
  const runningRef = useRef<Set<AgentId>>(new Set());
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setSettings(loadSettings());
    setHistory(loadHistory());
    fetch("/api/config")
      .then((r) => r.json() as Promise<ServerConfig>)
      .then(setServerConfig)
      .catch(() => setServerConfig({ deepseek: false, serpapi: false }));
  }, []);

  const cancelRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const flushBuffers = useCallback(() => {
    rafRef.current = null;
    const dirty = dirtyRef.current;
    if (dirty.size > 0) {
      setAgents((p) => {
        const next = { ...p };
        for (const id of dirty) {
          if (!runningRef.current.has(id)) continue;
          next[id] = { status: "running", markdown: bufferRef.current[id] };
        }
        return next;
      });
      dirty.clear();
    }
    if (runningRef.current.size > 0) {
      rafRef.current = requestAnimationFrame(flushBuffers);
    }
  }, []);

  const scheduleFlush = useCallback(() => {
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(flushBuffers);
    }
  }, [flushBuffers]);

  const closeStream = useCallback(() => {
    streamRef.current?.cancel();
    streamRef.current = null;
  }, []);

  const goToHome = useCallback(() => {
    closeStream();
    cancelRaf();
    bufferRef.current = emptyBuffers();
    dirtyRef.current.clear();
    runningRef.current.clear();
    setPhase("home");
    setIdea("");
    setAgents(initAgents());
    setSummary(null);
    setError(null);
    setViewingId(null);
    setViewingTime(null);
  }, [closeStream, cancelRaf]);

  const handleSettingsChange = useCallback((next: AppSettings) => {
    setSettings(next);
    saveSettings(next);
  }, []);

  const startValidation = useCallback(
    (raw: string) => {
      if (!settings) return;
      closeStream();
      cancelRaf();
      const trimmed = raw.trim();
      if (!trimmed) return;

      bufferRef.current = emptyBuffers();
      dirtyRef.current.clear();
      runningRef.current.clear();

      setIdea(trimmed);
      setAgents(initAgents());
      setSummary(null);
      setError(null);
      setViewingId(null);
      setViewingTime(null);
      setMobileSidebar(false);
      setPhase("analyzing");

      const onEvent = (e: SSEEvent) => {
        switch (e.type) {
          case "plan":
            setAgents(initAgents());
            break;
          case "agent:start":
            bufferRef.current[e.id] = "";
            runningRef.current.add(e.id);
            setAgents((p) => ({ ...p, [e.id]: { status: "running" } }));
            break;
          case "agent:chunk":
            if (!runningRef.current.has(e.id)) return;
            bufferRef.current[e.id] += e.delta;
            dirtyRef.current.add(e.id);
            scheduleFlush();
            break;
          case "agent:done":
            runningRef.current.delete(e.id);
            dirtyRef.current.delete(e.id);
            bufferRef.current[e.id] = e.markdown;
            setAgents((p) => ({ ...p, [e.id]: { status: "done", markdown: e.markdown } }));
            break;
          case "agent:error":
            runningRef.current.delete(e.id);
            dirtyRef.current.delete(e.id);
            setAgents((p) => ({ ...p, [e.id]: { status: "error", error: e.message } }));
            break;
          case "complete": {
            setSummary(e.summary);
            const agentResults: AgentResult[] = AGENTS.map((a) => ({
              id: a.id,
              markdown: bufferRef.current[a.id] || "",
            }));
            const item: HistoryItem = {
              id:
                (typeof crypto !== "undefined" && "randomUUID" in crypto && crypto.randomUUID()) ||
                `${Date.now()}-${Math.random().toString(36).slice(2)}`,
              idea: e.summary.idea,
              timestamp: Date.now(),
              scores: e.summary.scores,
              verdict: e.summary.verdict,
              recommendation: e.summary.recommendation,
              agents: agentResults,
            };
            setHistory(saveHistory(item));
            break;
          }
          case "error":
            setError(e.message);
            break;
        }
      };

      const onError = () => {
        if (streamRef.current === null) return;
        streamRef.current = null;
        cancelRaf();
        setError("连接中断，请重试");
        setAgents((p) => {
          const next = { ...p };
          runningRef.current.forEach((id) => {
            if (next[id].status === "running") {
              next[id] = { status: "error", error: "连接中断" };
            }
          });
          return next;
        });
        runningRef.current.clear();
        dirtyRef.current.clear();
      };

      void streamValidation(trimmed, settings, { onEvent, onError }).then((handle) => {
        streamRef.current = handle;
      });
    },
    [closeStream, cancelRaf, scheduleFlush, settings]
  );

  const selectHistory = useCallback(
    (item: HistoryItem) => {
      closeStream();
      cancelRaf();
      setMobileSidebar(false);
      setIdea(item.idea);
      setAgents(agentsFromHistory(item));
      setSummary({
        idea: item.idea,
        scores: item.scores,
        recommendation: item.recommendation,
        verdict: item.verdict,
      });
      setError(null);
      setViewingId(item.id);
      setViewingTime(item.timestamp);
      setPhase("viewing");
    },
    [closeStream, cancelRaf]
  );

  const handleDelete = useCallback((id: string) => {
    setHistory(deleteHistory(id));
    if (viewingId === id) {
      goToHome();
    }
  }, [viewingId, goToHome]);

  const handleClear = useCallback(() => {
    clearHistory();
    setHistory([]);
    if (phase === "viewing") {
      goToHome();
    }
  }, [phase, goToHome]);

  useEffect(() => () => {
    closeStream();
    cancelRaf();
  }, [closeStream, cancelRaf]);

  if (!settings) return null;

  const currentProvider = selectedProvider(settings);
  const providerReady = isProviderReady(currentProvider, serverConfig?.deepseek);
  const serpapiReady = !!settings.apiKeys.serpapi || !!serverConfig?.serpapi;
  const searchWillRun = settings.enabledAgents.competitor && settings.searchEnabled;

  const enabledCount = Object.values(settings.enabledAgents).filter(Boolean).length;
  const completed = Object.entries(agents).filter(
    ([id, a]) => settings.enabledAgents[id as AgentId] && (a.status === "done" || a.status === "error")
  ).length;
  const progress = enabledCount > 0 ? Math.round((completed / enabledCount) * 100) : 0;

  return (
    <div className="flex flex-1 min-h-screen">
      <Sidebar
        history={history}
        viewingId={viewingId}
        onSelect={selectHistory}
        onDelete={handleDelete}
        onClear={handleClear}
        onNew={goToHome}
        onSettings={() => setSettingsOpen(true)}
        mobileOpen={mobileSidebar}
        onCloseMobile={() => setMobileSidebar(false)}
      />

      <main className="flex-1 min-w-0 flex flex-col">
        {phase === "home" && (
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
            <div className="w-full max-w-2xl">
              <h1 className="text-center text-4xl sm:text-5xl font-semibold tracking-tight text-foreground mb-10">
                AI Startup Validator
              </h1>

              {!providerReady && (
                <div className="mb-5 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 flex items-center gap-3">
                  <div className="shrink-0 h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center">
                    <span className="text-amber-700 text-sm font-bold">!</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-amber-900">
                      请先配置「{currentProvider?.name || "当前供应商"}」的 API Key
                    </div>
                    <div className="text-xs text-amber-700 mt-0.5">
                      在设置面板填入 Key，或在 .env.local 中设置 DEEPSEEK_API_KEY
                    </div>
                  </div>
                  <button
                    onClick={() => setSettingsOpen(true)}
                    className="shrink-0 rounded-lg bg-amber-600 text-white text-sm font-medium px-3 py-1.5 hover:bg-amber-700 transition-colors"
                  >
                    打开设置
                  </button>
                </div>
              )}

              {providerReady && (
                <div className="mb-5 flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-muted-foreground mb-1.5">模型</label>
                    <select
                      value={`${settings.selectedProviderId}::${settings.selectedModel}`}
                      onChange={(e) => {
                        const [providerId, model] = e.target.value.split("::");
                        if (providerId && model) {
                          const next = { ...settings, selectedProviderId: providerId, selectedModel: model };
                          setSettings(next);
                          saveSettings(next);
                        }
                      }}
                      className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                    >
                      {settings.providers.map((p) => (
                        <optgroup key={p.id} label={p.name}>
                          {p.models.map((m) => (
                            <option key={`${p.id}::${m}`} value={`${p.id}::${m}`}>
                              {m}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {providerReady && searchWillRun && !serpapiReady && (
                <div className="mb-5 rounded-xl border border-border bg-muted px-4 py-2.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-foreground">
                      竞品搜索已启用，但未配置 SerpApi Key，竞品 Agent 将跳过联网搜索
                    </div>
                  </div>
                  <button
                    onClick={() => setSettingsOpen(true)}
                    className="shrink-0 text-xs text-foreground hover:opacity-70 transition-opacity underline underline-offset-2"
                  >
                    配置
                  </button>
                </div>
              )}

              <IdeaInput onSubmit={startValidation} disabled={!providerReady} />
            </div>
          </div>
        )}

        {(phase === "analyzing" || phase === "viewing") && (
          <div className="flex-1 px-4 py-8 overflow-y-auto">
            <div className="max-w-3xl mx-auto">
              <div className="mb-6 flex items-center gap-3">
                <button
                  onClick={() => setMobileSidebar(true)}
                  className="md:hidden text-sm text-muted-foreground hover:text-foreground shrink-0"
                >
                  历史
                </button>
                <button
                  onClick={goToHome}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
                >
                  ← 新建验证
                </button>
                {phase === "viewing" && viewingTime && (
                  <span className="text-xs text-muted-foreground ml-auto shrink-0">
                    {new Date(viewingTime).toLocaleString()}
                  </span>
                )}
              </div>

              <div className="mb-6 rounded-xl border border-border bg-background shadow-soft p-4 card-hover">
                <div className="text-xs text-muted-foreground mb-1">
                  {phase === "viewing" ? "历史报告" : "正在验证"}
                </div>
                <div className="text-lg font-semibold text-foreground break-words">{idea}</div>
                {phase === "analyzing" && (
                  <>
                    <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full progress-flow transition-[width] duration-300 ease-linear"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
                      <span>{completed} / {enabledCount} Agent 完成</span>
                      <span>{progress}%</span>
                    </div>
                  </>
                )}
              </div>

              {error && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
                  出错了：{error}
                </div>
              )}

              <AgentPanel agents={agents} enabledAgents={phase === "analyzing" ? settings.enabledAgents : undefined} />

              <div className="mt-3">
                <JudgeReport state={agents.judge} summary={summary} />
              </div>
            </div>
          </div>
        )}
      </main>

      <SettingsPanel
        settings={settings}
        onChange={handleSettingsChange}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        serverConfig={serverConfig}
      />
    </div>
  );
}

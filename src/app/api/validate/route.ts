import { NextRequest } from "next/server";
import { sseEncode, sseDone, SSE_HEADERS } from "@/lib/sse";
import { AGENTS, type AgentResult, type SSEEvent } from "@/lib/types";
import { DEFAULT_SETTINGS, findProvider, type AppSettings, type Provider } from "@/lib/settings";
import { ANALYST_SPECS, type AgentRunOptions, type CompetitorRunOptions } from "@/agents/registry";
import { runJudgeAgent } from "@/agents";
import { requireAuth } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RuntimeSettings extends Omit<AppSettings, "apiKeys"> {
  provider: Provider;
  serpapiKey: string;
}

interface ValidateBody {
  idea?: string;
  settings?: Partial<AppSettings>;
}

async function parseBody(req: NextRequest): Promise<{ idea: string; settings: RuntimeSettings }> {
  const body = (await req.json().catch(() => ({}))) as ValidateBody;
  const idea = (body.idea ?? "").trim();
  if (!idea) throw new Error("缺少 idea 参数");
  if (idea.length > 200) throw new Error("idea 过长（最多 200 字符）");

  const partial = body.settings ?? {};
  const providers = partial.providers?.length ? partial.providers : DEFAULT_SETTINGS.providers;
  const providerId = partial.selectedProviderId || DEFAULT_SETTINGS.selectedProviderId;
  const provider = findProvider({ ...DEFAULT_SETTINGS, providers, selectedProviderId: providerId, selectedModel: "" }, providerId);
  if (!provider) throw new Error("未找到选中的模型供应商");

  const settings: RuntimeSettings = {
    providers,
    selectedProviderId: providerId,
    selectedModel: partial.selectedModel ?? DEFAULT_SETTINGS.selectedModel,
    depth: partial.depth ?? DEFAULT_SETTINGS.depth,
    searchEnabled: partial.searchEnabled ?? DEFAULT_SETTINGS.searchEnabled,
    searchQueries: partial.searchQueries ?? DEFAULT_SETTINGS.searchQueries,
    searchResultsPerQuery: partial.searchResultsPerQuery ?? DEFAULT_SETTINGS.searchResultsPerQuery,
    searchResultsToLLM: partial.searchResultsToLLM ?? DEFAULT_SETTINGS.searchResultsToLLM,
    enabledAgents: { ...DEFAULT_SETTINGS.enabledAgents, ...partial.enabledAgents },
    provider,
    serpapiKey: partial.apiKeys?.serpapi?.trim() || "",
  };

  return { idea, settings };
}

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function baseAgentOptions(settings: RuntimeSettings, signal?: AbortSignal) {
  return {
    signal,
    provider: settings.provider,
    model: settings.selectedModel,
    depth: settings.depth,
  };
}

export async function POST(req: NextRequest) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;
  const limited = rateLimit(req, { max: 10 });
  if (limited) return limited;

  let idea: string;
  let settings: RuntimeSettings;
  try {
    ({ idea, settings } = await parseBody(req));
  } catch (e) {
    return new Response(errMessage(e), { status: 400 });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: SSEEvent) => {
        try {
          controller.enqueue(sseEncode(event));
        } catch {
          // controller already closed
        }
      };

      emit({ type: "plan", idea, agents: AGENTS.map((a) => a.id) });

      const specs = ANALYST_SPECS.filter((s) => settings.enabledAgents[s.id]);
      const results: AgentResult[] = [];

      for (const spec of specs) {
        const id = spec.id;
        emit({ type: "agent:start", id });
        try {
          const baseOpts = baseAgentOptions(settings, req.signal);
          const runnerOpts: AgentRunOptions | CompetitorRunOptions =
            id === "competitor"
              ? {
                  ...baseOpts,
                  searchEnabled: settings.searchEnabled,
                  searchQueries: settings.searchQueries,
                  searchResultsPerQuery: settings.searchResultsPerQuery,
                  searchResultsToLLM: settings.searchResultsToLLM,
                  serpapiKey: settings.serpapiKey,
                }
              : baseOpts;
          const res = await spec.run(
            idea,
            (delta) => emit({ type: "agent:chunk", id, delta }),
            runnerOpts
          );
          results.push(res);
          emit({ type: "agent:done", id, markdown: res.markdown });
        } catch (e) {
          emit({ type: "agent:error", id, message: errMessage(e) });
        }
      }

      if (settings.enabledAgents.judge) {
        emit({ type: "agent:start", id: "judge" });
        try {
          const { result, summary } = await runJudgeAgent(idea, results, baseAgentOptions(settings, req.signal));
          emit({ type: "agent:done", id: "judge", markdown: result.markdown });
          emit({ type: "complete", summary });
        } catch (e) {
          const msg = errMessage(e);
          emit({ type: "agent:error", id: "judge", message: msg });
          emit({ type: "error", message: msg });
        }
      } else {
        emit({ type: "error", message: "Judge agent is disabled" });
      }

      try {
        controller.enqueue(sseDone());
      } catch {
        // ignore
      }
      controller.close();
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}

import type { Provider, ApiFormat } from "./settings";

const TIMEOUT = 120000;

interface LlmOptions {
  provider: Provider;
  model: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

function mergeSignal(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(TIMEOUT);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

function resolveProvider(p: Provider): {
  baseUrl: string;
  apiKey: string;
} {
  if (p.id === "deepseek") {
    const apiKey = p.apiKey.trim() || process.env.DEEPSEEK_API_KEY || "";
    const baseUrl = (p.baseUrl.trim() || process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1").replace(/\/$/, "");
    return { baseUrl, apiKey };
  }
  const apiKey = p.apiKey.trim();
  const baseUrl = p.baseUrl.trim().replace(/\/$/, "");
  return { baseUrl, apiKey };
}

export async function chatText(
  system: string,
  user: string,
  opts: LlmOptions
): Promise<string> {
  const { temperature = 0.7, maxTokens = 1800, signal, provider, model } = opts;
  return callChat(provider, model, system, user, temperature, maxTokens, false, signal);
}

export async function chatTextStream(
  system: string,
  user: string,
  onChunk: (delta: string) => void,
  opts: LlmOptions
): Promise<string> {
  const { temperature = 0.7, maxTokens = 1800, signal, provider, model } = opts;
  return callChatStream(provider, model, system, user, temperature, maxTokens, onChunk, signal);
}

export async function chatJSON<T = unknown>(
  system: string,
  user: string,
  opts: LlmOptions
): Promise<T> {
  const { temperature = 0.3, maxTokens = 2400, signal, provider, model } = opts;
  const raw = await callChat(provider, model, system, user, temperature, maxTokens, true, signal);
  return parseJSON<T>(raw);
}

async function callChat(
  provider: Provider,
  model: string,
  system: string,
  user: string,
  temperature: number,
  maxTokens: number,
  json: boolean,
  signal?: AbortSignal
): Promise<string> {
  const { baseUrl, apiKey } = resolveProvider(provider);
  if (!apiKey) throw providerKeyError(provider);
  if (!model) throw new Error(`模型供应商 "${provider.name}" 未选择模型`);

  if (provider.format === "anthropic") {
    return callAnthropicChat(baseUrl, apiKey, model, system, user, temperature, maxTokens, json, signal);
  }

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature,
    max_tokens: maxTokens,
    stream: false,
  };
  if (json) body.response_format = { type: "json_object" };

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: mergeSignal(signal),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${provider.name} API ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error(`${provider.name} 返回了空内容`);
  return content as string;
}

async function callChatStream(
  provider: Provider,
  model: string,
  system: string,
  user: string,
  temperature: number,
  maxTokens: number,
  onChunk: (delta: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const { baseUrl, apiKey } = resolveProvider(provider);
  if (!apiKey) throw providerKeyError(provider);
  if (!model) throw new Error(`模型供应商 "${provider.name}" 未选择模型`);

  if (provider.format === "anthropic") {
    return streamAnthropic(baseUrl, apiKey, model, system, user, temperature, maxTokens, onChunk, signal);
  }

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature,
    max_tokens: maxTokens,
    stream: true,
  };

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: mergeSignal(signal),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`${provider.name} API ${res.status}: ${text.slice(0, 300)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload);
        const delta = json?.choices?.[0]?.delta?.content;
        if (delta) {
          full += delta;
          onChunk(delta);
        }
      } catch {
        // partial JSON, wait for more
      }
    }
  }
  if (!full) throw new Error(`${provider.name} 流式响应无内容`);
  return full;
}

async function callAnthropicChat(
  baseUrl: string,
  apiKey: string,
  model: string,
  system: string,
  user: string,
  temperature: number,
  maxTokens: number,
  json: boolean,
  signal?: AbortSignal
): Promise<string> {
  const finalSystem = json ? `${system}\n\n你必须只输出 JSON 对象，不要 Markdown 代码块，不要额外文字。` : system;

  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      system: finalSystem,
      messages: [{ role: "user", content: user }],
    }),
    signal: mergeSignal(signal),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Anthropic API ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data?.content?.[0]?.text;
  if (!text) throw new Error("Anthropic 返回了空内容");
  return text as string;
}

async function streamAnthropic(
  baseUrl: string,
  apiKey: string,
  model: string,
  system: string,
  user: string,
  temperature: number,
  maxTokens: number,
  onChunk: (delta: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      system,
      messages: [{ role: "user", content: user }],
      stream: true,
    }),
    signal: mergeSignal(signal),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`Anthropic API ${res.status}: ${text.slice(0, 300)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    let currentEvent = "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        currentEvent = "";
        continue;
      }
      if (trimmed.startsWith("event:")) {
        currentEvent = trimmed.slice(6).trim();
        continue;
      }
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload);
        if (currentEvent === "content_block_delta") {
          const delta = json?.delta?.text;
          if (delta) {
            full += delta;
            onChunk(delta);
          }
        }
      } catch {
        // partial JSON
      }
    }
  }
  if (!full) throw new Error("Anthropic 流式响应无内容");
  return full;
}

function providerKeyError(provider: Provider): Error {
  if (provider.id === "deepseek") {
    return new Error("未配置 DeepSeek API Key，请在设置面板填写或在 .env.local 中设置 DEEPSEEK_API_KEY");
  }
  return new Error(`模型供应商 "${provider.name}" 未配置 API Key`);
}

export function parseJSON<T>(raw: string): T {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) s = s.slice(start, end + 1);
  return JSON.parse(s) as T;
}

export { type ApiFormat };

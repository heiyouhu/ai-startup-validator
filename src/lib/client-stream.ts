import type { SSEEvent } from "./types";
import type { AppSettings } from "./settings";

interface StreamHandlers {
  onEvent: (event: SSEEvent) => void;
  onError: (message: string) => void;
  onComplete?: () => void;
}

export interface StreamHandle {
  cancel: () => void;
}

export async function streamValidation(
  idea: string,
  settings: AppSettings,
  handlers: StreamHandlers,
  signal?: AbortSignal
): Promise<StreamHandle> {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (signal) signal.addEventListener("abort", onAbort);

  const handle: StreamHandle = {
    cancel: () => controller.abort(),
  };

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const authToken = typeof window !== "undefined" ? localStorage.getItem("asv_auth_token") : null;
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  try {
    const res = await fetch("/api/validate", {
      method: "POST",
      headers,
      body: JSON.stringify({ idea, settings }),
      signal: controller.signal,
    });

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      handlers.onError(`请求失败 ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`);
      if (signal) signal.removeEventListener("abort", onAbort);
      return handle;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          const trimmed = frame.trim();
          if (!trimmed) continue;
          if (trimmed === "data: [DONE]") {
            handlers.onComplete?.();
            if (signal) signal.removeEventListener("abort", onAbort);
            return handle;
          }
          if (!trimmed.startsWith("data: ")) continue;
          const payload = trimmed.slice(6);
          try {
            const event = JSON.parse(payload) as SSEEvent;
            handlers.onEvent(event);
          } catch {
            // partial JSON, ignore
          }
        }
      }
      handlers.onComplete?.();
    } catch (e) {
      if (controller.signal.aborted) {
        // cancelled by caller, no error
      } else {
        handlers.onError(e instanceof Error ? e.message : "流式读取失败");
      }
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // ignore
      }
    }
  } catch (e) {
    if (controller.signal.aborted) {
      // cancelled
    } else {
      handlers.onError(e instanceof Error ? e.message : "请求失败");
    }
  }

  if (signal) signal.removeEventListener("abort", onAbort);
  return handle;
}

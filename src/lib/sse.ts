import type { SSEEvent } from "./types";

const encoder = new TextEncoder();

export function sseEncode(event: SSEEvent): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

export function sseDone(): Uint8Array {
  return encoder.encode("data: [DONE]\n\n");
}

export const SSE_HEADERS: Record<string, string> = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

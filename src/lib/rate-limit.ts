import { NextRequest, NextResponse } from "next/server";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 60_000;
const DEFAULT_MAX = 10;

export function rateLimit(
  req: NextRequest,
  opts: { windowMs?: number; max?: number } = {}
): NextResponse | null {
  const windowMs = opts.windowMs ?? WINDOW_MS;
  const max = opts.max ?? DEFAULT_MAX;
  const ip = getClientIp(req);
  const now = Date.now();
  const bucket = buckets.get(ip);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + windowMs });
    return null;
  }

  bucket.count += 1;
  if (bucket.count > max) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    return NextResponse.json(
      { error: "请求过于频繁，请稍后再试" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }
  return null;
}

function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "local";
}

export function clearRateLimit(): void {
  buckets.clear();
}

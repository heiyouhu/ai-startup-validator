import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;
  return NextResponse.json({
    deepseek: !!process.env.DEEPSEEK_API_KEY,
    serpapi: !!process.env.SERPAPI_KEY,
  });
}

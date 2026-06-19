import { NextRequest, NextResponse } from "next/server";

const AUTH_PASSWORD = process.env.APP_AUTH_PASSWORD?.trim();

export function isAuthEnabled(): boolean {
  return !!AUTH_PASSWORD;
}

export function requireAuth(req: NextRequest): NextResponse | null {
  if (!AUTH_PASSWORD) return null;
  const header = req.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (token === AUTH_PASSWORD) return null;
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

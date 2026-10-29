import { NextResponse } from "next/server";
import { timingSafeEqual, createHash } from "node:crypto";
import { allowAttempt, config, cookieName, cookieOptions, createSession, sameOrigin } from "@/lib/auth";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return new Response("Forbidden", { status: 403 });
    if (!await allowAttempt()) return new Response("Too many attempts. Try again in 15 minutes.", { status: 429, headers: { "Retry-After": "900" } });
    // Read a bounded stream; Content-Length alone is not trustworthy.
    const reader = request.body?.getReader();
    if (!reader) return new Response("Invalid request", { status: 400 });
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length;
      if (size > 4096) { await reader.cancel(); return new Response("Request too large", { status: 413 }); } chunks.push(value); }
    if (!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")) return new Response("Invalid request", { status: 415 });
    const password = new URLSearchParams(Buffer.concat(chunks).toString()).get("password") ?? "";
    const hash = (value: string) => createHash("sha256").update(value).digest();
    if (!timingSafeEqual(hash(password), hash(config().password))) return new Response("Invalid credentials. Return to login and try again.", { status: 401 });
    const response = NextResponse.redirect(new URL("/", config().origin), 303);
    response.cookies.set(cookieName, await createSession(), cookieOptions);
    return response;
  } catch { return new Response("Authentication unavailable", { status: 503 }); }
}

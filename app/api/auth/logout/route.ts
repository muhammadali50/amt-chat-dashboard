import { NextRequest, NextResponse } from "next/server";
import { cookieName, cookieOptions, deleteSession, sameOrigin, config } from "@/lib/auth";
export async function POST(request: NextRequest) {
  try {
    if (!sameOrigin(request)) return new Response("Forbidden", { status: 403 });
    await deleteSession(request.cookies.get(cookieName)?.value);
    const response = NextResponse.redirect(new URL("/login", config().origin), 303);
    response.cookies.set(cookieName, "", { ...cookieOptions, maxAge: 0 });
    response.headers.set("Clear-Site-Data", '"cache", "cookies", "storage"');
    return response;
  } catch { return new Response("Logout unavailable. Try again.", { status: 503 }); }
}

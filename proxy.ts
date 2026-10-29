import { NextRequest, NextResponse } from "next/server";
import { cookieName, validSession } from "./lib/auth";
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const nonce = btoa(crypto.randomUUID());
  const csp = `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV !== "production" ? " 'unsafe-eval'" : ""}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self';`;
  const forwarded = new Headers(request.headers);
  forwarded.set("x-nonce", nonce);
  forwarded.set("Content-Security-Policy", csp);
  const next = () => NextResponse.next({ request: { headers: forwarded } });
  let response: NextResponse;
  if (["/login", "/api/auth/login", "/api/auth/logout", "/api/track"].includes(path) || path.startsWith("/_next/static/")) response = next();
  else {
    try {
      if (await validSession(request.cookies.get(cookieName)?.value)) response = next();
      else if (path.startsWith("/api/") || !["GET", "HEAD"].includes(request.method)) response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      else response = NextResponse.redirect(new URL("/login", request.url), 303);
    } catch { response = new NextResponse("Authentication is unavailable. Contact the administrator.", { status: 503 }); }
  }
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return response;
}
export const config = { matcher: ["/:path*"] };

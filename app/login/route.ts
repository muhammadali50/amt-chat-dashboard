import { config } from "@/lib/auth";
export const dynamic = "force-dynamic";
export function GET() {
  try { config(); } catch { return new Response("Administrator setup required.", { status: 503 }); }
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Admin login</title><style>body{font:18px system-ui;background:#f7f4ee;display:grid;place-items:center;min-height:95vh}main{background:white;padding:2rem;border-radius:16px;width:min(340px,80vw)}input,button{box-sizing:border-box;width:100%;padding:12px;margin-top:12px}button{background:#8f171d;color:white;border:0;border-radius:6px}</style><main><h1>Admin login</h1><p>This dashboard is private.</p><form method="post" action="/api/auth/login"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="1024"><button>Sign in</button></form></main></html>`, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

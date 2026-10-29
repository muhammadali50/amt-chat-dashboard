import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cookieName, validSession } from "./auth";
export async function requireAdmin() {
  if (!await validSession((await cookies()).get(cookieName)?.value)) redirect("/login");
}
export async function apiAuth() {
  try {
    if (!await validSession((await cookies()).get(cookieName)?.value)) return new Response("Unauthorized", { status: 401 });
    return null;
  } catch { return new Response("Authentication unavailable", { status: 503 }); }
}

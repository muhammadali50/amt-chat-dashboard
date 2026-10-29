import { apiAuth } from "@/lib/auth-server";
import { getConversations } from "@/lib/data";
export const dynamic = "force-dynamic";
export async function GET() {
 const denied = await apiAuth(); if (denied) return denied;
 try { return Response.json((await getConversations()).data); } catch { return new Response("Data unavailable", {status:503}); }
}

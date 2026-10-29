import { apiAuth } from "@/lib/auth-server";
import { getConversations, getMessages } from "@/lib/data";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: {params: Promise<{id: string}>}) {
 const denied = await apiAuth(); if (denied) return denied;
 try { const { id } = await context.params; if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Invalid ID", {status:400}); return Response.json(await getMessages(id)); } catch { return new Response("Data unavailable", {status:503}); }
}

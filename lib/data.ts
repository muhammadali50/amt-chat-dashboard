import "server-only";
import { getSupabaseAdminClient as getSupabaseClient } from "@/lib/supabase-admin";
import { requireAdmin } from "./auth-server";
import type { Conversation, Message } from "@/types/database";

export interface DatabaseQueryErrorDetails {
  query: string;
  status: number;
  code: string;
  message: string;
  details: string | null;
  hint: string | null;
}

export class DatabaseQueryError extends Error {
  constructor(public readonly info: DatabaseQueryErrorDetails) {
    super(info.message);
    this.name = "DatabaseQueryError";
  }
}

function throwQueryError(
  query: string,
  status: number,
  error: {
    code?: string;
    message: string;
    details?: string | null;
    hint?: string | null;
  }
): never {
  const info: DatabaseQueryErrorDetails = {
    query,
    status,
    code: error.code ?? "",
    message: error.message,
    details: error.details ?? null,
    hint: error.hint ?? null
  };

  info.message = "Database query failed.";
  info.details = null; info.hint = null;
  throw new DatabaseQueryError(info);
}

export async function getConversations(): Promise<{
  data: Conversation[];
  demo: boolean;
}> {
  await requireAdmin();
  const supabase = getSupabaseClient();

  const { data, error, status } = await supabase
    .from("conversations")
    .select("*")
    .order("last_message_at", { ascending: false });

  if (error) throwQueryError("getConversations", status, error);

  return { data: data ?? [], demo: false };
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  await requireAdmin();
  const supabase = getSupabaseClient();

  const { data, error, status } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throwQueryError("getMessages", status, error);

  return data ?? [];
}


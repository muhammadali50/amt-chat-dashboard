import { requireAdmin } from "@/lib/auth-server";
import { ConversationDashboard } from "@/components/conversation-dashboard";
import { DashboardShell } from "@/components/dashboard-shell";
import { DatabaseError } from "@/components/database-error";
import {
  DatabaseQueryError,
  getConversations,
  type DatabaseQueryErrorDetails
} from "@/lib/data";
import type { Conversation } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function Home() {
  await requireAdmin();
  let conversations: Conversation[] = [];
  let demo = false;
  let queryError: DatabaseQueryErrorDetails | null = null;

  try {
    ({ data: conversations, demo } = await getConversations());
  } catch (error) {
    queryError =
      error instanceof DatabaseQueryError
        ? error.info
        : {
            query: "getConversations",
            status: 0,
            code: "",
            message: error instanceof Error ? error.message : "Unknown database error",
            details: null,
            hint: null
          };
  }

  return (
    <DashboardShell>
      {queryError ? (
        <DatabaseError error={queryError} />
      ) : (
        <ConversationDashboard initialConversations={conversations} demo={demo} />
      )}
    </DashboardShell>
  );
}


import { requireAdmin } from "@/lib/auth-server";
import { DashboardShell } from "@/components/dashboard-shell";
import { VisitorsDashboard } from "@/components/visitors-dashboard";
import { getVisitorSummaries } from "@/lib/visitor-data";

export const dynamic = "force-dynamic";

export default async function VisitorsPage() {
  await requireAdmin();
  try {
    const visitors = await getVisitorSummaries();
    return (
      <DashboardShell>
        <VisitorsDashboard initialVisitors={visitors} />
      </DashboardShell>
    );
  } catch {
    return (
      <DashboardShell>
        <div className="grid h-full place-items-center p-8 text-center">
          <div className="rounded-2xl border border-stone-200 bg-white p-8 shadow-panel">
            <h1 className="text-lg font-extrabold text-stone-800">Visitors are unavailable</h1>
            <p className="mt-2 max-w-md text-sm leading-6 text-stone-500">
              Check that the visitor tables exist and the server-side Supabase service role key is configured.
            </p>
          </div>
        </div>
      </DashboardShell>
    );
  }
}

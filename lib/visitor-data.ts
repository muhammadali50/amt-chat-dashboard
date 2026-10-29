import "server-only";
import { requireAdmin } from "./auth-server";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export type VisitorSummary = {
  visitor_key: string;
  name: string | null;
  email: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  first_source: string;
  last_source: string;
  first_seen: string | null;
  last_seen: string | null;
  total_pages: number;
  latest_page: string | null;
};

export async function getVisitorSummaries(): Promise<VisitorSummary[]> {
  await requireAdmin();
  const supabase = getSupabaseAdminClient();
  const { data: visitors, error } = await supabase
    .from("website_visitors")
    .select("id, visitor_key, name, email, city, region, country, first_source, last_source, first_seen, last_seen")
    .order("last_seen", { ascending: false, nullsFirst: false })
    .limit(250);

  if (error) throw new Error("Could not load website visitors.");
  if (!visitors?.length) return [];

  const ids = visitors.map((visitor) => visitor.id);
  const { data: pages, error: pagesError } = await supabase
    .from("website_page_history")
    .select("visitor_id, page_path, entered_at")
    .in("visitor_id", ids)
    .order("entered_at", { ascending: true });

  if (pagesError) throw new Error("Could not load visitor page summaries.");

  const pageCounts = new Map<string, number>();
  const latestPages = new Map<string, { page_path: string; entered_at: string }>();
  for (const page of pages ?? []) {
    pageCounts.set(page.visitor_id, (pageCounts.get(page.visitor_id) ?? 0) + 1);
    latestPages.set(page.visitor_id, page);
  }

  // Deliberately omit the private website_visitors.id from all data sent to the browser.
  return visitors.map((visitor) => ({
    visitor_key: visitor.visitor_key,
    name: visitor.name,
    email: visitor.email,
    city: visitor.city,
    region: visitor.region,
    country: visitor.country,
    first_source: visitor.first_source,
    last_source: visitor.last_source,
    first_seen: visitor.first_seen,
    last_seen: visitor.last_seen,
    total_pages: pageCounts.get(visitor.id) ?? 0,
    latest_page: latestPages.get(visitor.id)?.page_path ?? null
  }));
}

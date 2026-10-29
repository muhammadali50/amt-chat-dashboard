import { apiAuth } from "@/lib/auth-server";
import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ visitorKey: string }> }
) {
  const denied = await apiAuth(); if (denied) return denied;
  const { visitorKey } = await params;
  if (!uuidPattern.test(visitorKey)) {
    return NextResponse.json({ error: "Visitor not found." }, { status: 404 });
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data: visitor, error } = await supabase
      .from("website_visitors")
      .select("id, visitor_key, name, email, city, region, country, first_source, last_source, first_seen, last_seen")
      .eq("visitor_key", visitorKey)
      .maybeSingle();

    if (error) return NextResponse.json({ error: "Visitor history is unavailable." }, { status: 503 });
    if (!visitor) return NextResponse.json({ error: "Visitor not found." }, { status: 404 });

    const { data: pages, error: pagesError } = await supabase
      .from("website_page_history")
      .select("page_path, entered_at, duration_seconds")
      .eq("visitor_id", visitor.id)
      .order("entered_at", { ascending: true });

    if (pagesError) {
      return NextResponse.json({ error: "Visitor history is unavailable." }, { status: 503 });
    }

    return NextResponse.json({
      visitor: {
        visitor_key: visitor.visitor_key,
        name: visitor.name,
        email: visitor.email,
        city: visitor.city,
        region: visitor.region,
        country: visitor.country,
        first_source: visitor.first_source,
        last_source: visitor.last_source,
        first_seen: visitor.first_seen,
        last_seen: visitor.last_seen
      },
      pages: pages ?? []
    });
  } catch {
    console.error("[visitor history] server operation failed");
    return NextResponse.json({ error: "Visitor history is unavailable." }, { status: 503 });
  }
}

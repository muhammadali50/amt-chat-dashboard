import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type TrackBody = {
  action?: unknown;
  visitor_key?: unknown;
  page_path?: unknown;
  utm_source?: unknown;
  referrer?: unknown;
  page_history_id?: unknown;
  duration_seconds?: unknown;
};

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text.slice(0, maxLength) : null;
}

function normalizeSource(value: string) {
  const normalized = value.toLowerCase().trim();
  if (/(^|\.)google\./.test(normalized) || normalized === "google") return "google";
  if (/(^|\.)(facebook|fb)\./.test(normalized) || ["facebook", "fb"].includes(normalized)) {
    return "facebook";
  }
  if (/(^|\.)instagram\./.test(normalized) || normalized === "instagram") return "instagram";
  if (/(^|\.)(wa\.me|whatsapp)($|\.)/.test(normalized) || normalized === "whatsapp") {
    return "whatsapp";
  }
  if (normalized === "direct") return "direct";
  return normalized.replace(/[^a-z0-9.-]/g, "").slice(0, 100) || "direct";
}

function getSource(utmSource: string | null, referrer: string | null, requestHost: string | null) {
  if (utmSource) return normalizeSource(utmSource);
  if (!referrer) return "direct";

  try {
    const referrerUrl = new URL(referrer);
    const referrerHost = referrerUrl.hostname.toLowerCase().replace(/^www\./, "");
    const currentHost = requestHost?.toLowerCase().split(":")[0].replace(/^www\./, "");
    if (!referrerUrl.protocol.startsWith("http") || referrerHost === currentHost) return "direct";

    if (/(^|\.)(google\.[a-z.]+)$/.test(referrerHost)) return "google";
    if (/(^|\.)(facebook\.com|fb\.com)$/.test(referrerHost)) return "facebook";
    if (/(^|\.)instagram\.com$/.test(referrerHost)) return "instagram";
    if (referrerHost === "wa.me" || /(^|\.)whatsapp\.com$/.test(referrerHost)) return "whatsapp";
    return normalizeSource(referrerHost);
  } catch {
    return "direct";
  }
}

function decodeLocation(value: string | null) {
  if (!value) return null;
  try {
    return decodeURIComponent(value).trim().slice(0, 120) || null;
  } catch {
    return value.trim().slice(0, 120) || null;
  }
}

function getLocation(request: Request) {
  const headers = request.headers;
  const countryCode = headers.get("x-vercel-ip-country")?.trim().toUpperCase();
  let country = countryCode ?? null;
  if (countryCode && /^[A-Z]{2}$/.test(countryCode)) {
    try {
      country = new Intl.DisplayNames(["en"], { type: "region" }).of(countryCode) ?? countryCode;
    } catch {
      country = countryCode;
    }
  }

  return {
    city: decodeLocation(headers.get("x-vercel-ip-city")),
    region: decodeLocation(headers.get("x-vercel-ip-country-region")),
    country
  };
}

function validPagePath(value: unknown) {
  if (typeof value !== "string" || value.length > 2048 || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }
  if (/[\\\u0000-\u001f]/.test(value)) return null;

  try {
    const parsed = new URL(value, "https://amt.invalid");
    return parsed.origin === "https://amt.invalid" ? parsed.pathname : null;
  } catch {
    return null;
  }
}

function failure() {
  return NextResponse.json({ error: "Tracking is temporarily unavailable." }, { status: 503 });
}

export async function POST(request: Request) {
  let body: TrackBody;
  try {
    body = (await request.json()) as TrackBody;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const visitorKey = typeof body.visitor_key === "string" ? body.visitor_key : "";
  if (!uuidPattern.test(visitorKey)) {
    return NextResponse.json({ error: "Invalid visitor key." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdminClient();

    if (body.action === "duration") {
      const pageHistoryId = typeof body.page_history_id === "string" ? body.page_history_id : "";
      const seconds = body.duration_seconds;
      if (
        !uuidPattern.test(pageHistoryId) ||
        typeof seconds !== "number" ||
        !Number.isInteger(seconds) ||
        seconds < 0 ||
        seconds > 604800
      ) {
        return NextResponse.json({ error: "Invalid duration update." }, { status: 400 });
      }

      const { data: visitor, error: visitorError } = await supabase
        .from("website_visitors")
        .select("id")
        .eq("visitor_key", visitorKey)
        .maybeSingle();
      if (visitorError || !visitor) return failure();

      const { error } = await supabase
        .from("website_page_history")
        .update({ duration_seconds: seconds })
        .eq("id", pageHistoryId)
        .eq("visitor_id", visitor.id);
      if (error) return failure();
      return new NextResponse(null, { status: 204 });
    }

    if (body.action !== "entry") {
      return NextResponse.json({ error: "Invalid tracking action." }, { status: 400 });
    }

    const pagePath = validPagePath(body.page_path);
    if (!pagePath) return NextResponse.json({ error: "Invalid page path." }, { status: 400 });

    const source = getSource(
      cleanText(body.utm_source, 100),
      cleanText(body.referrer, 2048),
      request.headers.get("x-forwarded-host") ?? request.headers.get("host")
    );
    const location = getLocation(request);
    const now = new Date().toISOString();

    let { data: visitor, error: lookupError } = await supabase
      .from("website_visitors")
      .select("id, first_source, city, region, country")
      .eq("visitor_key", visitorKey)
      .maybeSingle();

    if (lookupError) return failure();

    if (!visitor) {
      const { data: created, error: createError } = await supabase
        .from("website_visitors")
        .insert({
          visitor_key: visitorKey,
          name: null,
          email: null,
          city: location.city,
          region: location.region,
          country: location.country,
          first_source: source,
          last_source: source,
          first_seen: now,
          last_seen: now
        })
        .select("id, first_source, city, region, country")
        .single();

      if (createError?.code === "23505") {
        const retry = await supabase
          .from("website_visitors")
          .select("id, first_source, city, region, country")
          .eq("visitor_key", visitorKey)
          .single();
        visitor = retry.data;
        if (retry.error || !visitor) return failure();
      } else {
        if (createError || !created) return failure();
        visitor = created;
      }
    }

    const updates: {
      last_seen: string;
      updated_at: string;
      city?: string;
      region?: string;
      country?: string;
      last_source?: string;
    } = { last_seen: now, updated_at: now };

    // Direct visits do not erase a previously known acquisition source.
    if (source !== "direct") updates.last_source = source;
    if (!visitor.city && location.city) updates.city = location.city;
    if (!visitor.region && location.region) updates.region = location.region;
    if (!visitor.country && location.country) updates.country = location.country;

    const { error: updateError } = await supabase
      .from("website_visitors")
      .update(updates)
      .eq("id", visitor.id);
    if (updateError) return failure();

    const { data: pageHistory, error: historyError } = await supabase
      .from("website_page_history")
      .insert({ visitor_id: visitor.id, page_path: pagePath })
      .select("id")
      .single();
    if (historyError || !pageHistory) return failure();

    return NextResponse.json({ page_history_id: pageHistory.id }, { status: 201 });
  } catch {
    // Do not include request data, IP headers, or secrets in server logs.
    console.error("[visitor tracking] server operation failed");
    return failure();
  }
}

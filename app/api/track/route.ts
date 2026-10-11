import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type TrackBody = {
  action?: unknown;
  visitor_key?: unknown;
  page_visit_key?: unknown;
  page_url?: unknown;
  page_path?: unknown;
  utm_source?: unknown;
  referrer?: unknown;
  page_history_id?: unknown;
  duration_seconds?: unknown;
  name?: unknown;
  email?: unknown;
};

const defaultWebsiteOrigins = ["https://www.amustafatraders.com", "https://amustafatraders.com"];

function normalizeOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function getAllowedOrigins() {
  const configured = process.env.WEBSITE_TRACKING_ALLOWED_ORIGINS
    ?.split(",")
    .map((origin) => normalizeOrigin(origin.trim()))
    .filter((origin): origin is string => Boolean(origin));
  const origins = new Set(configured?.length ? configured : defaultWebsiteOrigins);

  if (process.env.NODE_ENV !== "production") {
    origins.add("http://localhost:3000");
    origins.add("http://localhost:3001");
    origins.add("http://127.0.0.1:3000");
  }

  return origins;
}

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin");
  const headers = new Headers({ Vary: "Origin" });
  if (origin && getAllowedOrigins().has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    headers.set("Access-Control-Max-Age", "86400");
  }
  return headers;
}

function isAllowedRequestOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return Boolean(origin && getAllowedOrigins().has(origin));
}

function jsonResponse(request: Request, body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders(request) });
}

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
    let currentHost = requestHost?.toLowerCase() ?? null;
    if (currentHost) {
      try {
        currentHost = new URL(currentHost).hostname.toLowerCase();
      } catch {
        currentHost = currentHost.split(":")[0];
      }
      currentHost = currentHost.replace(/^www\./, "");
    }
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

function validPagePath(value: unknown, allowedPageOrigins: Set<string>) {
  if (typeof value !== "string" || value.length > 4096) return null;
  try {
    const parsed = new URL(value);
    if (!/^https?:$/.test(parsed.protocol) || !allowedPageOrigins.has(parsed.origin)) return null;
    const pagePath = `${parsed.pathname}${parsed.hash}`;
    return pagePath.length <= 2048 && !/[\\\u0000-\u001f]/.test(pagePath) ? pagePath : null;
  } catch {
    return null;
  }
}

function validLegacyPagePath(value: unknown) {
  if (typeof value !== "string" || value.length > 2048 || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }
  if (/[\\\u0000-\u001f]/.test(value)) return null;

  try {
    const parsed = new URL(value, "https://amt.invalid");
    return parsed.origin === "https://amt.invalid" ? `${parsed.pathname}${parsed.hash}` : null;
  } catch {
    return null;
  }
}

function failure(request: Request) {
  return jsonResponse(request, { error: "Tracking is temporarily unavailable." }, 503);
}

export async function OPTIONS(request: Request) {
  if (!isAllowedRequestOrigin(request)) {
    return new NextResponse(null, { status: 403, headers: corsHeaders(request) });
  }
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(request: Request) {
  if (!isAllowedRequestOrigin(request)) {
    return jsonResponse(request, { error: "Origin is not allowed." }, 403);
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 16_384) return jsonResponse(request, { error: "Request is too large." }, 413);

  let body: TrackBody;
  try {
    body = (await request.json()) as TrackBody;
  } catch {
    return jsonResponse(request, { error: "Invalid request." }, 400);
  }

  const visitorKey = typeof body.visitor_key === "string" ? body.visitor_key : "";
  if (!uuidPattern.test(visitorKey)) {
    return jsonResponse(request, { error: "Invalid visitor key." }, 400);
  }

  try {
    const supabase = getSupabaseAdminClient();

    if (body.action === "identify") {
      const name = cleanText(body.name, 120);
      const email = cleanText(body.email, 254)?.toLowerCase() ?? null;
      if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return jsonResponse(request, { error: "Enter a valid name and email." }, 400);
      }

      const { data: visitor, error } = await supabase
        .from("website_visitors")
        .update({ name, email, updated_at: new Date().toISOString() })
        .eq("visitor_key", visitorKey)
        .select("id")
        .maybeSingle();

      if (error) return failure(request);
      if (!visitor) return jsonResponse(request, { error: "Visitor has not been tracked yet." }, 404);
      return jsonResponse(request, { success: true });
    }

    if (body.action === "page_duration" || body.action === "duration") {
      const seconds = body.duration_seconds;
      if (typeof seconds !== "number" || !Number.isInteger(seconds) || seconds < 0 || seconds > 604800) {
        return jsonResponse(request, { error: "Invalid duration update." }, 400);
      }

      if (body.action === "page_duration") {
        const pageVisitKey = typeof body.page_visit_key === "string" ? body.page_visit_key : "";
        if (!uuidPattern.test(pageVisitKey)) {
          return jsonResponse(request, { error: "Invalid page visit key." }, 400);
        }

        const { data: visitor, error: visitorError } = await supabase
          .from("website_visitors")
          .select("id")
          .eq("visitor_key", visitorKey)
          .maybeSingle();
        if (visitorError) return failure(request);
        if (!visitor) return jsonResponse(request, { error: "Visitor has not been tracked yet." }, 404);

        const { data: page, error } = await supabase
          .from("website_page_history")
          .update({ duration_seconds: seconds })
          .eq("page_visit_key", pageVisitKey)
          .eq("visitor_id", visitor.id)
          .select("id")
          .maybeSingle();
        if (error) return failure(request);
        if (!page) return jsonResponse(request, { error: "Page visit was not found." }, 404);
        return jsonResponse(request, { success: true });
      }

      const pageHistoryId = typeof body.page_history_id === "string" ? body.page_history_id : "";
      if (!uuidPattern.test(pageHistoryId)) {
        return jsonResponse(request, { error: "Invalid duration update." }, 400);
      }

      const { data: visitor, error: visitorError } = await supabase
        .from("website_visitors")
        .select("id")
        .eq("visitor_key", visitorKey)
        .maybeSingle();
      if (visitorError || !visitor) return failure(request);

      const { error } = await supabase
        .from("website_page_history")
        .update({ duration_seconds: seconds })
        .eq("id", pageHistoryId)
        .eq("visitor_id", visitor.id);
      if (error) return failure(request);
      return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
    }

    if (body.action !== "page_view" && body.action !== "entry") {
      return jsonResponse(request, { error: "Invalid tracking action." }, 400);
    }

    const allowedOrigins = getAllowedOrigins();
    const pagePath = body.action === "page_view"
      ? validPagePath(body.page_url, allowedOrigins)
      : validLegacyPagePath(body.page_path);
    if (!pagePath) return jsonResponse(request, { error: "Invalid page URL or path." }, 400);

    const pageVisitKey = body.action === "page_view"
      ? (typeof body.page_visit_key === "string" ? body.page_visit_key : "")
      : null;
    if (body.action === "page_view" && !uuidPattern.test(pageVisitKey ?? "")) {
      return jsonResponse(request, { error: "Invalid page visit key." }, 400);
    }

    let pageOrigin = request.headers.get("origin");
    if (body.action === "page_view" && typeof body.page_url === "string") {
      try {
        pageOrigin = new URL(body.page_url).origin;
      } catch {
        pageOrigin = request.headers.get("origin");
      }
    }

    const source = getSource(
      cleanText(body.utm_source, 100),
      cleanText(body.referrer, 2048),
      pageOrigin
    );
    const location = getLocation(request);
    const now = new Date().toISOString();

    let { data: visitor, error: lookupError } = await supabase
      .from("website_visitors")
      .select("id, first_source, city, region, country")
      .eq("visitor_key", visitorKey)
      .maybeSingle();

    if (lookupError) return failure(request);

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
        if (retry.error || !visitor) return failure(request);
      } else {
        if (createError || !created) return failure(request);
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
    if (updateError) return failure(request);

    const insert = await supabase
      .from("website_page_history")
      .insert({
        visitor_id: visitor.id,
        page_path: pagePath,
        ...(pageVisitKey ? { page_visit_key: pageVisitKey } : {})
      })
      .select("id")
      .single();

    if (insert.error?.code === "23505" && pageVisitKey) {
      const duplicate = await supabase
        .from("website_page_history")
        .select("visitor_id, page_path")
        .eq("page_visit_key", pageVisitKey)
        .maybeSingle();
      if (duplicate.error) return failure(request);
      if (duplicate.data?.visitor_id !== visitor.id || duplicate.data.page_path !== pagePath) {
        return jsonResponse(request, { error: "Page visit key is already in use." }, 409);
      }
      return jsonResponse(request, { success: true });
    }

    if (insert.error || !insert.data) return failure(request);

    return jsonResponse(request, { success: true }, 201);
  } catch {
    // Do not include request data, IP headers, or secrets in server logs.
    console.error("[visitor tracking] server operation failed");
    return failure(request);
  }
}

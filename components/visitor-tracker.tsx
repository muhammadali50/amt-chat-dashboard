"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const visitorStorageKey = "amt_visitor_key";
const activePageStorageKey = "amt_active_page";

type ActivePage = {
  visitorKey: string;
  pageHistoryId: string;
  pagePath: string;
  startedAt: number;
};

function getVisitorKey() {
  try {
    const existing = window.localStorage.getItem(visitorStorageKey);
    if (existing) return existing;

    const created = window.crypto.randomUUID();
    window.localStorage.setItem(visitorStorageKey, created);
    return created;
  } catch {
    return window.crypto.randomUUID();
  }
}

function getStoredActivePage(): ActivePage | null {
  try {
    const value = window.sessionStorage.getItem(activePageStorageKey);
    if (!value) return null;
    const parsed = JSON.parse(value) as ActivePage;
    if (
      typeof parsed.visitorKey === "string" &&
      typeof parsed.pageHistoryId === "string" &&
      typeof parsed.pagePath === "string" &&
      Number.isFinite(parsed.startedAt)
    ) {
      return parsed;
    }
  } catch {
    // Tracking must not interfere with site navigation when storage is unavailable.
  }
  return null;
}

function storeActivePage(page: ActivePage | null) {
  try {
    if (page) window.sessionStorage.setItem(activePageStorageKey, JSON.stringify(page));
    else window.sessionStorage.removeItem(activePageStorageKey);
  } catch {
    // Session storage is a convenience for page reloads, not a tracking requirement.
  }
}

function finishPage(page: ActivePage) {
  const durationSeconds = Math.min(
    604800,
    Math.max(0, Math.round((Date.now() - page.startedAt) / 1000))
  );

  try {
    void fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "duration",
        visitor_key: page.visitorKey,
        page_history_id: page.pageHistoryId,
        duration_seconds: durationSeconds
      }),
      keepalive: true,
      cache: "no-store"
    }).catch(() => undefined);
  } catch {
    // Beacon failures must never block navigation.
  }
}

export function VisitorTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const utmSource = searchParams.get("utm_source");
  const lastPathRef = useRef<string | null>(null);
  const visitorKeyRef = useRef<string | null>(null);
  const activePageRef = useRef<ActivePage | null>(null);
  const generationRef = useRef(0);

  useEffect(() => {
    if (!pathname || lastPathRef.current === pathname) return;
    lastPathRef.current = pathname;

    visitorKeyRef.current ??= getVisitorKey();
    const visitorKey = visitorKeyRef.current;
    const previousPage = activePageRef.current ?? getStoredActivePage();
    if (previousPage && previousPage.visitorKey === visitorKey) finishPage(previousPage);
    activePageRef.current = null;
    storeActivePage(null);

    const requestGeneration = ++generationRef.current;
    const startedAt = Date.now();
    const referrer = document.referrer || null;

    void fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "entry",
        visitor_key: visitorKey,
        page_path: pathname,
        utm_source: utmSource,
        referrer
      }),
      cache: "no-store"
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as { page_history_id?: string };
      })
      .then((result) => {
        if (!result?.page_history_id) return;
        const page: ActivePage = {
          visitorKey,
          pageHistoryId: result.page_history_id,
          pagePath: pathname,
          startedAt
        };

        if (requestGeneration !== generationRef.current) {
          finishPage(page);
          return;
        }

        activePageRef.current = page;
        storeActivePage(page);
      })
      .catch(() => undefined);
  }, [pathname, utmSource]);

  useEffect(() => {
    const updateCurrentDuration = () => {
      const activePage = activePageRef.current;
      if (activePage) finishPage(activePage);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") updateCurrentDuration();
    };

    window.addEventListener("pagehide", updateCurrentDuration);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", updateCurrentDuration);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return null;
}

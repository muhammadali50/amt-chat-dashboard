"use client";

import { useEffect, useMemo, useState } from "react";
import { SearchIcon } from "@/components/icons";
import type { VisitorSummary } from "@/lib/visitor-data";

type VisitorPage = {
  page_path: string;
  entered_at: string;
  duration_seconds: number;
};

type VisitorDetails = {
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
};

const dateFormatter = new Intl.DateTimeFormat("en-PK", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Karachi"
});

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
}

function formatDuration(seconds: number) {
  if (seconds < 60) return seconds === 0 ? "<1 sec" : `${seconds} sec`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

function shortKey(value: string) {
  return value.slice(0, 8).toUpperCase();
}

function locationLabel(visitor: Pick<VisitorDetails, "city" | "region" | "country">) {
  return [visitor.city, visitor.region, visitor.country].filter(Boolean).join(", ") || "Location unavailable";
}

export function VisitorsDashboard({ initialVisitors }: { initialVisitors: VisitorSummary[] }) {
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(initialVisitors[0]?.visitor_key ?? null);
  const [selectedVisitor, setSelectedVisitor] = useState<VisitorDetails | null>(null);
  const [pages, setPages] = useState<VisitorPage[]>([]);
  const [historyLoading, setHistoryLoading] = useState(Boolean(initialVisitors[0]));
  const [historyError, setHistoryError] = useState("");

  const filteredVisitors = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return initialVisitors;
    return initialVisitors.filter((visitor) =>
      [
        visitor.visitor_key,
        visitor.name,
        visitor.email,
        visitor.city,
        visitor.region,
        visitor.country,
        visitor.latest_page
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(term))
    );
  }, [initialVisitors, search]);

  useEffect(() => {
    if (!selectedKey) {
      setSelectedVisitor(null);
      setPages([]);
      setHistoryLoading(false);
      return;
    }

    const controller = new AbortController();
    setHistoryLoading(true);
    setHistoryError("");

    void fetch(`/api/visitors/${encodeURIComponent(selectedKey)}/history`, {
      cache: "no-store",
      signal: controller.signal
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Visitor history could not be loaded.");
        return (await response.json()) as { visitor: VisitorDetails; pages: VisitorPage[] };
      })
      .then((result) => {
        setSelectedVisitor(result.visitor);
        setPages(result.pages);
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setHistoryError("Visitor history could not be loaded.");
        setSelectedVisitor(null);
        setPages([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setHistoryLoading(false);
      });

    return () => controller.abort();
  }, [selectedKey]);

  return (
    <div className="flex h-full flex-col overflow-hidden p-3 pt-16 sm:p-5 sm:pt-16 md:p-6 lg:p-7">
      <header className="mb-5 flex shrink-0 items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-px w-5 bg-[#c69235]" />
            <p className="text-[10px] font-extrabold uppercase tracking-[0.23em] text-[#a36818]">
              Website analytics
            </p>
          </div>
          <h1 className="mt-1 truncate text-2xl font-black tracking-tight text-[#2a211e] sm:text-[28px]">
            Website Visitors
          </h1>
          <p className="mt-1 hidden text-sm text-stone-500 sm:block">
            Visitor sources, approximate locations, and page journeys.
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-800">
          Latest {initialVisitors.length}
        </span>
      </header>

      <div className="grid min-h-0 flex-1 overflow-hidden rounded-[22px] border border-stone-200/90 bg-white shadow-panel md:grid-cols-[340px_minmax(0,1fr)] lg:grid-cols-[385px_minmax(0,1fr)]">
        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden border-r border-stone-200">
          <div className="shrink-0 border-b border-stone-100 p-4">
            <label className="flex items-center gap-2.5 rounded-xl border border-stone-200 bg-[#faf9f6] px-3 py-2.5 text-stone-400 focus-within:border-amber-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-amber-100">
              <SearchIcon className="h-4 w-4 shrink-0" />
              <input
                aria-label="Search website visitors"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full bg-transparent text-sm text-stone-800 outline-none placeholder:text-stone-400"
                placeholder="Search visitors or pages"
              />
            </label>
          </div>

          <div className="flex items-center justify-between px-4 pb-2 pt-4">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-stone-400">
              Recent visitors
            </p>
            <span className="rounded-full bg-[#f9efe8] px-2 py-0.5 text-[10px] font-bold text-[#8f171d]">
              {filteredVisitors.length}
            </span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            {filteredVisitors.length ? (
              filteredVisitors.map((visitor) => (
                <button
                  key={visitor.visitor_key}
                  onClick={() => setSelectedKey(visitor.visitor_key)}
                  className={
                    "relative flex w-full gap-3 rounded-xl p-3 text-left transition " +
                    (selectedKey === visitor.visitor_key
                      ? "bg-[#fff5ef] shadow-sm ring-1 ring-[#f0ddd0]"
                      : "hover:bg-stone-50")
                  }
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-100 to-orange-200 text-xs font-extrabold text-[#8f171d]">
                    {shortKey(visitor.visitor_key).slice(0, 2)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <strong className="truncate text-sm font-extrabold text-stone-800">
                        {visitor.name || `Visitor ${shortKey(visitor.visitor_key)}`}
                      </strong>
                      <time className="shrink-0 text-[10px] text-stone-400">
                        {visitor.last_seen ? formatDate(visitor.last_seen) : "—"}
                      </time>
                    </span>
                    <span className="mt-1 block truncate text-[10px] font-semibold capitalize text-emerald-700">
                      {visitor.last_source || "direct"}
                    </span>
                    <span className="mt-1.5 block truncate text-xs text-stone-500">
                      {visitor.latest_page || "No page history"} · {visitor.total_pages} pages
                    </span>
                  </span>
                </button>
              ))
            ) : (
              <div className="grid h-48 place-items-center px-8 text-center">
                <div>
                  <SearchIcon className="mx-auto h-6 w-6 text-stone-300" />
                  <p className="mt-3 text-sm font-semibold text-stone-500">
                    {initialVisitors.length ? "No visitors found" : "No visitors yet"}
                  </p>
                  <p className="mt-1 text-xs text-stone-400">
                    Visitors will appear after their first tracked page view.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-[#fbfaf7]">
          {selectedVisitor ? (
            <>
              <div className="shrink-0 border-b border-stone-200 bg-white px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-stone-400">
                      Visitor {shortKey(selectedVisitor.visitor_key)}
                    </p>
                    <h2 className="mt-1 truncate text-lg font-extrabold text-stone-900">
                      {selectedVisitor.name || "Anonymous visitor"}
                    </h2>
                    {selectedVisitor.email && (
                      <p className="mt-0.5 text-xs text-stone-500">{selectedVisitor.email}</p>
                    )}
                    <p className="mt-1 text-xs text-stone-500">
                      {locationLabel(selectedVisitor)}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-right text-[10px] sm:text-xs">
                    <span className="text-stone-400">First source</span>
                    <strong className="capitalize text-stone-700">{selectedVisitor.first_source}</strong>
                    <span className="text-stone-400">Last source</span>
                    <strong className="capitalize text-stone-700">{selectedVisitor.last_source}</strong>
                    <span className="text-stone-400">First seen</span>
                    <span className="text-stone-600">{formatDate(selectedVisitor.first_seen)}</span>
                    <span className="text-stone-400">Last seen</span>
                    <span className="text-stone-600">{formatDate(selectedVisitor.last_seen)}</span>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
                <h3 className="mb-4 text-[10px] font-extrabold uppercase tracking-[0.16em] text-stone-400">
                  Page journey · chronological
                </h3>
                {historyLoading ? (
                  <div className="space-y-3">
                    {[0, 1, 2].map((item) => (
                      <div key={item} className="h-16 animate-pulse rounded-xl bg-white shadow-sm" />
                    ))}
                  </div>
                ) : historyError ? (
                  <div className="rounded-xl border border-red-100 bg-white p-4 text-sm text-red-700">
                    {historyError}
                  </div>
                ) : pages.length ? (
                  <ol className="relative space-y-3 before:absolute before:bottom-5 before:left-[17px] before:top-5 before:w-px before:bg-[#eadbc9]">
                    {pages.map((page, index) => (
                      <li key={`${page.entered_at}-${index}`} className="relative flex gap-3">
                        <span className="z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#eadbc9] bg-white text-xs font-extrabold text-[#8f171d] shadow-sm">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1 rounded-xl border border-stone-200/80 bg-white p-3 shadow-sm">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <strong className="break-all text-sm font-bold text-stone-800">
                              {page.page_path}
                            </strong>
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                              {formatDuration(page.duration_seconds)}
                            </span>
                          </div>
                          <time className="mt-1 block text-[10px] text-stone-400">
                            {formatDate(page.entered_at)}
                          </time>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-500">
                    No page history has been recorded for this visitor yet.
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="grid h-full place-items-center p-8 text-center text-sm text-stone-500">
              {historyLoading ? "Loading visitor history…" : "Select a visitor to view their page journey."}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

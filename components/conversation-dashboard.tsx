"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftIcon,
  BellIcon,
  MoreIcon,
  SearchIcon
} from "@/components/icons";
import { PlatformBadge } from "@/components/platform-badge";
import {
  getMessages,
  subscribeToConversations
} from "@/lib/chat-client";
import type { Conversation, Message, Platform } from "@/types/database";

type Filter = "all" | Platform;

const chatTimeFormatter = new Intl.DateTimeFormat("en-PK", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Karachi"
});

const listDateFormatter = new Intl.DateTimeFormat("en-PK", {
  month: "short",
  day: "numeric",
  timeZone: "Asia/Karachi"
});

function chatTime(value: string) {
  return chatTimeFormatter.format(new Date(value));
}

function listTime(value: string) {
  return listDateFormatter.format(new Date(value));
}

function Avatar({
  conversation,
  large = false
}: {
  conversation: Conversation;
  large?: boolean;
}) {
  const initial = conversation.username?.charAt(0).toUpperCase() || "U";
  const palette =
    conversation.platform === "instagram"
      ? "from-[#f7d7bc] to-[#f3a7b7] text-[#8f171d]"
      : conversation.platform === "whatsapp"
        ? "from-emerald-100 to-green-200 text-emerald-800"
        : "from-blue-100 to-sky-200 text-blue-800";

  return (
    <div
      className={
        "relative grid shrink-0 place-items-center rounded-full bg-gradient-to-br font-extrabold shadow-sm " +
        palette +
        (large ? " h-12 w-12 text-base" : " h-11 w-11 text-sm")
      }
    >
      {initial}
      <span className="absolute -bottom-0.5 -right-0.5 rounded-md border-2 border-white bg-white">
        <PlatformBadge platform={conversation.platform} compact />
      </span>
    </div>
  );
}

function EmptyConversation() {
  return (
    <div className="grid h-full place-items-center p-8 text-center">
      <div>
        <div className="relative mx-auto h-36 w-44">
          <Image
            src="/brand/rice-bowl.png"
            alt=""
            fill
            sizes="176px"
            className="object-contain drop-shadow-xl"
          />
        </div>
        <h3 className="mt-4 text-base font-extrabold text-stone-800">Your customer inbox</h3>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-stone-500">
          Select a conversation to view its complete chatbot history.
        </p>
      </div>
    </div>
  );
}

export function ConversationDashboard({
  initialConversations,
  demo
}: {
  initialConversations: Conversation[];
  demo: boolean;
}) {
  const [conversations, setConversations] = useState(initialConversations);
  const [selected, setSelected] = useState<Conversation | null>(
    initialConversations[0] ?? null
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(Boolean(initialConversations[0]));
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [showChat, setShowChat] = useState(false);
  const messageAreaRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  useEffect(() => {
    if (!selected) {
      setMessages([]);
      return;
    }

    let active = true;
    stickToBottomRef.current = true;
    setLoading(true);
    setError("");

    getMessages(selected.id)
      .then((items) => {
        if (active) setMessages(items);
      })
      .catch(() => {
        if (active) setError("Could not load this conversation.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const timer = setInterval(() => {
      void getMessages(selected.id).then(items => { if (active) setMessages(items); }).catch(() => { if (active) setError("Could not refresh messages."); });
    }, 10000);
    return () => { active = false; clearInterval(timer); };
  }, [selected]);

  useEffect(() => {
    if (loading || !stickToBottomRef.current) return;

    const frame = requestAnimationFrame(() => {
      const area = messageAreaRef.current;
      if (area) area.scrollTop = area.scrollHeight;
    });

    return () => cancelAnimationFrame(frame);
  }, [loading, messages, selected?.id]);

  useEffect(() => subscribeToConversations((rows) => {
    setConversations(rows);
    setSelected(current => current ? rows.find(row => row.id === current.id) ?? null : null);
  }), []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return conversations.filter((item) => {
      const matchesPlatform = filter === "all" || item.platform === filter;
      const matchesSearch =
        !term ||
        (item.username ?? "").toLowerCase().includes(term) ||
        (item.last_message ?? "").toLowerCase().includes(term);

      return matchesPlatform && matchesSearch;
    });
  }, [conversations, filter, search]);

  function selectConversation(conversation: Conversation) {
    setSelected(conversation);
    setShowChat(true);
  }

  return (
    <div className="flex h-full flex-col overflow-hidden p-3 pt-16 sm:p-5 sm:pt-16 md:p-6 lg:p-7">
      <header className="mb-5 flex shrink-0 items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-px w-5 bg-[#c69235]" />
            <p className="text-[10px] font-extrabold uppercase tracking-[0.23em] text-[#a36818]">
              Customer care
            </p>
          </div>
          <h1 className="mt-1 truncate text-2xl font-black tracking-tight text-[#2a211e] sm:text-[28px]">
            Conversations
          </h1>
          <p className="mt-1 hidden text-sm text-stone-500 sm:block">
            Review customer enquiries from Instagram, Facebook, and WhatsApp.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {demo && (
            <span className="hidden rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-800 lg:block">
              Demo data
            </span>
          )}
          <button
            className="relative grid h-10 w-10 place-items-center rounded-xl border border-stone-200 bg-white text-stone-500 shadow-sm transition hover:border-amber-300 hover:text-[#8f171d]"
            aria-label="Notifications"
          >
            <BellIcon className="h-[18px] w-[18px]" />
            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#b91c1c] ring-2 ring-white" />
          </button>
          <div className="relative h-10 w-10 overflow-hidden rounded-full border-2 border-white bg-white shadow-md">
            <Image
              src="/brand/amt-logo.png"
              alt="A Mustafa Traders"
              fill
              sizes="40px"
              className="object-contain"
            />
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden rounded-[22px] border border-stone-200/90 bg-white shadow-panel">
        <div className="grid h-full min-h-0 overflow-hidden md:grid-cols-[340px_minmax(0,1fr)] lg:grid-cols-[385px_minmax(0,1fr)]">
          <section
            className={
              "h-full min-h-0 min-w-0 flex-col overflow-hidden border-r border-stone-200 bg-white " +
              (showChat ? "hidden md:flex" : "flex")
            }
          >
            <div className="shrink-0 border-b border-stone-100 p-4">
              <label className="flex items-center gap-2.5 rounded-xl border border-stone-200 bg-[#faf9f6] px-3 py-2.5 text-stone-400 transition focus-within:border-amber-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-amber-100">
                <SearchIcon className="h-4 w-4 shrink-0" />
                <input
                  aria-label="Search conversations"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full bg-transparent text-sm text-stone-800 outline-none placeholder:text-stone-400"
                  placeholder="Search customers or messages"
                />
              </label>

              <div className="mt-3 flex gap-2">
                {(["all", "instagram", "facebook", "whatsapp"] as Filter[]).map((item) => (
                  <button
                    key={item}
                    onClick={() => setFilter(item)}
                    className={
                      "rounded-lg px-3 py-1.5 text-[11px] font-bold capitalize transition " +
                      (filter === item
                        ? "bg-[#8f171d] text-white shadow-sm"
                        : "bg-stone-100 text-stone-500 hover:bg-stone-200")
                    }
                  >
                    {item === "all" ? "All" : item[0].toUpperCase() + item.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between px-4 pb-2 pt-4">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-stone-400">
                Recent messages
              </p>
              <span className="rounded-full bg-[#f9efe8] px-2 py-0.5 text-[10px] font-bold text-[#8f171d]">
                {filtered.length}
              </span>
            </div>

            <div className="min-h-0 flex-1 overscroll-contain overflow-y-auto px-2 pb-3">
              {filtered.length ? (
                filtered.map((conversation) => (
                  <button
                    key={conversation.id}
                    onClick={() => selectConversation(conversation)}
                    className={
                      "relative flex w-full gap-3 rounded-xl p-3 text-left transition " +
                      (selected?.id === conversation.id
                        ? "bg-[#fff5ef] shadow-sm ring-1 ring-[#f0ddd0]"
                        : "hover:bg-stone-50")
                    }
                  >
                    {selected?.id === conversation.id && (
                      <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-[#a11c22]" />
                    )}
                    <Avatar conversation={conversation} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <strong className="truncate text-sm font-extrabold text-stone-800">
                          {conversation.username || "Unknown Customer"}
                        </strong>
                        <time
                          suppressHydrationWarning
                          className="shrink-0 text-[10px] font-medium text-stone-400"
                        >
                          {listTime(conversation.last_message_at)}
                        </time>
                      </span>
                      <span className="mt-1 block text-[10px]">
                        <PlatformBadge platform={conversation.platform} />
                      </span>
                      <span className="mt-1.5 flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-xs text-stone-500">
                          {conversation.last_message}
                        </span>
                        {(conversation.unread_count ?? 0) > 0 && (
                          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#9c1d22] px-1 text-[9px] font-bold text-white">
                            {conversation.unread_count}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                ))
              ) : (
                <div className="grid h-48 place-items-center px-8 text-center">
                  <div>
                    <SearchIcon className="mx-auto h-6 w-6 text-stone-300" />
                    <p className="mt-3 text-sm font-semibold text-stone-500">No conversations found</p>
                    <p className="mt-1 text-xs text-stone-400">Try another name or platform.</p>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section
            className={
              "h-full min-h-0 min-w-0 flex-col overflow-hidden bg-[#fbfaf7] " +
              (showChat ? "flex" : "hidden md:flex")
            }
          >
            {selected ? (
              <>
                <div className="glass-panel flex h-[76px] shrink-0 items-center gap-3 border-b border-stone-200 px-4 sm:px-5">
                  <button
                    onClick={() => setShowChat(false)}
                    className="mr-1 grid h-9 w-9 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 md:hidden"
                    aria-label="Back to conversations"
                  >
                    <ArrowLeftIcon className="h-5 w-5" />
                  </button>
                  <Avatar conversation={selected} large />
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-extrabold text-stone-900">
                      {selected.username || "Unknown Customer"}
                    </h2>
                    <div className="mt-1 flex items-center gap-2 text-[10px]">
                      <PlatformBadge platform={selected.platform} />
                      <span className="h-1 w-1 rounded-full bg-stone-300" />
                      <span className="flex items-center gap-1 font-semibold text-emerald-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Active
                      </span>
                    </div>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="hidden rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-[10px] font-bold text-stone-500 sm:block">
                      {selected.platform_user_id}
                    </span>
                    <button
                      className="grid h-9 w-9 place-items-center rounded-lg text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
                      aria-label="Conversation options"
                    >
                      <MoreIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div
                  ref={messageAreaRef}
                  onScroll={(event) => {
                    const area = event.currentTarget;
                    stickToBottomRef.current =
                      area.scrollHeight - area.scrollTop - area.clientHeight < 80;
                  }}
                  className="chat-wallpaper relative min-h-0 flex-1 overscroll-contain overflow-y-auto p-4 sm:p-6 lg:p-8"
                >
                  <div className="pointer-events-none absolute right-4 top-4 h-24 w-20 opacity-[0.06] sm:h-36 sm:w-28">
                    <Image
                      src="/brand/amt-rice-bag.png"
                      alt=""
                      fill
                      sizes="112px"
                      className="object-contain"
                    />
                  </div>

                  {loading ? (
                    <div className="space-y-4">
                      <div className="h-16 w-2/3 animate-pulse rounded-2xl bg-white/80 shadow-sm" />
                      <div className="ml-auto h-16 w-3/5 animate-pulse rounded-2xl bg-red-100/80" />
                      <div className="h-14 w-1/2 animate-pulse rounded-2xl bg-white/80 shadow-sm" />
                    </div>
                  ) : error ? (
                    <div className="grid h-full place-items-center text-sm font-semibold text-red-600">
                      {error}
                    </div>
                  ) : messages.length ? (
                    <div className="relative mx-auto max-w-3xl space-y-4">
                      <div className="flex justify-center pb-2">
                        <span className="rounded-full border border-white/80 bg-white/75 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-400 shadow-sm backdrop-blur">
                          Conversation history
                        </span>
                      </div>
                      {messages.map((message) => {
                        const outgoing = message.sender_type === "bot";

                        return (
                          <div
                            key={message.id}
                            className={"flex " + (outgoing ? "justify-end" : "justify-start")}
                          >
                            <div
                              className={
                                "max-w-[86%] px-4 py-3 shadow-sm sm:max-w-[70%] " +
                                (outgoing
                                  ? "rounded-2xl rounded-br-md bg-gradient-to-br from-[#9f1c22] to-[#761217] text-white"
                                  : "rounded-2xl rounded-bl-md border border-stone-200/90 bg-white text-stone-700")
                              }
                            >
                              <p className="text-[13px] leading-relaxed sm:text-sm">{message.message}</p>
                              <time
                                suppressHydrationWarning
                                className={
                                  "mt-1.5 block text-right text-[9px] font-medium " +
                                  (outgoing ? "text-red-100/80" : "text-stone-400")
                                }
                              >
                                {chatTime(message.created_at)}
                              </time>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyConversation />
                  )}
                </div>

                <div className="flex shrink-0 items-center justify-center gap-2 border-t border-stone-200 bg-white px-5 py-3 text-[11px] font-medium text-stone-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#c69235]" />
                  Read-only conversation history
                  <span className="hidden sm:inline">· Replies are not enabled</span>
                </div>
              </>
            ) : (
              <EmptyConversation />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

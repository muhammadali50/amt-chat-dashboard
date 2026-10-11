"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AnalyticsIcon,
  ChatIcon,
  MenuIcon,
  SettingsIcon,
  StoreIcon,
  VisitorsIcon
} from "@/components/icons";

const navigation = [
  { label: "Conversations", icon: ChatIcon, href: "/" },
  { label: "Website Visitors", icon: VisitorsIcon, href: "/visitors" },
  { label: "Analytics", icon: AnalyticsIcon, href: null },
  { label: "Settings", icon: SettingsIcon, href: null }
];

export function Sidebar({
  open,
  onToggle
}: {
  open: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {open && (
        <button
          aria-label="Close navigation"
          onClick={onToggle}
          className="fixed inset-0 z-30 bg-[#24100f]/50 backdrop-blur-sm md:hidden"
        />
      )}

      <aside
        className={
          "fixed inset-y-0 left-0 z-40 flex w-[278px] flex-col overflow-hidden bg-[#421014] text-white shadow-2xl transition-transform md:static md:w-[252px] md:translate-x-0 xl:w-[278px] " +
          (open ? "translate-x-0" : "-translate-x-full")
        }
      >
        <div className="absolute inset-0">
          <Image
            src="/brand/rice-fields.jpg"
            alt=""
            fill
            priority
            sizes="278px"
            className="object-cover opacity-[0.14]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#4f1015]/80 via-[#421014]/95 to-[#25090b]" />
        </div>

        <div className="relative z-10 flex h-[92px] shrink-0 items-center gap-3 border-b border-white/10 px-5">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-amber-300/70 bg-white shadow-lg shadow-black/20">
            <Image
              src="/brand/amt-logo.png"
              alt="A Mustafa Traders logo"
              fill
              priority
              sizes="56px"
              className="object-contain"
            />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-extrabold tracking-wide">A Mustafa Traders</p>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.17em] text-amber-300">
              Chat Dashboard
            </p>
          </div>
        </div>

        <nav className="relative z-10 space-y-2 p-4 pt-7">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
            Workspace
          </p>
          {navigation.map(({ label, icon: NavIcon, href }) => {
            const active = href !== null && pathname === href;
            const classes =
              "group flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-semibold transition " +
              (href
                ? active
                  ? "bg-gradient-to-r from-[#a82429] to-[#86191e] text-white shadow-lg shadow-black/20 ring-1 ring-white/10"
                  : "text-white/70 hover:bg-white/5 hover:text-white"
                : "cursor-not-allowed text-white/45");

            return href ? (
              <Link
                key={label}
                href={href}
                onClick={() => {
                  if (open) onToggle();
                }}
                aria-current={active ? "page" : undefined}
                className={classes}
              >
                <NavIcon className="h-5 w-5" />
                {label}
              </Link>
            ) : (
              <button key={label} disabled className={classes}>
                <NavIcon className="h-5 w-5" />
                {label}
                <span className="ml-auto rounded-full bg-white/5 px-2 py-0.5 text-[8px] uppercase tracking-wider text-white/35">
                  Soon
                </span>
              </button>
            );
          })}
        </nav>

        <div className="relative z-10 mx-4 mt-4 overflow-hidden rounded-2xl border border-amber-300/20 bg-white/[0.07] p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-400/15 text-amber-300">
              <StoreIcon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-bold">Customer support</p>
              <p className="mt-1 flex items-center gap-1.5 text-[10px] text-white/50">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                System online
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-auto overflow-hidden border-t border-white/10 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-amber-100 text-xs font-extrabold text-[#79161b]">
              AM
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold">A Mustafa Admin</p>
              <p className="truncate text-[10px] text-white/40">admin@amtraders.pk</p>
            </div>
          </div>
        </div>
      </aside>

      <button
        onClick={onToggle}
        className="fixed left-4 top-4 z-20 grid h-10 w-10 place-items-center rounded-xl border border-stone-200 bg-white text-[#8f171d] shadow-lg md:hidden"
        aria-label="Open navigation"
      >
        <MenuIcon className="h-5 w-5" />
      </button>
    </>
  );
}


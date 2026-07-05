"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RingAvatar } from "@/components/RingAvatar";
import { HomeIcon, ChatIcon, GraphIcon, PeopleIcon } from "@/components/icons";
import { SettingsIcon, PlusIcon } from "@/components/icons-desktop";

const NAV = [
  { label: "Home", href: "/", Icon: HomeIcon, enabled: true },
  { label: "People", href: "/people", Icon: PeopleIcon, enabled: false },
  { label: "Graph", href: "/graph", Icon: GraphIcon, enabled: false },
  { label: "Chat", href: "/chat", Icon: ChatIcon, enabled: true },
  { label: "Settings", href: "/settings", Icon: SettingsIcon, enabled: false },
] as const;

export function DesktopSidebar({
  name,
  secondary,
}: {
  name: string;
  secondary: string;
}) {
  const pathname = usePathname();
  const clean = pathname.replace(/^\/(m|d)(?=\/|$)/, "") || "/";

  return (
    <aside className="glass rounded-[28px] w-[220px] shrink-0 sticky top-6 h-[calc(100dvh-48px)] min-h-[560px] flex flex-col px-[10px] pt-[26px] pb-[22px]">
      <p className="font-semibold text-[20px] text-ink px-3">Hefesto</p>

      <nav className="mt-[54px] flex flex-col gap-2">
        {NAV.map(({ label, href, Icon, enabled }) => {
          const active = clean === href;
          const inner = (
            <span
              className={`flex items-center gap-4 h-11 rounded-[22px] px-3 ${
                active ? "bg-white" : "opacity-50"
              }`}
            >
              <Icon color={active ? "var(--orange)" : "var(--ink)"} />
              <span className="text-[13.5px] font-medium text-ink">{label}</span>
            </span>
          );
          return enabled ? (
            <Link key={label} href={href}>
              {inner}
            </Link>
          ) : (
            <span key={label} aria-disabled="true">
              {inner}
            </span>
          );
        })}
      </nav>

      <button
        type="button"
        className="mt-auto mx-3 h-11 rounded-[22px] bg-ember text-cream text-[13px] font-medium flex items-center justify-center gap-2"
      >
        <PlusIcon color="#F6F1E8" />
        Capture
      </button>

      <div className="flex items-center gap-3 px-3 mt-9">
        <RingAvatar initial={(name[0] ?? "H").toUpperCase()} />
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-ink truncate">{name}</p>
          <p className="text-[10.5px] text-muted truncate">{secondary}</p>
        </div>
      </div>
    </aside>
  );
}

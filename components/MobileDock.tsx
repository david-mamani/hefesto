"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeIcon, ChatIcon, GraphIcon, PeopleIcon } from "@/components/icons";

const ITEMS = [
  { label: "Home", href: "/", Icon: HomeIcon, enabled: true },
  { label: "Chat", href: "/chat", Icon: ChatIcon, enabled: true },
  { label: "Graph", href: "/graph", Icon: GraphIcon, enabled: true },
  { label: "People", href: "/people", Icon: PeopleIcon, enabled: true },
] as const;

export function MobileDock() {
  const pathname = usePathname();
  const clean = pathname.replace(/^\/(m|d)(?=\/|$)/, "") || "/";

  return (
    <nav className="fixed bottom-[18px] left-1/2 -translate-x-1/2 w-[330px] h-[68px] glass rounded-[34px] grid grid-cols-4 items-center px-2 z-40">
      {ITEMS.map(({ label, href, Icon, enabled }) => {
        const active = clean === href || (href !== "/" && clean.startsWith(`${href}/`));
        const tone = active ? "var(--orange)" : "rgba(28,22,17,0.45)";
        const content = (
          <span className="flex flex-col items-center gap-[4px]">
            <Icon color={tone} />
            <span
              className="text-[9.5px] font-medium"
              style={{ color: active ? "var(--ink)" : "rgba(28,22,17,0.45)" }}
            >
              {label}
            </span>
          </span>
        );
        return enabled ? (
          <Link key={label} href={href} className="flex justify-center py-2">
            {content}
          </Link>
        ) : (
          <span key={label} className="flex justify-center py-2" aria-disabled="true">
            {content}
          </span>
        );
      })}
    </nav>
  );
}

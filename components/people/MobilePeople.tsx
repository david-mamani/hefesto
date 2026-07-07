"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { NetworkPerson } from "@/lib/network";
import { compactGap, subtitleFor } from "@/lib/person";
import { RingAvatar } from "@/components/RingAvatar";
import { SearchIcon } from "@/components/icons-desktop";

/*
 * People list (Figma M06): search, cluster pills, and one glass row per person
 * — ring avatar, name, what-you-know subtitle, compact recency.
 */

const FILTERS = ["all", "work", "personal", "family"] as const;
type Filter = (typeof FILTERS)[number];

export function MobilePeople({ people }: { people: NetworkPerson[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people.filter(
      (p) =>
        (filter === "all" || (p.cluster ?? "personal") === filter) &&
        (!q || p.name.toLowerCase().includes(q))
    );
  }, [people, query, filter]);

  return (
    <>
      <div className="rounded-full h-12 flex items-center gap-3 px-2 mt-4 bg-input border border-(--input-border)">
        <span className="size-8 shrink-0 rounded-full bg-white grid place-items-center">
          <SearchIcon color="var(--ink)" />
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people…"
          className="flex-1 min-w-0 bg-transparent text-[13px] text-ink placeholder:text-muted focus:outline-none"
        />
      </div>

      <div className="flex items-center gap-[10px] mt-4">
        {FILTERS.map((f) => {
          const active = filter === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`h-[34px] px-[16px] rounded-[17px] text-[12.5px] font-medium capitalize ${
                active ? "bg-ember text-cream" : "bg-white/55 border border-white/90 text-ink"
              }`}
            >
              {f}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 mt-4 pb-[110px]">
        {visible.length === 0 && (
          <p className="text-[13px] text-muted text-center mt-10">
            {people.length === 0
              ? "No one here yet — capture someone you met."
              : "No one matches that."}
          </p>
        )}
        {visible.map((person) => (
          <Link
            key={person.personId}
            href={`/people/${person.personId}`}
            className="glass rounded-[22px] h-[66px] flex items-center gap-[14px] px-[14px]"
          >
            <RingAvatar initial={person.initial} size={40} />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-[15px] text-ink truncate">
                {person.name}
              </span>
              <span className="block text-[11.5px] text-muted truncate mt-[1px]">
                {subtitleFor(person) || "No details yet"}
              </span>
            </span>
            <span className="text-[10.5px] text-muted self-start mt-[22px]">
              {compactGap(person.warmth.days)}
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}

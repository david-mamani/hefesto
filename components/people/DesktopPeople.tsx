"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { NetworkPerson, PersonDetail } from "@/lib/network";
import {
  knowledgeLines,
  personTitle,
  affinityCaption,
  compactGap,
  subtitleFor,
} from "@/lib/person";
import { RingAvatar } from "@/components/RingAvatar";
import { Briefing } from "@/components/Briefing";
import { ForgetModal } from "@/components/ForgetModal";
import { ChevronRightIcon } from "@/components/icons";
import { SearchIcon } from "@/components/icons-desktop";
import { applyMode, clusterToMode } from "@/lib/mascot";

/*
 * Desktop People (Figma M10b): master list with search + cluster pills on the
 * left, the person card panel on the right. Rows are links — selection is the
 * ?person= search param so the detail loads server-side.
 */

const MODE_GLOW: Record<string, string> = {
  work: "#2f6bff",
  personal: "#f07e12",
  family: "#3fb57f",
};

const FILTERS = ["all", "work", "personal", "family"] as const;
type Filter = (typeof FILTERS)[number];

function timelineDate(iso: string): string {
  return new Date(iso)
    .toLocaleDateString("en-US", { month: "short", day: "numeric" })
    .toUpperCase();
}

export function DesktopPeople({
  people,
  detail,
}: {
  people: NetworkPerson[];
  detail: PersonDetail | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [forgetOpen, setForgetOpen] = useState(false);
  const [forgetBusy, setForgetBusy] = useState(false);
  const [draftHint, setDraftHint] = useState(false);

  // The selected person's cluster tints the panel accents (PRD §11).
  useEffect(() => {
    applyMode(clusterToMode(detail?.person.cluster));
    return () => applyMode("personal");
  }, [detail?.person.cluster]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people.filter(
      (p) =>
        (filter === "all" || (p.cluster ?? "personal") === filter) &&
        (!q || p.name.toLowerCase().includes(q))
    );
  }, [people, query, filter]);

  const coolingDown = people.filter((p) => p.warmth.band !== "warm").length;
  const person = detail?.person ?? null;
  const timeline = detail?.timeline.slice(-3) ?? [];

  function stubDraft() {
    setDraftHint(true);
    setTimeout(() => setDraftHint(false), 2600);
  }

  async function confirmForget() {
    if (!person) return;
    setForgetBusy(true);
    try {
      await fetch("/api/forget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId: person.personId }),
      });
    } finally {
      setForgetBusy(false);
      setForgetOpen(false);
      router.push("/people");
      router.refresh();
    }
  }

  return (
    <div className="pt-[20px]">
      <h1 className="font-semibold text-[28px] text-ink">People</h1>
      <p className="text-[13px] text-muted mt-1">
        {people.length} {people.length === 1 ? "person" : "people"} · {coolingDown} cooling down
      </p>

      <div className="flex items-center gap-[8px] mt-[20px]">
        <div className="bg-[#F3EDE3] border border-white/90 rounded-[24px] h-12 w-[430px] flex items-center gap-3 px-2">
          <span className="size-8 rounded-full bg-white grid place-items-center shrink-0">
            <SearchIcon color="var(--ink)" />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people…"
            className="flex-1 min-w-0 bg-transparent text-[13px] text-ink placeholder:text-muted focus:outline-none"
          />
        </div>

        <div className="ml-[30px] flex items-center gap-[8px]">
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
      </div>

      <div className="flex gap-10 mt-[24px] items-start">
        {/* master list */}
        <div className="flex flex-col gap-3 w-[480px] shrink-0">
          {visible.length === 0 && (
            <p className="text-[13px] text-muted mt-6">
              {people.length === 0
                ? "No one here yet — capture someone you met."
                : "No one matches that."}
            </p>
          )}
          {visible.map((p) => {
            const selected = p.personId === person?.personId;
            const glow = MODE_GLOW[p.cluster ?? "personal"] ?? MODE_GLOW.personal;
            return (
              <Link
                key={p.personId}
                href={`/people?person=${p.personId}`}
                scroll={false}
                className={`glass rounded-[22px] h-[72px] flex items-center gap-[14px] px-[14px] ${
                  selected ? "!border-[rgba(240,126,18,0.9)]" : ""
                }`}
              >
                <span
                  className="grid place-items-center size-[44px] rounded-full text-[14px] font-semibold text-ink shrink-0"
                  style={{
                    backgroundColor: p.warmth.color,
                    boxShadow: `0 0 20px 4px ${glow}45, 0 8px 18px rgba(51,31,10,0.14)`,
                  }}
                >
                  {p.initial}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-[15px] text-ink truncate">
                    {p.name}
                  </span>
                  <span className="block text-[11.5px] text-muted truncate mt-[1px]">
                    {subtitleFor(p) || "No details yet"}
                  </span>
                </span>
                <span className="text-[10.5px] text-muted self-start mt-[16px]">
                  {compactGap(p.warmth.days)}
                </span>
                <ChevronRightIcon color="#1C1611" />
              </Link>
            );
          })}
        </div>

        {/* detail panel */}
        {person && (
          <aside className="glass rounded-[28px] flex-1 max-w-[600px] px-[30px] pt-[28px] pb-[30px]">
            <div className="flex items-start gap-5">
              <RingAvatar initial={person.initial} size={72} />
              <div className="min-w-0 pt-[4px]">
                <p className="font-semibold text-[24px] text-ink leading-tight truncate">
                  {person.name}
                </p>
                <p className="text-[13px] text-muted mt-[4px]">{personTitle(person)}</p>
              </div>
              <span className="ml-[40px] shrink-0 inline-grid place-items-center h-[34px] px-[18px] rounded-[17px] bg-white/55 border border-white/90 text-[12.5px] font-medium text-ink capitalize mt-[6px]">
                {person.cluster ?? "personal"}
              </span>
            </div>

            <section
              className="relative overflow-hidden h-[90px] rounded-[22px] shadow-[0px_16px_38px_0px_rgba(51,31,10,0.16)] mt-[26px] px-5"
              style={{
                background:
                  "linear-gradient(180deg, color-mix(in srgb, var(--color-mode) 46%, white) 0%, var(--color-mode) 100%)",
              }}
            >
              <p className="text-[10px] font-medium tracking-[1px] text-white pt-[14px]">
                AFFINITY
              </p>
              <div className="flex items-center gap-4">
                <p className="font-light text-[36px] text-white leading-tight">
                  {person.warmth.score}
                </p>
                <p className="text-[12px] text-white">{affinityCaption(person.warmth.band)}</p>
                <span className="relative ml-auto h-[5px] w-[190px] rounded-[2.5px] bg-white/35">
                  <span
                    className="absolute inset-y-0 left-0 rounded-[2.5px] bg-white"
                    style={{ width: `${Math.max(4, person.warmth.score)}%` }}
                  />
                </span>
              </div>
            </section>

            <p className="micro-label text-[10px] tracking-[1px] mt-[26px]">What I know</p>
            <ul className="mt-[12px] flex flex-col gap-[13px]">
              {knowledgeLines(person).map((line) => (
                <li key={line} className="flex items-start gap-[11px]">
                  <span className="size-[7px] rounded-full mt-[5px] shrink-0" style={{ background: "var(--color-mode)" }} />
                  <span className="text-[13px] text-ink leading-snug">{line}</span>
                </li>
              ))}
              {knowledgeLines(person).length === 0 && (
                <li className="text-[13px] text-muted">
                  Nothing yet — capture something about {person.name.split(/\s+/)[0]}.
                </li>
              )}
            </ul>

            <p className="micro-label text-[10px] tracking-[1px] mt-[24px]">Timeline</p>
            <ul className="mt-[12px] flex flex-col gap-[16px]">
              {timeline.length === 0 && (
                <li className="text-[12.5px] text-muted">
                  The story starts with your next capture.
                </li>
              )}
              {timeline.map((entry, index) => (
                <li key={`${entry.date}-${index}`} className="flex items-baseline gap-[12px]">
                  <span className="size-[8px] rounded-full shrink-0 self-center" style={{ background: "var(--color-mode)" }} />
                  <span className="micro-label text-[9px] tracking-[0.9px] w-[52px] shrink-0">
                    {timelineDate(entry.date)}
                  </span>
                  <span className="text-[12.5px] text-ink leading-snug">{entry.text}</span>
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-3 mt-[30px]">
              <button
                type="button"
                onClick={stubDraft}
                className="h-[54px] px-[28px] rounded-[27px] bg-ember text-cream text-[15px] font-medium"
              >
                Draft message
              </button>
              <button
                type="button"
                onClick={stubDraft}
                aria-label="Draft message"
                className="size-[54px] rounded-full bg-ember grid place-items-center"
              >
                <ChevronRightIcon color="#F6F1E8" />
              </button>
              <button
                type="button"
                onClick={() => setBriefingOpen(true)}
                className="h-[54px] px-[26px] rounded-[27px] bg-white text-[12.5px] font-medium text-[#1C1611] ml-[10px]"
              >
                Briefing
              </button>
              <button
                type="button"
                onClick={() => setForgetOpen(true)}
                className="text-[12px] font-medium text-muted ml-[8px]"
              >
                Forget person
              </button>
            </div>

            {draftHint && (
              <p className="text-[11px] text-muted mt-[12px]">
                Message drafting arrives with briefings — soon.
              </p>
            )}
          </aside>
        )}
      </div>

      {briefingOpen && person && (
        <Briefing personId={person.personId} onClose={() => setBriefingOpen(false)} />
      )}

      {forgetOpen && person && (
        <ForgetModal
          name={person.name}
          initial={person.initial}
          memoryCount={person.memoryCount}
          busy={forgetBusy}
          onConfirm={confirmForget}
          onCancel={() => setForgetOpen(false)}
        />
      )}
    </div>
  );
}

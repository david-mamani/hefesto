"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EmberGlow } from "@/components/EmberGlow";
import { WarmthChart } from "@/components/WarmthChart";
import { NetworkWidget } from "@/components/NetworkWidget";
import { RingAvatar } from "@/components/RingAvatar";
import { AskBar } from "@/components/AskBar";
import { Briefing } from "@/components/Briefing";
import { ChevronRightIcon } from "@/components/icons";
import type { NetworkPerson } from "@/lib/network";
import type { Nudge } from "@/lib/warmth";
import { knowledgeLines } from "@/lib/person";
import { nudgesEnabled } from "@/lib/theme";

/*
 * Desktop Home (Figma M10) — the dashboard, fed by the live person registry:
 * stat cards, today's briefing entry, the follow-up nudge, recent people, and
 * the "Your network" ember widget.
 */

// Honest copy before the first capture exists — no fabricated people.
const EMPTY = {
  meetingTitle: "Your first briefing",
  meetingNote: "Capture someone you met — I'll prep you before you meet them again.",
};

function healthNote(series: number[], peopleCount: number): string {
  if (peopleCount === 0) return "no memories yet";
  const first = series[0] ?? 0;
  const last = series[series.length - 1] ?? 0;
  if (last - first >= 5) return "improving steadily";
  if (first - last >= 5) return "cooling down";
  return last >= 70 ? "glowing warm" : "holding steady";
}

export function DesktopHome({
  greeting,
  firstName,
  people,
  nudge,
  healthSeries,
}: {
  greeting: string;
  firstName: string;
  people: NetworkPerson[];
  nudge: Nudge | null;
  healthSeries: number[];
}) {
  const [briefingId, setBriefingId] = useState<string | null>(null);

  // On open, push the cold-contact nudge to the user's linked Telegram
  // (server-side: max one proactive push per day).
  useEffect(() => {
    if (!nudgesEnabled()) return;
    fetch("/api/nudge", { method: "POST" }).catch(() => {});
  }, []);

  const followUps = people.filter((p) => p.warmth.band === "cold").length;
  const health = healthSeries[healthSeries.length - 1] ?? 0;
  const featured = people[0] ?? null;
  const featuredNote = featured ? knowledgeLines(featured, 2).join(" · ") : "";
  const recent = people.slice(0, 5);

  const summary =
    people.length === 0
      ? "Capture the first person you meet — Hefesto remembers"
      : `${people.length} ${people.length === 1 ? "person" : "people"} in your memory · ${followUps} to follow up`;

  return (
    <div className="pt-[20px]">
      <h1 className="font-semibold text-[28px] text-ink">
        {greeting}, {firstName}
      </h1>
      <p className="text-[13px] text-muted mt-1">{summary}</p>

      <AskBar />

      <div className="grid grid-cols-[330px_330px_minmax(360px,420px)] gap-5 mt-[26px] max-[1280px]:grid-cols-2 max-[1280px]:max-w-[680px]">
        <section className="relative overflow-hidden h-[150px] rounded-[26px] bg-gradient-to-b from-peach to-orange shadow-[0px_16px_38px_0px_rgba(51,31,10,0.16)] p-6 text-white">
          <p className="text-[10px] font-medium tracking-[1px] uppercase">People</p>
          <p className="font-light text-[56px] leading-none mt-2">{people.length}</p>
          <p className="text-[12px] absolute left-6 bottom-3">in your memory</p>
        </section>

        <section className="relative h-[150px] rounded-[26px] bg-ember shadow-[0px_16px_38px_0px_rgba(51,31,10,0.2)] p-6">
          <p className="text-[10px] font-medium tracking-[1px] uppercase text-muted">
            To follow up
          </p>
          <p className="font-light text-[56px] leading-none mt-2 text-cream">{followUps}</p>
          <div className="absolute left-6 right-6 bottom-[23px] h-[5px] rounded-full bg-[#3A332B]">
            <div
              className="h-full rounded-full bg-yellow"
              style={{
                width: `${people.length ? Math.min(100, Math.round((followUps / people.length) * 100)) : 0}%`,
              }}
            />
          </div>
        </section>

        <section className="relative h-[150px] glass rounded-[26px] px-[22px] pt-[16px] overflow-hidden">
          <p className="micro-label text-[10px] tracking-[1px]">Memory health</p>
          <div className="flex items-baseline gap-4">
            <p className="font-light text-[56px] leading-tight text-ink">{health}</p>
            <p className="text-[12.5px] text-muted">{healthNote(healthSeries, people.length)}</p>
          </div>
          <WarmthChart
            points={people.length ? healthSeries : undefined}
            className="absolute left-[22px] right-[22px] top-[74px] h-[58px] w-[calc(100%-44px)]"
          />
          <p className="micro-label absolute left-[22px] bottom-[11px] text-[8.5px] tracking-[0.85px]">
            Network warmth · Last 30 days
          </p>
        </section>
      </div>

      <div className="flex gap-5 mt-6 items-start max-[1280px]:flex-col">
        <div className="flex-1 max-w-[620px] min-w-0">
          <p className="micro-label text-[10px] tracking-[1px]">Today</p>

          <section className="relative overflow-hidden rounded-[26px] bg-surface-soft shadow-[0px_16px_38px_0px_rgba(51,31,10,0.08)] h-[160px] mt-[14px]">
            <EmberGlow className="w-[300px] h-[110px] right-[-100px] bottom-[-40px]" />
            <div className="absolute left-4 top-4 w-[110px] h-[128px] glass rounded-[20px]">
              <p className="font-light text-[24px] text-ink absolute left-[12px] top-[8px]">4:00</p>
              <p className="text-[10.5px] text-muted absolute left-[12px] top-[40px]">PM today</p>
              <p className="micro-label text-[8.5px] tracking-[0.85px] absolute left-[12px] bottom-[14px]">
                Briefing
              </p>
            </div>
            <p className="absolute left-[150px] top-[30px] font-semibold text-[17px] text-ink">
              {featured ? `Coffee with ${featured.name}` : EMPTY.meetingTitle}
            </p>
            <p className="absolute left-[150px] top-[62px] w-[330px] text-[12.5px] text-muted">
              {featured ? featuredNote || "You'll know more after the next capture" : EMPTY.meetingNote}
            </p>
            <p className="micro-label absolute left-[150px] bottom-[24px] text-[10px] tracking-[1px]">
              View briefing
            </p>
            <button
              type="button"
              aria-label="Open briefing"
              disabled={!featured}
              onClick={() => featured && setBriefingId(featured.personId)}
              className="absolute right-[24px] bottom-[16px] size-11 rounded-full bg-ember grid place-items-center"
            >
              <ChevronRightIcon color="#F6F1E8" />
            </button>
          </section>

          <section className="relative glass rounded-[26px] h-[120px] mt-5 px-[18px]">
            <p className="micro-label absolute left-[18px] top-[14px] text-[10px] tracking-[1px]">
              Follow-up
            </p>
            <p className="absolute left-[18px] top-[36px] font-semibold text-[16px] text-ink">
              {nudge ? `Reconnect with ${nudge.name.split(" · ")[0].split(/\s+/)[0]}` : "Nobody is going cold"}
            </p>
            <p className="absolute left-[18px] top-[64px] text-[12.5px] text-muted">
              {nudge
                ? `No contact in ${nudge.warmth.gap} · ${nudge.cluster ?? "personal"}`
                : "Your network is warm — keep capturing"}
            </p>
            {nudge && (
              <button
                type="button"
                aria-label="Open follow-up briefing"
                onClick={() => setBriefingId(nudge.personId)}
                className="absolute right-[26px] top-[36px] size-11 rounded-full bg-ember grid place-items-center"
              >
                <ChevronRightIcon color="#F6F1E8" />
              </button>
            )}
          </section>

          <p className="micro-label mt-[26px] text-[10px] tracking-[1px]">Recent</p>
          <div className="flex gap-[42px] mt-[14px]">
            {recent.length === 0 && (
              <p className="text-[12.5px] text-muted">The people you capture will appear here.</p>
            )}
            {recent.map((person) => (
              <Link
                key={person.personId}
                href={`/people?person=${person.personId}`}
                className="text-center w-12"
              >
                <RingAvatar initial={person.initial} size={48} />
                <p className="text-[10.5px] font-medium text-ink mt-1 truncate">
                  {person.name.split(" · ")[0].split(/\s+/)[0]}
                </p>
              </Link>
            ))}
          </div>
        </div>

        <NetworkWidget people={people} />
      </div>

      {briefingId && <Briefing personId={briefingId} onClose={() => setBriefingId(null)} />}
    </div>
  );
}

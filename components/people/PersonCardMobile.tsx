"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PersonDetail } from "@/lib/network";
import { knowledgeLines, personTitle, affinityCaption } from "@/lib/person";
import { applyMode, clusterToMode } from "@/lib/mascot";
import { RingAvatar } from "@/components/RingAvatar";
import { Briefing } from "@/components/Briefing";
import { ForgetModal } from "@/components/ForgetModal";
import { ChevronRightIcon } from "@/components/icons";

/*
 * Person card (Figma M07): identity, affinity ember card, what-I-know bullets,
 * capture timeline, and the action row. Forget is the real thing (M13).
 */

function timelineDate(iso: string): string {
  return new Date(iso)
    .toLocaleDateString("en-US", { month: "short", day: "numeric" })
    .toUpperCase();
}

export function PersonCardMobile({ detail }: { detail: PersonDetail }) {
  const router = useRouter();
  const { person, timeline } = detail;
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [forgetOpen, setForgetOpen] = useState(false);
  const [forgetBusy, setForgetBusy] = useState(false);
  const [draftHint, setDraftHint] = useState(false);

  const knowledge = knowledgeLines(person);
  const recentTimeline = timeline.slice(-4);

  // Opening a person adopts their cluster's mode: the affinity glow and the
  // accents tint blue / orange / green (PRD §11). Default returns on close.
  useEffect(() => {
    applyMode(clusterToMode(person.cluster));
    return () => applyMode("personal");
  }, [person.cluster]);

  function stubDraft() {
    setDraftHint(true);
    setTimeout(() => setDraftHint(false), 2600);
  }

  async function confirmForget() {
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
    <main className="px-6 pb-[110px]">
      <Link href="/people" aria-label="Back to people" className="inline-block pt-[52px] py-2 pr-4">
        <svg width="10" height="20" viewBox="0 0 10 20" fill="none" aria-hidden="true">
          <path
            d="M9 1L1.5 10L9 19"
            stroke="#1C1611"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Link>

      <div className="flex items-start gap-4 mt-[8px]">
        <RingAvatar initial={person.initial} size={64} />
        <div className="min-w-0 pt-[2px]">
          <h1 className="font-semibold text-[22px] text-ink leading-tight truncate">
            {person.name}
          </h1>
          <p className="text-[12.5px] text-muted mt-[2px]">{personTitle(person)}</p>
          <span className="inline-grid place-items-center h-[34px] px-[18px] rounded-[17px] bg-white/55 border border-white/90 text-[12.5px] font-medium text-ink capitalize mt-[8px]">
            {person.cluster ?? "personal"}
          </span>
        </div>
      </div>

      <section
        className="relative overflow-hidden h-[96px] rounded-[24px] shadow-[0px_16px_38px_0px_rgba(51,31,10,0.16)] mt-[22px] px-5"
        style={{
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--color-mode) 46%, white) 0%, var(--color-mode) 100%)",
        }}
      >
        <p className="text-[10px] font-medium tracking-[1px] text-white pt-[14px]">AFFINITY</p>
        <div className="flex items-center gap-[28px]">
          <p className="font-light text-[40px] text-white leading-tight">{person.warmth.score}</p>
          <p className="text-[12px] text-white">{affinityCaption(person.warmth.band)}</p>
          <span className="relative ml-auto h-[5px] w-[120px] rounded-[2.5px] bg-white/35">
            <span
              className="absolute inset-y-0 left-0 rounded-[2.5px] bg-white"
              style={{ width: `${Math.max(4, person.warmth.score)}%` }}
            />
          </span>
        </div>
      </section>

      <p className="micro-label text-[10px] tracking-[1px] mt-[24px]">What I know</p>
      <section className="glass rounded-[24px] px-[18px] py-[15px] mt-[10px]">
        {knowledge.length === 0 && (
          <p className="text-[13px] text-muted">
            Nothing yet — capture something about {person.name.split(/\s+/)[0]}.
          </p>
        )}
        <ul className="flex flex-col gap-[13px]">
          {knowledge.map((line) => (
            <li key={line} className="flex items-start gap-[13px]">
              <span className="size-[7px] rounded-full mt-[5px] shrink-0" style={{ background: "var(--color-mode)" }} />
              <span className="text-[13px] text-ink leading-snug">{line}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="micro-label text-[10px] tracking-[1px] mt-[22px]">Timeline</p>
      <section className="glass rounded-[24px] px-[16px] py-[16px] mt-[10px]">
        {recentTimeline.length === 0 && (
          <p className="text-[12.5px] text-muted">The story starts with your next capture.</p>
        )}
        <ul>
          {recentTimeline.map((entry, index) => (
            <li key={`${entry.date}-${index}`} className="relative pl-[22px] pb-[16px] last:pb-0">
              {index < recentTimeline.length - 1 && (
                <span className="absolute left-[4px] top-[14px] bottom-0 w-[1.5px] bg-ink/15" />
              )}
              <span className="absolute left-0 top-[4px] size-[9px] rounded-full" style={{ background: "var(--color-mode)" }} />
              <p className="micro-label text-[9px] tracking-[0.9px]">{timelineDate(entry.date)}</p>
              <p className="text-[12.5px] text-ink leading-snug mt-[2px]">{entry.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex items-center gap-2 mt-[24px]">
        <button
          type="button"
          onClick={stubDraft}
          className="flex-1 h-[54px] px-[28px] rounded-[27px] bg-ember text-cream text-[15px] font-medium whitespace-nowrap text-left"
        >
          Draft message
        </button>
        <button
          type="button"
          onClick={() => setBriefingOpen(true)}
          aria-label="Open briefing"
          className="size-[54px] rounded-full bg-ember grid place-items-center shrink-0"
        >
          <ChevronRightIcon color="#F6F1E8" />
        </button>
        <Link
          href="/"
          className="h-[54px] w-[88px] rounded-[27px] bg-white text-[12.5px] font-medium text-[#1C1611] grid place-items-center ml-3 shrink-0 whitespace-nowrap"
        >
          Log update
        </Link>
      </div>

      {draftHint && (
        <p className="text-[11px] text-muted mt-[10px]">
          Message drafting arrives with briefings — soon.
        </p>
      )}

      <button
        type="button"
        onClick={() => setForgetOpen(true)}
        className="block mx-auto mt-[22px] text-[12px] font-medium text-muted"
      >
        Forget person
      </button>

      {briefingOpen && (
        <Briefing personId={person.personId} onClose={() => setBriefingOpen(false)} />
      )}

      {forgetOpen && (
        <ForgetModal
          name={person.name}
          initial={person.initial}
          memoryCount={person.memoryCount}
          busy={forgetBusy}
          onConfirm={confirmForget}
          onCancel={() => setForgetOpen(false)}
        />
      )}
    </main>
  );
}

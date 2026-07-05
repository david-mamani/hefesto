import { createClient } from "@/lib/supabase/server";
import { RingAvatar } from "@/components/RingAvatar";
import { EmberGlow } from "@/components/EmberGlow";
import { HefestoSprite } from "@/components/HefestoSprite";
import { SpeechBubble } from "@/components/SpeechBubble";
import { Composer } from "@/components/Composer";
import { ChevronRightIcon } from "@/components/icons";

// Placeholder content matching the design frame — replaced by live data
// (briefings, nudges) once capture and the person registry are wired up.
const PLACEHOLDER = {
  meeting: {
    time: "4:00",
    when: "PM · today",
    title: "Coffee with Ana García",
    note: "Dog Toby was sick · hiring a designer",
  },
  greeting: "You meet Ana at 4:00 — want your briefing?",
  suggestion: { text: "Reconnect with Jorge — 2 months", cluster: "Family" },
};

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "";
  const initial = (displayName[0] ?? "H").toUpperCase();

  return (
    <main className="px-6">
      <header className="flex items-center gap-3 pt-12">
        <RingAvatar initial={initial} />
        <h1 className="font-semibold text-[26px] text-ink">Hefesto</h1>
      </header>

      <p className="micro-label mt-6 text-[10px] tracking-[1px]">Next meeting</p>

      <section className="relative overflow-hidden h-[150px] rounded-[26px] bg-surface-soft shadow-[0px_16px_38px_0px_rgba(51,31,10,0.08)] mt-[6px]">
        <EmberGlow className="w-[220px] h-[90px] right-[-49px] bottom-[-30px]" />

        <div className="absolute left-[14px] top-[14px] w-[118px] h-[122px] glass rounded-[20px]">
          <p className="font-light text-[26px] text-ink absolute left-[12px] top-[8px]">
            {PLACEHOLDER.meeting.time}
          </p>
          <p className="text-[11px] text-muted absolute left-[12px] top-[42px]">
            {PLACEHOLDER.meeting.when}
          </p>
          <p className="micro-label text-[9px] tracking-[0.9px] absolute left-[12px] bottom-[12px]">
            Briefing
          </p>
        </div>

        <p className="absolute left-[148px] top-[26px] w-[122px] font-semibold text-[15px] text-ink leading-normal">
          {PLACEHOLDER.meeting.title}
        </p>
        <p className="absolute left-[148px] top-[76px] w-[120px] text-[11.5px] text-muted leading-normal">
          {PLACEHOLDER.meeting.note}
        </p>

        <button
          type="button"
          aria-label="Open briefing"
          className="absolute right-[14px] bottom-[16px] size-10 rounded-full bg-ember grid place-items-center"
        >
          <ChevronRightIcon color="#F6F1E8" />
        </button>
      </section>

      <div className="flex justify-center mt-[10px]">
        <SpeechBubble>{PLACEHOLDER.greeting}</SpeechBubble>
      </div>

      <div className="flex justify-center -mt-[7px]">
        <HefestoSprite scale={6} />
      </div>

      <p className="micro-label -mt-3 text-[10px] tracking-[1px]">Suggested</p>

      <section className="relative h-[74px] glass rounded-[22px] mt-[5px]">
        <p className="absolute left-[18px] top-[10px] font-medium text-[13px] text-ink">
          {PLACEHOLDER.suggestion.text}
        </p>
        <span className="absolute left-[18px] top-[34px] h-[30px] px-[14px] rounded-full bg-white text-[12px] font-medium text-[#1C1611] grid place-items-center">
          {PLACEHOLDER.suggestion.cluster}
        </span>
        <span className="absolute right-[24px] top-1/2 -translate-y-1/2 text-ink">
          <ChevronRightIcon color="#1C1611" />
        </span>
      </section>

      <div className="mt-[26px]">
        <Composer />
      </div>
    </main>
  );
}

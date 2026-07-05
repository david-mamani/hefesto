import { createClient } from "@/lib/supabase/server";
import { EmberGlow } from "@/components/EmberGlow";
import { WarmthChart } from "@/components/WarmthChart";
import { NetworkWidget } from "@/components/NetworkWidget";
import { RingAvatar } from "@/components/RingAvatar";
import { AskBar } from "@/components/AskBar";
import { ChevronRightIcon } from "@/components/icons";

// Placeholder content matching the dashboard frame — replaced by live data
// (person registry, briefings, warmth) as capture and the graph come online.
const PLACEHOLDER = {
  summary: "2 briefings · 1 follow-up today",
  people: 42,
  followUps: 3,
  health: 68,
  meeting: {
    time: "4:00",
    when: "PM today",
    title: "Coffee with Ana García",
    note: "Dog Toby was sick · she's hiring a designer",
  },
  followUp: { title: "Reconnect with Jorge", note: "No contact in 2 months · family" },
  recent: [
    { initial: "A", label: "Ana" },
    { initial: "L", label: "Leo" },
    { initial: "M", label: "Mom" },
    { initial: "C", label: "Carlos" },
    { initial: "S", label: "Sofía" },
  ],
};

function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 19) return "Good afternoon";
  return "Good evening";
}

export default async function DesktopHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const fullName = (user?.user_metadata?.full_name as string | undefined) ?? "";
  const firstName = (fullName || user?.email?.split("@")[0] || "there").split(" ")[0];
  const greeting = greetingForHour(new Date().getHours());

  return (
    <div className="pt-[20px]">
      <h1 className="font-semibold text-[28px] text-ink">
        {greeting}, {firstName}
      </h1>
      <p className="text-[13px] text-muted mt-1">{PLACEHOLDER.summary}</p>

      <AskBar />

      <div className="grid grid-cols-[330px_330px_minmax(360px,420px)] gap-5 mt-[26px] max-[1280px]:grid-cols-2 max-[1280px]:max-w-[680px]">
        <section className="relative overflow-hidden h-[150px] rounded-[26px] bg-gradient-to-b from-peach to-orange shadow-[0px_16px_38px_0px_rgba(51,31,10,0.16)] p-6 text-white">
          <p className="text-[10px] font-medium tracking-[1px] uppercase">People</p>
          <p className="font-light text-[56px] leading-none mt-2">{PLACEHOLDER.people}</p>
          <p className="text-[12px] absolute left-6 bottom-3">in your memory</p>
        </section>

        <section className="relative h-[150px] rounded-[26px] bg-ember shadow-[0px_16px_38px_0px_rgba(51,31,10,0.2)] p-6">
          <p className="text-[10px] font-medium tracking-[1px] uppercase text-muted">
            To follow up
          </p>
          <p className="font-light text-[56px] leading-none mt-2 text-cream">
            {PLACEHOLDER.followUps}
          </p>
          <div className="absolute left-6 right-6 bottom-[23px] h-[5px] rounded-full bg-[#3A332B]">
            <div className="h-full w-[39%] rounded-full bg-yellow" />
          </div>
        </section>

        <section className="relative h-[150px] glass rounded-[26px] px-[22px] pt-[16px] overflow-hidden">
          <p className="micro-label text-[10px] tracking-[1px]">Memory health</p>
          <div className="flex items-baseline gap-4">
            <p className="font-light text-[56px] leading-tight text-ink">
              {PLACEHOLDER.health}
            </p>
            <p className="text-[12.5px] text-muted">improving steadily</p>
          </div>
          <WarmthChart className="absolute left-[22px] right-[22px] top-[74px] h-[58px] w-[calc(100%-44px)]" />
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
              <p className="font-light text-[24px] text-ink absolute left-[12px] top-[8px]">
                {PLACEHOLDER.meeting.time}
              </p>
              <p className="text-[10.5px] text-muted absolute left-[12px] top-[40px]">
                {PLACEHOLDER.meeting.when}
              </p>
              <p className="micro-label text-[8.5px] tracking-[0.85px] absolute left-[12px] bottom-[14px]">
                Briefing
              </p>
            </div>
            <p className="absolute left-[150px] top-[30px] font-semibold text-[17px] text-ink">
              {PLACEHOLDER.meeting.title}
            </p>
            <p className="absolute left-[150px] top-[62px] w-[330px] text-[12.5px] text-muted">
              {PLACEHOLDER.meeting.note}
            </p>
            <p className="micro-label absolute left-[150px] bottom-[24px] text-[10px] tracking-[1px]">
              View briefing
            </p>
            <button
              type="button"
              aria-label="Open briefing"
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
              {PLACEHOLDER.followUp.title}
            </p>
            <p className="absolute left-[18px] top-[64px] text-[12.5px] text-muted">
              {PLACEHOLDER.followUp.note}
            </p>
            <button
              type="button"
              aria-label="Open follow-up"
              className="absolute right-[26px] top-[36px] size-11 rounded-full bg-ember grid place-items-center"
            >
              <ChevronRightIcon color="#F6F1E8" />
            </button>
          </section>

          <p className="micro-label mt-[26px] text-[10px] tracking-[1px]">Recent</p>
          <div className="flex gap-[42px] mt-[14px]">
            {PLACEHOLDER.recent.map((person) => (
              <div key={person.label} className="text-center w-12">
                <RingAvatar initial={person.initial} size={48} />
                <p className="text-[10.5px] font-medium text-ink mt-1">{person.label}</p>
              </div>
            ))}
          </div>
        </div>

        <NetworkWidget />
      </div>
    </div>
  );
}

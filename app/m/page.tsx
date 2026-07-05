import { createClient } from "@/lib/supabase/server";
import { RingAvatar } from "@/components/RingAvatar";
import { HomeExperience } from "@/components/HomeExperience";
import { getNetwork } from "@/lib/network";
import { knowledgeLines } from "@/lib/person";

export const dynamic = "force-dynamic";

// Base copy from the Home frame; the Suggested card is replaced by the live
// cold-contact nudge below when the user has people.
const PLACEHOLDERS = {
  greeting: "Tell me about someone you met — I'll remember them.",
  meeting: {
    time: "4:00",
    when: "PM · today",
    title: "Coffee with Ana García",
    note: "Dog Toby was sick · hiring a designer",
  },
  suggestion: { text: "Reconnect with Jorge — 2 months", cluster: "Family" },
};

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "";
  const initial = (displayName[0] ?? "H").toUpperCase();

  const network = user ? await getNetwork(user.id) : { people: [], nudge: null };
  // On-open nudge speaks through Hefesto's bubble (PRD §6.12) — the Suggested
  // card below carries the same reconnection with its cluster chip.
  const greeting = network.nudge ? network.nudge.message : PLACEHOLDERS.greeting;
  const suggestion = network.nudge
    ? {
        text: `Reconnect with ${network.nudge.name.split(/\s+/)[0]} — ${network.nudge.warmth.gap}`,
        cluster: titleCase(network.nudge.cluster ?? "personal"),
      }
    : PLACEHOLDERS.suggestion;

  // The "next meeting" card is the briefing entry point — feature the most recent
  // person so tapping it opens their real, memory-grounded briefing.
  const featured = network.people[0] ?? null;
  const meeting = featured
    ? {
        ...PLACEHOLDERS.meeting,
        title: `Coffee with ${featured.name}`,
        note:
          knowledgeLines(featured, 2).join(" · ") ||
          "You'll know more after the next capture",
      }
    : PLACEHOLDERS.meeting;

  return (
    <main className="px-6">
      <header className="flex items-center gap-3 pt-12">
        <RingAvatar initial={initial} />
        <h1 className="font-semibold text-[26px] text-ink">Hefesto</h1>
      </header>

      <HomeExperience
        placeholders={{ ...PLACEHOLDERS, greeting, suggestion, meeting }}
        featuredPersonId={featured?.personId ?? null}
      />
    </main>
  );
}

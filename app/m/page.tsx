import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { RingAvatar } from "@/components/RingAvatar";
import { HomeExperience } from "@/components/HomeExperience";
import { getNetwork } from "@/lib/network";
import { knowledgeLines, compactGap } from "@/lib/person";

export const dynamic = "force-dynamic";

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ capture?: string }>;
}) {
  const { capture } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "";
  const initial = (displayName[0] ?? "H").toUpperCase();

  const network = user ? await getNetwork(user.id) : { people: [], nudge: null };

  // On-open nudge speaks through Hefesto's bubble (PRD §6.12) — the Suggested
  // card carries the same reconnection and opens that person.
  const greeting = network.nudge
    ? network.nudge.message
    : "Tell me about someone you met — I'll remember them.";
  const suggestion = network.nudge
    ? {
        personId: network.nudge.personId,
        text: `Reconnect with ${network.nudge.name.split(/\s+/)[0]} — ${network.nudge.warmth.gap}`,
        cluster: titleCase(network.nudge.cluster ?? "personal"),
      }
    : null;

  // The briefing card features the most recent person — tapping it opens their
  // real, memory-grounded briefing.
  const featuredPerson = network.people[0] ?? null;
  const featured = featuredPerson
    ? {
        personId: featuredPerson.personId,
        name: featuredPerson.name,
        initial: featuredPerson.initial,
        lastSeen: compactGap(featuredPerson.warmth.days),
        note:
          knowledgeLines(featuredPerson, 2).join(" · ") ||
          "You'll know more after the next capture",
      }
    : null;

  return (
    <main className="px-6">
      <header className="flex items-center gap-3 pt-12">
        <Link href="/account" aria-label="Account">
          <RingAvatar initial={initial} />
        </Link>
        <h1 className="font-semibold text-[26px] text-ink">Hefesto</h1>
      </header>

      <HomeExperience
        greeting={greeting}
        featured={featured}
        suggestion={suggestion}
        initialCapture={capture ? `${capture}: ` : undefined}
      />
    </main>
  );
}

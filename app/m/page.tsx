import { createClient } from "@/lib/supabase/server";
import { RingAvatar } from "@/components/RingAvatar";
import { HomeExperience } from "@/components/HomeExperience";

// Placeholder content matching the design frame — replaced by live data
// (briefings, nudges) once the graph and warmth phases land.
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

      <HomeExperience placeholders={PLACEHOLDERS} />
    </main>
  );
}

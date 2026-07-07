import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RingAvatar } from "@/components/RingAvatar";
import { MobilePeople } from "@/components/people/MobilePeople";
import { getNetwork } from "@/lib/network";

export const dynamic = "force-dynamic";

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ person?: string }>;
}) {
  // Desktop links use /people?person= â€” on mobile the card is its own page.
  const { person } = await searchParams;
  if (person) redirect(`/people/${person}`);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "";
  const initial = (displayName[0] ?? "H").toUpperCase();
  const { people } = user ? await getNetwork(user.id) : { people: [] };

  return (
    <main className="px-6">
      <header className="flex items-center gap-3 pt-12">
        <RingAvatar initial={initial} />
        <h1 className="font-semibold text-[26px] text-ink">People</h1>
      </header>

      <MobilePeople people={people} />
    </main>
  );
}

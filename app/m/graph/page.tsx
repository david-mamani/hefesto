import { createClient } from "@/lib/supabase/server";
import { RingAvatar } from "@/components/RingAvatar";
import { GraphView } from "@/components/GraphView";
import { getNetwork } from "@/lib/network";

export const dynamic = "force-dynamic";

export default async function GraphPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "";
  const initial = (displayName[0] ?? "H").toUpperCase();
  const { people } = user ? await getNetwork(user.id) : { people: [] };

  return (
    <main className="px-6 flex flex-col min-h-[calc(100dvh-104px)]">
      <header className="flex items-center gap-3 pt-12">
        <RingAvatar initial={initial} />
        <h1 className="font-semibold text-[24px] text-ink">Your network</h1>
      </header>

      <GraphView people={people} />

      <p className="micro-label text-center text-[9px] tracking-[0.9px] pb-1 leading-relaxed">
        Glow = mode (blue work · orange personal · green family) · node = warmth
      </p>
    </main>
  );
}

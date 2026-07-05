import { createClient } from "@/lib/supabase/server";
import { getNetwork } from "@/lib/network";
import { warmthSeries } from "@/lib/warmth";
import { DesktopHome } from "@/components/DesktopHome";

export const dynamic = "force-dynamic";

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

  const network = user ? await getNetwork(user.id) : { people: [], nudge: null };
  const healthSeries = warmthSeries(network.people);

  return (
    <DesktopHome
      greeting={greeting}
      firstName={firstName}
      people={network.people}
      nudge={network.nudge}
      healthSeries={healthSeries}
    />
  );
}

import { createClient } from "@/lib/supabase/server";
import { getNetwork } from "@/lib/network";
import { DesktopGraph } from "@/components/DesktopGraph";

export const dynamic = "force-dynamic";

export default async function DesktopGraphPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { people } = user ? await getNetwork(user.id) : { people: [] };

  return <DesktopGraph people={people} />;
}

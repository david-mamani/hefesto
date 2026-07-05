import { createClient } from "@/lib/supabase/server";
import { DesktopPeople } from "@/components/people/DesktopPeople";
import { getNetwork, getPerson } from "@/lib/network";

export const dynamic = "force-dynamic";

export default async function DesktopPeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ person?: string }>;
}) {
  const { person } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { people } = user ? await getNetwork(user.id) : { people: [] };
  const selectedId = person ?? people[0]?.personId;
  const detail = user && selectedId ? await getPerson(user.id, selectedId) : null;

  return <DesktopPeople people={people} detail={detail} />;
}

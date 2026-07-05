import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PersonCardMobile } from "@/components/people/PersonCardMobile";
import { getPerson } from "@/lib/network";

export const dynamic = "force-dynamic";

export default async function PersonPage({
  params,
}: {
  params: Promise<{ personId: string }>;
}) {
  const { personId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const detail = await getPerson(user.id, personId);
  if (!detail) notFound();

  return <PersonCardMobile detail={detail} />;
}

import { createAdminClient } from "@/lib/supabase/admin";
import { warmthOf, selectNudge, type Warmth, type Nudge } from "@/lib/warmth";

/*
 * The user's people, resolved server-side into warmth embers for the /graph view
 * and the Home nudge. Identity always derives from the session user id.
 */

export type NetworkPerson = {
  personId: string;
  name: string;
  initial: string;
  cluster: "work" | "personal" | "family" | null;
  lastInteraction: string | null;
  warmth: Warmth;
};

export type Network = {
  people: NetworkPerson[];
  nudge: Nudge | null;
};

export async function getNetwork(userId: string): Promise<Network> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("persons")
    .select("person_id, canonical_name, cluster, last_interaction, last_nudge_at")
    .eq("user_id", userId)
    .order("last_interaction", { ascending: false, nullsFirst: false });

  const rows = data ?? [];
  const people: NetworkPerson[] = rows.map((p) => ({
    personId: p.person_id,
    name: p.canonical_name,
    initial: (p.canonical_name?.trim()?.[0] ?? "?").toUpperCase(),
    cluster: p.cluster,
    lastInteraction: p.last_interaction,
    warmth: warmthOf(p.last_interaction),
  }));

  const nudge = selectNudge(
    rows.map((p) => ({
      personId: p.person_id,
      name: p.canonical_name,
      cluster: p.cluster,
      lastInteraction: p.last_interaction,
      lastNudgeAt: p.last_nudge_at,
    }))
  );

  return { people, nudge };
}

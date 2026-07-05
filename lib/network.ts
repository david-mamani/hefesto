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
  createdAt: string | null;
  warmth: Warmth;
  memoryCount: number;
  role: string | null;
  company: string | null;
  relationship: string | null;
  interests: string[];
  facts: string[];
  commitments: string[];
};

export type Network = {
  people: NetworkPerson[];
  nudge: Nudge | null;
};

export async function getNetwork(userId: string): Promise<Network> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("persons")
    .select(
      "person_id, canonical_name, cluster, last_interaction, last_nudge_at, created_at, role, company, relationship, interests, facts, commitments"
    )
    .eq("user_id", userId)
    .order("last_interaction", { ascending: false, nullsFirst: false });

  const rows = data ?? [];

  // Memory count per person (drives the M13 "N memories" line).
  const counts = new Map<string, number>();
  if (rows.length) {
    const { data: pd } = await admin
      .from("person_data")
      .select("person_id")
      .in(
        "person_id",
        rows.map((r) => r.person_id)
      );
    for (const r of pd ?? []) counts.set(r.person_id, (counts.get(r.person_id) ?? 0) + 1);
  }

  const people: NetworkPerson[] = rows.map((p) => ({
    personId: p.person_id,
    name: p.canonical_name,
    initial: (p.canonical_name?.trim()?.[0] ?? "?").toUpperCase(),
    cluster: p.cluster,
    lastInteraction: p.last_interaction,
    createdAt: p.created_at,
    warmth: warmthOf(p.last_interaction),
    memoryCount: counts.get(p.person_id) ?? 0,
    role: p.role ?? null,
    company: p.company ?? null,
    relationship: p.relationship ?? null,
    interests: p.interests ?? [],
    facts: p.facts ?? [],
    commitments: p.commitments ?? [],
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

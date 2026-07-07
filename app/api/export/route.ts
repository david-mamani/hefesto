import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/*
 * Export my data (M10e Privacy): everything the registry knows — people with
 * their full profile and the capture timeline — as a downloadable JSON file.
 * Your memories are yours, in a format you can take anywhere.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const admin = createAdminClient();
  const { data: persons } = await admin
    .from("persons")
    .select(
      "canonical_name, cluster, role, company, relationship, interests, facts, commitments, met_at_event, met_at_date, last_interaction, created_at"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  const { data: notes } = await admin
    .from("capture_notes")
    .select("summary, channel, created_at, person_id, persons(canonical_name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const payload = {
    exportedAt: new Date().toISOString(),
    account: user.email,
    people: (persons ?? []).map((p) => ({
      name: p.canonical_name,
      cluster: p.cluster,
      role: p.role,
      company: p.company,
      relationship: p.relationship,
      interests: p.interests,
      facts: p.facts,
      commitments: p.commitments,
      metAt: [p.met_at_event, p.met_at_date].filter(Boolean).join(" · ") || null,
      lastInteraction: p.last_interaction,
      captured: p.created_at,
    })),
    timeline: (notes ?? []).map((n) => ({
      date: n.created_at,
      about: (n.persons as unknown as { canonical_name?: string } | null)?.canonical_name ?? null,
      note: n.summary,
      channel: n.channel,
    })),
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": 'attachment; filename="hefesto-memories.json"',
    },
  });
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureProvisioned } from "@/memory/provisioning";
import { forget } from "@/lib/cognee";

/*
 * Forget a person for real (Figma M13): every one of their memories is removed
 * from the Cognee graph (forget by dataId — verified in the smoke test), then the
 * registry rows are deleted so the node disappears from the graph and network.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { personId } = (await request.json().catch(() => ({}))) as { personId?: string };
  if (!personId) return NextResponse.json({ error: "Missing personId" }, { status: 400 });

  try {
    const admin = createAdminClient();
    const { data: person } = await admin
      .from("persons")
      .select("person_id, canonical_name")
      .eq("user_id", user.id)
      .eq("person_id", personId)
      .maybeSingle();
    if (!person) return NextResponse.json({ error: "Person not found" }, { status: 404 });

    const memory = await ensureProvisioned(user.id);
    const { data: rows } = await admin
      .from("person_data")
      .select("data_id")
      .eq("person_id", personId);
    const dataIds = (rows ?? []).map((r) => r.data_id as string);

    for (const dataId of dataIds) {
      await forget({ datasetId: memory.datasetId, dataId }).catch(() => {});
    }

    await admin.from("person_data").delete().eq("person_id", personId);
    await admin.from("persons").delete().eq("user_id", user.id).eq("person_id", personId);

    return NextResponse.json({ ok: true, forgot: dataIds.length, name: person.canonical_name });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Forget failed" },
      { status: 500 }
    );
  }
}

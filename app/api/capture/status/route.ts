import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureProvisioned } from "@/memory/provisioning";
import { datasets } from "@/lib/cognee";

/*
 * Polled by the "forging" state. Completion = the capture's data item exists in
 * the dataset AND the latest pipeline status reads completed. (Status alone is
 * unreliable right after remember — it can still show the PREVIOUS run.)
 * Once complete, the data_id ↔ person mapping is recorded (forget depends on it).
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const filename = searchParams.get("filename");
  const personId = searchParams.get("personId");
  if (!filename || !personId) {
    return NextResponse.json({ error: "Missing filename or personId" }, { status: 400 });
  }

  try {
    // Ownership first: the polled person must belong to the caller — fail fast
    // instead of spending Cognee calls on (or leaking timing about) foreign ids.
    const admin = createAdminClient();
    const { data: person } = await admin
      .from("persons")
      .select("person_id")
      .eq("user_id", user.id)
      .eq("person_id", personId)
      .maybeSingle();
    if (!person) return NextResponse.json({ error: "Person not found" }, { status: 404 });

    const memory = await ensureProvisioned(user.id);

    const items = await datasets.data(memory.datasetId).catch(() => []);
    const stem = filename.replace(/\.md$/, "");
    const item = items.find((i) => i.name === filename || i.name === stem);
    if (!item) return NextResponse.json({ status: "forging" });

    const statuses = await datasets.status([memory.datasetId]).catch(() => ({}) as Record<string, unknown>);
    const statusText = JSON.stringify(statuses[memory.datasetId] ?? "");
    if (/failed|errored/i.test(statusText)) {
      return NextResponse.json({ status: "failed" });
    }
    if (!/completed/i.test(statusText)) {
      return NextResponse.json({ status: "forging" });
    }

    await admin.from("person_data").upsert({
      person_id: personId,
      data_id: item.id,
      filename,
    });

    return NextResponse.json({ status: "completed", dataId: item.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Status check failed" },
      { status: 500 }
    );
  }
}

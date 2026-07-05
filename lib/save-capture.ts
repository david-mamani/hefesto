import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureProvisioned } from "@/memory/provisioning";
import { remember, datasets } from "@/lib/cognee";
import { buildCaptureMarkdown, ONTOLOGY_KEY, type ConfirmedFields } from "@/lib/capture";

/*
 * Shared capture persistence — the single path from a confirmed capture to memory,
 * used by both the web confirmation route and the Telegram webhook. Dataset identity
 * always derives from the user id, never from input.
 */

export type SaveCaptureInput = {
  userId: string;
  resolution: "new" | "existing";
  personId?: string;
  fields: ConfirmedFields;
  sourceText: string;
  channel: "web" | "telegram";
};

export type SaveCaptureResult = {
  personId: string;
  canonicalName: string;
  filename: string;
  datasetId: string;
};

export async function saveCapture(input: SaveCaptureInput): Promise<SaveCaptureResult> {
  const memory = await ensureProvisioned(input.userId);
  const admin = createAdminClient();
  const name = input.fields.name.trim();

  let personId: string;
  let canonicalName: string;

  if (input.resolution === "existing" && input.personId) {
    const { data: person, error } = await admin
      .from("persons")
      .select("person_id, canonical_name")
      .eq("user_id", input.userId)
      .eq("person_id", input.personId)
      .single();
    if (error || !person) throw new Error("Person not found");
    personId = person.person_id;
    canonicalName = person.canonical_name;
  } else {
    canonicalName = name;
    // Same exact name in Cognee merges (deterministic UUID5) — a NEW person with a
    // taken name gets a discriminator so it stays a distinct node.
    const { data: clash } = await admin
      .from("persons")
      .select("person_id")
      .eq("user_id", input.userId)
      .eq("canonical_name", canonicalName)
      .maybeSingle();
    if (clash) {
      const discriminator = input.fields.metAtEvent ?? new Date().toISOString().slice(0, 10);
      canonicalName = `${name} · ${discriminator}`;
    }

    const { data: inserted, error } = await admin
      .from("persons")
      .insert({
        user_id: input.userId,
        canonical_name: canonicalName,
        aliases: canonicalName === name ? [] : [name],
        cluster: input.fields.cluster,
        last_interaction: new Date().toISOString(),
      })
      .select("person_id")
      .single();
    if (error || !inserted) throw new Error(`Could not register person: ${error?.message}`);
    personId = inserted.person_id;
  }

  const filename = `capture_${randomUUID()}.md`;
  const content = buildCaptureMarkdown({
    canonicalName,
    fields: input.fields,
    sourceText: input.sourceText.trim(),
    channel: input.channel,
    capturedAt: new Date(),
  });

  await remember({
    filename,
    content,
    datasetName: memory.datasetName,
    ontologyKey: ONTOLOGY_KEY,
    nodeSet: [input.fields.cluster],
    runInBackground: true,
  });

  await admin
    .from("persons")
    .update({ last_interaction: new Date().toISOString() })
    .eq("person_id", personId);

  return { personId, canonicalName, filename, datasetId: memory.datasetId };
}

/*
 * Poll until the capture's graph is built, then record the data_id ↔ person link
 * (forget depends on it). Completion = the data item exists AND status is completed —
 * status alone can still read the PREVIOUS run right after remember.
 */
export async function waitAndRecord(
  datasetId: string,
  filename: string,
  personId: string,
  timeoutMs = 3 * 60 * 1000
): Promise<{ status: "completed" | "failed" | "forging"; dataId?: string }> {
  const admin = createAdminClient();
  const stem = filename.replace(/\.md$/, "");
  const t0 = Date.now();

  while (Date.now() - t0 < timeoutMs) {
    const items = await datasets.data(datasetId).catch(() => []);
    const item = items.find((i) => i.name === filename || i.name === stem);
    if (item) {
      const statuses = await datasets
        .status([datasetId])
        .catch(() => ({}) as Record<string, unknown>);
      const statusText = JSON.stringify(statuses[datasetId] ?? "");
      if (/failed|errored/i.test(statusText)) return { status: "failed" };
      if (/completed/i.test(statusText)) {
        await admin.from("person_data").upsert({ person_id: personId, data_id: item.id, filename });
        return { status: "completed", dataId: item.id };
      }
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  return { status: "forging" };
}

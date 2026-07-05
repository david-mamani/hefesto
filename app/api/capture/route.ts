import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureProvisioned } from "@/memory/provisioning";
import { extractCapture } from "@/lib/groq";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { text } = (await request.json().catch(() => ({}))) as { text?: string };
  if (!text?.trim()) return NextResponse.json({ error: "Empty capture" }, { status: 400 });

  try {
    await ensureProvisioned(user.id);
    const extraction = await extractCapture(text.trim());

    // Disambiguation (same-name merge gotcha): surface existing people with a
    // matching name so the card can ask "new person or this one?"
    let candidates: { personId: string; canonicalName: string; cluster: string | null }[] = [];
    if (extraction.name) {
      const admin = createAdminClient();
      const { data } = await admin
        .from("persons")
        .select("person_id, canonical_name, cluster")
        .eq("user_id", user.id)
        .ilike("canonical_name", `%${extraction.name.split(" ")[0]}%`)
        .limit(3);
      candidates = (data ?? []).map((p) => ({
        personId: p.person_id,
        canonicalName: p.canonical_name,
        cluster: p.cluster,
      }));
    }

    return NextResponse.json({ extraction, candidates });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Extraction failed" },
      { status: 500 }
    );
  }
}

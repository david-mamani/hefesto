import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProvisioned } from "@/memory/provisioning";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  try {
    const memory = await ensureProvisioned(user.id);
    return NextResponse.json({
      datasetName: memory.datasetName,
      isolationPattern: memory.isolationPattern,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Provisioning failed" },
      { status: 500 }
    );
  }
}

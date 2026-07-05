import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProvisioned } from "@/memory/provisioning";
import { rememberFeedbackEntry } from "@/lib/cognee";

type FeedbackBody = {
  qaId: string;
  sessionId: string;
  thumbs: "up" | "down";
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as FeedbackBody | null;
  if (!body?.qaId || !body.sessionId || !["up", "down"].includes(body.thumbs)) {
    return NextResponse.json({ error: "Invalid feedback" }, { status: 400 });
  }

  try {
    const memory = await ensureProvisioned(user.id);
    await rememberFeedbackEntry({
      sessionId: body.sessionId,
      qaId: body.qaId,
      score: body.thumbs === "up" ? 5 : 1,
      datasetName: memory.datasetName,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Feedback failed" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { saveCapture } from "@/lib/save-capture";
import type { ConfirmedFields } from "@/lib/capture";

type ConfirmBody = {
  resolution: "new" | "existing";
  personId?: string;
  fields: ConfirmedFields;
  sourceText: string;
  channel?: "web" | "telegram";
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as ConfirmBody | null;
  if (!body?.fields?.name?.trim() || !body.sourceText?.trim()) {
    return NextResponse.json({ error: "Invalid confirmation" }, { status: 400 });
  }

  try {
    const result = await saveCapture({
      userId: user.id,
      resolution: body.resolution,
      personId: body.personId,
      fields: body.fields,
      sourceText: body.sourceText,
      channel: body.channel ?? "web",
    });
    return NextResponse.json({
      personId: result.personId,
      filename: result.filename,
      canonicalName: result.canonicalName,
    });
  } catch (error) {
    console.error("capture/confirm failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Capture failed" },
      { status: 500 }
    );
  }
}

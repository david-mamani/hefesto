import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { personBriefing, PersonNotFoundError } from "@/lib/briefing";

/*
 * Pre-meeting briefing (Figma M12) — the shared pipeline lives in lib/briefing.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const personId = new URL(request.url).searchParams.get("personId");
  if (!personId) return NextResponse.json({ error: "Missing personId" }, { status: 400 });

  try {
    return NextResponse.json(await personBriefing(user.id, personId));
  } catch (error) {
    if (error instanceof PersonNotFoundError) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Briefing failed" },
      { status: 500 }
    );
  }
}

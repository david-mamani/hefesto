import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { transcribeAudio, audioFilename } from "@/lib/whisper";

/*
 * Voice-to-text for the chat composer (M02/M10d mic): the spoken question comes
 * back as text and goes through the normal recall send. No memory is touched.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: "No audio received" }, { status: 400 });
  }

  try {
    const text = await transcribeAudio(audio, audioFilename(audio.type));
    if (!text) {
      return NextResponse.json({ error: "I couldn't hear anything — try again" }, { status: 422 });
    }
    return NextResponse.json({ text });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Transcription failed" },
      { status: 500 }
    );
  }
}

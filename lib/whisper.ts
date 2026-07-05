/*
 * Groq Whisper transcription (server-side only) — turns a voice capture into text,
 * which then flows through the exact same extraction + confirmation pipeline as
 * typed captures.
 */

const GROQ_TRANSCRIBE_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const MODEL = "whisper-large-v3";

export async function transcribeAudio(audio: Blob, filename = "capture.webm"): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set");

  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model", MODEL);
  form.append("response_format", "json");
  form.append("language", "en");
  form.append("temperature", "0");

  const res = await fetch(GROQ_TRANSCRIBE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Groq transcription failed (${res.status}): ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as { text?: string };
  return (data.text ?? "").trim();
}

// Groq detects the format from the filename extension, so map the blob mime.
export function audioFilename(mime: string | undefined): string {
  const t = mime ?? "";
  if (t.includes("mp4") || t.includes("m4a")) return "capture.mp4";
  if (t.includes("ogg")) return "capture.ogg";
  if (t.includes("mpeg") || t.includes("mp3")) return "capture.mp3";
  if (t.includes("wav")) return "capture.wav";
  return "capture.webm";
}

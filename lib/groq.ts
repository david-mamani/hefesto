/*
 * Groq chat completions (server-side only) — pre-confirmation extraction.
 * The confirmation card is ALWAYS shown before anything reaches memory.
 */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

export type ExtractedCapture = {
  name: string | null;
  cluster: "work" | "personal" | "family";
  role: string | null;
  company: string | null;
  interests: string[];
  met_at: { event: string | null; date: string | null };
  relationship: "friend" | "family" | "colleague" | "client" | "lead" | null;
  facts: string[];
  commitments: string[];
};

const SYSTEM_PROMPT = `You extract structured facts about ONE person from a short note the user captured after meeting or talking to them.

Return ONLY a JSON object with exactly these fields:
{
  "name": string | null,            // the person's name as mentioned
  "cluster": "work" | "personal" | "family",   // best-guess life area
  "role": string | null,            // job title or role, e.g. "founder", "designer"
  "company": string | null,
  "interests": string[],            // hobbies or topics they care about
  "met_at": { "event": string | null, "date": string | null },  // where/how they met; date ISO 8601 if stated
  "relationship": "friend" | "family" | "colleague" | "client" | "lead" | null,
  "facts": string[],                // other atomic facts worth remembering
  "commitments": string[]           // things promised or wanted, e.g. "wants an intro to a designer"
}

Rules:
- Use null or [] when the note does not say. Never invent details.
- Keep every value in English, short and human-readable.
- "cluster" defaults to "personal" when ambiguous; family members are "family"; professional contexts are "work".`;

export async function extractCapture(text: string): Promise<ExtractedCapture> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set");

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Groq extraction failed (${res.status}): ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  const parsed = JSON.parse(data.choices[0]?.message?.content ?? "{}");

  const clusters = ["work", "personal", "family"] as const;
  const relationships = ["friend", "family", "colleague", "client", "lead"] as const;

  return {
    name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name.trim() : null,
    cluster: clusters.includes(parsed.cluster) ? parsed.cluster : "personal",
    role: typeof parsed.role === "string" && parsed.role ? parsed.role : null,
    company: typeof parsed.company === "string" && parsed.company ? parsed.company : null,
    interests: Array.isArray(parsed.interests) ? parsed.interests.map(String) : [],
    met_at: {
      event: typeof parsed.met_at?.event === "string" && parsed.met_at.event ? parsed.met_at.event : null,
      date: typeof parsed.met_at?.date === "string" && parsed.met_at.date ? parsed.met_at.date : null,
    },
    relationship: relationships.includes(parsed.relationship) ? parsed.relationship : null,
    facts: Array.isArray(parsed.facts) ? parsed.facts.map(String) : [],
    commitments: Array.isArray(parsed.commitments) ? parsed.commitments.map(String) : [],
  };
}

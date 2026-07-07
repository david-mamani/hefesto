import { createAdminClient } from "@/lib/supabase/admin";
import { ensureProvisioned } from "@/memory/provisioning";
import { recall, sessions, splitEvidence, StillMemorizingError } from "@/lib/cognee";

/*
 * The recall pipeline behind the chat — shared by the web chat route and the
 * Telegram bot so both surfaces answer identically: recall with references,
 * evidence parsing, referral path walking, qa_id retrieval.
 */

export type ChatEvidence = {
  document: string;
  dataId: string;
  chunkId: string;
  quote: string;
  personName?: string | null;
};

export type ChatPathPerson = {
  personId: string;
  name: string;
  cluster: "work" | "personal" | "family" | null;
};

export type AnswerResult = {
  conversationId: string;
  sessionId: string;
  text: string;
  evidence: ChatEvidence[];
  path: ChatPathPerson[];
  sources: string[];
  qaId: string | null;
  mode: "networking" | "personal" | "family";
  pending?: boolean;
};

export class ConversationNotFoundError extends Error {
  constructor() {
    super("Conversation not found");
  }
}

const EVIDENCE_LINE =
  /-\s*chunk\s+\d+\s+of\s+document\s+(\S+)\s+\(data_id:\s*([0-9a-f-]{36}),\s*chunk_id:\s*([0-9a-f-]{36})\):\s*"([\s\S]*?)"(?=\s*(?:\n\s*-|$))/gi;

function parseEvidence(block: string | null): ChatEvidence[] {
  if (!block) return [];
  const entries: ChatEvidence[] = [];
  for (const match of block.matchAll(EVIDENCE_LINE)) {
    entries.push({
      document: match[1],
      dataId: match[2],
      chunkId: match[3],
      quote: match[4].trim(),
    });
  }
  return entries;
}

export function modeFor(cluster: string | null | undefined): "networking" | "personal" | "family" {
  if (cluster === "work") return "networking";
  if (cluster === "family") return "family";
  return "personal";
}

// Keep answers short and human — and phrase referrals as "X can introduce you to Y"
// so the path can be walked from the sentence.
const CHAT_SYSTEM_PROMPT =
  "You are Hefesto, a warm relationship-memory assistant. Answer in ONE short, natural sentence " +
  "grounded only in the user's memories. When the answer is a referral, name who can make the " +
  "introduction and to whom, e.g. 'Leo can introduce you to Maya, who runs a gaming studio.' " +
  "Never use bullet points or lists.";

const REFERRAL_PATTERNS = [
  /\b([A-Z][\p{L}'.-]*(?:\s+[A-Z][\p{L}'.-]*)*)\s+can\s+introduce\s+you\s+to\s+([A-Z][\p{L}'.-]*(?:\s+[A-Z][\p{L}'.-]*)*)/u,
  /\b([A-Z][\p{L}'.-]*(?:\s+[A-Z][\p{L}'.-]*)*)\s+can\s+put\s+you\s+in\s+touch\s+with\s+([A-Z][\p{L}'.-]*(?:\s+[A-Z][\p{L}'.-]*)*)/u,
  /\b([A-Z][\p{L}'.-]*(?:\s+[A-Z][\p{L}'.-]*)*)\s+can\s+connect\s+you\s+(?:with|to)\s+([A-Z][\p{L}'.-]*(?:\s+[A-Z][\p{L}'.-]*)*)/u,
];

function parseReferral(answer: string): { connector: string; target: string } | null {
  for (const re of REFERRAL_PATTERNS) {
    const m = answer.match(re);
    if (m) return { connector: m[1].trim(), target: m[2].trim() };
  }
  return null;
}

type PersonRow = {
  person_id: string;
  canonical_name: string;
  aliases: string[] | null;
  cluster: ChatPathPerson["cluster"];
};

function matchPerson(name: string, persons: PersonRow[]): ChatPathPerson | null {
  const norm = name.trim().toLowerCase();
  const first = norm.split(/\s+/)[0];
  for (const p of persons) {
    const names = [p.canonical_name.toLowerCase(), ...(p.aliases ?? []).map((a) => a.toLowerCase())];
    if (names.some((n) => n === norm || n.split(/\s+/)[0] === first)) {
      return { personId: p.person_id, name: p.canonical_name, cluster: p.cluster };
    }
  }
  return null;
}

/** Deep-scan a JSON value for the last occurrence of a given key. */
function findLastKey(value: unknown, key: string): unknown {
  let found: unknown;
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      for (const [k, inner] of Object.entries(v as Record<string, unknown>)) {
        if (k === key && inner !== null && inner !== undefined) found = inner;
        walk(inner);
      }
    }
  };
  walk(value);
  return found;
}

export async function answerQuestion(
  userId: string,
  message: string,
  opts: { thinkDeeper?: boolean; conversationId?: string | null } = {}
): Promise<AnswerResult> {
  // Dataset identity ALWAYS derives from the authenticated user — never from the client
  const memory = await ensureProvisioned(userId);
  const admin = createAdminClient();

  const requested = opts.conversationId ?? null;
  let conversationId: string;
  let cogneeSessionId: string;
  if (requested) {
    const { data: conversation } = await admin
      .from("conversations")
      .select("conversation_id, cognee_session_id")
      .eq("user_id", userId)
      .eq("conversation_id", requested)
      .maybeSingle();
    if (!conversation) throw new ConversationNotFoundError();
    conversationId = requested;
    cogneeSessionId = conversation.cognee_session_id;
  } else {
    const { data: created, error } = await admin
      .from("conversations")
      .insert({ user_id: userId })
      .select("conversation_id, cognee_session_id")
      .single();
    if (error || !created) throw new Error("Could not start conversation");
    conversationId = created.conversation_id;
    cogneeSessionId = created.cognee_session_id;
  }

  let raw: unknown;
  try {
    raw = await recall({
      query: message.trim(),
      searchType: opts.thinkDeeper ? "GRAPH_COMPLETION_COT" : "GRAPH_COMPLETION",
      datasets: [memory.datasetName],
      sessionId: cogneeSessionId,
      includeReferences: true,
      systemPrompt: CHAT_SYSTEM_PROMPT,
    });
  } catch (error) {
    if (error instanceof StillMemorizingError) {
      return {
        conversationId,
        sessionId: cogneeSessionId,
        text: "I'm still forging your memories — give me a moment and ask again.",
        evidence: [],
        path: [],
        sources: [],
        qaId: null,
        mode: "personal",
        pending: true,
      };
    }
    throw error;
  }

  // recall returns [{kind, search_type, text}] — Evidence block lives inside .text
  const answerText = Array.isArray(raw)
    ? String((raw[0] as { text?: string })?.text ?? "")
    : typeof raw === "string"
      ? raw
      : String(findLastKey(raw, "text") ?? "");
  const { text, evidence: evidenceBlock } = splitEvidence(answerText);
  const evidence = parseEvidence(evidenceBlock);

  // Map cited data_ids → captured persons (§17.C) — feeds the "via" sources and
  // the single-hop fallback path.
  const citedPersons: ChatPathPerson[] = [];
  if (evidence.length) {
    const dataIds = [...new Set(evidence.map((e) => e.dataId))];
    const { data: rows } = await admin
      .from("person_data")
      .select("data_id, persons!inner(person_id, canonical_name, cluster, user_id)")
      .in("data_id", dataIds);
    const byDataId = new Map(
      (rows ?? [])
        .filter((r) => {
          const person = r.persons as unknown as { user_id: string };
          return person.user_id === userId;
        })
        .map((r) => {
          const person = r.persons as unknown as {
            person_id: string;
            canonical_name: string;
            cluster: ChatPathPerson["cluster"];
          };
          return [
            r.data_id,
            { personId: person.person_id, name: person.canonical_name, cluster: person.cluster },
          ] as const;
        })
    );
    const seen = new Set<string>();
    for (const entry of evidence) {
      const person = byDataId.get(entry.dataId);
      entry.personName = person?.name ?? null;
      if (person && !seen.has(person.personId)) {
        seen.add(person.personId);
        citedPersons.push(person);
      }
    }
  }

  // The path preferentially follows the referral named in the answer
  // ("X can introduce you to Y") so the walk reads You → X → Y — even when Y is a
  // second-degree entity (not a captured contact). Direct answers fall back to the
  // people actually cited.
  let path: ChatPathPerson[] = citedPersons;
  const referral = parseReferral(text);
  if (referral) {
    const { data: allPersons } = await admin
      .from("persons")
      .select("person_id, canonical_name, aliases, cluster")
      .eq("user_id", userId);
    const persons = (allPersons ?? []) as PersonRow[];
    const connector =
      matchPerson(referral.connector, persons) ??
      ({ personId: "", name: referral.connector, cluster: null } as ChatPathPerson);
    const target =
      matchPerson(referral.target, persons) ??
      ({ personId: "", name: referral.target, cluster: null } as ChatPathPerson);
    path = connector.name === target.name ? [connector] : [connector, target];
  }

  // "via" = the notes behind the answer. For a referral, that's the connector's
  // memory (the target has no note); otherwise every cited person.
  let sources = [...new Set(citedPersons.map((p) => p.name))];
  if (referral) {
    const pathSources = path.filter((p) => p.personId).map((p) => p.name);
    if (pathSources.length) sources = pathSources;
  }

  // qa_id is not in the recall response — it lives in the session's QA entries
  let qaId: string | null = null;
  try {
    const session = await sessions.get(cogneeSessionId);
    qaId = (findLastKey(session, "qa_id") as string | undefined) ?? null;
  } catch {
    qaId = null;
  }

  return {
    conversationId,
    sessionId: cogneeSessionId,
    text,
    evidence,
    path,
    sources,
    qaId,
    mode: modeFor(path[0]?.cluster),
  };
}

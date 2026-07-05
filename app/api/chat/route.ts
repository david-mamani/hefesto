import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureProvisioned } from "@/memory/provisioning";
import { recall, sessions, splitEvidence, StillMemorizingError } from "@/lib/cognee";

type ChatBody = {
  message: string;
  conversationId?: string;
  thinkDeeper?: boolean;
};

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

function modeFor(cluster: string | null | undefined): "networking" | "personal" | "family" {
  if (cluster === "work") return "networking";
  if (cluster === "family") return "family";
  return "personal";
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

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as ChatBody | null;
  if (!body?.message?.trim()) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }

  try {
    // Dataset identity ALWAYS derives from the session user — never from the client
    const memory = await ensureProvisioned(user.id);
    const admin = createAdminClient();

    let conversationId = body.conversationId ?? null;
    let cogneeSessionId: string;
    if (conversationId) {
      const { data: conversation } = await admin
        .from("conversations")
        .select("conversation_id, cognee_session_id")
        .eq("user_id", user.id)
        .eq("conversation_id", conversationId)
        .maybeSingle();
      if (!conversation) {
        return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
      }
      cogneeSessionId = conversation.cognee_session_id;
    } else {
      const { data: created, error } = await admin
        .from("conversations")
        .insert({ user_id: user.id })
        .select("conversation_id, cognee_session_id")
        .single();
      if (error || !created) {
        return NextResponse.json({ error: "Could not start conversation" }, { status: 500 });
      }
      conversationId = created.conversation_id;
      cogneeSessionId = created.cognee_session_id;
    }

    let raw: unknown;
    try {
      raw = await recall({
        query: body.message.trim(),
        searchType: body.thinkDeeper ? "GRAPH_COMPLETION_COT" : "GRAPH_COMPLETION",
        datasets: [memory.datasetName],
        sessionId: cogneeSessionId,
        includeReferences: true,
      });
    } catch (error) {
      if (error instanceof StillMemorizingError) {
        return NextResponse.json({
          conversationId,
          sessionId: cogneeSessionId,
          text: "I'm still forging your memories — give me a moment and ask again.",
          evidence: [],
          path: [],
          qaId: null,
          mode: "personal",
          pending: true,
        });
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

    // path[] is derived app-side: cited data_ids → person_data → persons (§17.C)
    let path: ChatPathPerson[] = [];
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
            return person.user_id === user.id;
          })
          .map((r) => {
            const person = r.persons as unknown as {
              person_id: string;
              canonical_name: string;
              cluster: ChatPathPerson["cluster"];
            };
            return [
              r.data_id,
              {
                personId: person.person_id,
                name: person.canonical_name,
                cluster: person.cluster,
              },
            ] as const;
          })
      );
      const seen = new Set<string>();
      for (const entry of evidence) {
        const person = byDataId.get(entry.dataId);
        entry.personName = person?.name ?? null;
        if (person && !seen.has(person.personId)) {
          seen.add(person.personId);
          path.push(person);
        }
      }
    }

    // qa_id is not in the recall response — it lives in the session's QA entries
    let qaId: string | null = null;
    try {
      const session = await sessions.get(cogneeSessionId);
      qaId = (findLastKey(session, "qa_id") as string | undefined) ?? null;
    } catch {
      qaId = null;
    }

    return NextResponse.json({
      conversationId,
      sessionId: cogneeSessionId,
      text,
      evidence,
      path,
      qaId,
      mode: modeFor(path[0]?.cluster),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Recall failed" },
      { status: 500 }
    );
  }
}

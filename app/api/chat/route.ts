import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { answerQuestion, ConversationNotFoundError } from "@/lib/answer";

export type { ChatEvidence, ChatPathPerson } from "@/lib/answer";

type ChatBody = {
  message: string;
  conversationId?: string;
  thinkDeeper?: boolean;
};

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
    const answer = await answerQuestion(user.id, body.message, {
      thinkDeeper: body.thinkDeeper,
      conversationId: body.conversationId ?? null,
    });
    return NextResponse.json(answer);
  } catch (error) {
    if (error instanceof ConversationNotFoundError) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Recall failed" },
      { status: 500 }
    );
  }
}

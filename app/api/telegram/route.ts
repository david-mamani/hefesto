import { NextResponse, after } from "next/server";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureProvisioned } from "@/memory/provisioning";
import { extractCapture } from "@/lib/groq";
import { transcribeAudio } from "@/lib/whisper";
import { telegram } from "@/lib/telegram";
import { saveCapture, waitAndRecord } from "@/lib/save-capture";
import { extractionToFields, type ConfirmedFields } from "@/lib/capture";
import { answerQuestion, ConversationNotFoundError } from "@/lib/answer";
import { personBriefing } from "@/lib/briefing";

/*
 * Telegram inbound (PRD §9.1, multi-user). Validates the secret header, then
 * routes per chat: /start <token> links the chat to its Hefesto account,
 * capture notes (text or voice) run through the SAME extract → confirm →
 * remember pipeline as the web app (confirmation = inline ✅ Save / ✏️ Edit /
 * ❌ Discard), questions ("?") go through the shared recall pipeline, and
 * /briefing <name> prepares a meeting. Responds 200 immediately; all work
 * happens in after() so Telegram never retries.
 */

const CLUSTER_LABEL: Record<string, string> = {
  work: "Networking",
  personal: "Personal",
  family: "Family",
};

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

const esc = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const LINK_HINT =
  "This chat isn't linked to a Hefesto account yet.\n" +
  "Open <b>hefesto.org</b> → Account → <b>Connect Telegram</b> and tap the link — takes ten seconds.";

const WELCOME =
  "⚒️ <b>Linked!</b> I'm Hefesto — your relationship memory.\n\n" +
  "• Send a note or a voice message about someone you met — I'll forge it into your graph.\n" +
  "• Ask me anything with a “?” — I answer from your own memories.\n" +
  "• /briefing &lt;name&gt; — prep before you meet someone.\n\n" +
  "When a contact is going cold, I'll nudge you right here.";

const HELP =
  "🐱 Here's what I can do:\n\n" +
  "• A note or voice message about someone → confirmation card → your graph.\n" +
  "• A question ending in “?” → an answer grounded in your memories.\n" +
  "• /briefing &lt;name&gt; → a pre-meeting briefing.";

function formatCard(fields: ConfirmedFields): string {
  const lines = [`🐱 <b>${esc(fields.name || "Someone new")}</b>`];
  const roleCompany = [fields.role, fields.company ? `at ${fields.company}` : null]
    .filter(Boolean)
    .join(" ");
  if (roleCompany) lines.push(esc(roleCompany));
  lines.push(`<i>${CLUSTER_LABEL[fields.cluster] ?? "Personal"}</i>`);
  const bullets = [
    ...fields.facts,
    ...fields.commitments.map((c) => `${fields.name} ${c}`),
  ];
  if (bullets.length) lines.push("", ...bullets.map((b) => `• ${esc(b)}`));
  return lines.join("\n");
}

const CARD_BUTTONS = (id: string) => [
  [
    { text: "✅ Save", callback_data: `save:${id}` },
    { text: "✏️ Edit", callback_data: `edit:${id}` },
    { text: "❌ Discard", callback_data: `discard:${id}` },
  ],
];

type TgMessage = {
  chat?: { id?: number };
  text?: string;
  voice?: { file_id?: string };
};

type TgCallback = {
  id: string;
  data?: string;
  message?: { chat?: { id?: number }; message_id?: number };
};

async function handleStart(chatId: number, payload: string) {
  const admin = createAdminClient();
  if (!payload) {
    const { data: link } = await admin
      .from("telegram_links")
      .select("user_id")
      .eq("telegram_chat_id", chatId)
      .maybeSingle();
    await telegram.sendMessage(chatId, link ? HELP : LINK_HINT).catch(() => {});
    return;
  }

  const { data: token } = await admin
    .from("link_tokens")
    .select("token_hash, user_id, expires_at, used_at")
    .eq("token_hash", sha256(payload))
    .maybeSingle();

  const valid =
    token && !token.used_at && new Date(token.expires_at).getTime() > Date.now();
  if (!valid) {
    await telegram
      .sendMessage(
        chatId,
        "That link has expired — open Hefesto → Account → <b>Connect Telegram</b> for a fresh one."
      )
      .catch(() => {});
    return;
  }

  await admin
    .from("link_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("token_hash", token.token_hash);
  await admin
    .from("telegram_links")
    .upsert({ telegram_chat_id: chatId, user_id: token.user_id, conversation_id: null });
  await telegram.sendMessage(chatId, WELCOME).catch(() => {});
}

async function handleBriefing(chatId: number, userId: string, query: string) {
  const admin = createAdminClient();
  if (!query) {
    await telegram
      .sendMessage(chatId, "Who should I brief you on? e.g. <b>/briefing Ana</b>")
      .catch(() => {});
    return;
  }

  const { data: persons } = await admin
    .from("persons")
    .select("person_id, canonical_name, aliases")
    .eq("user_id", userId);
  const norm = query.toLowerCase();
  const matches = (persons ?? []).filter((p) => {
    const names = [p.canonical_name, ...((p.aliases as string[] | null) ?? [])];
    return names.some((n) => n.toLowerCase().includes(norm));
  });

  if (!matches.length) {
    await telegram
      .sendMessage(chatId, `I don't know <b>${esc(query)}</b> yet — send me a note about them first.`)
      .catch(() => {});
    return;
  }
  if (matches.length > 1) {
    const names = matches.map((m) => `• ${esc(m.canonical_name)}`).join("\n");
    await telegram
      .sendMessage(chatId, `Which one?\n${names}\n\nTry the full name, e.g. /briefing ${esc(matches[0].canonical_name)}`)
      .catch(() => {});
    return;
  }

  await telegram.sendMessage(chatId, "⚒️ Forging the briefing…").catch(() => {});
  try {
    const b = await personBriefing(userId, matches[0].person_id);
    const points = b.keyPoints.map((k) => `• ${esc(k)}`).join("\n");
    await telegram.sendMessage(
      chatId,
      `📋 <b>${esc(b.title)}</b>\n` +
        `<i>${esc(b.name)} · ${CLUSTER_LABEL[b.cluster ?? "personal"]} · last seen ${esc(b.gap)}</i>\n\n` +
        `${esc(b.summary)}\n\n${points}`
    );
  } catch {
    await telegram
      .sendMessage(chatId, "That briefing didn't come together — try again in a moment.")
      .catch(() => {});
  }
}

async function handleQuestion(chatId: number, userId: string, question: string) {
  const admin = createAdminClient();
  const { data: link } = await admin
    .from("telegram_links")
    .select("conversation_id")
    .eq("telegram_chat_id", chatId)
    .maybeSingle();

  const ask = (conversationId: string | null) =>
    answerQuestion(userId, question, { conversationId });

  try {
    let answer;
    try {
      answer = await ask(link?.conversation_id ?? null);
    } catch (error) {
      // A stale conversation (e.g. relinked account) starts a fresh one.
      if (error instanceof ConversationNotFoundError) answer = await ask(null);
      else throw error;
    }
    if (answer.conversationId !== link?.conversation_id) {
      await admin
        .from("telegram_links")
        .update({ conversation_id: answer.conversationId })
        .eq("telegram_chat_id", chatId);
    }

    const parts = [esc(answer.text)];
    const quotes = answer.evidence
      .slice(0, 2)
      .map((e) => `<i>“${esc(e.quote.length > 120 ? `${e.quote.slice(0, 120)}…` : e.quote)}”</i>`);
    if (quotes.length) parts.push("", ...quotes);
    if (answer.path.length >= 2) {
      parts.push("", `🐾 You → ${answer.path.map((p) => esc(p.name)).join(" → ")}`);
    } else if (answer.sources.length) {
      parts.push("", `🐾 via ${answer.sources.map(esc).join(" · ")}`);
    }
    await telegram.sendMessage(chatId, parts.join("\n"));
  } catch {
    await telegram
      .sendMessage(chatId, "I couldn't reach your memories just now — try again in a moment.")
      .catch(() => {});
  }
}

async function handleCorrection(
  chatId: number,
  pending: { id: string; source_text: string },
  correction: string
) {
  const admin = createAdminClient();
  const combined = `${pending.source_text}\nCorrection: ${correction}`;
  try {
    const fields = extractionToFields(await extractCapture(combined));
    await admin
      .from("telegram_captures")
      .update({ fields, source_text: combined, status: "pending" })
      .eq("id", pending.id);
    await telegram.sendMessage(chatId, formatCard(fields), CARD_BUTTONS(pending.id));
  } catch {
    await telegram
      .sendMessage(chatId, "I couldn't apply that correction — try rephrasing it.")
      .catch(() => {});
  }
}

async function handleMessage(message: TgMessage) {
  const chatId = message.chat?.id;
  if (!chatId) return;

  let text = message.text?.trim() ?? "";

  // /start works before the chat is linked — it's how the link happens.
  if (text.startsWith("/start")) {
    await handleStart(chatId, text.slice("/start".length).trim());
    return;
  }

  const admin = createAdminClient();
  const { data: link } = await admin
    .from("telegram_links")
    .select("user_id")
    .eq("telegram_chat_id", chatId)
    .maybeSingle();
  const userId = link?.user_id as string | undefined;
  if (!userId) {
    await telegram.sendMessage(chatId, LINK_HINT).catch(() => {});
    return;
  }

  if (!text && message.voice?.file_id) {
    const file = await telegram.getFile(message.voice.file_id);
    const blob = await telegram.downloadFile(file.file_path);
    text = (await transcribeAudio(blob, "voice.ogg")).trim();
  }
  if (!text) {
    await telegram
      .sendMessage(chatId, "Send me a note or a voice message about someone you met.")
      .catch(() => {});
    return;
  }

  const command = text.match(/^\/([a-z]+)(?:@\w+)?\s*([\s\S]*)$/i);
  if (command) {
    const [, name, rest] = command;
    if (name.toLowerCase() === "help") {
      await telegram.sendMessage(chatId, HELP).catch(() => {});
    } else if (name.toLowerCase() === "briefing") {
      await handleBriefing(chatId, userId, rest.trim());
    } else {
      await telegram.sendMessage(chatId, HELP).catch(() => {});
    }
    return;
  }

  // An in-flight ✏️ Edit claims the next plain message as its correction.
  const { data: editing } = await admin
    .from("telegram_captures")
    .select("id, source_text")
    .eq("user_id", userId)
    .eq("status", "editing")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (editing) {
    await handleCorrection(chatId, editing, text);
    return;
  }

  if (text.includes("?")) {
    await handleQuestion(chatId, userId, text);
    return;
  }

  await ensureProvisioned(userId);
  const fields = extractionToFields(await extractCapture(text));

  const { data: pending } = await admin
    .from("telegram_captures")
    .insert({ user_id: userId, fields, source_text: text, channel: "telegram" })
    .select("id")
    .single();
  if (!pending) return;

  await telegram.sendMessage(chatId, formatCard(fields), CARD_BUTTONS(pending.id));
}

async function handleCallback(cb: TgCallback) {
  await telegram.answerCallbackQuery(cb.id).catch(() => {});
  const [action, id] = (cb.data ?? "").split(":");
  const chatId = cb.message?.chat?.id;
  const messageId = cb.message?.message_id;
  if (!id || !chatId || !messageId) return;

  const admin = createAdminClient();
  const { data: pending } = await admin
    .from("telegram_captures")
    .select("id, user_id, fields, source_text")
    .eq("id", id)
    .maybeSingle();
  if (!pending) {
    await telegram.editMessageText(chatId, messageId, "This capture has expired.").catch(() => {});
    return;
  }

  if (action === "discard") {
    await admin.from("telegram_captures").delete().eq("id", id);
    await telegram.editMessageText(chatId, messageId, "❌ Discarded.").catch(() => {});
    return;
  }

  if (action === "edit") {
    await admin.from("telegram_captures").update({ status: "editing" }).eq("id", id);
    await telegram
      .editMessageText(
        chatId,
        messageId,
        `${formatCard(pending.fields as ConfirmedFields)}\n\n✏️ <b>Reply with your correction</b> — I'll update the card.`,
        [[{ text: "❌ Discard", callback_data: `discard:${id}` }]]
      )
      .catch(() => {});
    return;
  }

  if (action === "save") {
    await telegram.editMessageText(chatId, messageId, "⚒️ Forging your memory…").catch(() => {});
    try {
      const result = await saveCapture({
        userId: pending.user_id,
        resolution: "new",
        fields: pending.fields as ConfirmedFields,
        sourceText: pending.source_text,
        channel: "telegram",
      });
      const status = await waitAndRecord(result.datasetId, result.filename, result.personId);
      await admin.from("telegram_captures").delete().eq("id", id);
      const msg =
        status.status === "failed"
          ? "That one didn't take — try sending it again."
          : `✅ Saved. <b>${esc(result.canonicalName)}</b> is now part of your graph.`;
      await telegram.editMessageText(chatId, messageId, msg).catch(() => {});
    } catch {
      await telegram
        .editMessageText(chatId, messageId, "Something went wrong saving that — try again.")
        .catch(() => {});
    }
  }
}

export async function POST(request: Request) {
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (!process.env.TELEGRAM_WEBHOOK_SECRET || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return new NextResponse("forbidden", { status: 401 });
  }

  const update = (await request.json().catch(() => null)) as {
    message?: TgMessage;
    callback_query?: TgCallback;
  } | null;

  if (update) {
    after(async () => {
      try {
        if (update.callback_query) await handleCallback(update.callback_query);
        else if (update.message) await handleMessage(update.message);
      } catch {
        // Always 200 to Telegram; nothing to retry-storm on.
      }
    });
  }

  return NextResponse.json({ ok: true });
}

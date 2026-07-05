import { NextResponse, after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureProvisioned } from "@/memory/provisioning";
import { extractCapture } from "@/lib/groq";
import { transcribeAudio } from "@/lib/whisper";
import { telegram } from "@/lib/telegram";
import { saveCapture, waitAndRecord } from "@/lib/save-capture";
import { extractionToFields, type ConfirmedFields } from "@/lib/capture";

/*
 * Telegram inbound capture (demo). Validates the secret header, serves only the
 * hardcoded demo chat, and runs text/voice through the SAME extract → confirm →
 * remember pipeline as the web app, with the confirmation as inline buttons.
 * Responds 200 immediately; all work happens in after() so Telegram never retries.
 */

const CLUSTER_LABEL: Record<string, string> = {
  work: "Networking",
  personal: "Personal",
  family: "Family",
};

function formatCard(fields: ConfirmedFields): string {
  const lines = [`🐱 <b>${fields.name || "Someone new"}</b>`];
  const roleCompany = [fields.role, fields.company ? `at ${fields.company}` : null]
    .filter(Boolean)
    .join(" ");
  if (roleCompany) lines.push(roleCompany);
  lines.push(`<i>${CLUSTER_LABEL[fields.cluster] ?? "Personal"}</i>`);
  const bullets = [
    ...fields.facts,
    ...fields.commitments.map((c) => `${fields.name} ${c}`),
  ];
  if (bullets.length) lines.push("", ...bullets.map((b) => `• ${b}`));
  return lines.join("\n");
}

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

async function handleMessage(message: TgMessage) {
  const chatId = message.chat?.id;
  if (!chatId) return;

  const demoChatId = Number(process.env.TELEGRAM_DEMO_CHAT_ID);
  if (!demoChatId || chatId !== demoChatId) {
    await telegram.sendMessage(chatId, "Hefesto is in private beta 🐱").catch(() => {});
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
    await telegram.sendMessage(chatId, "Link your Hefesto account first 🐱").catch(() => {});
    return;
  }

  let text = message.text?.trim() ?? "";
  if (!text && message.voice?.file_id) {
    const file = await telegram.getFile(message.voice.file_id);
    const blob = await telegram.downloadFile(file.file_path);
    text = await transcribeAudio(blob, "voice.ogg");
  }
  if (!text) {
    await telegram
      .sendMessage(chatId, "Send me a note or a voice message about someone you met.")
      .catch(() => {});
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

  await telegram.sendMessage(chatId, formatCard(fields), [
    [
      { text: "✅ Save", callback_data: `save:${pending.id}` },
      { text: "❌ Discard", callback_data: `discard:${pending.id}` },
    ],
  ]);
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
          : `✅ Saved. <b>${result.canonicalName}</b> is now part of your graph.`;
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

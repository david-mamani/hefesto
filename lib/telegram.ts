/*
 * Telegram Bot API client (server-side only). Used for the outbound nudge and the
 * inbound capture webhook. Token comes from TELEGRAM_BOT_TOKEN.
 */

const API = "https://api.telegram.org";

function token(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  return t;
}

/** Bare bot username — tolerates "@name", "t.me/name" and full-URL forms in the env var. */
export function botUsername(): string {
  const raw = process.env.TELEGRAM_BOT_USERNAME ?? "";
  const bare = raw
    .replace(/^https?:\/\//i, "")
    .replace(/^(www\.)?t(elegram)?\.me\//i, "")
    .replace(/^@/, "")
    .replace(/\/+$/, "")
    .trim();
  if (!bare) throw new Error("TELEGRAM_BOT_USERNAME is not set");
  return bare;
}

/** One-tap link that opens the bot with `/start <token>` prefilled. */
export function deepLink(startToken: string): string {
  return `https://t.me/${botUsername()}?start=${startToken}`;
}

async function call<T = unknown>(method: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API}/bot${token()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!data.ok) throw new Error(`Telegram ${method} failed: ${data.description ?? "unknown"}`);
  return data.result as T;
}

export type InlineButton = { text: string; callback_data: string };

export const telegram = {
  sendMessage: (chatId: number | string, text: string, buttons?: InlineButton[][]) =>
    call<{ message_id: number }>("sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}),
    }),

  editMessageText: (
    chatId: number | string,
    messageId: number,
    text: string,
    buttons?: InlineButton[][]
  ) =>
    call("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: "HTML",
      reply_markup: buttons ? { inline_keyboard: buttons } : { inline_keyboard: [] },
    }),

  answerCallbackQuery: (callbackQueryId: string, text?: string) =>
    call("answerCallbackQuery", { callback_query_id: callbackQueryId, ...(text ? { text } : {}) }),

  getFile: (fileId: string) => call<{ file_path: string }>("getFile", { file_id: fileId }),

  downloadFile: async (filePath: string): Promise<Blob> => {
    const res = await fetch(`${API}/file/bot${token()}/${filePath}`);
    if (!res.ok) throw new Error(`Telegram file download failed: ${res.status}`);
    return res.blob();
  },

  setWebhook: (url: string, secretToken: string) =>
    call("setWebhook", {
      url,
      secret_token: secretToken,
      allowed_updates: ["message", "callback_query"],
    }),

  deleteWebhook: () => call("deleteWebhook", { drop_pending_updates: true }),

  setMyCommands: (commands: { command: string; description: string }[]) =>
    call("setMyCommands", { commands }),

  getWebhookInfo: () => call<Record<string, unknown>>("getWebhookInfo", {}),

  getUpdates: () => call<unknown[]>("getUpdates", {}),
};

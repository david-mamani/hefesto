/*
 * Telegram webhook + demo-chat linker (re-runnable).
 *
 *   npx tsx scripts/telegram-setup.ts find            # discover your chat_id (message the bot first)
 *   npx tsx scripts/telegram-setup.ts [demo-email]    # register the webhook + link the demo chat
 *
 * Env (from .env.local): TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET,
 * TELEGRAM_DEMO_CHAT_ID, optional TELEGRAM_WEBHOOK_URL (defaults to prod).
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..");
try {
  for (const line of readFileSync(join(appRoot, ".env.local"), "utf8").split(/\r?\n/)) {
    const eq = line.indexOf("=");
    if (eq <= 0 || line.trimStart().startsWith("#")) continue;
    const k = line.slice(0, eq).trim();
    if (k && !(k in process.env)) process.env[k] = line.slice(eq + 1).trim();
  }
} catch {
  // ambient env
}

import { telegram } from "../lib/telegram";

const WEBHOOK_URL = process.env.TELEGRAM_WEBHOOK_URL ?? "https://hefesto.org/api/telegram";

async function find() {
  console.log("Discovering chats — make sure you've sent /start to the bot.\n");
  await telegram.deleteWebhook().catch(() => {});
  const updates = (await telegram.getUpdates()) as {
    message?: { chat?: { id?: number; first_name?: string; username?: string }; text?: string };
  }[];
  if (!updates.length) {
    console.log("No updates yet. Send the bot a message, then re-run: npx tsx scripts/telegram-setup.ts find");
    return;
  }
  const seen = new Set<number>();
  for (const u of updates) {
    const chat = u.message?.chat;
    if (!chat?.id || seen.has(chat.id)) continue;
    seen.add(chat.id);
    console.log(`chat_id=${chat.id}  ·  ${chat.first_name ?? ""} ${chat.username ? "@" + chat.username : ""}  ·  "${u.message?.text ?? ""}"`);
  }
  console.log("\nPut the right chat_id into TELEGRAM_DEMO_CHAT_ID, then re-run without 'find'.");
}

async function setup(email: string | undefined) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const chatId = Number(process.env.TELEGRAM_DEMO_CHAT_ID);
  if (!secret) throw new Error("TELEGRAM_WEBHOOK_SECRET is not set");
  if (!chatId) throw new Error("TELEGRAM_DEMO_CHAT_ID is not set (run `find` first)");

  await telegram.setWebhook(WEBHOOK_URL, secret);
  console.log(`✔ webhook set → ${WEBHOOK_URL}`);

  if (email) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
    let userId: string | undefined;
    for (let page = 1; page <= 20 && !userId; page++) {
      const { data } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
      userId = data.users.find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase())?.id;
      if (data.users.length < 200) break;
    }
    if (!userId) throw new Error(`No Supabase user with email ${email}`);
    await supabase.from("telegram_links").upsert({ telegram_chat_id: chatId, user_id: userId });
    console.log(`✔ linked chat ${chatId} → ${email}`);
  } else {
    console.log("(no email given — skipped account linking; pass the demo email to enable inbound + nudges)");
  }

  const info = (await telegram.getWebhookInfo()) as { url?: string; pending_update_count?: number };
  console.log(`\nwebhook info: url=${info.url} · pending=${info.pending_update_count}`);
}

const arg = process.argv[2];
(arg === "find" ? find() : setup(arg)).catch((e) => {
  console.error("telegram-setup failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});

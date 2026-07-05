import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getNetwork } from "@/lib/network";
import { telegram } from "@/lib/telegram";

/*
 * On-open nudge → Telegram. When Home loads and a contact is going cold, the nudge
 * is also pushed to the user's linked Telegram chat. Throttled in-memory so a burst
 * of reloads doesn't spam the chat (the Home card itself is rendered server-side).
 */
const lastSent = new Map<number, number>();
const THROTTLE_MS = 60_000;

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  try {
    const { nudge } = await getNetwork(user.id);
    if (!nudge) return NextResponse.json({ nudge: null, sent: false });

    if (!process.env.TELEGRAM_BOT_TOKEN) {
      return NextResponse.json({ nudge, sent: false });
    }

    const admin = createAdminClient();
    const { data: link } = await admin
      .from("telegram_links")
      .select("telegram_chat_id")
      .eq("user_id", user.id)
      .maybeSingle();
    const chatId = link?.telegram_chat_id as number | undefined;
    if (!chatId) return NextResponse.json({ nudge, sent: false });

    const now = Date.now();
    if (now - (lastSent.get(chatId) ?? 0) < THROTTLE_MS) {
      return NextResponse.json({ nudge, sent: false, throttled: true });
    }
    lastSent.set(chatId, now);

    await telegram.sendMessage(chatId, `🐱 <b>${nudge.message}</b>`).catch(() => {});

    return NextResponse.json({ nudge, sent: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nudge failed" },
      { status: 500 }
    );
  }
}

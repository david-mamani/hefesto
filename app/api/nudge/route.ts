import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getNetwork } from "@/lib/network";
import { telegram } from "@/lib/telegram";

/*
 * On-open nudge → Telegram. When Home loads and a contact is going cold, the nudge
 * is also pushed to the user's linked Telegram chat — at most one proactive push
 * per user per day (PRD §6.11), tracked via persons.last_nudge_at. A delivered
 * nudge marks the person, which starts their 7-day re-nudge cooldown (§17.1.5).
 * The in-memory throttle only guards against reload bursts within one instance.
 */
const lastSent = new Map<number, number>();
const THROTTLE_MS = 60_000;
const DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;

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

    // Max one proactive push per user per day — the most recent nudge across the
    // user's people is the last time we proactively reached out.
    const { data: recent } = await admin
      .from("persons")
      .select("last_nudge_at")
      .eq("user_id", user.id)
      .not("last_nudge_at", "is", null)
      .order("last_nudge_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recent?.last_nudge_at && now - new Date(recent.last_nudge_at).getTime() < DAILY_WINDOW_MS) {
      return NextResponse.json({ nudge, sent: false, throttled: true });
    }
    lastSent.set(chatId, now);

    const delivered = await telegram
      .sendMessage(chatId, `🐱 <b>${nudge.message}</b>`)
      .then(() => true)
      .catch(() => false);

    if (delivered) {
      await admin
        .from("persons")
        .update({ last_nudge_at: new Date(now).toISOString() })
        .eq("user_id", user.id)
        .eq("person_id", nudge.personId);
    }

    return NextResponse.json({ nudge, sent: delivered });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nudge failed" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { botUsername, deepLink } from "@/lib/telegram";

/*
 * Connect Telegram (PRD §9.1). POST mints a one-time token (only its SHA-256
 * hash is stored, 10-minute expiry) and returns the t.me deep link; the bot
 * resolves `/start <token>` back to this user. GET reports the link state so
 * the connect screen can flip live; DELETE unlinks every chat of the user.
 */

const TOKEN_TTL_MS = 10 * 60 * 1000;

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  try {
    const admin = createAdminClient();
    // One live token per user — a fresh request invalidates older ones.
    await admin.from("link_tokens").delete().eq("user_id", user.id);

    const token = randomBytes(24).toString("base64url"); // 32 chars, fits /start's 64-char payload
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
    const { error } = await admin.from("link_tokens").insert({
      token_hash: sha256(token),
      user_id: user.id,
      expires_at: expiresAt,
    });
    if (error) throw new Error("Could not create the link token");

    const url = deepLink(token);
    // Ink modules on a transparent back — the card behind provides the paper.
    const qrDataUrl = await QRCode.toDataURL(url, {
      errorCorrectionLevel: "M",
      margin: 1,
      scale: 8,
      color: { dark: "#1c1611ff", light: "#00000000" },
    });

    return NextResponse.json({
      url,
      qrDataUrl,
      botUsername: botUsername(),
      expiresAt,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Link failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const admin = createAdminClient();
  const { count } = await admin
    .from("telegram_links")
    .select("telegram_chat_id", { count: "exact", head: true })
    .eq("user_id", user.id);

  let username: string | null = null;
  try {
    username = botUsername();
  } catch {
    username = null;
  }
  return NextResponse.json({ linked: (count ?? 0) > 0, botUsername: username });
}

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const admin = createAdminClient();
  await admin.from("telegram_links").delete().eq("user_id", user.id);
  await admin.from("link_tokens").delete().eq("user_id", user.id);
  return NextResponse.json({ linked: false });
}

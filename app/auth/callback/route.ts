import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProvisioned } from "@/memory/provisioning";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Provision the user's memory (idempotent); failures retry on first capture
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) await ensureProvisioned(user.id).catch(() => {});

      return NextResponse.redirect(`${origin}${next.startsWith("/") ? next : "/"}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}

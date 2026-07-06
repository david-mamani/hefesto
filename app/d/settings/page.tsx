import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DesktopSettings } from "@/components/settings/DesktopSettings";
import type { ThemePref } from "@/lib/theme";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const fullName = (user?.user_metadata?.full_name as string | undefined) ?? "";
  const name = fullName || user?.email?.split("@")[0] || "there";
  const email = user?.email ?? "";
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "recently";

  let telegramLinked = false;
  if (user) {
    const admin = createAdminClient();
    const { count } = await admin
      .from("telegram_links")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);
    telegramLinked = (count ?? 0) > 0;
  }

  const cookieStore = await cookies();
  const themeValue = cookieStore.get("theme")?.value;
  const initialTheme: ThemePref =
    themeValue === "dark" || themeValue === "system" ? themeValue : "light";
  const initialNudges = cookieStore.get("nudges")?.value !== "off";

  return (
    <DesktopSettings
      name={name}
      email={email}
      accountLabel="student account"
      memberSince={memberSince}
      telegramLinked={telegramLinked}
      initialTheme={initialTheme}
      initialNudges={initialNudges}
    />
  );
}

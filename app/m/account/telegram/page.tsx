import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ConnectTelegram } from "@/components/settings/ConnectTelegram";

export default async function ConnectTelegramPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let linked = false;
  if (user) {
    const admin = createAdminClient();
    const { count } = await admin
      .from("telegram_links")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);
    linked = (count ?? 0) > 0;
  }

  return <ConnectTelegram initialLinked={linked} />;
}

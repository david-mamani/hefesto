import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/*
 * Service-role client — bypasses RLS. Server-side only, for the app's own
 * registry writes (provisioning, capture bookkeeping, Telegram mapping).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin environment variables are not set");

  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

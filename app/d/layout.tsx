import { createClient } from "@/lib/supabase/server";
import { DesktopShell } from "@/components/DesktopShell";

export default async function DesktopLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const fullName = (user?.user_metadata?.full_name as string | undefined) ?? "";
  const name = fullName || user?.email?.split("@")[0] || "there";
  const secondary = user?.email ?? "";

  return (
    <DesktopShell name={name} secondary={secondary}>
      {children}
    </DesktopShell>
  );
}

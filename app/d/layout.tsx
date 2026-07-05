import { createClient } from "@/lib/supabase/server";
import { DesktopSidebar } from "@/components/DesktopSidebar";

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
    <div className="max-w-[1440px] mx-auto flex gap-9 px-6 py-6 min-h-dvh">
      <DesktopSidebar name={name} secondary={secondary} />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}

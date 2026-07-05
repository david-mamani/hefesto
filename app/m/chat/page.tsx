import { createClient } from "@/lib/supabase/server";
import { RingAvatar } from "@/components/RingAvatar";
import { HefestoSprite } from "@/components/HefestoSprite";
import { ChatView } from "@/components/chat/ChatView";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "";
  const initial = (displayName[0] ?? "H").toUpperCase();

  return (
    <main className="px-6 flex flex-col min-h-[calc(100dvh-104px)]">
      <header className="flex items-center gap-3 pt-12">
        <RingAvatar initial={initial} />
        <h1 className="font-semibold text-[26px] text-ink">Chat</h1>
        <HefestoSprite scale={2} className="ml-auto -mt-3" />
      </header>

      <ChatView initialQuestion={q?.trim() || undefined} />
    </main>
  );
}

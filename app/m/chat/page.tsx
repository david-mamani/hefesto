import { createClient } from "@/lib/supabase/server";
import { ChatView } from "@/components/chat/ChatView";
import { SUGGESTED_QUESTIONS } from "@/lib/suggested";

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
      <ChatView
        headerInitial={initial}
        initialQuestion={q?.trim() || undefined}
        suggestions={SUGGESTED_QUESTIONS}
      />
    </main>
  );
}

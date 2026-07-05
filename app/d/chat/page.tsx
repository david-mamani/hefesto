import { DesktopChat } from "@/components/chat/DesktopChat";

export default async function DesktopChatPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  return <DesktopChat initialQuestion={q?.trim() || undefined} />;
}

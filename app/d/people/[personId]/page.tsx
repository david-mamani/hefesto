import { redirect } from "next/navigation";

// Mobile links use /people/{id} — on desktop the card is the ?person= panel.
export default async function DesktopPersonRedirect({
  params,
}: {
  params: Promise<{ personId: string }>;
}) {
  const { personId } = await params;
  redirect(`/people?person=${personId}`);
}

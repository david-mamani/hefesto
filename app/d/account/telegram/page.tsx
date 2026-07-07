import { redirect } from "next/navigation";

// Desktop links Telegram from Settings (M10e) — the M04 screen is mobile-only.
export default function DesktopConnectTelegramRedirect() {
  redirect("/settings");
}

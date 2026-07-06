import { redirect } from "next/navigation";

// On desktop the settings screen carries the account (Figma M10e).
export default function DesktopAccountAlias() {
  redirect("/settings");
}

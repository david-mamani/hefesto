import { redirect } from "next/navigation";

// On mobile the account screen carries the settings (Figma M09).
export default function MobileSettingsAlias() {
  redirect("/account");
}

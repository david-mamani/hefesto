/*
 * Theme + preference cookies (client-side). Light is the default; dark swaps
 * the token set via [data-theme="dark"] (globals.css); system follows the OS.
 * Cookies (not localStorage) so the root layout can render the right
 * data-theme server-side — no flash of the wrong theme.
 */

export type ThemePref = "light" | "dark" | "system";

export const THEME_ORDER: ThemePref[] = ["light", "dark", "system"];

const YEAR = 60 * 60 * 24 * 365;

function readCookie(name: string): string | null {
  const hit = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
}

export function currentTheme(): ThemePref {
  const value = readCookie("theme");
  return value === "dark" || value === "system" ? value : "light";
}

/** Flip the token set on <html> right now. */
export function applyTheme(pref: ThemePref): void {
  const dark =
    pref === "dark" ||
    (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  if (dark) document.documentElement.dataset.theme = "dark";
  else delete document.documentElement.dataset.theme;
}

export function saveTheme(pref: ThemePref): void {
  document.cookie = `theme=${pref}; path=/; max-age=${YEAR}; samesite=lax`;
  applyTheme(pref);
}

/** Proactive nudges preference — Home skips the on-open push when off. */
export function nudgesEnabled(): boolean {
  return readCookie("nudges") !== "off";
}

export function saveNudges(on: boolean): void {
  document.cookie = `nudges=${on ? "on" : "off"}; path=/; max-age=${YEAR}; samesite=lax`;
}

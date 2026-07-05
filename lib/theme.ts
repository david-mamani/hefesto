export type Theme = "light" | "dark";

const YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

/*
 * Theme is persisted in a cookie (not localStorage) so the server can render
 * the correct data-theme attribute on first paint — no flash of wrong theme.
 */
export function applyTheme(theme: Theme) {
  if (theme === "dark") {
    document.documentElement.dataset.theme = "dark";
  } else {
    delete document.documentElement.dataset.theme;
  }
  document.cookie = `theme=${theme}; path=/; max-age=${YEAR_IN_SECONDS}; samesite=lax`;
}

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

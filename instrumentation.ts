/*
 * Server-boot hook (PRD F4·P2): the Telegram webhook registers itself on every
 * production boot, so a deploy is all it takes — no manual setWebhook step.
 * Boot never fails because of Telegram: errors are logged and swallowed.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production") return;
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_WEBHOOK_SECRET) return;

  const { telegram } = await import("./lib/telegram");
  const url = process.env.TELEGRAM_WEBHOOK_URL ?? "https://hefesto.org/api/telegram";
  try {
    await telegram.setWebhook(url, process.env.TELEGRAM_WEBHOOK_SECRET);
    await telegram.setMyCommands([
      { command: "briefing", description: "Pre-meeting briefing: /briefing <name>" },
      { command: "help", description: "What Hefesto can do here" },
    ]);
    console.log(`telegram webhook registered → ${url}`);
  } catch (error) {
    console.error(
      "telegram webhook registration failed:",
      error instanceof Error ? error.message : error
    );
  }
}

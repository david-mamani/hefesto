"use client";

import Link from "next/link";
import { useTelegramLink } from "@/components/settings/useTelegramLink";

/*
 * Connect Telegram (Figma M04): one-time QR + deep-link button. The QR is the
 * real /start link; the screen flips to the linked state live once the bot
 * confirms the handshake, and offers disconnect from there.
 */

function PlaneIcon() {
  return (
    <svg width="20" height="18" viewBox="0 0 16 14" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M15 1L1 6.2L5.4 8L11.5 3.6L7.3 8.8L12.8 13L15 1Z" stroke="#F6F1E8" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

export function ConnectTelegram({ initialLinked }: { initialLinked: boolean }) {
  const { linked, url, qrDataUrl, botUsername, busy, disconnect } = useTelegramLink(initialLinked);
  const handle = botUsername ? `@${botUsername}` : "@…";

  return (
    <main className="px-6 pb-12 flex flex-col items-center">
      <div className="w-full">
        <Link href="/account" aria-label="Back" className="inline-block mt-[52px] text-ink">
          <svg width="12" height="20" viewBox="0 0 12 20" fill="none" aria-hidden="true">
            <path d="M10.5 1.5L2 10L10.5 18.5" stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>

        <h1 className="font-semibold text-[24px] text-ink mt-3">Connect Telegram</h1>
        <p className="text-[13px] text-muted mt-[14px] max-w-[340px]">
          Send Hefesto a voice note or text from Telegram — it lands straight in your memory.
        </p>
      </div>

      <div className="size-[200px] rounded-[28px] bg-[#fbf8f2] shadow-[0px_16px_38px_0px_rgba(51,31,10,0.08)] mt-9 flex items-center justify-center overflow-hidden">
        {linked ? (
          <div className="flex flex-col items-center gap-3">
            <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden="true">
              <circle cx="22" cy="22" r="21" stroke="#3FB57F" strokeWidth="2" />
              <path d="M13 22.5L19.5 29L31 16" stroke="#3FB57F" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="text-[13px] font-medium text-[#1c1611]">Linked</p>
          </div>
        ) : qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL, no optimizer pass
          <img src={qrDataUrl} alt="Scan to open the bot" className="size-[168px] [image-rendering:pixelated]" />
        ) : (
          <p className="text-[11px] text-muted">Preparing your link…</p>
        )}
      </div>

      <p className="micro-label text-[10px] tracking-[1px] text-center mt-[42px]">
        {linked ? "YOU'RE ALL SET — SAY HI TO THE BOT" : "SCAN ON DESKTOP — OR TAP BELOW"}
      </p>

      <div className="flex items-center gap-2 mt-[34px]">
        {linked ? (
          <button
            type="button"
            onClick={disconnect}
            disabled={busy}
            className="w-[200px] h-[54px] rounded-[27px] bg-white text-[15px] font-medium text-[#1C1611] disabled:opacity-60"
          >
            Disconnect
          </button>
        ) : (
          <>
            <a
              href={url ?? "#"}
              className={`w-[200px] h-[54px] rounded-[27px] bg-[#17120d] text-[15px] font-medium text-[#f6f1e8] flex items-center justify-center ${
                url ? "" : "pointer-events-none opacity-60"
              }`}
            >
              Open in Telegram
            </a>
            <a
              href={url ?? "#"}
              aria-label="Open in Telegram"
              className={`size-[54px] rounded-full bg-[#17120d] flex items-center justify-center ${
                url ? "" : "pointer-events-none opacity-60"
              }`}
            >
              <svg width="6" height="12" viewBox="0 0 6 12" fill="none" aria-hidden="true">
                <path d="M1 1L5 6L1 11" stroke="#F6F1E8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </>
        )}
      </div>

      <p className="text-[10.5px] text-muted text-center mt-[34px]">
        One-time secure link · disconnect anytime
      </p>

      <div
        className="w-[200px] h-[56px] rounded-[20px] mt-[46px] flex items-center justify-center gap-3 border border-[rgba(255,255,255,0.14)] shadow-[0px_16px_38px_0px_rgba(51,31,10,0.22)] backdrop-blur-[16px]"
        style={{ background: "rgba(36,30,24,0.55)" }}
      >
        <PlaneIcon />
        <p className="text-[13px] font-medium text-[#f6f1e8]">{handle}</p>
      </div>
    </main>
  );
}

"use client";

import { useState } from "react";
import { RingAvatar } from "@/components/RingAvatar";
import { Toggle } from "@/components/settings/Toggle";
import { saveTheme, saveNudges, THEME_ORDER, type ThemePref } from "@/lib/theme";

/*
 * Desktop Settings (Figma M10e): profile + preferences + log out on the left,
 * Connect Telegram and Privacy & data on the right. Appearance is the live
 * three-way theme control; nudges persist as a preference cookie.
 */

const PREF_LABEL: Record<ThemePref, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

function Chevron() {
  return (
    <svg width="6" height="12" viewBox="0 0 6 12" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M1 1L5 6L1 11" stroke="var(--ink)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Decorative QR block per the frame — the real one-time link ships with the bot phase.
function QrBlock() {
  const cells = [
    [0, 0, 3], [5, 0, 3], [2, 1, 1], [4, 2, 1], [1, 3, 1], [3, 3, 1], [5, 3, 1],
    [2, 4, 1], [0, 5, 3], [4, 5, 1], [5, 6, 1],
  ] as const;
  return (
    <svg width="118" height="118" viewBox="0 0 9 9" className="rounded-[10px] bg-cream shrink-0" aria-hidden="true">
      {cells.map(([x, y, s], i) =>
        s === 3 ? (
          <g key={i}>
            <rect x={x + 1} y={y + 1} width="2" height="2" fill="#141414" />
            <rect x={x + 1.5} y={y + 1.5} width="1" height="1" fill="#f6f1e8" />
            <rect x={x + 1.75} y={y + 1.75} width="0.5" height="0.5" fill="#141414" />
          </g>
        ) : (
          <rect key={i} x={x + 1.25} y={y + 1.25} width="0.6" height="0.6" fill="#141414" />
        )
      )}
    </svg>
  );
}

export function DesktopSettings({
  name,
  email,
  accountLabel,
  memberSince,
  telegramLinked,
  initialTheme,
  initialNudges,
}: {
  name: string;
  email: string;
  accountLabel: string;
  memberSince: string;
  telegramLinked: boolean;
  initialTheme: ThemePref;
  initialNudges: boolean;
}) {
  const [theme, setTheme] = useState<ThemePref>(initialTheme);
  const [nudges, setNudges] = useState(initialNudges);
  const [hint, setHint] = useState(false);

  function stub() {
    setHint(true);
    setTimeout(() => setHint(false), 2600);
  }

  return (
    <div className="pt-[20px] max-w-[1120px]">
      <h1 className="font-semibold text-[28px] text-ink">Settings</h1>
      <p className="text-[13px] text-muted mt-1">account · connections · privacy</p>

      <div className="flex gap-8 items-start mt-8">
        {/* Left column — profile, preferences, log out */}
        <div className="w-[480px] shrink-0 flex flex-col gap-6">
          <section className="glass rounded-[26px] px-7 pt-7 pb-6">
            <div className="flex items-center gap-6">
              <RingAvatar initial={(name[0] ?? "H").toUpperCase()} size={72} />
              <div className="min-w-0">
                <p className="font-semibold text-[22px] text-ink truncate">{name}</p>
                <p className="text-[12px] text-muted truncate mt-[2px]">
                  {email} · {accountLabel}
                </p>
                <button
                  type="button"
                  onClick={stub}
                  className="mt-3 h-[34px] px-5 rounded-[17px] bg-white text-[12.5px] font-medium text-[#1C1611]"
                >
                  Edit profile
                </button>
              </div>
            </div>
            <p className="micro-label text-[9px] tracking-[0.9px] mt-5">Member since {memberSince}</p>
          </section>

          <section className="glass rounded-[26px] px-7 py-5">
            <p className="micro-label text-[10px] tracking-[1px]">Preferences</p>

            <div className="flex items-center h-[56px] border-b border-[rgba(28,22,17,0.08)]">
              <span className="text-[13.5px] font-medium text-ink">Proactive nudges</span>
              <span className="ml-auto">
                <Toggle
                  on={nudges}
                  label="Proactive nudges"
                  onChange={(next) => {
                    setNudges(next);
                    saveNudges(next);
                  }}
                />
              </span>
            </div>

            <button
              type="button"
              onClick={stub}
              className="w-full flex items-center h-[56px] border-b border-[rgba(28,22,17,0.08)] text-left"
            >
              <span className="text-[13.5px] font-medium text-ink">Language</span>
              <span className="ml-auto flex items-center gap-4">
                <span className="text-[11.5px] text-muted">English</span>
                <Chevron />
              </span>
            </button>

            <div className="flex items-center h-[56px]">
              <span className="text-[13.5px] font-medium text-ink">Appearance</span>
              <span className="ml-auto flex items-center gap-[6px] text-[11.5px]">
                {THEME_ORDER.map((pref, i) => (
                  <span key={pref} className="flex items-center gap-[6px]">
                    {i > 0 && <span className="text-muted">·</span>}
                    <button
                      type="button"
                      onClick={() => {
                        setTheme(pref);
                        saveTheme(pref);
                      }}
                      className={
                        theme === pref ? "font-medium text-ink underline underline-offset-4" : "text-muted"
                      }
                    >
                      {PREF_LABEL[pref]}
                    </button>
                  </span>
                ))}
              </span>
            </div>
          </section>

          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="h-[46px] px-9 rounded-[23px] bg-white text-[13px] font-medium text-[#1C1611]"
            >
              Log out
            </button>
          </form>
          <p
            className={`text-[10.5px] text-muted -mt-3 transition-opacity ${hint ? "opacity-100" : "opacity-0"}`}
            aria-hidden={!hint}
          >
            Coming soon.
          </p>
        </div>

        {/* Right column — connections + privacy */}
        <div className="flex-1 min-w-0 flex flex-col gap-6">
          <section className="glass rounded-[26px] px-7 py-6">
            <h2 className="font-semibold text-[18px] text-ink">Connect Telegram</h2>
            <div className="flex gap-7 items-start mt-2">
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] text-muted leading-relaxed">
                  Scan the QR with your phone — capture voice notes and get nudges right in Telegram.
                </p>
                <p className="micro-label text-[9px] tracking-[0.9px] mt-5">
                  Status · {telegramLinked ? "Linked" : "Not linked"}
                </p>
                <button
                  type="button"
                  onClick={stub}
                  className="mt-3 h-[46px] px-6 rounded-[23px] flex items-center gap-3 text-[13px] font-medium text-cream"
                  style={{ background: "rgba(83,72,63,0.92)" }}
                >
                  <svg width="16" height="14" viewBox="0 0 16 14" fill="none" aria-hidden="true">
                    <path d="M15 1L1 6.2L5.4 8L11.5 3.6L7.3 8.8L12.8 13L15 1Z" stroke="#F6F1E8" strokeWidth="1.3" strokeLinejoin="round" />
                  </svg>
                  @HefestoBot
                </button>
                <p className="text-[10.5px] text-muted mt-4">
                  One-time secure link · expires in 10 min · disconnect anytime
                </p>
              </div>
              <QrBlock />
            </div>
          </section>

          <section className="glass rounded-[26px] px-7 py-6">
            <h2 className="font-semibold text-[18px] text-ink">Privacy &amp; data</h2>
            <p className="text-[12.5px] text-muted leading-relaxed mt-2 max-w-[420px]">
              Your memories are yours. Capture is always intentional and you can erase anything — or
              everything — at any time.
            </p>
            <button
              type="button"
              onClick={stub}
              className="w-full flex items-center h-[52px] border-b border-[rgba(28,22,17,0.08)] text-left mt-2"
            >
              <span className="text-[13.5px] font-medium text-ink">Export my data</span>
              <span className="ml-auto">
                <Chevron />
              </span>
            </button>
            <div className="flex items-center gap-4 mt-5">
              <button
                type="button"
                onClick={stub}
                className="h-[46px] px-6 rounded-[23px] bg-ember text-cream text-[13px] font-medium shrink-0"
              >
                Forget everything
              </button>
              <p className="text-[10.5px] text-muted leading-snug max-w-[220px]">
                removes ALL your memories — cannot be undone
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

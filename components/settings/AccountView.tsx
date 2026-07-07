"use client";

import { useState } from "react";
import Link from "next/link";
import { RingAvatar } from "@/components/RingAvatar";
import { Toggle } from "@/components/settings/Toggle";
import { EditProfileModal } from "@/components/settings/EditProfileModal";
import { PrivacySheet } from "@/components/settings/PrivacySheet";
import { saveTheme, saveNudges, THEME_ORDER, type ThemePref } from "@/lib/theme";

/*
 * Account (Figma M09): identity, the settings list, the proactive-nudges
 * switch and log out. Appearance cycles Light → Dark → System and applies
 * instantly; Telegram shows the real link state.
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

function Row({
  label,
  value,
  onClick,
  href,
  static: isStatic = false,
  last = false,
}: {
  label: string;
  value?: string;
  onClick?: () => void;
  href?: string;
  /** Informational row — no chevron, not clickable (e.g. Language). */
  static?: boolean;
  last?: boolean;
}) {
  const className = `w-full h-[60px] flex items-center px-[18px] text-left ${
    last
      ? ""
      : "relative after:absolute after:bottom-0 after:left-[18px] after:right-[21px] after:h-px after:bg-[rgba(28,22,17,0.08)]"
  }`;
  const body = (
    <>
      <span className="text-[13.5px] font-medium text-ink">{label}</span>
      <span className="ml-auto flex items-center gap-4 pr-[7px]">
        {value && <span className="text-[11.5px] text-muted">{value}</span>}
        {!isStatic && <Chevron />}
      </span>
    </>
  );
  if (isStatic) {
    return <div className={className}>{body}</div>;
  }
  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {body}
    </button>
  );
}

export function AccountView({
  name,
  accountLabel,
  telegramLinked,
  initialTheme,
  initialNudges,
}: {
  name: string;
  accountLabel: string;
  telegramLinked: boolean;
  initialTheme: ThemePref;
  initialNudges: boolean;
}) {
  const [theme, setTheme] = useState<ThemePref>(initialTheme);
  const [nudges, setNudges] = useState(initialNudges);
  const [editOpen, setEditOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  function cycleTheme() {
    const next = THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length];
    setTheme(next);
    saveTheme(next);
  }

  return (
    <main className="px-6 pb-12">
      <Link href="/" aria-label="Back" className="inline-block mt-[52px] text-ink">
        <svg width="12" height="20" viewBox="0 0 12 20" fill="none" aria-hidden="true">
          <path d="M10.5 1.5L2 10L10.5 18.5" stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>

      <h1 className="font-semibold text-[24px] text-ink mt-3">Account</h1>

      <div className="flex flex-col items-center mt-[26px]">
        <RingAvatar initial={(name[0] ?? "H").toUpperCase()} size={72} />
        <p className="font-semibold text-[20px] text-ink mt-[18px]">{name}</p>
        <p className="text-[12px] text-muted mt-[6px]">{accountLabel}</p>
      </div>

      <section className="glass rounded-[26px] mt-[32px] overflow-hidden">
        <Row label="Edit profile" onClick={() => setEditOpen(true)} />
        <Row label="Connect Telegram" value={telegramLinked ? "Linked" : "Not linked"} href="/account/telegram" />
        <Row label="Language" value="English" static />
        <Row label="Privacy & data" onClick={() => setPrivacyOpen(true)} />
        <Row label="Appearance" value={PREF_LABEL[theme]} onClick={cycleTheme} last />
      </section>

      <section className="glass rounded-[24px] h-[58px] mt-4 flex items-center px-[18px]">
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
      </section>

      <form action="/auth/signout" method="post" className="mt-6">
        <button
          type="submit"
          className="w-full h-[52px] rounded-[26px] bg-white text-[13.5px] font-medium text-[#1C1611]"
        >
          Log out
        </button>
      </form>

      {editOpen && <EditProfileModal currentName={name} onClose={() => setEditOpen(false)} />}
      {privacyOpen && <PrivacySheet onClose={() => setPrivacyOpen(false)} />}
    </main>
  );
}

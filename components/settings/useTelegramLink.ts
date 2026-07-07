"use client";

import { useCallback, useEffect, useState } from "react";

/*
 * Shared state for the Connect Telegram surfaces (M04 mobile, M10e desktop).
 * Mints a one-time deep link + QR while unlinked, polls until the bot confirms
 * the /start handshake, and re-mints before the 10-minute token expires.
 */

type LinkState = {
  linked: boolean;
  url: string | null;
  qrDataUrl: string | null;
  botUsername: string | null;
  busy: boolean;
};

const POLL_MS = 4000;
const REMINT_MS = 9 * 60 * 1000; // refresh ahead of the 10-minute expiry

export function useTelegramLink(initialLinked: boolean) {
  const [state, setState] = useState<LinkState>({
    linked: initialLinked,
    url: null,
    qrDataUrl: null,
    botUsername: null,
    busy: false,
  });
  const mint = useCallback(async () => {
    try {
      const res = await fetch("/api/telegram/link", { method: "POST" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        url: string;
        qrDataUrl: string;
        botUsername: string;
      };
      setState((s) => ({
        ...s,
        url: data.url,
        qrDataUrl: data.qrDataUrl,
        botUsername: data.botUsername,
      }));
    } catch {
      // leave the previous link in place
    }
  }, []);

  useEffect(() => {
    if (state.linked) return;

    let cancelled = false;
    void mint();
    const remint = setInterval(() => void mint(), REMINT_MS);
    const poll = setInterval(async () => {
      try {
        const res = await fetch("/api/telegram/link");
        if (!res.ok) return;
        const data = (await res.json()) as { linked: boolean; botUsername: string | null };
        if (!cancelled && data.linked) {
          setState((s) => (s.linked ? s : { ...s, linked: true }));
        }
      } catch {
        // transient — keep polling
      }
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(remint);
      clearInterval(poll);
    };
  }, [state.linked, mint]);

  const disconnect = useCallback(async () => {
    setState((s) => ({ ...s, busy: true }));
    try {
      await fetch("/api/telegram/link", { method: "DELETE" });
      setState((s) => ({ ...s, linked: false, url: null, qrDataUrl: null, busy: false }));
    } catch {
      setState((s) => ({ ...s, busy: false }));
    }
  }, []);

  return { ...state, disconnect };
}

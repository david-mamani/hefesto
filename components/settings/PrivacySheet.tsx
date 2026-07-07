"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/*
 * Privacy & data (mobile M09 row → sheet): export everything as JSON, or erase
 * the whole memory — the same real actions the desktop Settings card offers.
 */
export function PrivacySheet({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function forgetEverything() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/forget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "everything" }),
      });
    } finally {
      setBusy(false);
      onClose();
      router.refresh();
    }
  }

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center px-8" onClick={onClose}>
      <div className="absolute inset-0 bg-[rgba(28,22,17,0.38)]" />
      <div
        className="relative w-full max-w-[320px] rounded-[28px] bg-surface-soft px-6 pt-6 pb-5 shadow-[0px_16px_38px_0px_rgba(51,31,10,0.08)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold text-[20px] text-ink">Privacy &amp; data</h3>
        <p className="text-[12.5px] text-muted mt-2 leading-relaxed">
          Your memories are yours. Capture is always intentional and you can erase anything — or
          everything — at any time.
        </p>

        <a
          href="/api/export"
          download
          className="mt-5 h-12 rounded-[24px] bg-white text-[13px] font-medium text-[#1C1611] grid place-items-center"
        >
          Export my data
        </a>

        {confirming ? (
          <div className="mt-3">
            <p className="text-[12px] font-medium text-ink">
              This removes ALL your memories — it cannot be undone.
            </p>
            <div className="flex items-center gap-3 mt-3">
              <button
                type="button"
                onClick={forgetEverything}
                disabled={busy}
                className="h-12 flex-1 rounded-[24px] bg-ember text-cream text-[13px] font-medium disabled:opacity-60"
              >
                {busy ? "Forgetting…" : "Yes, forget everything"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="h-12 w-[80px] rounded-[24px] bg-input text-[12.5px] font-medium text-ink"
              >
                Keep
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="mt-3 w-full h-12 rounded-[24px] bg-ember text-cream text-[13px] font-medium"
          >
            Forget everything
          </button>
        )}

        <button
          type="button"
          onClick={onClose}
          className="block mx-auto mt-4 text-[12px] font-medium text-muted"
        >
          Close
        </button>
      </div>
    </div>
  );
}

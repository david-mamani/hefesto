"use client";

import { RingAvatar } from "@/components/RingAvatar";

/* Forget-person confirm — Figma M13. Deletion is real (see /api/forget). */
export function ForgetModal({
  name,
  initial,
  memoryCount,
  busy = false,
  onConfirm,
  onCancel,
}: {
  name: string;
  initial: string;
  memoryCount: number;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const first = name.split(/\s+/)[0] || name;
  const memories =
    memoryCount > 0
      ? `All ${memoryCount} ${memoryCount === 1 ? "memory" : "memories"} about ${first}`
      : `All memories about ${first}`;

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center px-8" onClick={onCancel}>
      <div className="absolute inset-0 bg-[rgba(28,22,17,0.38)]" />
      <div
        className="relative w-full max-w-[320px] rounded-[28px] bg-surface-soft px-6 pt-6 pb-5 text-center shadow-[0px_16px_38px_0px_rgba(51,31,10,0.08)]"
        onClick={(e) => e.stopPropagation()}
      >
        <RingAvatar initial={initial} size={60} className="mx-auto" />
        <h3 className="font-semibold text-[20px] text-ink mt-4">Forget {first}?</h3>
        <p className="text-[12.5px] text-muted mt-2 leading-relaxed">
          {memories} will be permanently removed from your graph.
        </p>
        <p className="text-[11.5px] font-medium text-ink/70 mt-7">
          Hefesto never forgets — unless you ask him to.
        </p>

        <div className="flex items-center justify-center gap-3 mt-7">
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="h-12 w-[152px] rounded-[24px] bg-ember text-cream text-[13.5px] font-medium disabled:opacity-70"
          >
            {busy ? "Forgetting…" : "Forget"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="h-12 w-[70px] rounded-[24px] bg-input text-[12.5px] font-medium text-ink"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

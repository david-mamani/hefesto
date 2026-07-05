"use client";

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
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative w-full max-w-[320px] rounded-[28px] bg-surface-soft px-6 pt-6 pb-5 text-center shadow-[0px_24px_60px_rgba(51,31,10,0.28)]"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="inline-grid place-items-center size-[52px] rounded-full ring-2 ring-orange bg-bg font-semibold text-[18px] text-ink mx-auto">
          {initial}
        </span>
        <h3 className="font-semibold text-[19px] text-ink mt-4">Forget {first}?</h3>
        <p className="text-[12.5px] text-muted mt-2 leading-relaxed">
          {memories} will be permanently removed from your graph.
        </p>
        <p className="text-[11.5px] text-muted/90 italic mt-3">
          Hefesto never forgets — unless you ask him to.
        </p>

        <div className="flex items-center justify-center gap-3 mt-5">
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="h-11 px-7 rounded-full bg-ember text-cream text-[13.5px] font-medium disabled:opacity-70"
          >
            {busy ? "Forgetting…" : "Forget"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="h-11 px-6 rounded-full bg-white text-[13.5px] font-medium text-[#1C1611]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

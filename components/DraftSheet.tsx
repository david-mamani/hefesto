"use client";

import { useEffect, useState } from "react";

/*
 * Draft message overlay (M10d's DRAFT card language): Hefesto writes a short,
 * memory-grounded opener; the user copies it into their messaging app.
 */

type DraftState =
  | { phase: "drafting" }
  | { phase: "ready"; text: string }
  | { phase: "error"; message: string };

export function DraftSheet({ personId, onClose }: { personId: string; onClose: () => void }) {
  const [state, setState] = useState<DraftState>({ phase: "drafting" });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ personId }),
        });
        const data = (await res.json()) as { text?: string; error?: string };
        if (!res.ok || !data.text) throw new Error(data.error ?? "Draft failed");
        if (!cancelled) setState({ phase: "ready", text: data.text });
      } catch (error) {
        if (!cancelled)
          setState({
            phase: "error",
            message:
              error instanceof Error && error.message
                ? error.message
                : "That draft didn't come together — try again.",
          });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [personId]);

  async function copy() {
    if (state.phase !== "ready") return;
    try {
      await navigator.clipboard.writeText(state.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — the text stays selectable.
    }
  }

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center px-6" onClick={onClose}>
      <div className="absolute inset-0 bg-[rgba(28,22,17,0.38)] backdrop-blur-[4px]" />
      <div
        className="relative w-full max-w-[470px] glass rounded-[22px] bg-bg/95 px-[22px] pt-[16px] pb-[18px]"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="micro-label text-[9px] tracking-[0.9px]">Draft</p>

        {state.phase === "drafting" && (
          <p className="text-[12.5px] text-muted mt-3">Hefesto is drafting from your memories…</p>
        )}
        {state.phase === "error" && (
          <p className="text-[12.5px] text-orange mt-3">{state.message}</p>
        )}
        {state.phase === "ready" && (
          <p className="text-[12.5px] text-ink leading-relaxed mt-3 select-text">{state.text}</p>
        )}

        <div className="flex items-center gap-2 mt-5">
          <button
            type="button"
            onClick={copy}
            disabled={state.phase !== "ready"}
            className="h-[42px] px-6 rounded-[21px] bg-ember text-cream text-[12.5px] font-medium disabled:opacity-50"
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-[42px] px-5 rounded-[21px] bg-white text-[12.5px] font-medium text-[#1C1611]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

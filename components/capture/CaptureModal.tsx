"use client";

import { useEffect, useState } from "react";
import { useCapture } from "@/components/capture/useCapture";
import { ReviewCapture } from "@/components/capture/ReviewCapture";
import { ForgingCard } from "@/components/capture/ForgingCard";

export function CaptureModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const capture = useCapture();
  const { state } = capture;
  const [text, setText] = useState("");

  useEffect(() => {
    if (!open) {
      setText("");
      capture.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (state.phase === "done") {
      const timer = setTimeout(onClose, 2200);
      return () => clearTimeout(timer);
    }
  }, [state.phase, onClose]);

  if (!open) return null;

  if (state.phase === "review" && capture.fields) {
    return (
      <ReviewCapture
        fields={capture.fields}
        setFields={capture.setFields}
        candidates={capture.candidates}
        resolution={capture.resolution}
        setResolution={capture.setResolution}
        sourceText={capture.sourceText}
        onSave={capture.confirm}
        onDiscard={onClose}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-[rgba(28,22,17,0.35)] backdrop-blur-[6px] grid place-items-center px-6">
      <div className="w-full max-w-[420px]">
        {state.phase === "forging" || state.phase === "done" ? (
          <div className="bg-bg rounded-[28px] p-6 shadow-[0px_16px_38px_0px_rgba(51,31,10,0.22)]">
            <ForgingCard
              summary={state.canonicalName}
              done={state.phase === "done"}
            />
          </div>
        ) : (
          <div className="glass rounded-[28px] p-[22px] bg-bg/95">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-[22px] text-ink">Capture</h2>
              <button
                type="button"
                onClick={onClose}
                className="h-[30px] px-[14px] rounded-full bg-white text-[12px] font-medium text-[#1C1611]"
              >
                Close
              </button>
            </div>
            <p className="text-[12px] text-muted mt-1">
              Who did you meet? What should Hefesto remember?
            </p>
            <textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="met Carlos, fintech founder, wants an intro to a designer…"
              rows={4}
              className="w-full mt-4 rounded-3xl bg-input border border-(--input-border) px-5 py-4 text-[13px] text-ink placeholder:text-muted focus:outline-none resize-none"
            />
            {state.phase === "error" && (
              <p className="text-[12px] text-orange mt-2">{state.message}</p>
            )}
            <button
              type="button"
              disabled={!text.trim() || state.phase === "extracting"}
              onClick={() => capture.start(text.trim())}
              className="mt-4 h-[48px] px-7 rounded-full bg-ember text-cream text-[14px] font-medium disabled:opacity-60"
            >
              {state.phase === "extracting" ? "Reading…" : "Continue"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

/*
 * Async ingest status ("Hefesto is forging…"). Progress is time-based toward
 * 90% while the pipeline runs (observed remember→graph latency ≈ 16s), and
 * jumps to 100% when the poll reports completion.
 */
export function ForgingCard({ summary, done }: { summary: string; done: boolean }) {
  const [progress, setProgress] = useState(8);

  useEffect(() => {
    if (done) {
      setProgress(100);
      return;
    }
    const started = Date.now();
    const timer = setInterval(() => {
      const elapsed = (Date.now() - started) / 1000;
      setProgress(Math.min(90, 8 + (elapsed / 18) * 82));
    }, 400);
    return () => clearInterval(timer);
  }, [done]);

  return (
    <>
      <section className="glass rounded-3xl px-[18px] py-[14px]">
        <p className="micro-label text-[9px] tracking-[0.9px]">
          {done ? "Remember · Complete" : "Remember · Cognify running"}
        </p>
        <div className="h-2 rounded-full bg-[rgba(28,22,17,0.1)] mt-3 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-peach to-orange transition-[width] duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-[12px] text-muted mt-[10px] truncate">{summary}</p>
        <span className="inline-grid place-items-center h-[22px] px-4 rounded-full bg-ember text-cream text-[8.5px] font-medium tracking-[0.85px] uppercase mt-3">
          {done ? "In memory" : "Processing"}
        </span>
      </section>
      <p className="text-center text-[11.5px] text-muted mt-5 px-4">
        You can keep using the app — Hefesto will let you know when it&apos;s done.
      </p>
    </>
  );
}

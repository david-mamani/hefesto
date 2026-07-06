"use client";

import { useEffect, useRef, useState } from "react";
import { Hefesto, type HefestoHandle } from "@/components/HefestoSprite";
import { ChevronRightIcon } from "@/components/icons";
import { applyMode, clusterToMode } from "@/lib/mascot";

type BriefingData = {
  personId: string;
  name: string;
  initial: string;
  cluster: "work" | "personal" | "family" | null;
  gap: string;
  title: string;
  summary: string;
  keyPoints: string[];
};

const CLUSTER_LABEL: Record<string, string> = {
  work: "Networking",
  personal: "Personal",
  family: "Family",
};

/*
 * Pre-meeting briefing overlay — Figma M12, 1:1. The gradient card is where
 * the mode shows (PRD §11): its glow and the key-point accents tint blue /
 * orange / green by the person's cluster; Hefesto pops his "!" on open and
 * keeps his own palette.
 */
export function Briefing({ personId, onClose }: { personId: string; onClose: () => void }) {
  const [data, setData] = useState<BriefingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hefesto = useRef<HefestoHandle>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/briefing?personId=${personId}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => !cancelled && setError("Couldn't load the briefing"));
    return () => {
      cancelled = true;
    };
  }, [personId]);

  // The person's cluster tints the UI while the briefing is open; Hefesto
  // reacts with the alert "!". The tint returns to default on close.
  useEffect(() => {
    if (!data) return;
    applyMode(clusterToMode(data.cluster));
    hefesto.current?.play("alert");
    return () => applyMode("personal");
  }, [data]);

  const first = data?.name.split(/\s+/)[0] ?? "";

  return (
    <div className="fixed inset-0 z-50 bg-bg overflow-y-auto">
      <div className="w-full max-w-[390px] mx-auto px-6 pb-10 min-h-full flex flex-col">
        <button type="button" onClick={onClose} aria-label="Back" className="mt-[52px] w-fit text-ink">
          <svg width="12" height="20" viewBox="0 0 12 20" fill="none" aria-hidden="true">
            <path d="M10.5 1.5L2 10L10.5 18.5" stroke="#1C1611" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {!data && !error && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <Hefesto scale={4} />
            <p className="text-[13px] text-muted">Getting you ready…</p>
          </div>
        )}

        {error && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <p className="text-[13px] text-muted text-center max-w-[240px]">{error}</p>
            <button type="button" onClick={onClose} className="h-11 px-6 rounded-full bg-ember text-cream text-[13px] font-medium">
              Close
            </button>
          </div>
        )}

        {data && (
          <>
            <header className="flex items-center gap-4 mt-[14px]">
              <span className="inline-grid place-items-center size-[56px] rounded-full bg-gradient-to-br from-peach to-orange p-[3px] shrink-0">
                <span className="grid place-items-center size-full rounded-full bg-bg font-semibold text-[17px] text-ink">
                  {data.initial}
                </span>
              </span>
              <div className="min-w-0">
                <h1 className="font-semibold text-[20px] text-ink truncate">{data.name}</h1>
                {data.title && <p className="text-[12px] text-muted truncate mt-[2px]">{data.title}</p>}
              </div>
            </header>
            <span className="ml-[72px] mt-[6px] w-fit h-[34px] px-[18px] rounded-[17px] bg-white/55 border border-white/90 text-[12.5px] font-medium text-ink grid place-items-center">
              {CLUSTER_LABEL[data.cluster ?? "personal"]}
            </span>

            <p className="micro-label mt-[26px] text-[10px] tracking-[1px]">Pre-meeting briefing</p>
            <section
              className="relative overflow-hidden h-[84px] rounded-[24px] mt-2 px-5 text-white shadow-[0px_16px_38px_0px_rgba(51,31,10,0.16)]"
              style={{
                background:
                  "linear-gradient(180deg, color-mix(in srgb, var(--color-mode) 46%, white) 0%, var(--color-mode) 100%)",
              }}
            >
              <p className="font-semibold text-[16px] pt-[14px]">Reconnect with {first}</p>
              <p className="text-[12px] opacity-95 mt-[4px] capitalize">
                {data.cluster ?? "personal"} · last seen {data.gap}
              </p>
              <svg
                className="absolute right-5 top-5"
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="none"
                aria-hidden="true"
              >
                <path d="M1 9L9 1M9 1H2.5M9 1V7.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </section>

            <p className="micro-label mt-6 text-[10px] tracking-[1px]">Summary</p>
            <section className="glass rounded-[24px] mt-2 px-[18px] py-[14px]">
              <p className="text-[12.5px] text-ink leading-relaxed">{data.summary}</p>
            </section>

            {data.keyPoints.length > 0 && (
              <>
                <p className="micro-label mt-6 text-[10px] tracking-[1px]">Key points</p>
                <section className="glass rounded-[24px] mt-2 px-[18px] py-[13px] flex flex-col gap-[11px]">
                  {data.keyPoints.map((point, i) => (
                    <div key={i} className="flex gap-[11px]">
                      <span
                        className="size-[7px] rounded-full mt-[5px] shrink-0"
                        style={{ background: "var(--color-mode)" }}
                      />
                      <p className="text-[12.5px] text-ink leading-snug">{point}</p>
                    </div>
                  ))}
                </section>
              </>
            )}

            <div className="flex items-center gap-[14px] mt-6">
              <Hefesto ref={hefesto} scale={2} ambient />
              <span className="relative glass rounded-[18px] h-[44px] px-[13px] grid place-items-center">
                <span
                  className="absolute -left-[6px] top-1/2 -translate-y-1/2 size-[10px] rotate-45"
                  style={{ background: "var(--glass-bg)", borderLeft: "1.5px solid var(--glass-border)", borderBottom: "1.5px solid var(--glass-border)" }}
                  aria-hidden="true"
                />
                <span className="text-[12.5px] font-medium text-ink">You&apos;ve got this!</span>
              </span>
            </div>

            <div className="flex items-center gap-2 mt-auto pt-8">
              <button
                type="button"
                onClick={onClose}
                className="h-[54px] px-7 rounded-full bg-ember text-cream text-[15px] font-medium"
              >
                Draft opener
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Draft opener"
                className="size-[54px] rounded-full bg-ember grid place-items-center"
              >
                <ChevronRightIcon color="#F6F1E8" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="h-[54px] w-[78px] rounded-full bg-white text-[12.5px] font-medium text-[#1C1611] ml-auto grid place-items-center"
              >
                Later
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

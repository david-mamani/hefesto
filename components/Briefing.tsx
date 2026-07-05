"use client";

import { useEffect, useState } from "react";
import { Hefesto } from "@/components/HefestoSprite";
import { SpeechBubble } from "@/components/SpeechBubble";
import { ChevronRightIcon } from "@/components/icons";

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

/* Pre-meeting briefing overlay — Figma M12. */
export function Briefing({ personId, onClose }: { personId: string; onClose: () => void }) {
  const [data, setData] = useState<BriefingData | null>(null);
  const [error, setError] = useState<string | null>(null);

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
            <header className="flex items-center gap-3 mt-4">
              <span className="inline-grid place-items-center size-[52px] rounded-full bg-gradient-to-br from-peach to-orange p-[3px]">
                <span className="grid place-items-center size-full rounded-full bg-bg font-semibold text-[18px] text-ink">
                  {data.initial}
                </span>
              </span>
              <div className="min-w-0">
                <h1 className="font-semibold text-[22px] text-ink truncate">{data.name}</h1>
                {data.title && <p className="text-[12px] text-muted truncate">{data.title}</p>}
              </div>
              <span className="ml-auto h-[26px] px-[14px] rounded-full bg-white text-[11px] font-medium text-[#1C1611] grid place-items-center shrink-0">
                {CLUSTER_LABEL[data.cluster ?? "personal"]}
              </span>
            </header>

            <p className="micro-label mt-7 text-[10px] tracking-[1px]">Pre-meeting briefing</p>
            <section
              className="relative overflow-hidden rounded-[22px] mt-2 px-5 py-4 text-cream"
              style={{ background: "linear-gradient(120deg, #f6a24d 0%, #ee7a12 100%)" }}
            >
              <p className="font-semibold text-[16px]">Reconnect with {first}</p>
              <p className="text-[12px] opacity-90 mt-[2px] capitalize">
                {data.cluster ?? "personal"} · last seen {data.gap}
              </p>
              <span className="absolute right-4 top-1/2 -translate-y-1/2 opacity-90">
                <ChevronRightIcon color="#F6F1E8" />
              </span>
            </section>

            <p className="micro-label mt-6 text-[10px] tracking-[1px]">Summary</p>
            <section className="glass rounded-[22px] mt-2 px-[18px] py-[15px]">
              <p className="text-[13px] text-ink leading-relaxed">{data.summary}</p>
            </section>

            {data.keyPoints.length > 0 && (
              <>
                <p className="micro-label mt-6 text-[10px] tracking-[1px]">Key points</p>
                <section className="glass rounded-[22px] mt-2 px-[18px] py-[14px] flex flex-col gap-[10px]">
                  {data.keyPoints.map((point, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="size-[6px] rounded-full bg-orange mt-[6px] shrink-0" />
                      <p className="text-[13px] text-ink leading-snug">{point}</p>
                    </div>
                  ))}
                </section>
              </>
            )}

            <div className="flex items-center gap-3 mt-6">
              <Hefesto scale={3} />
              <SpeechBubble>You&apos;ve got this!</SpeechBubble>
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
                className="h-[54px] px-6 rounded-full bg-white text-[13px] font-medium text-[#1C1611] ml-auto"
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

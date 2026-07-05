"use client";

import { useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import type { NetworkPerson } from "@/lib/network";
import { knowledgeLines, lastInteractionLine } from "@/lib/person";
import { Briefing } from "@/components/Briefing";
import { ChevronRightIcon } from "@/components/icons";

/*
 * Desktop graph (Figma M10c): full-canvas network with cluster filter pills,
 * zoom, the WARM → COLD legend, and the selected-node panel on the right.
 */

// Cluster → glow color (legend: glow = mode color · node = warmth)
const MODE_GLOW: Record<string, string> = {
  work: "#2f6bff",
  personal: "#f07e12",
  family: "#3fb57f",
};

const FILTERS = ["all", "work", "personal", "family"] as const;
type Filter = (typeof FILTERS)[number];

type Placed = NetworkPerson & { x: number; y: number };

const round2 = (n: number) => Math.round(n * 100) / 100;

// Evenly spaced around You on an ellipse in the 0–100 box, rotated for balance.
function place(people: NetworkPerson[]): Placed[] {
  const n = people.length;
  return people.map((p, i) => {
    const angle = ((-90 + (360 / Math.max(1, n)) * i + 18) * Math.PI) / 180;
    return { ...p, x: round2(50 + 38 * Math.cos(angle)), y: round2(50 + 38 * Math.sin(angle)) };
  });
}

const ZOOM_MIN = 0.6;
const ZOOM_MAX = 1.6;
const ZOOM_STEP = 0.2;

export function DesktopGraph({ people }: { people: NetworkPerson[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [zoom, setZoom] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(people[0]?.personId ?? null);
  const [briefingId, setBriefingId] = useState<string | null>(null);

  const visible = useMemo(
    () => (filter === "all" ? people : people.filter((p) => (p.cluster ?? "personal") === filter)),
    [people, filter]
  );
  const placed = useMemo(() => place(visible), [visible]);
  const selected = people.find((p) => p.personId === selectedId) ?? null;

  return (
    <div className="pt-[20px] flex flex-col min-h-[calc(100dvh-48px)]">
      <div className="flex items-start gap-6">
        <div>
          <h1 className="font-semibold text-[28px] text-ink">Your network</h1>
          <p className="text-[13px] text-muted mt-1">
            glow = mode color (blue work · orange personal · green family) · node = warmth
          </p>
        </div>

        <div className="ml-auto flex items-center gap-[8px]">
          {FILTERS.map((f) => {
            const active = filter === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`h-[34px] px-[16px] rounded-[17px] text-[12.5px] font-medium capitalize ${
                  active
                    ? "bg-ember text-cream"
                    : "bg-white/55 border border-white/90 text-ink"
                }`}
              >
                {f}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-6 mt-2 flex-1 min-h-0 items-stretch">
        {/* canvas */}
        <div className="relative flex-1 min-w-0 overflow-hidden">
          {visible.length === 0 ? (
            <div className="absolute inset-0 grid place-items-center">
              <p className="text-[13px] text-muted text-center max-w-[260px]">
                {people.length === 0
                  ? "No one in your graph yet. Capture someone you met and they'll bloom here."
                  : "No one in this cluster yet."}
              </p>
            </div>
          ) : (
            <div
              className="absolute inset-[8%] transition-transform duration-200"
              style={{ transform: `scale(${zoom})` }}
            >
              <svg
                className="absolute inset-0 w-full h-full"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                {placed.map((p, i) => (
                  <line
                    key={p.personId}
                    className="graph-spoke"
                    x1="50"
                    y1="50"
                    x2={p.x}
                    y2={p.y}
                    stroke="rgba(28,22,17,0.20)"
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                    style={{ ["--d"]: `${round2(0.15 + i * 0.09)}s` } as CSSProperties}
                  />
                ))}
              </svg>

              {/* You */}
              <div
                className="absolute -translate-x-1/2 -translate-y-1/2 size-[64px] rounded-full bg-ember grid place-items-center shadow-[0px_10px_24px_rgba(51,31,10,0.28)]"
                style={{ left: "50%", top: "50%" }}
              >
                <span className="text-[14px] font-medium text-cream">You</span>
              </div>

              {placed.map((p, i) => {
                const glow = MODE_GLOW[p.cluster ?? "personal"] ?? MODE_GLOW.personal;
                const isSelected = p.personId === selectedId;
                return (
                  <button
                    key={p.personId}
                    type="button"
                    onClick={() => setSelectedId(p.personId)}
                    className="graph-ember absolute -translate-x-1/2 -translate-y-1/2 focus:outline-none"
                    style={{
                      left: `${p.x}%`,
                      top: `${p.y}%`,
                      ["--d"]: `${round2(0.2 + i * 0.11)}s`,
                    } as CSSProperties}
                    aria-label={`${p.name}, warmth ${p.warmth.score}`}
                    aria-pressed={isSelected}
                  >
                    <span
                      className="grid place-items-center size-[52px] rounded-full text-[16px] font-semibold text-ink"
                      style={{
                        backgroundColor: p.warmth.color,
                        boxShadow: `0 0 28px 6px ${glow}55, 0 20px 40px 3px ${glow}3d, 0 8px 18px rgba(51,31,10,0.14)`,
                        outline: isSelected ? "2px solid rgba(28,22,17,0.55)" : "none",
                        outlineOffset: "3px",
                      }}
                    >
                      {p.initial}
                    </span>
                    <span className="absolute top-full left-1/2 -translate-x-1/2 mt-[6px] w-[80px] text-center">
                      <span className="block text-[11px] font-medium text-ink leading-tight">
                        {p.name.split(" · ")[0].split(/\s+/)[0]}
                      </span>
                      <span className="block micro-label text-[8.5px] tracking-[0.68px] mt-[1px]">
                        {p.cluster ?? "personal"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* zoom */}
          <div className="absolute left-0 bottom-[64px] flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(ZOOM_MAX, round2(z + ZOOM_STEP)))}
              className="size-10 rounded-full bg-white shadow-[0px_10px_24px_rgba(51,31,10,0.14)] grid place-items-center text-[18px] font-medium text-ink"
              aria-label="Zoom in"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(ZOOM_MIN, round2(z - ZOOM_STEP)))}
              className="size-10 rounded-full bg-white shadow-[0px_10px_24px_rgba(51,31,10,0.14)] grid place-items-center text-[18px] font-medium text-ink"
              aria-label="Zoom out"
            >
              −
            </button>
          </div>

          {/* warmth legend */}
          <div className="absolute left-0 bottom-[10px] flex items-center gap-[10px]">
            <span
              className="h-[6px] w-[120px] rounded-[3px]"
              style={{ backgroundImage: "linear-gradient(90deg, #F07E12 13%, #948A7D 87%)" }}
            />
            <span className="micro-label text-[8.5px] tracking-[0.85px]">Warm → cold</span>
          </div>
        </div>

        {/* selected panel */}
        {selected && (
          <aside className="glass rounded-[28px] w-[340px] shrink-0 px-[22px] pt-[18px] pb-[22px] self-start flex flex-col">
            <p className="micro-label text-[10px] tracking-[1px]">Selected</p>

            <div className="flex items-center gap-4 mt-[14px]">
              <span
                className="grid place-items-center size-[56px] rounded-full text-[17px] font-semibold text-ink shrink-0"
                style={{
                  backgroundColor: selected.warmth.color,
                  boxShadow: `0 0 24px 5px ${
                    MODE_GLOW[selected.cluster ?? "personal"]
                  }55, 0 14px 30px 2px ${MODE_GLOW[selected.cluster ?? "personal"]}3d`,
                }}
              >
                {selected.initial}
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-[20px] text-ink truncate">{selected.name}</p>
                <span className="inline-grid place-items-center h-[34px] px-[16px] rounded-[17px] bg-white/55 border border-white/90 text-[12.5px] font-medium text-ink capitalize mt-[4px]">
                  {selected.cluster ?? "personal"}
                </span>
              </div>
            </div>

            <p className="micro-label text-[10px] tracking-[1px] mt-[22px]">
              Warmth · {selected.warmth.score}
            </p>
            <div className="relative h-[6px] rounded-[3px] bg-ink/10 mt-[8px]">
              <div
                className="absolute inset-y-0 left-0 rounded-[3px]"
                style={{
                  width: `${Math.max(4, selected.warmth.score)}%`,
                  backgroundImage: "linear-gradient(90deg, #FFC490 13%, #F07E12 87%)",
                }}
              />
            </div>
            <p className="text-[11.5px] text-muted mt-[10px]">
              {lastInteractionLine(selected.warmth.gap)}
            </p>

            <p className="micro-label text-[10px] tracking-[1px] mt-[24px]">What you know</p>
            <ul className="mt-[10px] flex flex-col gap-[14px]">
              {knowledgeLines(selected).map((line) => (
                <li key={line} className="flex items-start gap-[11px]">
                  <span className="size-[7px] rounded-full bg-orange mt-[5px] shrink-0" />
                  <span className="text-[12.5px] text-ink leading-snug">{line}</span>
                </li>
              ))}
              {knowledgeLines(selected).length === 0 && (
                <li className="text-[12.5px] text-muted">
                  Nothing yet — capture something about {selected.name.split(/\s+/)[0]}.
                </li>
              )}
            </ul>

            <div className="flex items-center gap-3 mt-[28px]">
              <button
                type="button"
                onClick={() => setBriefingId(selected.personId)}
                className="h-[54px] px-[28px] rounded-[27px] bg-ember text-cream text-[15px] font-medium"
              >
                Briefing
              </button>
              <button
                type="button"
                onClick={() => setBriefingId(selected.personId)}
                className="size-[54px] rounded-full bg-gradient-to-b from-peach to-orange grid place-items-center"
                aria-label="Open briefing"
              >
                <ChevronRightIcon color="#F6F1E8" />
              </button>
            </div>

            <div className="mt-[22px]">
              <Link
                href={`/people?person=${selected.personId}`}
                className="inline-grid h-12 px-[26px] rounded-[24px] bg-white text-[12.5px] font-medium text-[#1C1611] place-items-center"
              >
                Open card
              </Link>
            </div>

            <p className="text-[11px] text-muted leading-relaxed mt-[30px]">
              Tip: click any node to inspect it — capturing something about a person re-ignites
              their ember.
            </p>
          </aside>
        )}
      </div>

      {briefingId && <Briefing personId={briefingId} onClose={() => setBriefingId(null)} />}
    </div>
  );
}

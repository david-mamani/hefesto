"use client";

import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import type { NetworkPerson } from "@/lib/network";

// Cluster → glow color (caption: GLOW = MODE · blue work / orange personal / green family)
const MODE_GLOW: Record<string, string> = {
  work: "#2f6bff",
  personal: "#f07e12",
  family: "#3fb57f",
};

type Placed = NetworkPerson & { x: number; y: number };

// Round to 2 decimals so the SSR and client strings are byte-identical (Math.cos/sin
// differ by a last-ULP between Node and the browser → hydration mismatch otherwise).
const round2 = (n: number) => Math.round(n * 100) / 100;

// Evenly spaced around You, on an ellipse in the 0–100 box, rotated for balance.
function place(people: NetworkPerson[]): Placed[] {
  const n = people.length;
  return people.map((p, i) => {
    const angle = ((-90 + (360 / Math.max(1, n)) * i + 18) * Math.PI) / 180;
    return { ...p, x: round2(50 + 37 * Math.cos(angle)), y: round2(50 + 40 * Math.sin(angle)) };
  });
}

export function GraphView({ people }: { people: NetworkPerson[] }) {
  const router = useRouter();
  const placed = place(people);

  if (people.length === 0) {
    return (
      <div className="relative flex-1 grid place-items-center">
        <p className="text-[13px] text-muted text-center max-w-[220px]">
          No one in your graph yet. Capture someone you met and they&apos;ll bloom here.
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex-1 my-1 min-h-[420px]">
      {/* spokes */}
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
        className="absolute -translate-x-1/2 -translate-y-1/2 size-[56px] rounded-full bg-ember grid place-items-center shadow-[0px_10px_24px_rgba(51,31,10,0.28)]"
        style={{ left: "50%", top: "50%" }}
      >
        <span className="text-[13px] font-medium text-cream">You</span>
      </div>

      {/* people — tap opens the person card (M07) */}
      {placed.map((p, i) => {
        const glow = MODE_GLOW[p.cluster ?? "personal"] ?? MODE_GLOW.personal;
        return (
          <button
            key={p.personId}
            type="button"
            onClick={() => router.push(`/people/${p.personId}`)}
            className="graph-ember absolute -translate-x-1/2 -translate-y-1/2 focus:outline-none"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              ["--d"]: `${round2(0.2 + i * 0.11)}s`,
            } as CSSProperties}
            aria-label={`${p.name}, warmth ${p.warmth.score}`}
          >
            <span
              className="grid place-items-center size-[44px] rounded-full text-[14px] font-semibold text-ink"
              style={{
                backgroundColor: p.warmth.color,
                // M08: the mode glow is wide and falls softly below the node.
                boxShadow: `0 0 24px 5px ${glow}55, 0 16px 34px 2px ${glow}3d, 0 8px 18px rgba(51,31,10,0.14)`,
              }}
            >
              {p.initial}
            </span>
            <span className="absolute top-full left-1/2 -translate-x-1/2 mt-[5px] w-[74px] text-center">
              <span className="block text-[10px] font-medium text-ink leading-tight">
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
  );
}

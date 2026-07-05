"use client";

import { useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import type { NetworkPerson } from "@/lib/network";
import { bandFor } from "@/lib/warmth";
import { Briefing } from "@/components/Briefing";
import { ForgetModal } from "@/components/ForgetModal";

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
  const [selected, setSelected] = useState<NetworkPerson | null>(null);
  const [briefingId, setBriefingId] = useState<string | null>(null);
  const [forgetTarget, setForgetTarget] = useState<NetworkPerson | null>(null);
  const [forgetBusy, setForgetBusy] = useState(false);
  const placed = place(people);

  async function confirmForget() {
    if (!forgetTarget) return;
    setForgetBusy(true);
    try {
      await fetch("/api/forget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId: forgetTarget.personId }),
      });
    } finally {
      setForgetBusy(false);
      setForgetTarget(null);
      router.refresh();
    }
  }

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

      {/* people */}
      {placed.map((p, i) => {
        const glow = MODE_GLOW[p.cluster ?? "personal"] ?? MODE_GLOW.personal;
        return (
          <button
            key={p.personId}
            type="button"
            onClick={() => setSelected(p)}
            className="graph-ember absolute -translate-x-1/2 -translate-y-1/2 focus:outline-none"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              ["--d"]: `${round2(0.2 + i * 0.11)}s`,
            } as CSSProperties}
            aria-label={`${p.name}, warmth ${p.warmth.score}`}
          >
            <span
              className="grid place-items-center size-[44px] rounded-full text-[14px] font-semibold text-white"
              style={{
                backgroundColor: p.warmth.color,
                boxShadow: `0 0 20px 3px ${glow}59, 0 8px 18px rgba(51,31,10,0.16)`,
              }}
            >
              {p.initial}
            </span>
            <span className="absolute top-full left-1/2 -translate-x-1/2 mt-[5px] w-[74px] text-center">
              <span className="block text-[10px] font-medium text-ink leading-tight">{p.name}</span>
              <span className="block micro-label text-[8.5px] tracking-[0.68px] mt-[1px]">
                {p.cluster ?? "personal"}
              </span>
            </span>
          </button>
        );
      })}

      {selected && (
        <PersonSheet
          person={selected}
          onClose={() => setSelected(null)}
          onBriefing={() => {
            setBriefingId(selected.personId);
            setSelected(null);
          }}
          onForget={() => {
            setForgetTarget(selected);
            setSelected(null);
          }}
        />
      )}

      {briefingId && <Briefing personId={briefingId} onClose={() => setBriefingId(null)} />}

      {forgetTarget && (
        <ForgetModal
          name={forgetTarget.name}
          initial={forgetTarget.initial}
          memoryCount={forgetTarget.memoryCount}
          busy={forgetBusy}
          onConfirm={confirmForget}
          onCancel={() => setForgetTarget(null)}
        />
      )}
    </div>
  );
}

/*
 * Tap-a-node sheet. Info-first here; the full person card (briefing + forget,
 * Figma M07/M13) is layered on in the memory phase.
 */
function PersonSheet({
  person,
  onClose,
  onBriefing,
  onForget,
}: {
  person: NetworkPerson;
  onClose: () => void;
  onBriefing: () => void;
  onForget: () => void;
}) {
  const band = bandFor(person.warmth.score);
  const bandLabel = band === "warm" ? "Warm" : band === "cooling" ? "Cooling" : "Cold";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/25" />
      <div
        className="relative w-full max-w-[430px] glass rounded-t-[28px] px-6 pt-5 pb-8 animate-[sheet-up_0.25s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink/15" />
        <div className="flex items-center gap-3">
          <span
            className="grid place-items-center size-[52px] rounded-full text-[18px] font-semibold text-white"
            style={{ backgroundColor: person.warmth.color }}
          >
            {person.initial}
          </span>
          <div>
            <p className="text-[18px] font-semibold text-ink">{person.name}</p>
            <p className="micro-label text-[9px]">{person.cluster ?? "personal"}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto size-8 rounded-full bg-white/70 grid place-items-center text-ink text-[15px]"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="mt-5 flex gap-3">
          <div className="flex-1 bg-surface-soft rounded-[18px] px-4 py-3">
            <p className="micro-label text-[8.5px]">Warmth</p>
            <p className="text-[22px] font-light text-ink leading-tight">
              {person.warmth.score}
              <span className="text-[12px] text-muted ml-1">{bandLabel}</span>
            </p>
          </div>
          <div className="flex-1 bg-surface-soft rounded-[18px] px-4 py-3">
            <p className="micro-label text-[8.5px]">Last seen</p>
            <p className="text-[15px] font-medium text-ink leading-tight mt-[6px]">
              {person.warmth.gap}
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2">
          <button
            type="button"
            onClick={onBriefing}
            className="h-11 flex-1 rounded-full bg-ember text-cream text-[13px] font-medium"
          >
            Briefing
          </button>
          <button
            type="button"
            onClick={onForget}
            className="h-11 px-6 rounded-full bg-white text-[13px] font-medium text-[#1C1611]"
          >
            Forget
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import type { NetworkPerson } from "@/lib/network";

/*
 * "Your network" widget — the dashboard's live ember view: the most recently
 * touched contacts placed around You, node color = warmth, WARM → COLD legend.
 */

const MAX_EMBERS = 6;

const CENTER = { x: 240, y: 218 };
const RADIUS = { x: 152, y: 122 };

const round2 = (n: number) => Math.round(n * 100) / 100;

function place(people: NetworkPerson[]) {
  const n = people.length;
  return people.map((p, i) => {
    const angle = ((-90 + (360 / Math.max(1, n)) * i + 24) * Math.PI) / 180;
    return {
      ...p,
      x: round2(CENTER.x + RADIUS.x * Math.cos(angle)),
      y: round2(CENTER.y + RADIUS.y * Math.sin(angle)),
    };
  });
}

export function NetworkWidget({ people }: { people: NetworkPerson[] }) {
  const embers = place(people.slice(0, MAX_EMBERS));

  return (
    <section className="glass rounded-[28px] w-[480px] h-[446px] relative shrink-0 overflow-hidden">
      <p className="micro-label absolute left-[22px] top-[18px] text-[10px] tracking-[1px]">
        Your network
      </p>

      {embers.length === 0 ? (
        <p className="absolute inset-x-8 top-1/2 -translate-y-1/2 text-center text-[12.5px] text-muted">
          No one here yet — capture someone you met and their ember will glow here.
        </p>
      ) : (
        <>
          <svg className="absolute inset-0" viewBox="0 0 480 446" fill="none" aria-hidden="true">
            {embers.map((node, i) => (
              <line
                key={node.personId}
                className="graph-spoke"
                x1={CENTER.x}
                y1={CENTER.y}
                x2={node.x}
                y2={node.y}
                stroke="rgba(28,22,17,0.22)"
                strokeWidth="1"
                style={{ ["--d"]: `${round2(0.1 + i * 0.07)}s` } as CSSProperties}
              />
            ))}
          </svg>

          {embers.map((node, i) => (
            <Link
              key={node.personId}
              href={`/people?person=${node.personId}`}
              className="graph-ember absolute w-[70px] -translate-x-1/2 text-center"
              style={{
                left: node.x,
                top: node.y - 20,
                ["--d"]: `${round2(0.15 + i * 0.09)}s`,
              } as CSSProperties}
              aria-label={`${node.name}, warmth ${node.warmth.score}`}
            >
              <span
                className="inline-grid place-items-center size-10 rounded-full font-semibold text-[14px] text-ink"
                style={{
                  backgroundColor: node.warmth.color,
                  boxShadow: "0 8px 20px rgba(51,31,10,0.16)",
                }}
              >
                {node.initial}
              </span>
              <p className="text-[10px] font-medium text-ink mt-[2px] truncate">
                {node.name.split(" · ")[0].split(/\s+/)[0]}
              </p>
            </Link>
          ))}

          <div
            className="absolute size-[52px] rounded-full bg-ember grid place-items-center"
            style={{ left: CENTER.x - 26, top: CENTER.y - 26 }}
          >
            <span className="text-[12px] font-medium text-cream">You</span>
          </div>
        </>
      )}

      <div className="absolute bottom-[20px] inset-x-0 flex items-center justify-center gap-[10px]">
        <span
          className="h-[5px] w-[96px] rounded-[3px]"
          style={{ backgroundImage: "linear-gradient(90deg, #F07E12 13%, #948A7D 87%)" }}
        />
        <span className="micro-label text-[8.5px] tracking-[0.85px]">Warm → cold</span>
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";
import { Hefesto } from "@/components/HefestoSprite";
import { EmberGlow } from "@/components/EmberGlow";

/*
 * Mascot playground — the recording table for the reveal shot and the animation
 * workshop. Device-agnostic and unauthenticated (see proxy /dev exemption).
 */
export default function MascotDevPage() {
  const [scale, setScale] = useState(12);
  const [dark, setDark] = useState(true);

  return (
    <main
      className="min-h-dvh flex flex-col items-center"
      style={{ background: dark ? "#17120d" : "var(--bg)", color: dark ? "#f6f1e8" : "var(--ink)" }}
    >
      <div className="w-full max-w-[560px] px-6 pt-10">
        <p className="text-[11px] tracking-[1.2px] uppercase opacity-60">Hefesto · mascot playground</p>
        <h1 className="text-[22px] font-semibold mt-1">The recording table</h1>

        <div className="flex items-center gap-4 mt-5 text-[12px]">
          <label className="flex items-center gap-2">
            scale {scale}×
            <input
              type="range"
              min={2}
              max={20}
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
            />
          </label>
          <button
            type="button"
            onClick={() => setDark((v) => !v)}
            className="px-3 h-8 rounded-full text-[12px] font-medium"
            style={{ background: dark ? "rgba(255,255,255,0.12)" : "#17120d", color: dark ? "#f6f1e8" : "#f6f1e8" }}
          >
            {dark ? "Ember" : "Cream"} bg
          </button>
        </div>

        <p className="text-[11px] opacity-55 mt-3 leading-relaxed">
          Plays <code>/mascot/idle.json</code> when present; otherwise the static sprite with a
          placeholder breath. Drop the hand-drawn idle in <code>public/mascot/</code> to replace it.
        </p>
      </div>

      {/* Hero — the reveal frame */}
      <div className="relative flex-1 w-full grid place-items-center py-10">
        <EmberGlow className="w-[320px] h-[160px] opacity-70" />
        <div className="relative">
          <Hefesto scale={scale} />
        </div>
      </div>

      {/* Integer-scale reference row */}
      <div className="w-full max-w-[560px] px-6 pb-12 flex items-end justify-center gap-8">
        {[2, 4, 6, 8].map((s) => (
          <div key={s} className="flex flex-col items-center gap-2">
            <Hefesto scale={s} />
            <span className="text-[10px] opacity-50">{s}×</span>
          </div>
        ))}
      </div>
    </main>
  );
}

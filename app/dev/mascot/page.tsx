"use client";

import { useEffect, useRef, useState } from "react";
import { Hefesto, type HefestoHandle } from "@/components/HefestoSprite";
import { EmberGlow } from "@/components/EmberGlow";
import { CLIP_FILES, SUSTAINED, type ClipName, type Mode } from "@/lib/mascot";

/*
 * Mascot playground — the recording table for the reveal shot and the animation
 * workshop (P4). Lists every clip in the registry (loaded vs pending), plays any
 * of them, switches mode to preview the UI tint, and reads the live frame index.
 * Device-agnostic and unauthenticated (see proxy /dev exemption).
 */

const MODES: Mode[] = ["networking", "personal", "family"];
const ALL_CLIPS = Object.keys(CLIP_FILES) as ClipName[];

export default function MascotDevPage() {
  const hefesto = useRef<HefestoHandle>(null);
  const [scale, setScale] = useState(12);
  const [dark, setDark] = useState(true);
  const [mode, setMode] = useState<Mode>("personal");
  const [loaded, setLoaded] = useState<string[]>([]);
  const [frame, setFrame] = useState(0);

  // Live frame readout — poll the engine a few times a second.
  useEffect(() => {
    const id = setInterval(() => setFrame(hefesto.current?.currentFrame() ?? 0), 120);
    return () => clearInterval(id);
  }, []);

  function pickMode(m: Mode) {
    setMode(m);
    hefesto.current?.setMode(m);
  }

  const fg = dark ? "#f6f1e8" : "#1c1611";
  const border = dark ? "rgba(255,255,255,0.14)" : "rgba(28,22,17,0.12)";

  return (
    <main
      className="min-h-dvh flex flex-col items-center"
      style={{ background: dark ? "#17120d" : "var(--bg)", color: fg }}
    >
      <div className="w-full max-w-[620px] px-6 pt-10">
        <p className="text-[11px] tracking-[1.2px] uppercase opacity-60">Hefesto · mascot playground</p>
        <h1 className="text-[22px] font-semibold mt-1">The recording table</h1>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4 mt-5 text-[12px]">
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
            style={{ background: dark ? "rgba(255,255,255,0.12)" : "#17120d", color: "#f6f1e8" }}
          >
            {dark ? "Ember" : "Cream"} bg
          </button>
          <span className="opacity-55">frame #{frame}</span>
        </div>

        {/* Mode tint — the cat keeps its palette; the UI accents follow the mode */}
        <div className="mt-5">
          <p className="text-[11px] tracking-[1px] uppercase opacity-55 mb-2">Mode tint (UI only)</p>
          <div className="flex items-center gap-2">
            {MODES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => pickMode(m)}
                className="px-3 h-8 rounded-full text-[12px] font-medium capitalize"
                style={{
                  border: `1.5px solid ${mode === m ? "var(--color-mode)" : border}`,
                  background: mode === m ? "var(--color-mode)" : "transparent",
                  color: mode === m ? "#fff" : fg,
                }}
              >
                {m}
              </button>
            ))}
            <span
              className="ml-2 size-8 rounded-full"
              style={{ boxShadow: "0 0 26px 6px var(--color-mode)", background: "var(--color-mode)" }}
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Clip registry — loaded vs pending; play any that exist */}
        <div className="mt-6">
          <p className="text-[11px] tracking-[1px] uppercase opacity-55 mb-2">Clips</p>
          <div className="flex flex-col gap-1.5">
            {ALL_CLIPS.map((name) => {
              const isLoaded = loaded.includes(name);
              const sustained = SUSTAINED.includes(name);
              return (
                <div
                  key={name}
                  className="flex items-center gap-3 h-9 px-3 rounded-[12px] text-[12.5px]"
                  style={{ border: `1px solid ${border}` }}
                >
                  <span
                    className="size-2 rounded-full shrink-0"
                    style={{ background: isLoaded ? "#3fb57f" : "#8a7f70" }}
                    aria-hidden="true"
                  />
                  <span className="font-medium w-[70px]">{name}</span>
                  <span className="opacity-45 flex-1">
                    {isLoaded ? (name === "idle" ? "base · looping" : sustained ? "sustained loop" : "one-shot") : "pending — drop in workshop"}
                  </span>
                  {isLoaded && name !== "idle" && (
                    <button
                      type="button"
                      onClick={() => hefesto.current?.play(name)}
                      className="px-3 h-7 rounded-full text-[11px] font-medium"
                      style={{ background: "var(--color-mode)", color: "#fff" }}
                    >
                      Play
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => hefesto.current?.stop()}
            className="mt-2 px-3 h-7 rounded-full text-[11px] font-medium"
            style={{ border: `1px solid ${border}`, color: fg }}
          >
            Stop → idle
          </button>
        </div>
      </div>

      {/* Hero — the reveal frame */}
      <div className="relative flex-1 w-full grid place-items-center py-10">
        <EmberGlow className="w-[320px] h-[160px] opacity-70" />
        <div className="relative">
          <Hefesto ref={hefesto} scale={scale} mode={mode} onReady={({ clips }) => setLoaded(clips)} />
        </div>
      </div>

      {/* Integer-scale reference row */}
      <div className="w-full max-w-[620px] px-6 pb-12 flex items-end justify-center gap-8">
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

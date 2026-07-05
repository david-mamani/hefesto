"use client";

import { useEffect, useRef } from "react";

/*
 * Hefesto — the 8-bit mascot engine.
 *
 * Pixel-art rules (PRD §21): integer scaling only, imageSmoothingEnabled=false,
 * the whole sprite redrawn each frame. Plays a clip JSON when one exists; until
 * the hand-drawn idle.json lands it falls back to the static sprite with a gentle
 * procedural "breath" so the cat is alive, not frozen. Pauses off-viewport
 * (IntersectionObserver) and with prefers-reduced-motion.
 *
 * Clip contract: { w, h, palette:[null,"#..",..], frames?:number[][],
 *                  sequence?:[{frame,ms}], loop?, indices?:number[] (static) }
 */

type Clip = {
  w: number;
  h: number;
  palette: (string | null)[];
  indices?: number[];
  frames?: number[][];
  sequence?: { frame: number; ms: number }[];
  loop?: boolean;
};

// Procedural idle for a single-frame sprite: a slow 1px settle reads as breathing.
const BREATH = [
  { frame: 0, ms: 1000, off: 0 },
  { frame: 0, ms: 560, off: 1 },
];

async function loadClip(src?: string): Promise<Clip | null> {
  const candidates = src ? [src] : ["/mascot/idle.json", "/mascot/hefesto-static.json"];
  for (const url of candidates) {
    try {
      const res = await fetch(url);
      if (res.ok) return (await res.json()) as Clip;
    } catch {
      // try next candidate
    }
  }
  return null;
}

export function HefestoSprite({
  scale = 6,
  src,
  className,
}: {
  scale?: number;
  src?: string;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    let io: IntersectionObserver | null = null;

    (async () => {
      const clip = await loadClip(src);
      const canvas = canvasRef.current;
      if (cancelled || !clip || !canvas) return;

      const dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));
      const cell = scale * dpr;
      canvas.width = clip.w * cell;
      canvas.height = clip.h * cell;
      canvas.style.width = `${clip.w * scale}px`;
      canvas.style.height = `${clip.h * scale}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;

      const frames =
        clip.frames && clip.frames.length ? clip.frames : clip.indices ? [clip.indices] : [];
      if (!frames.length) return;

      const animated = frames.length > 1 && !!clip.sequence?.length;
      const seq: { frame: number; ms: number; off: number }[] = animated
        ? clip.sequence!.map((s) => ({ frame: s.frame, ms: s.ms, off: 0 }))
        : BREATH;
      const loop = clip.loop ?? true;

      const drawFrame = (indices: number[], yOff: number) => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const oy = yOff * cell;
        for (let i = 0; i < indices.length; i++) {
          const color = clip.palette[indices[i]];
          if (!color) continue;
          ctx.fillStyle = color;
          ctx.fillRect((i % clip.w) * cell, Math.floor(i / clip.w) * cell + oy, cell, cell);
        }
      };

      // Paint frame 0 immediately so the sprite is never blank — even off-viewport
      // or before the animation loop starts. The loop only drives the motion.
      drawFrame(frames[0], 0);
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      let step = 0;
      let acc = 0;
      let last = 0;
      let visible = true;

      const tick = (now: number) => {
        if (cancelled || !visible) {
          raf = 0;
          return;
        }
        if (last === 0) last = now;
        acc += now - last;
        last = now;

        const cur = seq[step % seq.length];
        if (acc >= cur.ms) {
          acc = 0;
          if (loop || step < seq.length - 1) step++;
        }
        const active = seq[step % seq.length];
        drawFrame(frames[active.frame] ?? frames[0], active.off);
        raf = requestAnimationFrame(tick);
      };

      const start = () => {
        if (!raf) {
          last = 0;
          raf = requestAnimationFrame(tick);
        }
      };

      io = new IntersectionObserver(
        ([entry]) => {
          visible = entry.isIntersecting;
          if (visible) start();
          else {
            cancelAnimationFrame(raf);
            raf = 0;
          }
        },
        { threshold: 0 }
      );
      io.observe(canvas);
      start();
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      io?.disconnect();
    };
  }, [scale, src]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ imageRendering: "pixelated" }}
      aria-hidden="true"
    />
  );
}

// The engine is the mascot — <Hefesto/> reads better at call sites (Home, Chat, /dev).
export const Hefesto = HefestoSprite;

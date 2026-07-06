"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  BASE_CLIP,
  CLIP_FILES,
  SUSTAINED,
  applyMode,
  loadClip,
  loadManifest,
  type ClipName,
  type Mode,
  type RawClip,
} from "@/lib/mascot";

/*
 * Hefesto — the 8-bit mascot engine (PRD §21-§22).
 *
 * A canvas + rAF game loop with a delta-time accumulator. Integer scaling only,
 * imageSmoothingEnabled=false, the whole sprite redrawn each frame. A small state
 * machine plays a looping base (idle), sustained loops (typing), and one-shots
 * that return to idle; play() while busy queues. The imperative handle exposes
 * play / setMode / stop / on. setMode tints the UI via CSS — never the cat.
 * Pauses off-viewport (IntersectionObserver) and with prefers-reduced-motion.
 */

export type HefestoHandle = {
  play: (name: ClipName, opts?: { queue?: boolean }) => void;
  setMode: (mode: Mode) => void;
  stop: () => void;
  currentFrame: () => number;
  currentClip: () => string | null;
  loadedClips: () => string[];
  on: (event: "click" | "hover", cb: () => void) => () => void;
};

type Frame = { frame: number; ms: number; off: number };
type NormClip = {
  name: string;
  w: number;
  h: number;
  palette: (string | null)[];
  frames: number[][];
  seq: Frame[];
  loop: boolean;
  anchor?: number;
  variants?: Frame[][];
};

// Static idle → a slow uneven 1px settle reads as breathing until a hand-drawn
// idle clip lands.
const BREATH: Frame[] = [
  { frame: 0, ms: 1100, off: 0 },
  { frame: 0, ms: 560, off: 1 },
];

function normalize(name: string, clip: RawClip): NormClip | null {
  const frames = clip.frames?.length ? clip.frames : clip.indices ? [clip.indices] : [];
  if (!frames.length) return null;
  const loop = clip.loop ?? SUSTAINED.includes(name as ClipName);

  let seq: Frame[];
  if (clip.sequence?.length && frames.length > 1) {
    seq = clip.sequence.map((s) => ({ frame: s.frame, ms: s.ms, off: 0 }));
  } else if (name === BASE_CLIP) {
    seq = BREATH;
  } else {
    seq = [{ frame: 0, ms: 400, off: 0 }];
  }
  const variants = clip.variants?.map((v) => v.map((s) => ({ frame: s.frame, ms: s.ms, off: 0 })));
  return { name, w: clip.w, h: clip.h, palette: clip.palette, frames, seq, loop, anchor: clip.anchor, variants };
}

class MascotEngine {
  private ctx: CanvasRenderingContext2D;
  private cell: number;
  private clips = new Map<string, NormClip>();
  private active: NormClip | null = null;
  private queue: string[] = [];
  private pendingAnchor: string | null = null;
  private baseStep = 0; // where the base loop was when a one-shot took over
  private seqOverride: Frame[] | null = null; // the variant chosen for this play
  private step = 0;
  private acc = 0;
  private last = 0;
  private raf = 0;
  private visible = true;
  private running = false;
  private sized = false;
  readonly reduced: boolean;

  constructor(
    private canvas: HTMLCanvasElement,
    private scale: number,
    dpr: number,
    reduced: boolean
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d context unavailable");
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;
    this.cell = scale * dpr;
    this.reduced = reduced;
  }

  add(clip: NormClip) {
    this.clips.set(clip.name, clip);
    // The base pose defines the canvas size and the first painted frame.
    if (clip.name === BASE_CLIP && !this.sized) {
      this.resizeTo(clip);
      this.active = clip;
      this.draw();
    } else if (!this.active && !this.sized) {
      // No base yet — show whatever arrived first so it's never blank.
      this.resizeTo(clip);
      this.active = clip;
      this.draw();
    }
  }

  private resizeTo(clip: NormClip) {
    this.canvas.width = clip.w * this.cell;
    this.canvas.height = clip.h * this.cell;
    this.canvas.style.width = `${clip.w * this.scale}px`;
    this.canvas.style.height = `${clip.h * this.scale}px`;
    this.ctx.imageSmoothingEnabled = false;
    this.sized = true;
  }

  private base(): NormClip | null {
    return this.clips.get(BASE_CLIP) ?? this.active;
  }

  play(name: string, opts?: { queue?: boolean }) {
    const clip = this.clips.get(name);
    if (!clip || this.reduced) return;
    if (this.active && this.active.name === name && clip.loop) return; // already sustained
    if (this.active && !this.active.loop && opts?.queue !== false) {
      // A one-shot is mid-flight — let it finish, then chain.
      this.queue.push(name);
    } else if (
      clip.anchor != null &&
      this.active?.name === BASE_CLIP &&
      this.seq()[this.step]?.frame !== clip.anchor
    ) {
      // Anchored clip requested off-pose: hold it until the base loop rests on
      // its anchor frame, so the swap is pixel-continuous (no pose jump).
      this.pendingAnchor = name;
    } else {
      // From the base on-pose, from a sustained state (a direct mode swap —
      // all states share the rest-pose body), or unanchored.
      this.startClip(clip);
    }
    this.ensureRunning();
  }

  /** The sequence currently driving the active clip (a chosen variant or the default). */
  private seq(): Frame[] {
    return this.seqOverride ?? this.active?.seq ?? [];
  }

  private startClip(clip: NormClip) {
    if (this.active && this.active.name === BASE_CLIP) this.baseStep = this.step;
    this.active = clip;
    // One-shots with variants play a randomly chosen sequence each time, so
    // repeated fires read as natural motion instead of a mechanical loop.
    this.seqOverride = clip.variants?.length
      ? clip.variants[Math.floor(Math.random() * clip.variants.length)]
      : null;
    this.step = 0;
    this.acc = 0;
  }

  private returnToBase() {
    const b = this.base();
    this.active = b;
    this.seqOverride = null;
    // Resume the base loop on the pose the one-shot was anchored over —
    // restarting its hold — so there is never a pose jump.
    this.step = b && this.baseStep < b.seq.length ? this.baseStep : 0;
  }

  stop() {
    this.queue = [];
    this.pendingAnchor = null;
    if (this.base()) {
      this.returnToBase();
      this.acc = 0;
    }
  }

  private advance() {
    if (!this.active) return;
    const seq = this.seq();
    if (this.acc < seq[this.step].ms) return;
    this.acc = 0;
    this.step++;
    if (this.step >= seq.length) {
      if (this.active.loop) {
        this.step = 0;
      } else if (this.queue.length) {
        const next = this.clips.get(this.queue.shift()!);
        if (next) {
          this.startClip(next);
        } else {
          this.returnToBase();
        }
      } else {
        this.returnToBase();
      }
    }
    // Fire a pending anchored one-shot the moment the base rests on its anchor.
    if (this.pendingAnchor && this.active && this.active.name === BASE_CLIP) {
      const pending = this.clips.get(this.pendingAnchor);
      if (pending && this.seq()[this.step]?.frame === pending.anchor) {
        this.pendingAnchor = null;
        this.startClip(pending);
      }
    }
  }

  private draw() {
    if (!this.active) return;
    const c = this.active;
    const seq = this.seq();
    const cur = seq[this.step] ?? seq[0];
    const indices = c.frames[cur.frame] ?? c.frames[0];
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const oy = cur.off * this.cell;
    for (let i = 0; i < indices.length; i++) {
      const color = c.palette[indices[i]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect((i % c.w) * this.cell, Math.floor(i / c.w) * this.cell + oy, this.cell, this.cell);
    }
  }

  private tick = (now: number) => {
    if (!this.running || !this.visible) {
      this.raf = 0;
      return;
    }
    if (this.last === 0) this.last = now;
    this.acc += now - this.last;
    this.last = now;
    this.advance();
    this.draw();
    this.raf = requestAnimationFrame(this.tick);
  };

  private ensureRunning() {
    if (this.reduced) {
      this.draw();
      return;
    }
    this.running = true;
    if (!this.raf && this.visible) {
      this.last = 0;
      this.raf = requestAnimationFrame(this.tick);
    }
  }

  start() {
    this.ensureRunning();
  }

  setVisible(v: boolean) {
    this.visible = v;
    if (v) this.ensureRunning();
    else {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.running = false;
  }

  currentFrame() {
    return this.active ? this.seq()[this.step]?.frame ?? 0 : 0;
  }

  currentClip() {
    return this.active?.name ?? null;
  }

  loadedNames() {
    return [...this.clips.keys()];
  }
}

export const HefestoSprite = forwardRef<
  HefestoHandle,
  {
    scale?: number;
    className?: string;
    mode?: Mode;
    onReady?: (info: { clips: string[] }) => void;
  }
>(function HefestoSprite({ scale = 6, className, mode, onReady }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<MascotEngine | null>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useImperativeHandle(
    ref,
    () => ({
      play: (name, opts) => engineRef.current?.play(name, opts),
      setMode: (m) => applyMode(m),
      stop: () => engineRef.current?.stop(),
      currentFrame: () => engineRef.current?.currentFrame() ?? 0,
      currentClip: () => engineRef.current?.currentClip() ?? null,
      loadedClips: () => engineRef.current?.loadedNames() ?? [],
      on: (event, cb) => {
        const el = canvasRef.current;
        if (!el) return () => {};
        const type = event === "hover" ? "mouseenter" : "click";
        el.addEventListener(type, cb);
        return () => el.removeEventListener(type, cb);
      },
    }),
    []
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    const dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let engine: MascotEngine;
    try {
      engine = new MascotEngine(canvas, scale, dpr, reduced);
    } catch {
      return;
    }
    engineRef.current = engine;

    (async () => {
      // The manifest declares which clips exist, so we never fire 404s for art
      // the workshop hasn't drawn yet.
      const manifest = await loadManifest();
      if (cancelled) return;

      // Base pose: the hand-drawn idle once the workshop ships it (listed in the
      // manifest), else the static sprite with a procedural breath.
      const baseRaw =
        (manifest.includes("idle") && (await loadClip("idle.json"))) ||
        (await loadClip("hefesto-static.json"));
      if (cancelled) return;
      if (baseRaw) {
        const baseN = normalize("idle", baseRaw);
        if (baseN) engine.add(baseN);
      }

      // One-shots + sustained clips the workshop has exported.
      for (const name of manifest) {
        if (name === "idle") continue;
        const rc = await loadClip(CLIP_FILES[name]);
        if (cancelled || !rc) continue;
        const n = normalize(name, rc);
        if (n) engine.add(n);
      }
      if (cancelled) return;
      engine.start();
      onReadyRef.current?.({ clips: engine.loadedNames() });
    })();

    const io = new IntersectionObserver(([entry]) => engine.setVisible(entry.isIntersecting), {
      threshold: 0,
    });
    io.observe(canvas);

    return () => {
      cancelled = true;
      io.disconnect();
      engine.destroy();
      engineRef.current = null;
    };
  }, [scale]);

  useEffect(() => {
    if (mode) applyMode(mode);
  }, [mode]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ imageRendering: "pixelated" }}
      aria-hidden="true"
    />
  );
});

// The engine is the mascot — <Hefesto/> reads better at call sites (Home, Chat, /dev).
export const Hefesto = HefestoSprite;

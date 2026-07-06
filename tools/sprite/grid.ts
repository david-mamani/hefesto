/*
 * Sprite workshop — grid operations over the 32×36 indexed-palette contract
 * (PRD §21). Frames are row-major index arrays (indices[y*w+x]), palette[0]=null
 * means transparent. Every op returns a NEW frame; sources are never mutated.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type Palette = (string | null)[];

export type ClipFile = {
  name?: string;
  w: number;
  h: number;
  palette: Palette;
  indices?: number[];
  frames?: number[][];
  sequence?: { frame: number; ms: number }[];
  loop?: boolean;
};

export const W = 32;
export const H = 36;

export function assertFrame(frame: number[], paletteSize: number, label = "frame"): void {
  if (frame.length !== W * H) {
    throw new Error(`${label}: expected ${W * H} indices, got ${frame.length}`);
  }
  for (let i = 0; i < frame.length; i++) {
    const v = frame[i];
    if (!Number.isInteger(v) || v < 0 || v >= paletteSize) {
      throw new Error(`${label}: bad index ${v} at (${i % W},${Math.floor(i / W)})`);
    }
  }
}

export function loadClipFile(path: string): ClipFile {
  return JSON.parse(readFileSync(path, "utf8")) as ClipFile;
}

export function saveClipFile(path: string, clip: ClipFile): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(clip));
}

export const at = (frame: number[], x: number, y: number): number =>
  x >= 0 && x < W && y >= 0 && y < H ? frame[y * W + x] : 0;

/** Shift full rows y0..y1 (inclusive) by dy. Vacated rows become transparent. */
export function shiftRows(frame: number[], y0: number, y1: number, dy: number): number[] {
  return shiftRegion(frame, 0, y0, W - 1, y1, 0, dy);
}

/**
 * Shift the rectangle (x0,y0)..(x1,y1) by (dx,dy). The vacated area is cleared;
 * pixels shifted outside the grid are dropped. Pixels already outside the
 * rectangle are left untouched (the moved block overwrites its destination).
 */
export function shiftRegion(
  frame: number[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  dx: number,
  dy: number
): number[] {
  const out = frame.slice();
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out[y * W + x] = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const v = frame[y * W + x];
      if (v === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      out[ny * W + nx] = v;
    }
  }
  return out;
}

/** Copy the rectangle as a patch: rows of indices plus its origin. */
export function copyRegion(
  frame: number[],
  x0: number,
  y0: number,
  x1: number,
  y1: number
): { x: number; y: number; rows: number[][] } {
  const rows: number[][] = [];
  for (let y = y0; y <= y1; y++) {
    const row: number[] = [];
    for (let x = x0; x <= x1; x++) row.push(frame[y * W + x]);
    rows.push(row);
  }
  return { x: x0, y: y0, rows };
}

/** Paste a patch at (x,y). Transparent patch pixels overwrite too (true stamp). */
export function pasteRegion(
  frame: number[],
  patch: { rows: number[][] },
  x: number,
  y: number
): number[] {
  const out = frame.slice();
  patch.rows.forEach((row, ry) => {
    row.forEach((v, rx) => {
      const px = x + rx;
      const py = y + ry;
      if (px >= 0 && px < W && py >= 0 && py < H) out[py * W + px] = v;
    });
  });
  return out;
}

/** Mirror the rectangle horizontally in place. */
export function mirrorRegionH(
  frame: number[],
  x0: number,
  y0: number,
  x1: number,
  y1: number
): number[] {
  const out = frame.slice();
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      out[y * W + x] = frame[y * W + (x1 - (x - x0))];
    }
  }
  return out;
}

/** Swap palette index `from` → `to` inside the rectangle. */
export function swapIndices(
  frame: number[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  from: number,
  to: number
): number[] {
  const out = frame.slice();
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (out[y * W + x] === from) out[y * W + x] = to;
    }
  }
  return out;
}

/** Set explicit pixels: [x, y, index] triples. */
export function setPixels(frame: number[], pixels: [number, number, number][]): number[] {
  const out = frame.slice();
  for (const [x, y, v] of pixels) {
    if (x >= 0 && x < W && y >= 0 && y < H) out[y * W + x] = v;
  }
  return out;
}

/** Compose a new frame = base + region patches (workshop rule: never redraw what doesn't change). */
export function compose(
  base: number[],
  patches: { x: number; y: number; rows: number[][] }[]
): number[] {
  return patches.reduce((acc, p) => pasteRegion(acc, p, p.x, p.y), base.slice());
}

const GLYPHS = [".", "o", "+", "#", "p"];

/** ASCII map of a frame for surgical review. 0='.', 1='o', 2='+', 3='#', 4='p'. */
export function toAscii(frame: number[], onlyRows?: [number, number]): string {
  const [r0, r1] = onlyRows ?? [0, H - 1];
  const lines: string[] = [];
  for (let y = r0; y <= r1; y++) {
    let line = "";
    for (let x = 0; x < W; x++) line += GLYPHS[frame[y * W + x]] ?? "?";
    lines.push(`${String(y).padStart(2, " ")} ${line}`);
  }
  return lines.join("\n");
}

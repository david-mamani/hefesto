/*
 * Sprite workshop — frame comparator. Lists exactly which pixels change between
 * two frames so edits can be reviewed surgically, and detects whole-band
 * vertical shifts (the most common breathing/bob move).
 */
import { W, H } from "./grid";

export type PixelDiff = { x: number; y: number; a: number; b: number };

export function diffFrames(a: number[], b: number[]): PixelDiff[] {
  const out: PixelDiff[] = [];
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) out.push({ x: i % W, y: Math.floor(i / W), a: a[i], b: b[i] });
  }
  return out;
}

/** Group diffs by row: "row 10: 6px (cols 11-20)". */
export function summarize(diffs: PixelDiff[]): string {
  if (!diffs.length) return "  identical";
  const byRow = new Map<number, PixelDiff[]>();
  for (const d of diffs) {
    const arr = byRow.get(d.y) ?? [];
    arr.push(d);
    byRow.set(d.y, arr);
  }
  const lines: string[] = [`  ${diffs.length}px changed across ${byRow.size} rows`];
  for (const [y, arr] of [...byRow.entries()].sort((p, q) => p[0] - q[0])) {
    const cols = arr.map((d) => d.x);
    lines.push(`  row ${String(y).padStart(2, " ")}: ${arr.length}px (cols ${Math.min(...cols)}-${Math.max(...cols)})`);
  }
  return lines.join("\n");
}

/**
 * Check whether b equals a with the row band y0..y1 shifted down by dy
 * (transparent fill behind). Returns the mismatch count for the hypothesis.
 */
export function shiftMismatch(a: number[], b: number[], y0: number, y1: number, dy: number): number {
  let bad = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const src = y - dy;
      const expected = y >= y0 + dy && y <= y1 + dy && src >= 0 && src < H
        ? a[src * W + x]
        : y >= y0 && y <= y1
          ? 0
          : a[y * W + x];
      if (b[y * W + x] !== expected) bad++;
    }
  }
  return bad;
}

/** Rows that differ at all — quick band finder. */
export function changedRows(diffs: PixelDiff[]): number[] {
  return [...new Set(diffs.map((d) => d.y))].sort((a, b) => a - b);
}

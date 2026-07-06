/*
 * Repair of idle frame 1 (the head-up rest pose), always rebuilt from the
 * as-received original so the fixes are idempotent and reviewable:
 *
 * 1. Rigid glasses box — the frame arrived with the bottom bar one row low
 *    (box rows 8-15 = 8 tall; every other frame keeps 7). Per the cycle's own
 *    logic (glasses ride up: 8-14 / settle low: 9-15) the bar moves 15 → 14
 *    and row 15 returns to chin fur.
 * 2. Single-row bridge — the bar joining the lenses must be 1px thick like in
 *    every other frame. Riding up, it belongs at row 10; the duplicate at
 *    row 11 (cols 14-15) opens back to fur.
 *
 *   npx tsx tools/sprite/fix-idle-f1.ts
 */
import { readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { W, toAscii, type ClipFile } from "./grid";

const SRC = join(__dirname, "src", "idle-frames.json");
const ORIGINAL = join(__dirname, "src", "idle-frames.original.json");

if (!existsSync(ORIGINAL)) copyFileSync(SRC, ORIGINAL);

const frames = JSON.parse(readFileSync(ORIGINAL, "utf8")) as ClipFile[];
const f1 = frames[1].indices!;

const row = (frame: number[], y: number) => frame.slice(y * W, (y + 1) * W);
const setRow = (frame: number[], y: number, values: number[]) => {
  for (let x = 0; x < W; x++) frame[y * W + x] = values[x];
};

console.log("f1 AS RECEIVED:\n" + toAscii(f1, [6, 17]));

// 1. Box: bottom bar 15 → 14, chin fur back at 15.
const bottomBar = row(f1, 15);
const chinFur = row(f1, 16);
setRow(f1, 14, bottomBar);
setRow(f1, 15, chinFur);

// 2. Bridge: open the duplicated closed-bridge row (row 11, cols 14-15 → fur).
f1[11 * W + 14] = 1;
f1[11 * W + 15] = 1;

console.log("\nf1 REPAIRED (box 8-14, bridge only at row 10):\n" + toAscii(f1, [6, 17]));

writeFileSync(SRC, JSON.stringify(frames));
console.log("\nsource updated → src/idle-frames.json (original untouched at src/idle-frames.original.json)");

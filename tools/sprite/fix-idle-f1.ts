/*
 * Repair of idle frame 1 (the head-up rest pose), always rebuilt from the
 * as-received original so the fixes are idempotent and reviewable.
 *
 * The whiskers are THREE pairs glued to the FACE (head up: rows 11/13/15;
 * head down: 12/14/16). When the glasses sit low their bottom bar merges with
 * the third pair into the wide fused bar; when they ride up, the bar leaves
 * ALONE and the whiskers stay on the face — exactly what frame 3 (glasses up,
 * head down) already shows. Fixes on the original frame 1:
 *
 * 1. Rigid glasses box — the bottom bar moves 15 → 14 NARROW (cols 7-22,
 *    frame-3's own bar pattern), leaving the whiskers behind.
 * 2. Third whisker pair stays with the face at row 15 (frame 2's row-16
 *    pattern: whiskers + fur).
 * 3. Single-row bridge — the duplicate closed-bridge row (row 11, cols 14-15)
 *    opens back to fur; riding up, the bridge belongs at row 10 only.
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
const f2 = frames[2].indices!;
const f3 = frames[3].indices!;

const row = (frame: number[], y: number) => frame.slice(y * W, (y + 1) * W);
const setRow = (frame: number[], y: number, values: number[]) => {
  for (let x = 0; x < W; x++) frame[y * W + x] = values[x];
};

console.log("f1 AS RECEIVED:\n" + toAscii(f1, [6, 17]));

// 1. Bottom bar 15 → 14, NARROW — authoritative pattern: frame 3's bar (row 15).
setRow(f1, 14, row(f3, 15));

// 2. Whiskers stay on the face at row 15 — frame 2's whiskers+fur row (16).
setRow(f1, 15, row(f2, 16));

// 3. Bridge: open the duplicated closed-bridge row (row 11, cols 14-15 → fur).
f1[11 * W + 14] = 1;
f1[11 * W + 15] = 1;

console.log("\nf1 REPAIRED (bar 8-14 narrow, whiskers 11/13/15 on the face, bridge at 10):\n" + toAscii(f1, [6, 17]));

writeFileSync(SRC, JSON.stringify(frames));
console.log("\nsource updated → src/idle-frames.json (original untouched at src/idle-frames.original.json)");

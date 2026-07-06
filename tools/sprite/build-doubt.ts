/*
 * Doubt — a solid black "?" pops up beside the head, holds, and vanishes.
 * Fires randomly between breaths at long intervals (ambient, rarer than
 * blink/tail). One-shot on idle frame 1, anchored.
 *
 *   npx tsx tools/sprite/build-doubt.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { setPixels, toAscii, saveClipFile, type ClipFile } from "./grid";
import { diffFrames, summarize } from "./diff";
import { stripPng, sequenceGif } from "./preview";

const ROOT = join(__dirname, "..", "..");
const OUT = join(__dirname, "out");
const src = JSON.parse(
  readFileSync(join(__dirname, "src", "idle-frames.json"), "utf8")
) as ClipFile[];
const rest = src[1].indices!;
const palette = src[1].palette;

// A 5×7 question mark at the top-right, clear of ears, whiskers and tail.
const GLYPH: [number, number][] = [
  [25, 1], [26, 1], [27, 1],
  [24, 2], [28, 2],
  [28, 3],
  [27, 4],
  [26, 5],
  [26, 7],
];

const held = setPixels(rest, GLYPH.map(([x, y]) => [x, y, 3] as [number, number, number]));

const SEQUENCE = [{ frame: 0, ms: 1400 }];

console.log("rest → held:");
console.log(summarize(diffFrames(rest, held)));
console.log("\nheld, glyph zone (rows 0-8):");
console.log(toAscii(held, [0, 8]));

stripPng(join(OUT, "doubt-strip.png"), [rest, held], palette, 8);
sequenceGif(join(OUT, "doubt.gif"), [rest, held], [
  { frame: 0, ms: 1200 },
  { frame: 1, ms: 1400 },
  { frame: 0, ms: 1200 },
], palette, 8);

const clip: ClipFile & { anchor: number } = {
  name: "doubt",
  w: 32,
  h: 36,
  palette,
  frames: [held],
  sequence: SEQUENCE,
  loop: false,
  anchor: 1,
};
saveClipFile(join(ROOT, "public", "mascot", "doubt.json"), clip);
console.log("\npreviews → out/doubt-strip.png · out/doubt.gif");
console.log("exported → public/mascot/doubt.json (one-shot, anchor: idle f1)");

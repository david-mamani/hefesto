/*
 * Alert — same pattern as doubt but with a solid black "!" beside the head:
 * pops, holds, vanishes. Fired by domain events (a briefing opens, an
 * important nudge). One-shot on idle frame 1, anchored.
 *
 *   npx tsx tools/sprite/build-alert.ts
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

// A 2px-wide exclamation mark in the same top-right spot as the "?".
const GLYPH: [number, number][] = [
  [26, 1], [27, 1],
  [26, 2], [27, 2],
  [26, 3], [27, 3],
  [26, 4], [27, 4],
  [26, 6], [27, 6],
];

const held = setPixels(rest, GLYPH.map(([x, y]) => [x, y, 3] as [number, number, number]));

const SEQUENCE = [{ frame: 0, ms: 1400 }];

console.log("rest → held:");
console.log(summarize(diffFrames(rest, held)));
console.log("\nheld, glyph zone (rows 0-8):");
console.log(toAscii(held, [0, 8]));

stripPng(join(OUT, "alert-strip.png"), [rest, held], palette, 8);
sequenceGif(join(OUT, "alert.gif"), [rest, held], [
  { frame: 0, ms: 1200 },
  { frame: 1, ms: 1400 },
  { frame: 0, ms: 1200 },
], palette, 8);

const clip: ClipFile & { anchor: number } = {
  name: "alert",
  w: 32,
  h: 36,
  palette,
  frames: [held],
  sequence: SEQUENCE,
  loop: false,
  anchor: 1,
};
saveClipFile(join(ROOT, "public", "mascot", "alert.json"), clip);
console.log("\npreviews → out/alert-strip.png · out/alert.gif");
console.log("exported → public/mascot/alert.json (one-shot, anchor: idle f1)");

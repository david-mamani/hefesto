/*
 * Blink — art direction: quick, the eyes simply DISAPPEAR for an instant.
 * Built on idle frame 1 (the 2s head-up rest pose) and anchored to it, so the
 * engine fires it only while idle sits in that pose — no 1px jump ever.
 * Pupils in f1: the 2×2 dark blocks at rows 10-11, cols 10-11 and 18-19.
 *
 *   npx tsx tools/sprite/build-blink.ts
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
const rest = src[1].indices!; // idle f1 — the long head-up rest pose
const palette = src[1].palette;

const PUPILS: [number, number][] = [
  [10, 10], [11, 10], [18, 10], [19, 10],
  [10, 11], [11, 11], [18, 11], [19, 11],
];

// Eyes gone — pupils become fur for a blink of time.
const noEyes = setPixels(rest, PUPILS.map(([x, y]) => [x, y, 1] as [number, number, number]));

// Art direction: FAST — the eyes vanish for a heartbeat.
const SEQUENCE = [{ frame: 0, ms: 70 }];

console.log("rest (idle f1) → eyes-gone:");
console.log(summarize(diffFrames(rest, noEyes)));
console.log("\neyes-gone, eye zone (rows 8-14):");
console.log(toAscii(noEyes, [8, 14]));

stripPng(join(OUT, "blink-strip.png"), [rest, noEyes], palette, 8);
sequenceGif(join(OUT, "blink.gif"), [rest, noEyes], [
  { frame: 0, ms: 1400 },
  { frame: 1, ms: 70 },
  { frame: 0, ms: 1400 },
  { frame: 1, ms: 70 },
], palette, 8);

const clip: ClipFile & { anchor: number } = {
  name: "blink",
  w: 32,
  h: 36,
  palette,
  frames: [noEyes],
  sequence: SEQUENCE,
  loop: false,
  anchor: 1, // fires only while idle rests on frame 1
};
saveClipFile(join(ROOT, "public", "mascot", "blink.json"), clip);
console.log("\npreviews → out/blink-strip.png · out/blink.gif");
console.log("exported → public/mascot/blink.json (anchor: idle f1)");

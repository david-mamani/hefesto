/*
 * Tail flick (approved) — rebuilt on idle frame 1 (the 2s head-up rest pose)
 * and anchored to it so it never causes a pose jump. The tail is the 2px
 * column at cols 24-25: dark tip rows 18-19, shaft rows 20-23.
 *
 *   curl1: tip (rows 18-19) bends right 1px — attached diagonally
 *   curl2: the very tip (row 18) bends right one more — a soft whip curl
 *
 *   npx tsx tools/sprite/build-tail.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { shiftRegion, toAscii, saveClipFile, type ClipFile } from "./grid";
import { diffFrames, summarize } from "./diff";
import { stripPng, sequenceGif } from "./preview";

const ROOT = join(__dirname, "..", "..");
const OUT = join(__dirname, "out");
const src = JSON.parse(
  readFileSync(join(__dirname, "src", "idle-frames.json"), "utf8")
) as ClipFile[];
const rest = src[1].indices!; // idle f1 — the long head-up rest pose
const palette = src[1].palette;

const curl1 = shiftRegion(rest, 24, 18, 25, 19, 1, 0);
const curl2 = shiftRegion(curl1, 25, 18, 26, 18, 1, 0);
// curlIn: the tip leans the other way, toward the body — cols 23-24.
const curlIn = shiftRegion(rest, 24, 18, 25, 19, -1, 0);

// Default whip (also the preview sequence).
const SEQUENCE = [
  { frame: 0, ms: 140 },
  { frame: 1, ms: 180 },
  { frame: 0, ms: 140 },
];

// Art direction: varied, natural motion — the engine picks one at random per
// play. frames: 0=curl1 (out), 1=curl2 (far out), 2=curlIn (toward the body).
const VARIANTS = [
  SEQUENCE, // classic whip
  [ // double flick — energetic
    { frame: 0, ms: 120 },
    { frame: 1, ms: 140 },
    { frame: 0, ms: 110 },
    { frame: 1, ms: 140 },
    { frame: 0, ms: 120 },
  ],
  [ // lazy sway — out, then curls in past the rest point
    { frame: 0, ms: 260 },
    { frame: 2, ms: 320 },
    { frame: 0, ms: 200 },
  ],
  [ // small twitch
    { frame: 0, ms: 200 },
  ],
  [ // slow curl inward and hold
    { frame: 2, ms: 420 },
  ],
];

console.log("rest → curl1:");
console.log(summarize(diffFrames(rest, curl1)));
console.log("\ncurl1 → curl2:");
console.log(summarize(diffFrames(curl1, curl2)));
console.log("\nrest → curlIn:");
console.log(summarize(diffFrames(rest, curlIn)));
console.log("\ncurlIn, tail zone (rows 16-27):");
console.log(toAscii(curlIn, [16, 27]));

stripPng(join(OUT, "tail-strip.png"), [rest, curl1, curl2, curlIn], palette, 8);
sequenceGif(join(OUT, "tail.gif"), [rest, curl1, curl2, curlIn], [
  { frame: 0, ms: 1000 },
  { frame: 1, ms: 140 },
  { frame: 2, ms: 180 },
  { frame: 1, ms: 140 },
  { frame: 0, ms: 900 },
  { frame: 1, ms: 260 },
  { frame: 3, ms: 320 },
  { frame: 1, ms: 200 },
  { frame: 0, ms: 1000 },
], palette, 8);

const clip: ClipFile & { anchor: number; variants: typeof VARIANTS } = {
  name: "tail",
  w: 32,
  h: 36,
  palette,
  frames: [curl1, curl2, curlIn],
  sequence: SEQUENCE,
  variants: VARIANTS,
  loop: false,
  anchor: 1, // fires only while idle rests on frame 1
};
saveClipFile(join(ROOT, "public", "mascot", "tail.json"), clip);
console.log("\npreviews → out/tail-strip.png · out/tail.gif");
console.log(`exported → public/mascot/tail.json (anchor: idle f1, ${VARIANTS.length} variants)`);

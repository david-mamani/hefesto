/*
 * Listening — plays while the user records a voice note: ears perk up and
 * sound waves pulse beside them. Sustained loop on idle frame 1, anchored.
 *
 *   frame 0: soft waves (dark orange dashes)
 *   frame 1: loud waves (orange, taller) + ear tips stretch 1px higher
 *
 *   npx tsx tools/sprite/build-listening.ts
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

// Soft: a short black dash beside each ear.
const soft = setPixels(rest, [
  [5, 3, 3], [5, 4, 3],
  [26, 3, 3], [26, 4, 3],
]);

// Loud: taller black dashes + an outer echo + ear tips perked 1px higher.
const loud = setPixels(rest, [
  [5, 2, 3], [5, 3, 3], [5, 4, 3], [5, 5, 3],
  [3, 3, 3], [3, 4, 3],
  [26, 2, 3], [26, 3, 3], [26, 4, 3], [26, 5, 3],
  [28, 3, 3], [28, 4, 3],
  [8, 1, 1], [21, 1, 1], // ear tips stretch up (fur, stays orange)
]);

const SEQUENCE = [
  { frame: 0, ms: 260 },
  { frame: 1, ms: 260 },
];

console.log("rest → soft:");
console.log(summarize(diffFrames(rest, soft)));
console.log("\nrest → loud:");
console.log(summarize(diffFrames(rest, loud)));
console.log("\nloud, ear zone (rows 0-8):");
console.log(toAscii(loud, [0, 8]));

stripPng(join(OUT, "listening-strip.png"), [rest, soft, loud], palette, 8);
sequenceGif(join(OUT, "listening.gif"), [rest, soft, loud], [
  { frame: 0, ms: 700 },
  { frame: 1, ms: 260 },
  { frame: 2, ms: 260 },
  { frame: 1, ms: 260 },
  { frame: 2, ms: 260 },
  { frame: 1, ms: 260 },
], palette, 8);

const clip: ClipFile & { anchor: number } = {
  name: "listening",
  w: 32,
  h: 36,
  palette,
  frames: [soft, loud],
  sequence: SEQUENCE,
  loop: true,
  anchor: 1,
};
saveClipFile(join(ROOT, "public", "mascot", "listening.json"), clip);
console.log("\npreviews → out/listening-strip.png · out/listening.gif");
console.log("exported → public/mascot/listening.json (sustained, anchor: idle f1)");
